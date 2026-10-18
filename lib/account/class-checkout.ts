import "server-only"

import { createHash } from "node:crypto"
import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe/server"

type ClassCheckoutPricing = {
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[]
  discounts?: Stripe.Checkout.SessionCreateParams.Discount[]
  metadata: Record<string, string>
}

function isMissingResource(error: unknown) {
  return typeof error === "object" && error !== null &&
    "code" in error && error.code === "resource_missing"
}

export async function getClassCheckoutPricing({
  priceId,
  couponId,
}: {
  priceId: string
  couponId: string | null
}): Promise<ClassCheckoutPricing> {
  const standard: ClassCheckoutPricing = {
    lineItems: [{ price: priceId, quantity: 1 }],
    discounts: couponId ? [{ coupon: couponId }] : undefined,
    metadata: {},
  }
  if (!couponId) return standard

  const stripe = getStripe()
  const coupon = await stripe.coupons.retrieve(couponId, { expand: ["currency_options", "applies_to"] })
  if (!coupon.valid) throw new Error("This class discount is no longer available. Please contact us.")
  if (coupon.amount_off === null) return standard
  // The source remains the eligibility check. A shared redemption cap cannot
  // be enforced by separate price-specific coupons.
  if (coupon.max_redemptions !== null) {
    throw new Error("This class discount needs billing configuration before checkout. Please contact us.")
  }

  const price = await stripe.prices.retrieve(priceId)
  const productId = typeof price.product === "string" ? price.product : price.product.id
  const amountOff = coupon.currency === price.currency
    ? coupon.amount_off
    : coupon.currency_options?.[price.currency]?.amount_off
  if (
    !price.active || price.unit_amount === null || !Number.isSafeInteger(price.unit_amount) ||
    price.unit_amount < 0 || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1 ||
    amountOff == null || !Number.isSafeInteger(amountOff) || amountOff < 0 ||
    (coupon.applies_to && !coupon.applies_to.products.includes(productId))
  ) {
    throw new Error("This class discount does not match its monthly price. Please contact us.")
  }
  if (price.unit_amount === 0 || amountOff === 0) return { ...standard, discounts: undefined }

  // Checkout accepts percentage coupons with automatic prorations. Scope the
  // conversion to this immutable price and verify the monthly saving is exact.
  // Integer basis points avoid floating-point rounding at half-cent boundaries.
  const discountCents = Math.min(amountOff, price.unit_amount)
  const basisPoints = Math.round(discountCents * 10000 / price.unit_amount)
  if (Math.floor((price.unit_amount * basisPoints + 5000) / 10000) !== discountCents) {
    throw new Error("This class discount cannot be applied exactly at checkout. Please contact us.")
  }
  const percentOff = basisPoints / 100
  const fingerprint = [priceId, couponId, basisPoints, coupon.duration,
    coupon.duration_in_months ?? "", coupon.redeem_by ?? ""].join(":")
  const checkoutCouponId = `class_${createHash("sha256").update(fingerprint).digest("hex").slice(0, 32)}`

  let checkoutCoupon: Stripe.Coupon
  try {
    checkoutCoupon = await stripe.coupons.retrieve(checkoutCouponId, { expand: ["applies_to"] })
  } catch (error) {
    if (!isMissingResource(error)) throw error
    checkoutCoupon = await stripe.coupons.create({
      id: checkoutCouponId,
      name: coupon.name ?? "Multi-athlete discount",
      percent_off: percentOff,
      duration: coupon.duration,
      ...(coupon.duration === "repeating" ? { duration_in_months: coupon.duration_in_months! } : {}),
      ...(coupon.redeem_by !== null ? { redeem_by: coupon.redeem_by } : {}),
      applies_to: { products: [productId] },
      expand: ["applies_to"],
      metadata: { source_coupon_id: couponId, source_price_id: priceId },
    }, { idempotencyKey: `class-checkout-coupon:${checkoutCouponId}` })
  }
  if (
    !checkoutCoupon.valid || checkoutCoupon.percent_off !== percentOff ||
    checkoutCoupon.duration !== coupon.duration ||
    checkoutCoupon.duration_in_months !== coupon.duration_in_months ||
    checkoutCoupon.redeem_by !== coupon.redeem_by ||
    checkoutCoupon.metadata?.source_coupon_id !== couponId ||
    checkoutCoupon.metadata?.source_price_id !== priceId ||
    !checkoutCoupon.applies_to?.products.includes(productId)
  ) {
    throw new Error("This class discount could not be verified. Please contact us.")
  }

  return {
    lineItems: standard.lineItems,
    discounts: [{ coupon: checkoutCoupon.id }],
    metadata: {
      class_price_id: priceId,
      multi_athlete_coupon_id: couponId,
      multi_athlete_checkout_coupon_id: checkoutCoupon.id,
    },
  }
}
