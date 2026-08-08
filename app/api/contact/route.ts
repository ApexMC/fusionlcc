import { sendContactEmail } from "@/lib/contact/email"
import {
  ContactValidationError,
  contactBodyLimitBytes,
  parseContactMessage,
} from "@/lib/contact/validation"
import { checkRateLimit, getRequestIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const rateLimit = checkRateLimit({
    key: `contact:${getRequestIp(req)}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  })

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many messages. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    )
  }

  if (!req.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "Expected a JSON request." }, { status: 415 })
  }

  const declaredLength = Number(req.headers.get("content-length") ?? 0)

  if (declaredLength > contactBodyLimitBytes) {
    return Response.json({ error: "Message is too large." }, { status: 413 })
  }

  try {
    const body = await req.text()

    if (new TextEncoder().encode(body).byteLength > contactBodyLimitBytes) {
      return Response.json({ error: "Message is too large." }, { status: 413 })
    }

    const contactMessage = parseContactMessage(JSON.parse(body) as unknown)

    await sendContactEmail(contactMessage)

    return Response.json({ ok: true })
  } catch (error) {
    const message =
      error instanceof SyntaxError || error instanceof ContactValidationError
        ? error.message
        : "Unable to send your message."

    const status =
      error instanceof SyntaxError || error instanceof ContactValidationError
        ? 400
        : 500

    return Response.json({ error: message }, { status })
  }
}
