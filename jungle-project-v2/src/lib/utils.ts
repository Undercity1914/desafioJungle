export { cn } from 'cn'

export type OrderStatus = 'pending' | 'confirmed' | 'rejected'

export function getOrderStatusMeta(status?: string) {
  switch (status) {
    case 'pending':
      return {
        toneClass: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
        title: 'Purchase pending',
        message: 'is being validated by the marketplace oracle.',
      }
    case 'rejected':
      return {
        toneClass: 'border-red-500/30 bg-red-500/10 text-red-200',
        title: 'Purchase rejected',
        message: 'was rejected by the marketplace oracle.',
      }
    default:
      return {
        toneClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
        title: 'Purchase confirmed',
        message: 'is now confirmed by the marketplace oracle.',
      }
  }
}

export function resolveCouponDiscount(subtotal: number, coupon: string): number {
  const normalized = coupon.trim().toUpperCase()

  if (normalized === 'JUNGLE10') {
    return Number((subtotal * 0.1).toFixed(6))
  }

  if (normalized === 'WELCOME15') {
    return Number((subtotal * 0.15).toFixed(6))
  }

  return 0
}
