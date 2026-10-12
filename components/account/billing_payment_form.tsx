"use client"

import * as React from "react"
import Script from "next/script"
import { useTheme } from "next-themes"
import { LoaderCircle, LockKeyhole } from "lucide-react"
import { Button } from "@/components/ui/button"

// Keep Stripe.js scoped to the billing payment form.
type PaymentElement = { mount: (node: HTMLElement) => void; destroy: () => void; on: (event: string, callback: () => void) => void }
type Elements = { create: (type: "payment", options: { layout: string; wallets: { link: "never" } }) => PaymentElement }
type StripeClient = {
  elements: (options: { clientSecret: string; appearance: { theme: "night" | "stripe"; variables: Record<string, string> } }) => Elements
  confirmSetup: (options: { elements: Elements; confirmParams: { return_url: string }; redirect: "if_required" }) =>
    Promise<{ error?: { message?: string }; setupIntent?: { status: string; payment_method: string | { id: string } | null } }>
}
type StripeWindow = Window & { Stripe?: (key: string) => StripeClient | null }

export function BillingPaymentForm({ clientSecret, publishableKey, onSaved }: {
  clientSecret: string
  publishableKey: string
  onSaved: () => Promise<void>
}) {
  const mountRef = React.useRef<HTMLDivElement>(null)
  const paymentRef = React.useRef<{ stripe: StripeClient; elements: Elements } | null>(null)
  const [scriptReady, setScriptReady] = React.useState(false)
  const [elementReady, setElementReady] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const { resolvedTheme } = useTheme()

  React.useEffect(() => {
    if (!scriptReady || !mountRef.current) return
    const stripe = (window as StripeWindow).Stripe?.(publishableKey)
    if (!stripe) return
    const elements = stripe.elements({ clientSecret, appearance: {
      theme: resolvedTheme === "dark" ? "night" : "stripe",
      variables: { borderRadius: "8px", fontFamily: "Arial, sans-serif", colorPrimary: resolvedTheme === "dark" ? "#fafafa" : "#18181b" },
    } })
    const element = elements.create("payment", { layout: "tabs", wallets: { link: "never" } })
    element.on("ready", () => setElementReady(true))
    element.on("loaderror", () => setError("The secure card form could not load. Close this window and try again."))
    element.mount(mountRef.current)
    paymentRef.current = { stripe, elements }
    return () => { element.destroy(); paymentRef.current = null }
  }, [scriptReady, clientSecret, publishableKey, resolvedTheme])

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!paymentRef.current || saving) return
    setSaving(true)
    setError(null)
    try {
      const { stripe, elements } = paymentRef.current
      const result = await stripe.confirmSetup({ elements, redirect: "if_required",
        confirmParams: { return_url: `${window.location.origin}/account#billing` } })
      if (result.error) throw new Error(result.error.message ?? "Your card could not be saved.")
      if (result.setupIntent?.status !== "succeeded") throw new Error("Your card is still being verified. Refresh billing to check its status.")
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your card could not be saved.")
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Script src="https://js.stripe.com/v3/" onReady={() => setScriptReady(true)}
        onError={() => setError("The secure card form could not load. Check your connection and try again.")} />
      {!elementReady && !error ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading secure card form…</p> : null}
      <div ref={mountRef} />
      <p className="flex items-start gap-2 text-xs text-muted-foreground"><LockKeyhole className="size-4 shrink-0" />Your card details are securely saved by Stripe for future payments. After saving, choose “Make default” to use this card for your subscriptions.</p>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={!elementReady || saving || Boolean(error && !elementReady)} className="w-full">
        {saving ? <LoaderCircle className="animate-spin" /> : null}{saving ? "Saving card…" : "Save card"}
      </Button>
    </form>
  )
}
