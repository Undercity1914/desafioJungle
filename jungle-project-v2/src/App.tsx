import {
  Outlet,
  Link,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
  useParams,
  useSearch,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Check, ChevronLeft, Heart, LogIn, LogOut, Search, ShoppingBag, UserCircle2 } from 'lucide-react'
import { Button } from './components/ui/button'
import { createOrder, fetchNftDetail, fetchNfts, fetchOrder, fetchQuote, loginUser, registerUser, updateProfile } from './lib/api'
import { nftCatalog } from './lib/mock-data'
import { getOrderStatusMeta } from './lib/utils'
import type { CartItem, Nft, Order, User } from './types'

const STORAGE_KEYS = {
  auth: 'jungle-user',
  cart: 'jungle-cart',
  session: 'jungle-session',
}

type SearchState = {
  q?: string
  sort?: string
  page?: number
  category?: string
}

type CartContextType = {
  cart: Record<string, CartItem>
  addToCart: (nft: Nft, quantity?: number) => void
  updateQuantity: (nftId: string, quantity: number) => void
  removeFromCart: (nftId: string) => void
  clearCart: () => void
  cartItems: CartItem[]
}

type AuthContextType = {
  user: User | null
  login: (nextUser: User) => void
  logout: () => void
  updateUser: (next: Partial<User>) => void
  toggleFavorite: (nftId: string) => void
  isFavorite: (nftId: string) => boolean
  addWallet: (wallet: string) => void
  setPrimaryWallet: (wallet: string) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const CartContext = createContext<CartContextType | undefined>(undefined)

const normalizeUser = (value?: Partial<User> | null): User | null => {
  if (!value) return null

  const wallets = Array.isArray(value.wallets) ? value.wallets : []
  const favorites = Array.isArray(value.favorites) ? value.favorites : []
  const primaryWallet = typeof value.primaryWallet === 'string' && value.primaryWallet
    ? value.primaryWallet
    : wallets[0] ?? ''

  return {
    id: value.id ?? '',
    name: value.name ?? '',
    email: value.email ?? '',
    avatar: value.avatar ?? '',
    primaryWallet,
    wallets,
    favorites,
  }
}

const getStoredUser = (): User | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.auth)
    const expiryRaw = localStorage.getItem(STORAGE_KEYS.session)
    if (!raw) return null

    if (expiryRaw) {
      const expiry = Number(JSON.parse(expiryRaw)?.expiresAt ?? 0)
      if (expiry && Date.now() > expiry) {
        localStorage.removeItem(STORAGE_KEYS.auth)
        localStorage.removeItem(STORAGE_KEYS.session)
        return null
      }
    }

    return normalizeUser(JSON.parse(raw) as Partial<User>)
  } catch {
    return null
  }
}

const getStoredCart = (): Record<string, CartItem> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.cart)
    return raw ? (JSON.parse(raw) as Record<string, CartItem>) : {}
  } catch {
    return {}
  }
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser)

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify(user))
      localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ expiresAt: Date.now() + 1000 * 60 * 60 * 8 }))
    } else {
      localStorage.removeItem(STORAGE_KEYS.auth)
      localStorage.removeItem(STORAGE_KEYS.session)
    }
  }, [user])

  const login = (nextUser: User) => setUser(normalizeUser(nextUser))

  const logout = () => setUser(null)

  const updateUser = (next: Partial<User>) => {
    setUser((current) => {
      if (!current) return current
      const currentWallets = Array.isArray(current.wallets) ? current.wallets : []
      const currentFavorites = Array.isArray(current.favorites) ? current.favorites : []
      const normalizedNext = normalizeUser({ ...current, ...next })
      if (!normalizedNext) return current

      return {
        ...current,
        ...normalizedNext,
        wallets: Array.isArray(next.wallets) ? next.wallets : currentWallets,
        favorites: Array.isArray(next.favorites) ? next.favorites : currentFavorites,
        primaryWallet: typeof next.primaryWallet === 'string' && next.primaryWallet ? next.primaryWallet : current.primaryWallet || currentWallets[0] || '',
      }
    })
  }

  const toggleFavorite = (nftId: string) => {
    setUser((current) => {
      if (!current) return current
      const favorites = Array.isArray(current.favorites) ? current.favorites : []
      const nextFavorites = favorites.includes(nftId)
        ? favorites.filter((item) => item !== nftId)
        : [...favorites, nftId]
      return { ...current, favorites: nextFavorites }
    })
  }

  const isFavorite = (nftId: string) => Boolean(user && (user.favorites ?? []).includes(nftId))

  const addWallet = (wallet: string) => {
    const trimmedWallet = wallet.trim()
    if (!trimmedWallet) return
    setUser((current) => {
      if (!current) return current
      const wallets = Array.isArray(current.wallets) ? current.wallets : []
      if (wallets.includes(trimmedWallet)) return current
      return {
        ...current,
        wallets: [...wallets, trimmedWallet],
        primaryWallet: current.primaryWallet || trimmedWallet,
      }
    })
  }

  const setPrimaryWallet = (wallet: string) => {
    setUser((current) => {
      if (!current) return current
      const wallets = Array.isArray(current.wallets) ? current.wallets : []
      if (!wallets.includes(wallet)) return current
      return { ...current, primaryWallet: wallet }
    })
  }

  return <AuthContext.Provider value={{ user, login, logout, updateUser, toggleFavorite, isFavorite, addWallet, setPrimaryWallet }}>{children}</AuthContext.Provider>
}

function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Record<string, CartItem>>(getStoredCart)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(cart))
  }, [cart])

  const addToCart = (nft: Nft, quantity = 1) => {
    setCart((current) => {
      const currentItem = current[nft.id] ?? { nftId: nft.id, quantity: 0, edition: 'standard' }
      return {
        ...current,
        [nft.id]: {
          ...currentItem,
          nftId: nft.id,
          quantity: Math.min(currentItem.quantity + quantity, nft.stock),
          edition: 'standard',
        },
      }
    })
  }

  const updateQuantity = (nftId: string, quantity: number) => {
    setCart((current) => {
      if (!current[nftId]) return current
      const nextQuantity = Math.max(0, quantity)
      if (nextQuantity === 0) {
        const next = { ...current }
        delete next[nftId]
        return next
      }
      return {
        ...current,
        [nftId]: {
          ...current[nftId],
          quantity: nextQuantity,
        },
      }
    })
  }

  const removeFromCart = (nftId: string) => {
    setCart((current) => {
      const next = { ...current }
      delete next[nftId]
      return next
    })
  }

  const clearCart = () => setCart({})

  const cartItems = useMemo(() => Object.values(cart), [cart])

  return (
    <CartContext.Provider value={{ cart, addToCart, updateQuantity, removeFromCart, clearCart, cartItems }}>
      {children}
    </CartContext.Provider>
  )
}

function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('AuthContext not available')
  }
  return context
}

function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('CartContext not available')
  }
  return context
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

const rootRoute = createRootRoute({
  component: () => (
    <AuthProvider>
      <CartProvider>
        <AppShell />
      </CartProvider>
    </AuthProvider>
  ),
})

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) {
      const from = `${window.location.pathname}${window.location.search}`
      navigate({ to: '/login', search: { redirect: from }, replace: true })
    }
  }, [navigate, user])

  if (!user) {
    return <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-10 text-center text-slate-300">Redirecting to login…</div>
  }

  return <>{children}</>
}

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : '',
    sort: typeof search.sort === 'string' ? search.sort : 'featured',
    page: Number(search.page ?? 1),
    category: typeof search.category === 'string' ? search.category : 'all',
  }),
  component: HomePage,
})

const nftDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$id',
  component: NftDetailPage,
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cart',
  component: CartPage,
})

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/checkout',
  component: () => <ProtectedRoute><CheckoutPage /></ProtectedRoute>,
})

const successRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/checkout/success',
  component: SuccessPage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : '/',
  }),
  component: LoginPage,
})

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : '/',
  }),
  component: SignupPage,
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: () => <ProtectedRoute><ProfilePage /></ProtectedRoute>,
})

const walletRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wallets',
  component: () => <ProtectedRoute><WalletPage /></ProtectedRoute>,
})

const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '*',
  component: NotFoundPage,
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  nftDetailRoute,
  cartRoute,
  checkoutRoute,
  successRoute,
  loginRoute,
  signupRoute,
  profileRoute,
  walletRoute,
  notFoundRoute,
])

const router = createRouter({ routeTree })

function AppShell() {
  const { user, logout } = useAuth()
  const { cartItems, clearCart } = useCart()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    clearCart()
    queryClient.clear()
  }

  return (
    <div className="min-h-screen bg-[#070b16] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070b16]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 font-semibold tracking-[0.2em] text-white/90 uppercase">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-orange-400/50 bg-orange-500/10 text-orange-300">
              J
            </div>
            Jungle
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <Link to="/" className="hover:text-white">Discover</Link>
            <Link to="/wallets" className="hover:text-white">Wallets</Link>
            <Link to="/profile" className="hover:text-white">Profile</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="hidden sm:inline-flex border-white bg-white text-black hover:bg-white hover:text-black"
              onPress={() => navigate({ to: '/cart' })}
            >
              <ShoppingBag className="mr-2 h-4 w-4" />
              {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
            </Button>
            {user ? (
              <>
                <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 md:flex">
                  <UserCircle2 className="h-4 w-4" />
                  {user.name}
                </div>
                <Button variant="ghost" onPress={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </>
            ) : (
              <Button onPress={() => navigate({ to: '/login' })}>
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}

function HomePage() {
  const navigate = useNavigate()
  const search = useSearch({ from: homeRoute.fullPath })
  const page = Number(search.page ?? 1)
  const q = String(search.q ?? '')
  const sort = String(search.sort ?? 'featured')
  const category = String(search.category ?? 'all')

  const { addToCart } = useCart()
  const { user, toggleFavorite, isFavorite } = useAuth()
  const query = useQuery({
    queryKey: ['nfts', { q, sort, page, category }],
    queryFn: () =>
      fetchNfts({
        q,
        sort,
        page,
        category,
      }),
  })

  const nfts: Nft[] = query.data?.items ?? nftCatalog
  const totalNfts = query.data?.total ?? nftCatalog.length

  const updateFilters = (next: Partial<SearchState>) => {
    navigate({
      to: '/',
      search: (prev: SearchState) => ({
        ...prev,
        ...next,
        page: next.page ?? 1,
      }),
    })
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-r from-slate-900 to-slate-800 p-8 shadow-2xl shadow-purple-950/40">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-purple-300">Curated drops</p>
            <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">Find the next icon in your collection</h1>
          </div>
          <div className="flex w-full max-w-md items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={q}
              aria-label="Search NFTs"
              placeholder="Search by title or artist"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
              onChange={(event) => updateFilters({ q: event.target.value })}
            />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-slate-300">Category</label>
          <select
            value={category}
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            onChange={(event) => updateFilters({ category: event.target.value })}
          >
            <option value="all">All</option>
            <option value="Helmet">Helmet</option>
            <option value="Landscape">Landscape</option>
            <option value="Portrait">Portrait</option>
            <option value="Architecture">Architecture</option>
            <option value="Abstract">Abstract</option>
          </select>

          <label className="text-sm text-slate-300">Sort</label>
          <select
            value={sort}
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            onChange={(event) => updateFilters({ sort: event.target.value })}
          >
            <option value="featured">Featured</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="newest">Newest</option>
          </select>
        </div>

        <div className="text-sm text-slate-400">Showing {nfts.length} of {totalNfts} NFTs</div>
      </div>

      {query.isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="animate-pulse rounded-3xl border border-white/10 bg-slate-800 p-4">
              <div className="mb-4 h-72 rounded-2xl bg-slate-700" />
              <div className="mb-2 h-5 w-3/4 rounded bg-slate-700" />
              <div className="h-4 w-1/2 rounded bg-slate-700" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-100">
          Unable to load the marketplace. <button className="font-semibold underline" onClick={() => query.refetch()}>Retry</button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {nfts.map((nft) => (
            <article key={nft.id} className="group rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-lg shadow-black/10 transition hover:-translate-y-1 hover:border-purple-500/40">
              <Link to="/nft/$id" params={{ id: nft.id }} className="block overflow-hidden rounded-2xl">
                <img src={nft.image} alt={nft.imageAlt} className="h-72 w-full rounded-2xl object-cover" loading="lazy" />
              </Link>
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{nft.collection}</p>
                  <Link to="/nft/$id" params={{ id: nft.id }} className="mt-1 block text-xl font-semibold text-white">
                    {nft.title}
                  </Link>
                </div>
                <div className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-xs font-medium text-orange-200">
                  {nft.stock} left
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-400">By {nft.creator}</p>
              <div className="mt-4 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Price</p>
                  <p className="text-2xl font-bold text-white">{nft.priceEth} ETH</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onPress={() => {
                      if (!user) {
                        navigate({ to: '/login' })
                        return
                      }
                      toggleFavorite(nft.id)
                    }}
                    aria-label={isFavorite(nft.id) ? 'Remove from favorites' : 'Add to favorites'}
                    className={isFavorite(nft.id) ? 'text-pink-300' : 'text-slate-300'}
                  >
                    <Heart className={`h-4 w-4 ${isFavorite(nft.id) ? 'fill-current' : ''}`} />
                  </Button>
                  <Button
                    variant="secondary"
                    onPress={() => addToCart(nft, 1)}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          isDisabled={page <= 1}
          onPress={() => updateFilters({ page: page - 1 })}
          className="border-white bg-white text-black hover:bg-white hover:text-black disabled:bg-slate-300 disabled:text-slate-500"
        >
          Previous
        </Button>
        <div className="text-sm text-slate-300">Page {page}</div>
        <Button
          variant="outline"
          onPress={() => updateFilters({ page: page + 1 })}
          isDisabled={page * 9 >= totalNfts}
          className="border-white bg-white text-black hover:bg-white hover:text-black"
        >
          Next
        </Button>
      </div>
    </div>
  )
}

function NftDetailPage() {
  const { id } = useParams({ from: nftDetailRoute.id })
  const navigate = useNavigate()
  const { addToCart } = useCart()
  const { user, toggleFavorite, isFavorite } = useAuth()
  const query = useQuery({
    queryKey: ['nft', id],
    queryFn: () => fetchNftDetail(id),
  })

  const nft = query.data as Nft | undefined

  if (query.isLoading) {
    return <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-10 text-slate-300">Loading NFT details…</div>
  }

  if (!nft || query.isError) {
    return <NotFoundPage />
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 p-4">
        <img src={nft.image} alt={nft.imageAlt} className="h-[520px] w-full rounded-2xl object-cover" />
      </div>

      <div className="space-y-6 rounded-3xl border border-white/10 bg-slate-900/70 p-6">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-purple-300">
          {nft.collection}
        </div>
        <h1 className="text-4xl font-bold text-white">{nft.title}</h1>
        <p className="text-slate-300">{nft.description}</p>

        <div className="flex items-center gap-3 text-sm text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">By {nft.creator}</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{nft.stock} available</span>
        </div>

        <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4">
          <p className="text-xs uppercase tracking-[0.25em] text-orange-200">Current price</p>
          <p className="mt-2 text-4xl font-bold text-white">{nft.priceEth} ETH</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button size="lg" onPress={() => addToCart(nft, 1)}>
            Add to cart <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onPress={() => {
              if (!user) {
                navigate({ to: '/login' })
                return
              }
              toggleFavorite(nft.id)
            }}
            className={isFavorite(nft.id) ? 'border-pink-500/70 text-pink-200' : 'text-slate-200'}
          >
            <Heart className={`mr-2 h-4 w-4 ${isFavorite(nft.id) ? 'fill-current' : ''}`} />
            {isFavorite(nft.id) ? 'Saved' : 'Save'}
          </Button>
          <Link to="/" className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-white hover:bg-muted md:h-9 md:gap-1.5 md:px-2.5 lg:h-9 lg:px-2.5">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to catalog
          </Link>
        </div>
      </div>
    </div>
  )
}

function CartPage() {
  const { cartItems, updateQuantity, removeFromCart, clearCart } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [coupon, setCoupon] = useState('JUNGLE10')

  const itemPayload = cartItems.map((item) => ({
    nftId: item.nftId,
    quantity: item.quantity,
    edition: item.edition,
  }))

  const quoteQuery = useQuery({
    queryKey: ['cart-quote', itemPayload, coupon],
    queryFn: () => fetchQuote({ items: itemPayload, coupon }),
    enabled: itemPayload.length > 0,
    retry: false,
  })

  const quote = quoteQuery.data ?? { subtotal: '0.00', discount: '0.00', networkFee: '0.015', total: '0.015' }
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  if (!cartItems.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-10 text-center">
        <ShoppingBag className="mx-auto h-10 w-10 text-slate-500" />
        <h2 className="mt-4 text-2xl font-semibold text-white">Your cart is empty</h2>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-lg border border-white/10 bg-slate-950 px-4 py-2 text-sm font-medium text-white">
          Continue shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-4">
        {cartItems.map((item) => {
          const nft = nftCatalog.find((entry) => entry.id === item.nftId)
          if (!nft) return null

          return (
            <div key={item.nftId} className="flex gap-4 rounded-3xl border border-white/10 bg-slate-900/70 p-4">
              <img src={nft.image} alt={nft.imageAlt} className="h-28 w-28 rounded-2xl object-cover" />
              <div className="flex flex-1 flex-col justify-between gap-3 sm:flex-row">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{nft.collection}</p>
                  <h3 className="text-lg font-semibold text-white">{nft.title}</h3>
                  <p className="text-sm text-slate-400">{nft.priceEth} ETH each</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={nft.stock}
                    value={item.quantity}
                    className="w-20 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-center text-white"
                    onChange={(event) => updateQuantity(item.nftId, Number(event.target.value))}
                  />
                  <Button variant="ghost" onPress={() => removeFromCart(item.nftId)}>Remove</Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <aside className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
        <h2 className="text-xl font-semibold text-white">Summary</h2>
        <div className="mt-5 space-y-4 text-sm text-slate-300">
          <div className="flex items-center justify-between">
            <span>{totalItems} items</span>
            <span>{quote?.subtotal ?? '0.00'} ETH</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Discount</span>
            <span>{quote?.discount ?? '0.00'} ETH</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Network fee</span>
            <span>{quote?.networkFee ?? '0.015'} ETH</span>
          </div>
          <input
            value={coupon}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none"
            onChange={(event) => setCoupon(event.target.value)}
          />
          <div className="flex items-center justify-between border-t border-white/10 pt-4 text-base font-semibold text-white">
            <span>Total</span>
            <span>{quote?.total ?? '0.015'} ETH</span>
          </div>
        </div>

        {user ? (
          <Button className="mt-6 w-full" onPress={() => navigate({ to: '/checkout' })}>
            Go to checkout
          </Button>
        ) : (
          <Button className="mt-6 w-full" onPress={() => navigate({ to: '/login' })}>
            Login to continue
          </Button>
        )}
        <Button variant="ghost" className="mt-3 w-full" onPress={clearCart}>Clear cart</Button>
      </aside>
    </div>
  )
}

function CheckoutPage() {
  const { cartItems, clearCart } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [coupon, setCoupon] = useState('JUNGLE10')
  const [selectedWallet, setSelectedWallet] = useState(user?.primaryWallet ?? user?.wallets?.[0] ?? '0x1f0f...b93a')
  const [selectedNetwork, setSelectedNetwork] = useState('Ethereum')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const quoteQuery = useQuery({
    queryKey: ['quote', cartItems, coupon],
    queryFn: () => fetchQuote({ items: cartItems.map((item) => ({ nftId: item.nftId, quantity: item.quantity, edition: item.edition })), coupon }),
    enabled: cartItems.length > 0,
  })

  useEffect(() => {
    if (user && user.primaryWallet && !(user.wallets ?? []).includes(user.primaryWallet)) {
      setSelectedWallet((user.wallets ?? [])[0] ?? '0x1f0f...b93a')
    }
  }, [user])

  const submitOrder = async () => {
    if (!user || !cartItems.length) return
    setIsSubmitting(true)

    try {
      const hasValidStock = cartItems.every(({ nftId, quantity }) => {
        const nft = nftCatalog.find((entry) => entry.id === nftId)
        return Boolean(nft && quantity > 0 && quantity <= nft.stock)
      })

      if (!hasValidStock) {
        throw new Error('One or more NFTs are no longer available. Please review your cart.')
      }

      const freshQuote = await fetchQuote({
        items: cartItems.map((item) => ({ nftId: item.nftId, quantity: item.quantity, edition: item.edition })),
        coupon,
      })

      if (!freshQuote || Number(freshQuote.total) <= 0) {
        throw new Error('The quote changed. Please review your purchase before confirming.')
      }

      const response = await createOrder({
        userId: user.id,
        items: cartItems.map((item) => ({ nftId: item.nftId, quantity: item.quantity, edition: item.edition })),
        coupon,
        idempotencyKey: crypto.randomUUID(),
      })
      if (response?.id) {
        localStorage.setItem('jungle-last-order', JSON.stringify({ orderId: response.id }))
      }
      clearCart()
      navigate({ to: '/checkout/success', search: { orderId: response.id } })
    } catch (error) {
      const message = typeof error === 'string' ? error : (error as { message?: string })?.message ?? 'Checkout failed. Please retry.'
      alert(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!user) {
    return <LoginPage />
  }

  if (!cartItems.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-10 text-center">
        <h2 className="text-2xl font-semibold text-white">Your cart is empty</h2>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-lg border border-white/10 bg-slate-950 px-4 py-2 text-sm font-medium text-white">Discover NFTs</Link>
      </div>
    )
  }

  const quote = quoteQuery.data ?? { subtotal: '0.00', discount: '0.00', networkFee: '0.015', total: '0.015' }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold text-white">Collector details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-slate-300">Name</label>
              <input value={user.name} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" readOnly />
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-300">Email</label>
              <input value={user.email} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" readOnly />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold text-white">Payment wallet</h2>
          <div className="mt-4 space-y-3">
            {(user.wallets ?? []).map((wallet) => (
              <button
                key={wallet}
                type="button"
                onClick={() => setSelectedWallet(wallet)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${selectedWallet === wallet ? 'border-purple-500/60 bg-purple-500/10 text-white' : 'border-white/10 bg-slate-950/50 text-slate-300'}`}
              >
                <span>{wallet}</span>
                {selectedWallet === wallet && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm text-slate-300">Network</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {['Ethereum', 'Polygon', 'Arbitrum'].map((network) => (
                <button
                  key={network}
                  type="button"
                  onClick={() => setSelectedNetwork(network)}
                  className={`rounded-2xl border px-3 py-2 text-sm ${selectedNetwork === network ? 'border-purple-500/60 bg-purple-500/10 text-white' : 'border-white/10 bg-slate-950/50 text-slate-300'}`}
                >
                  {network}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <aside className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
        <h2 className="text-xl font-semibold text-white">Review</h2>
        <div className="mt-5 space-y-4 text-sm text-slate-300">
          {cartItems.map((item) => {
            const nft = nftCatalog.find((entry) => entry.id === item.nftId)
            if (!nft) return null
            return (
              <div key={item.nftId} className="flex items-center justify-between">
                <span>
                  {nft.title} x{item.quantity}
                </span>
                <span>{(Number(nft.priceEth) * item.quantity).toFixed(2)} ETH</span>
              </div>
            )
          })}
          <div className="flex items-center justify-between">
            <span>Coupon</span>
            <input value={coupon} onChange={(event) => setCoupon(event.target.value)} className="w-24 rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-right text-white" />
          </div>
          <div className="flex items-center justify-between">
            <span>Wallet</span>
            <span className="text-right text-white">{selectedWallet}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Network</span>
            <span className="text-right text-white">{selectedNetwork}</span>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 pt-4 text-base font-semibold text-white">
            <span>Total</span>
            <span>{quote.total} ETH</span>
          </div>
        </div>

        <Button className="mt-6 w-full" onPress={submitOrder} isDisabled={isSubmitting || !selectedWallet}>
          {isSubmitting ? 'Confirming…' : 'Confirm purchase'}
        </Button>
      </aside>
    </div>
  )
}

function SuccessPage() {
  const search = useSearch({ from: successRoute.fullPath })
  const savedOrderId = typeof window !== 'undefined' ? localStorage.getItem('jungle-last-order') : null
  const fallbackOrderId = savedOrderId ? JSON.parse(savedOrderId).orderId : 'JUNGLE-001'
  const orderId = String(search.orderId ?? fallbackOrderId)
  const orderQuery = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrder(orderId),
    enabled: Boolean(orderId),
    retry: false,
  })

  const order = orderQuery.data as Order | undefined

  const statusMeta = getOrderStatusMeta(order?.status)
  const statusTone = statusMeta.toneClass
  const title = statusMeta.title

  return (
    <div className={`rounded-3xl border p-8 ${statusTone}`}>
      <div className="text-center">
        {order?.status === 'rejected' ? (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-200">!</div>
        ) : (
          <Check className="mx-auto h-14 w-14 rounded-full bg-emerald-500/20 p-3 text-emerald-300" />
        )}
        <h1 className="mt-6 text-4xl font-bold text-white">{title}</h1>
        <p className="mt-3 text-slate-300">
          {`Order ${orderId} ${statusMeta.message.toLowerCase()}`}
        </p>
      </div>

      {orderQuery.isLoading ? (
        <div className="mt-8 text-center text-slate-300">Loading order receipt…</div>
      ) : orderQuery.isError ? (
        <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">
          Unable to load the receipt for this order.
        </div>
      ) : order ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Receipt</h2>
              <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${statusTone}`}>
                {order.status}
              </span>
            </div>

            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <div className="flex justify-between"><span>Transaction</span><span className="font-medium text-white">{order.transactionHash}</span></div>
              <div className="flex justify-between"><span>Created</span><span>{new Date(order.createdAt).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Explorer</span><a className="text-purple-300 underline" href={order.explorerUrl} target="_blank" rel="noreferrer">Open</a></div>
            </div>

            <div className="mt-6 space-y-3">
              {order.items.map((item) => {
                const nft = nftCatalog.find((nftItem) => nftItem.id === item.nftId)
                return (
                  <div key={`${order.id}-${item.nftId}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                    <div>
                      <p className="font-medium text-white">{nft?.title ?? item.nftId}</p>
                      <p className="text-xs text-slate-400">Qty {item.quantity} · {item.edition}</p>
                    </div>
                    <span className="text-sm text-slate-200">{item.priceEth} ETH</span>
                  </div>
                )
              })}
            </div>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
            <h2 className="text-xl font-semibold text-white">Summary</h2>
            <div className="mt-5 space-y-4 text-sm text-slate-300">
              <div className="flex justify-between"><span>Subtotal</span><span>{order.subtotal} ETH</span></div>
              <div className="flex justify-between"><span>Discount</span><span>{order.discount} ETH</span></div>
              <div className="flex justify-between"><span>Network fee</span><span>{order.networkFee} ETH</span></div>
              <div className="flex justify-between border-t border-white/10 pt-4 text-base font-semibold text-white"><span>Total</span><span>{order.total} ETH</span></div>
            </div>
            <Link to="/" className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-white/10 bg-slate-950 px-4 py-2 text-sm font-medium text-white">Back to marketplace</Link>
          </aside>
        </div>
      ) : null}
    </div>
  )
}

function LoginPage() {
  const navigate = useNavigate()
  const search = useSearch({ from: loginRoute.fullPath })
  const { login, user } = useAuth()
  const [email, setEmail] = useState('ari@jungle.market')
  const [password, setPassword] = useState('jungle123')
  const [error, setError] = useState('')

  const redirectPath = typeof search.redirect === 'string' && search.redirect.startsWith('/') ? search.redirect : '/'

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const result = await loginUser(email, password)
      login(result.user)
      navigate({ to: redirectPath, replace: true })
    } catch (err) {
      setError(String((err as { message?: string })?.message ?? 'Login failed'))
    }
  }

  if (user) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-10 text-center">
        <h2 className="text-2xl font-semibold text-white">Welcome back, {user.name}</h2>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-lg border border-white/10 bg-slate-950 px-4 py-2 text-sm font-medium text-white">Go shopping</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-slate-900/75 p-8">
      <h1 className="text-3xl font-bold text-white">Login</h1>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-2 block text-sm text-slate-300">Email</label>
          <input value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" />
        </div>
        <div>
          <label className="mb-2 block text-sm text-slate-300">Password</label>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" />
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <Button className="w-full" type="submit">
          Login
        </Button>
      </form>
      <p className="mt-4 text-sm text-slate-400">
        Need an account?{' '}
        <Link to="/signup" search={{ redirect: redirectPath }} className="text-purple-300">Create one</Link>
      </p>
    </div>
  )
}

function SignupPage() {
  const navigate = useNavigate()
  const search = useSearch({ from: signupRoute.fullPath })
  const { login } = useAuth()
  const [name, setName] = useState('Nova Buyer')
  const [email, setEmail] = useState('nova@jungle.market')
  const [password, setPassword] = useState('jungle123')
  const [error, setError] = useState('')

  const redirectPath = typeof search.redirect === 'string' && search.redirect.startsWith('/') ? search.redirect : '/'

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const result = await registerUser(name, email, password)
      login(result.user)
      navigate({ to: redirectPath, replace: true })
    } catch (err) {
      setError(String((err as { message?: string })?.message ?? 'Sign up failed'))
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-slate-900/75 p-8">
      <h1 className="text-3xl font-bold text-white">Create account</h1>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-2 block text-sm text-slate-300">Display name</label>
          <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" />
        </div>
        <div>
          <label className="mb-2 block text-sm text-slate-300">Email</label>
          <input value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" />
        </div>
        <div>
          <label className="mb-2 block text-sm text-slate-300">Password</label>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" />
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <Button className="w-full" type="submit">Create account</Button>
      </form>
      <p className="mt-4 text-sm text-slate-400">
        Already have an account?{' '}
        <Link to="/login" search={{ redirect: redirectPath }} className="text-purple-300">Login</Link>
      </p>
    </div>
  )
}

function ProfilePage() {
  const { user, updateUser } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [avatar, setAvatar] = useState(user?.avatar ?? '')

  const onSave = async () => {
    if (!user) return
    try {
      const response = await updateProfile(user.id, { name, avatar })
      updateUser(response.user)
    } catch {
      updateUser({ name, avatar })
    }
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-slate-900/70 p-8">
      <h1 className="text-3xl font-bold text-white">Profile</h1>
      <div className="mt-6 grid gap-4">
        <div>
          <label className="mb-2 block text-sm text-slate-300">Display name</label>
          <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" />
        </div>
        <div>
          <label className="mb-2 block text-sm text-slate-300">Avatar URL</label>
          <input value={avatar} onChange={(event) => setAvatar(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" />
        </div>
      </div>
      <Button className="mt-6" onPress={onSave}>Save profile</Button>
    </div>
  )
}

function WalletPage() {
  const { user, addWallet, setPrimaryWallet } = useAuth()
  const [wallet, setWallet] = useState('0xAC45...1F12')

  if (!user) {
    return <LoginPage />
  }

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-slate-900/70 p-8">
      <h1 className="text-3xl font-bold text-white">Wallets</h1>
      <div className="mt-6 space-y-3">
        {(user.wallets ?? []).map((entry) => (
          <div key={entry} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-200">
            <span>{entry}</span>
            <Button
              variant={user.primaryWallet === entry ? 'secondary' : 'ghost'}
              size="sm"
              onPress={() => setPrimaryWallet(entry)}
            >
              {user.primaryWallet === entry ? 'Primary' : 'Set primary'}
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-6 flex gap-3">
        <input value={wallet} onChange={(event) => setWallet(event.target.value)} className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" />
        <Button
          onPress={() => {
            addWallet(wallet)
            setWallet('')
          }}
        >
          Add
        </Button>
      </div>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-10 text-center">
      <h1 className="text-3xl font-bold text-white">Page not found</h1>
      <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-lg border border-white/10 bg-slate-950 px-4 py-2 text-sm font-medium text-white">Return home</Link>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

export default App
