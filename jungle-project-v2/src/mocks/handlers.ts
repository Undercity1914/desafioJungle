import { http, HttpResponse } from 'msw'
import { demoUsers, nftCatalog } from '../lib/mock-data'
import type { User } from '../types'

const userStore: User[] = [...demoUsers]
const orderStore = new Map<string, {
  id: string
  userId: string
  items: Array<{ nftId: string; quantity: number; edition: string; priceEth: string }>
  coupon?: string
  status: 'pending' | 'confirmed' | 'rejected'
  total: string
  subtotal: string
  discount: string
  networkFee: string
  createdAt: string
  transactionHash: string
  explorerUrl: string
}>()

const getUserByEmail = (email: string) => userStore.find((user) => user.email.toLowerCase() === email.toLowerCase())

const getUserById = (userId: string) => userStore.find((user) => user.id === userId)

const mapQuote = (items: Array<{ nftId: string; quantity: number; edition: string }>) => {
  const subtotal = items.reduce((sum, item) => {
    const nft = nftCatalog.find((entry) => entry.id === item.nftId)
    if (!nft) return sum
    return sum + Number(nft.priceEth) * item.quantity
  }, 0)
  const discount = subtotal > 1 ? 0.18 : 0
  return {
    subtotal: subtotal.toFixed(2),
    discount: discount.toFixed(2),
    networkFee: '0.015',
    total: (subtotal - discount + 0.015).toFixed(2),
  }
}

export const handlers = [
  http.get('/api/nfts', ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
    const category = url.searchParams.get('category') ?? 'all'
    const sort = url.searchParams.get('sort') ?? 'featured'
    const page = Number(url.searchParams.get('page') ?? 1)

    let items = nftCatalog.filter((nft) => {
      const matchesQuery = q.length === 0 || `${nft.title} ${nft.creator} ${nft.collection}`.toLowerCase().includes(q)
      const matchesCategory = category === 'all' || nft.category === category
      return matchesQuery && matchesCategory
    })

    if (sort === 'price-low') items = [...items].sort((a, b) => Number(a.priceEth) - Number(b.priceEth))
    if (sort === 'price-high') items = [...items].sort((a, b) => Number(b.priceEth) - Number(a.priceEth))
    if (sort === 'newest') items = [...items].sort((a, b) => Number(b.version.replace('v', '')) - Number(a.version.replace('v', '')))

    const pageSize = 9
    const start = (page - 1) * pageSize
    const pagedItems = items.slice(start, start + pageSize)

    return HttpResponse.json({ items: pagedItems, total: items.length })
  }),

  http.get('/api/nfts/:id', ({ params }) => {
    const nft = nftCatalog.find((entry) => entry.id === params.id)
    if (!nft) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'NFT not found', requestId: crypto.randomUUID() }, { status: 404 })
    }

    return HttpResponse.json(nft)
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const payload = (await request.json()) as { email?: string; password?: string }
    if (!payload.email || !payload.password) {
      return HttpResponse.json({ code: 'INVALID_INPUT', message: 'Email and password are required.', requestId: crypto.randomUUID() }, { status: 400 })
    }

    const user = getUserByEmail(payload.email)
    if (!user || payload.password !== 'jungle123') {
      return HttpResponse.json({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.', requestId: crypto.randomUUID() }, { status: 401 })
    }

    return HttpResponse.json({ user, token: `mock-${user.id}` })
  }),

  http.post('/api/auth/register', async ({ request }) => {
    const payload = (await request.json()) as { name?: string; email?: string; password?: string }
    if (!payload.name || !payload.email || !payload.password) {
      return HttpResponse.json({ code: 'INVALID_INPUT', message: 'Please complete the form.', requestId: crypto.randomUUID() }, { status: 422 })
    }

    const existing = getUserByEmail(payload.email)
    if (existing) {
      return HttpResponse.json({ code: 'USER_EXISTS', message: 'Account already exists.', requestId: crypto.randomUUID() }, { status: 409 })
    }

    const created: User = {
      id: `user-${userStore.length + 1}`,
      name: payload.name,
      email: payload.email,
      avatar: 'https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=400&q=80',
      primaryWallet: '0xA1B2...C3D4',
      wallets: ['0xA1B2...C3D4'],
      favorites: [],
    }

    userStore.push(created)
    return HttpResponse.json({ user: created, token: `mock-${created.id}` })
  }),

  http.get('/api/users/:id/profile', ({ params }) => {
    const user = userStore.find((entry) => entry.id === params.id)
    if (!user) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'User not found', requestId: crypto.randomUUID() }, { status: 404 })
    }

    return HttpResponse.json(user)
  }),

  http.put('/api/users/:id/profile', async ({ params, request }) => {
    const payload = (await request.json()) as Partial<User>
    const user = userStore.find((entry) => entry.id === params.id)

    if (!user) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'User not found', requestId: crypto.randomUUID() }, { status: 404 })
    }

    const updated = { ...user, ...payload, favorites: user.favorites ?? [], wallets: user.wallets ?? [], primaryWallet: user.primaryWallet ?? user.wallets?.[0] ?? '' }
    Object.assign(user, updated)
    return HttpResponse.json({ user: updated })
  }),

  http.get('/api/users/:id/favorites', ({ params }) => {
    const user = getUserById(String(params.id))
    if (!user) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'User not found', requestId: crypto.randomUUID() }, { status: 404 })
    }
    return HttpResponse.json({ favorites: user.favorites ?? [] })
  }),

  http.post('/api/users/:id/favorites', async ({ params, request }) => {
    const payload = (await request.json()) as { nftId?: string }
    const user = getUserById(String(params.id))
    if (!user) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'User not found', requestId: crypto.randomUUID() }, { status: 404 })
    }

    if (!payload.nftId) {
      return HttpResponse.json({ code: 'INVALID_INPUT', message: 'NFT id is required.', requestId: crypto.randomUUID() }, { status: 422 })
    }

    const favorites = user.favorites.includes(payload.nftId)
      ? user.favorites.filter((entry) => entry !== payload.nftId)
      : [...user.favorites, payload.nftId]

    user.favorites = favorites
    return HttpResponse.json({ favorites })
  }),

  http.post('/api/users/:id/wallets', async ({ params, request }) => {
    const payload = (await request.json()) as { wallet?: string }
    const user = getUserById(String(params.id))
    if (!user) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'User not found', requestId: crypto.randomUUID() }, { status: 404 })
    }

    const wallet = payload.wallet?.trim()
    if (!wallet) {
      return HttpResponse.json({ code: 'INVALID_INPUT', message: 'Wallet address is required.', requestId: crypto.randomUUID() }, { status: 422 })
    }

    if (!user.wallets.includes(wallet)) {
      user.wallets = [...user.wallets, wallet]
    }

    if (!user.primaryWallet) {
      user.primaryWallet = wallet
    }

    return HttpResponse.json({ user })
  }),

  http.put('/api/users/:id/wallets/primary', async ({ params, request }) => {
    const payload = (await request.json()) as { wallet?: string }
    const user = getUserById(String(params.id))
    if (!user) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'User not found', requestId: crypto.randomUUID() }, { status: 404 })
    }

    if (!payload.wallet || !user.wallets.includes(payload.wallet)) {
      return HttpResponse.json({ code: 'INVALID_INPUT', message: 'Wallet is not available for this account.', requestId: crypto.randomUUID() }, { status: 422 })
    }

    user.primaryWallet = payload.wallet
    return HttpResponse.json({ user })
  }),

  http.post('/api/cart/quote', async ({ request }) => {
    const payload = (await request.json()) as { items?: Array<{ nftId: string; quantity: number; edition: string }>; coupon?: string }
    const items = payload.items ?? []
    const quote = mapQuote(items)

    if (payload.coupon && payload.coupon !== 'JUNGLE10') {
      return HttpResponse.json({ code: 'INVALID_COUPON', message: 'Coupon is expired or invalid.', requestId: crypto.randomUUID() }, { status: 422 })
    }

    return HttpResponse.json(quote)
  }),

  http.post('/api/orders', async ({ request }) => {
    const payload = (await request.json()) as {
      userId?: string
      items?: Array<{ nftId: string; quantity: number; edition: string }>
      coupon?: string
      idempotencyKey?: string
    }
    if (!payload.userId || !payload.items?.length) {
      return HttpResponse.json({ code: 'INVALID_INPUT', message: 'Order payload is invalid.', requestId: crypto.randomUUID() }, { status: 422 })
    }

    if (payload.idempotencyKey && orderStore.has(payload.idempotencyKey)) {
      const existing = orderStore.get(payload.idempotencyKey)
      if (existing && existing.userId === payload.userId) {
        return HttpResponse.json(existing)
      }
      return HttpResponse.json({ code: 'IDEMPOTENCY_CONFLICT', message: 'This idempotency key has already been used with different payload.', requestId: crypto.randomUUID() }, { status: 409 })
    }

    const quote = mapQuote(payload.items)
    const createdAt = new Date().toISOString()
    const normalizedCoupon = (payload.coupon ?? '').trim().toUpperCase()
    const status: 'pending' | 'confirmed' | 'rejected' =
      normalizedCoupon === 'REJECT' ? 'rejected' : normalizedCoupon === 'PENDING' ? 'pending' : 'confirmed'

    const order = {
      id: `order-${Date.now()}`,
      userId: payload.userId,
      items: payload.items.map((item) => ({
        ...item,
        priceEth: nftCatalog.find((nft) => nft.id === item.nftId)?.priceEth ?? '0.00',
      })),
      coupon: payload.coupon,
      subtotal: quote.subtotal,
      discount: quote.discount,
      networkFee: quote.networkFee,
      total: quote.total,
      status,
      createdAt,
      transactionHash: `0x${Math.random().toString(16).slice(2, 18)}`,
      explorerUrl: 'https://explorer.jungle.market/tx/' + crypto.randomUUID().slice(0, 8),
    }

    if (payload.idempotencyKey) {
      orderStore.set(payload.idempotencyKey, order)
    }

    return HttpResponse.json(order)
  }),

  http.get('/api/orders/:id', ({ params }) => {
    const match = Array.from(orderStore.values()).find((order) => order.id === params.id)
    if (!match) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Order not found', requestId: crypto.randomUUID() }, { status: 404 })
    }

    return HttpResponse.json(match)
  }),
]
