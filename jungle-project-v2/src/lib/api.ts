import axios, { type AxiosError } from 'axios'
import type { ApiErrorShape, Nft, Quote, User } from '../types'

export const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

export type AuthResponse = {
  user: User
  token: string
}

export const normalizeApiError = (error: AxiosError<ApiErrorShape>): ApiErrorShape => {
  const data = error.response?.data ?? {
    code: 'UNKNOWN_ERROR',
    message: 'Something went wrong.',
    requestId: crypto.randomUUID(),
  }

  return {
    code: data.code ?? 'UNKNOWN_ERROR',
    message: data.message ?? 'Something went wrong.',
    fieldErrors: data.fieldErrors,
    requestId: data.requestId ?? crypto.randomUUID(),
  }
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorShape>) => {
    return Promise.reject(normalizeApiError(error))
  },
)

export const fetchNfts = async (query: Record<string, string | number>): Promise<{ items: Nft[]; total: number }> => {
  const response = await api.get('/nfts', { params: query })
  return response.data as { items: Nft[]; total: number }
}

export const fetchNftDetail = async (id: string): Promise<Nft> => {
  const response = await api.get(`/nfts/${id}`)
  return response.data as Nft
}

export const loginUser = async (email: string, password: string) => {
  const response = await api.post<AuthResponse>('/auth/login', { email, password })
  return response.data
}

export const registerUser = async (name: string, email: string, password: string) => {
  const response = await api.post<AuthResponse>('/auth/register', { name, email, password })
  return response.data
}

export const fetchProfile = async (userId: string) => {
  const response = await api.get(`/users/${userId}/profile`)
  return response.data
}

export const updateProfile = async (userId: string, payload: Partial<User>) => {
  const response = await api.put(`/users/${userId}/profile`, payload)
  return response.data
}

export const fetchFavorites = async (userId: string) => {
  const response = await api.get<string[]>(`/users/${userId}/favorites`)
  return response.data
}

export const toggleFavorite = async (userId: string, nftId: string) => {
  const response = await api.post<{ favorites: string[] }>(`/users/${userId}/favorites`, { nftId })
  return response.data
}

export const addWallet = async (userId: string, wallet: string) => {
  const response = await api.post<{ user: User }>(`/users/${userId}/wallets`, { wallet })
  return response.data
}

export const setPrimaryWallet = async (userId: string, wallet: string) => {
  const response = await api.put<{ user: User }>(`/users/${userId}/wallets/primary`, { wallet })
  return response.data
}

export const fetchQuote = async (payload: { items: { nftId: string; quantity: number; edition: string }[]; coupon?: string }) => {
  const response = await api.post<Quote>('/cart/quote', payload)
  return response.data
}

export const createOrder = async (payload: { userId: string; items: { nftId: string; quantity: number; edition: string }[]; coupon?: string; idempotencyKey?: string }) => {
  const response = await api.post('/orders', payload)
  return response.data
}

export const fetchOrder = async (orderId: string) => {
  const response = await api.get(`/orders/${orderId}`)
  return response.data
}
