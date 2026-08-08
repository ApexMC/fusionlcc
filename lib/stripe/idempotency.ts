function normalizeKeyPart(value: string | number) {
  return String(value).trim().replace(/[^a-zA-Z0-9:_-]/g, "-").slice(0, 120)
}

export function getStripeIdempotencyKey(
  operation: "customer" | "checkout-session",
  resourceId: string | number
) {
  return `fusionlcc:${operation}:${normalizeKeyPart(resourceId)}:v1`
}
