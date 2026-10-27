export type Nft = {
  id: string
  title: string
  collection: string
  creator: string
  priceEth: string
  image: string
  imageAlt: string
  category: string
  stock: number
  version: string
  description: string
  tags: string[]
  isFeatured: boolean
}

export type User = {
  id: string
  name: string
  email: string
  avatar: string
  primaryWallet: string
  wallets: string[]
  favorites: string[]
}

export type CartItem = {
  nftId: string
  quantity: number
  edition: string
}

export type Quote = {
  subtotal: string
  discount: string
  networkFee: string
  total: string
}

export type Order = {
  id: string
  userId: string
  total: string
  subtotal: string
  discount: string
  networkFee: string
  status: 'pending' | 'confirmed' | 'rejected'
  createdAt: string
  transactionHash: string
  explorerUrl: string
  coupon?: string
  items: { nftId: string; quantity: number; priceEth: string; edition: string }[]
}

export type ApiErrorShape = {
  code: string
  message: string
  fieldErrors?: Record<string, string[]>
  requestId: string
}
