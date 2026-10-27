import { describe, expect, it } from 'vitest'

import { getOrderStatusMeta, resolveCouponDiscount } from './utils'

describe('getOrderStatusMeta', () => {
  it('returns the pending state description', () => {
    expect(getOrderStatusMeta('pending')).toMatchObject({
      title: 'Purchase pending',
      message: 'is being validated by the marketplace oracle.',
    })
  })

  it('returns the rejected state description', () => {
    expect(getOrderStatusMeta('rejected')).toMatchObject({
      title: 'Purchase rejected',
      message: 'was rejected by the marketplace oracle.',
    })
  })

  it('defaults to confirmed when the status is missing', () => {
    expect(getOrderStatusMeta()).toMatchObject({
      title: 'Purchase confirmed',
      message: 'is now confirmed by the marketplace oracle.',
    })
  })
})

describe('resolveCouponDiscount', () => {
  it('applies the Jungle 10% promotion', () => {
    expect(resolveCouponDiscount(2.5, 'JUNGLE10')).toBe(0.25)
  })

  it('applies the welcome 15% promotion', () => {
    expect(resolveCouponDiscount(40, 'WELCOME15')).toBe(6)
  })

  it('ignores unsupported coupons', () => {
    expect(resolveCouponDiscount(20, 'SPRING20')).toBe(0)
  })
})
