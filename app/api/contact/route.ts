import { sendContactEmail } from "@/lib/contact/email"

export async function POST(req: Request) {
  const { email, subject, message } = await req.json()

  await sendContactEmail({ email, subject, message })

  return Response.json({ ok: true })
}
