export const contactBodyLimitBytes = 8 * 1024

export type ContactMessage = {
  email: string
  subject: string
  message: string
}

export class ContactValidationError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function parseContactMessage(value: unknown): ContactMessage {
  if (!isRecord(value)) {
    throw new ContactValidationError("Enter a valid contact message.")
  }

  const email = normalizeText(value.email).toLowerCase()
  const subject = normalizeText(value.subject)
  const message = normalizeText(value.message)

  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    throw new ContactValidationError("Enter a valid email address.")
  }

  if (subject.length < 3 || subject.length > 120) {
    throw new ContactValidationError("Subject must be between 3 and 120 characters.")
  }

  if (message.length < 10 || message.length > 4_000) {
    throw new ContactValidationError("Message must be between 10 and 4,000 characters.")
  }

  return { email, subject, message }
}
