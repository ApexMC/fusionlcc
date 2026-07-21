import "server-only"

import nodemailer from "nodemailer"

type ContactEmailInput = {
  email?: string | null
  subject: string
  message: string
  to?: string | string[] | null
  bcc?: string | string[] | null
}

function compactRecipients(value: string | string[] | null | undefined) {
  return Array.isArray(value)
    ? value.map((item) => item.trim()).filter(Boolean)
    : value?.trim() || undefined
}

export async function sendContactEmail({
  email,
  subject,
  message,
  to,
  bcc,
}: ContactEmailInput) {
  const primaryRecipient =
    compactRecipients(to) ??
    process.env.CONTACT_TO_EMAIL?.trim() ??
    process.env.CONTACT_FROM_EMAIL?.trim()
  const blindCopyRecipients = compactRecipients(bcc)

  if (!primaryRecipient && !blindCopyRecipients) {
    throw new Error("No email recipients are configured.")
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  await transporter.sendMail({
    from: process.env.CONTACT_FROM_EMAIL,
    to: primaryRecipient,
    bcc: blindCopyRecipients,
    subject,
    text: message,
    replyTo: email?.trim() || process.env.CONTACT_FROM_EMAIL,
  })
}
