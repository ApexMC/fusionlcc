"use client"

import * as React from "react"
import { CreditCard, Download, FileText, LoaderCircle, Plus, RefreshCw, Wallet } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import { BillingPaymentForm } from "@/components/account/billing_payment_form"
import { ParentCreditHistory } from "@/components/account/parent_credit_history"
import { formatBillingMoney, isEndedSubscription } from "@/lib/account/customer-billing-types"
import type { BillingCreditPage, BillingInvoice, BillingInvoiceDetail, BillingInvoicePage, BillingSubscription, CustomerBillingData } from "@/lib/account/customer-billing-types"

async function billingRequest<T>(query = "", body?: Record<string, string>): Promise<T> {
  const response = await fetch(`/api/account/billing${query}`, {
    method: body ? "POST" : "GET", cache: "no-store",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? "Billing is unavailable. Please try again.")
  return data as T
}

function date(value: number | null) {
  return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value * 1000)) : "Not available"
}

function BillingStatus({ status }: { status: string }) {
  const variant = ["active", "trialing", "paid"].includes(status) ? "success" :
    ["past_due", "unpaid", "uncollectible", "incomplete"].includes(status) ? "warning" : "outline"
  return <Badge variant={variant} className="w-fit capitalize">{status.replaceAll("_", " ")}</Badge>
}

type Confirmation = {
  title: string
  description: string
  label: string
  body: Record<string, string>
}

export function ParentBilling() {
  const [data, setData] = React.useState<CustomerBillingData | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [history, setHistory] = React.useState(false)
  const [confirmation, setConfirmation] = React.useState<Confirmation | null>(null)
  const [invoice, setInvoice] = React.useState<BillingInvoiceDetail | null>(null)
  const [cardSetup, setCardSetup] = React.useState<{ clientSecret: string; publishableKey: string; label: string } | null>(null)
  const { toast } = useToast()

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try { setData(await billingRequest<CustomerBillingData>()) }
    catch (err) { setError(err instanceof Error ? err.message : "Billing could not be loaded.") }
    finally { setLoading(false) }
  }, [])
  React.useEffect(() => {
    let disposed = false
    void billingRequest<CustomerBillingData>().then(result => { if (!disposed) setData(result) })
      .catch(err => { if (!disposed) setError(err instanceof Error ? err.message : "Billing could not be loaded.") })
      .finally(() => { if (!disposed) setLoading(false) })
    return () => { disposed = true }
  }, [])

  function showError(err: unknown) {
    toast({ title: "Billing could not be updated", description: err instanceof Error ? err.message : "Please try again.", variant: "error" })
  }

  async function confirm() {
    if (!confirmation || busy) return
    setBusy("confirm")
    try {
      await billingRequest("", confirmation.body)
      setConfirmation(null)
      toast({ title: "Billing updated", description: "Your latest billing information is shown below.", variant: "success" })
      await load()
    } catch (err) { showError(err); await load() }
    finally { setBusy(null) }
  }

  async function viewInvoice(record: Pick<BillingInvoice, "id">) {
    setBusy(record.id)
    try { setInvoice(await billingRequest<BillingInvoiceDetail>(`?invoiceId=${encodeURIComponent(record.id)}`)) }
    catch (err) { showError(err) }
    finally { setBusy(null) }
  }

  async function moreInvoices(page: BillingInvoicePage) {
    if (!page.nextCursor) return
    setBusy(page.customerId)
    try {
      const next = await billingRequest<BillingInvoicePage>(`?customerId=${encodeURIComponent(page.customerId)}&cursor=${encodeURIComponent(page.nextCursor)}`)
      setData(current => current ? { ...current, invoicePages: current.invoicePages.map(previous => previous.customerId === page.customerId ?
        { ...next, invoices: [...new Map([...previous.invoices, ...next.invoices].map(item => [item.id, item])).values()] } : previous) } : current)
    } catch (err) { showError(err) }
    finally { setBusy(null) }
  }

  async function moreCredits(page: BillingCreditPage) {
    if (!page.nextCursor) return
    setBusy(`credits:${page.customerId}`)
    try {
      const next = await billingRequest<BillingCreditPage>(`?history=credits&customerId=${encodeURIComponent(page.customerId)}&cursor=${encodeURIComponent(page.nextCursor)}`)
      setData(current => current ? { ...current, creditPages: current.creditPages.map(previous => previous.customerId === page.customerId ?
        { ...next, transactions: [...new Map([...previous.transactions, ...next.transactions].map(item => [item.id, item])).values()] } : previous) } : current)
    } catch (err) { showError(err) }
    finally { setBusy(null) }
  }

  async function addCard(customerId: string, label: string) {
    setBusy(customerId)
    try {
      const result = await billingRequest<{ clientSecret: string; publishableKey: string }>("", { action: "setup", customerId })
      setCardSetup({ ...result, label })
    } catch (err) { showError(err) }
    finally { setBusy(null) }
  }

  function changeSubscription(subscription: BillingSubscription) {
    const keeping = subscription.cancelAtPeriodEnd
    const paired = subscription.kind === "cheer"
    setConfirmation({ title: keeping ? "Keep subscription?" : "Cancel subscription?",
      description: paired ? keeping ? "Tuition and cheer fees will continue on their existing billing dates." :
        "Both tuition and cheer fees will end at their respective paid period ends. You can undo this before they end. Outstanding invoices remain due." :
        keeping ? "Your subscription will continue on its existing billing schedule." :
          `Your subscription will end on ${date(subscription.periodEnd)}. You can undo this before it ends. Outstanding invoices remain due.`,
      label: keeping ? "Keep subscription" : paired ? "Cancel tuition & fees" : "Cancel subscription",
      body: { action: keeping ? "keep" : "cancel", subscriptionId: subscription.id } })
  }

  const subscriptions = data?.subscriptions.filter(subscription => isEndedSubscription(subscription.status) === history) ?? []
  const invoices = data?.invoicePages.flatMap(page => page.invoices).sort((a, b) => b.created - a.created) ?? []
  const activeCount = data?.subscriptions.filter(subscription => !isEndedSubscription(subscription.status)).length ?? 0
  const historyCount = (data?.subscriptions.length ?? 0) - activeCount

  return (
    <section id="billing" className="scroll-mt-24 space-y-4 mt-8" aria-labelledby="billing-title" aria-busy={loading}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="billing-title" className="flex items-center gap-2 text-2xl font-bold"><Wallet className="size-5 shrink-0" />Subscriptions & Payments</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage your family’s subscriptions, credits, invoices, and saved payment methods.</p>
        </div>
        <Button variant="outline" size="sm" disabled={loading || Boolean(busy)} onClick={() => void load()}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh billing</Button>
      </div>
      {error ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">{error} {data ? "The information below may be out of date." : ""}</div> : null}
      {loading && !data ? <Card className="rounded-lg bg-white dark:bg-black"><CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading billing information…</CardContent></Card> : null}
      {data ? <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card className="@container/billing-card min-h-0 max-h-[32rem] rounded-lg bg-white dark:bg-black">
          <CardHeader className="flex shrink-0 flex-wrap items-center justify-between gap-3 sm:flex-row">
            <CardTitle className="text-lg">Subscriptions</CardTitle>
            <div className="flex gap-1 rounded-lg border p-1" aria-label="Subscription view">
              <Button size="sm" variant={history ? "ghost" : "secondary"} aria-pressed={!history} onClick={() => setHistory(false)}>Current ({activeCount})</Button>
              <Button size="sm" variant={history ? "secondary" : "ghost"} aria-pressed={history} onClick={() => setHistory(true)}>Cancelled ({historyCount})</Button>
            </div>
          </CardHeader>
          <CardContent tabIndex={0} role="region" aria-label="Subscriptions" className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain outline-none [scrollbar-gutter:stable] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            {!subscriptions.length ? <Empty>{history ? "No cancelled subscriptions." : "No subscriptions yet. Approved enrollments can be paid from the Enrollments section."}</Empty> : null}
            {subscriptions.map(subscription => <div key={subscription.id} className="rounded-lg border bg-background p-4">
              <div className="flex flex-col justify-between gap-3 @lg/billing-card:flex-row">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{subscription.name}</h3><BillingStatus status={subscription.status} />{subscription.role ? <Badge variant="secondary" className="capitalize">{subscription.role}</Badge> : null}</div>
                  {subscription.athleteName ? <p className="text-sm text-muted-foreground">{subscription.athleteName}</p> : null}
                  {subscription.items.map((item, index) => <p key={index} className="text-sm">{item.amount === null ? "Variable pricing" : formatBillingMoney(item.amount * item.quantity, subscription.currency)}{item.interval ? ` / ${item.intervalCount > 1 ? `${item.intervalCount} ${item.interval}s` : item.interval}` : ""}{item.quantity > 1 ? ` · ${item.quantity} units` : ""}</p>)}
                  <p className="text-xs text-muted-foreground">{history ? `Ended ${date(subscription.endedAt)}` : subscription.cancelAt ? `Ends ${date(subscription.cancelAt)}` : subscription.cancelAtPeriodEnd ? `Ends ${date(subscription.periodEnd)}` : `Current period: ${date(subscription.periodStart)} – ${date(subscription.periodEnd)}`}</p>
                  {subscription.cancelAtPeriodEnd ? <p className="text-sm text-amber-700 dark:text-amber-300">Cancellation scheduled</p> : null}
                  {subscription.paymentMethodId ? <p className="text-xs text-muted-foreground">Payment method: {paymentMethodLabel(data, subscription)}</p> : null}
                </div>
                {!history && subscription.canManage ? <Button size="sm" variant="outline" disabled={Boolean(busy) || loading || Boolean(error)} onClick={() => changeSubscription(subscription)}>{subscription.cancelAtPeriodEnd ? "Keep subscription" : subscription.kind === "cheer" ? "Cancel tuition & fees" : "Cancel subscription"}</Button> : null}
              </div>
              {!history && !subscription.canManage ? <p className="mt-2 text-xs text-muted-foreground">Contact us to make changes to this subscription.</p> : null}
            </div>)}
            {subscriptions.some(subscription => subscription.kind === "cheer") ? <p className="text-xs text-muted-foreground">Cheer tuition and fees are billed separately. Cancelling a cheer enrollment applies to both subscriptions at their respective period ends.</p> : null}
            {!history && subscriptions.length ? <p className="text-xs text-muted-foreground">Listed prices are before any discounts, credits, or taxes. Your invoices show the amounts charged.</p> : null}
          </CardContent>
        </Card>

        <ParentCreditHistory customers={data.customers} pages={data.creditPages} disabled={Boolean(busy) || loading || Boolean(error)} busy={busy} onMore={page => void moreCredits(page)} onInvoice={id => void viewInvoice({ id })} />

        <Card className="@container/billing-card min-h-0 max-h-[32rem] rounded-lg bg-white dark:bg-black">
          <CardHeader className="shrink-0"><CardTitle className="flex items-center gap-2 text-lg"><CreditCard className="size-4" />Payment methods</CardTitle></CardHeader>
          <CardContent tabIndex={0} role="region" aria-label="Payment methods" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain outline-none [scrollbar-gutter:stable] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            {!data.customers.length ? <Empty>Payment methods will appear after your first paid enrollment.</Empty> : null}
            {data.customers.map(customer => <div key={customer.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0"><h3 className="text-sm font-semibold">{customer.label}</h3>{customer.email ? <p className="break-all text-xs text-muted-foreground">{customer.email}</p> : null}</div>
                <Button size="sm" variant="outline" disabled={Boolean(busy) || loading || Boolean(error) || !data.canAddPaymentMethod} onClick={() => void addCard(customer.id, customer.label)}><Plus />Add card</Button>
              </div>
              {!customer.methods.length ? <Empty>No saved payment methods.</Empty> : null}
              {customer.methods.map(method => <div key={method.id} className="flex flex-col justify-between gap-3 rounded-lg border bg-background p-3 @lg/billing-card:flex-row @lg/billing-card:items-center">
                <div className="space-y-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium capitalize">{method.label}{method.last4 ? ` •••• ${method.last4}` : ""}</span>{method.isDefault ? <Badge variant="success">Default</Badge> : method.inUse ? <Badge variant="outline">Used by subscription</Badge> : null}</div>{method.expiry ? <p className="text-xs text-muted-foreground">Expires {method.expiry}</p> : null}</div>
                <div className="flex flex-wrap gap-2">
                  {!method.isDefault || customer.methods.some(item => item.inUse && !item.isDefault) ? <Button variant="outline" size="sm" disabled={Boolean(busy) || loading || Boolean(error)} onClick={() => setConfirmation({ title: "Change default payment method?", description: "This payment method will be used for future invoices and all current subscriptions on this billing account.", label: "Make default", body: { action: "default", customerId: customer.id, methodId: method.id } })}>Make default</Button> : null}
                  <Button variant="ghost" size="sm" disabled={method.isDefault || method.inUse || Boolean(busy) || loading || Boolean(error)} onClick={() => setConfirmation({ title: "Remove payment method?", description: "This saved payment method will be removed from your billing account.", label: "Remove payment method", body: { action: "remove", customerId: customer.id, methodId: method.id } })}>Remove</Button>
                </div>
              </div>)}
            </div>)}
            {data.customers.length && !data.canAddPaymentMethod ? <p className="text-sm text-muted-foreground">Adding cards is not available yet. Please contact us to add a payment method.</p> : null}
            {data.customers.some(customer => customer.methods.length) ? <p className="text-xs text-muted-foreground">Set another card as default before removing a payment method used by a subscription.</p> : null}
          </CardContent>
        </Card>

        <Card className="@container/billing-card min-h-0 max-h-[32rem] rounded-lg bg-white dark:bg-black">
          <CardHeader className="shrink-0"><CardTitle className="flex items-center gap-2 text-lg"><FileText className="size-4" />Invoice history</CardTitle></CardHeader>
          <CardContent tabIndex={0} role="region" aria-label="Invoice history" className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain outline-none [scrollbar-gutter:stable] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            {!invoices.length ? <Empty>No invoices yet.</Empty> : null}
            {invoices.map(record => <div key={record.id} className="flex flex-col justify-between gap-3 rounded-lg border bg-background p-4 @lg/billing-card:flex-row @lg/billing-card:items-center">
              <div className="space-y-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{record.number ?? "Draft invoice"}</h3><BillingStatus status={record.status} /></div><p className="text-xs text-muted-foreground">{date(record.created)}{data.customers.length > 1 ? ` · ${data.customers.find(customer => customer.id === record.customerId)?.label}` : ""}</p><p className="text-sm font-medium">{formatBillingMoney(record.total, record.currency)}{record.amountRemaining > 0 ? <span className="ml-2 font-normal text-amber-700 dark:text-amber-300">{formatBillingMoney(record.amountRemaining, record.currency)} remaining</span> : null}</p></div>
              <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void viewInvoice(record)}>{busy === record.id ? <LoaderCircle className="animate-spin" /> : <FileText />}View breakdown</Button>{record.pdfUrl ? <Button asChild variant="ghost" size="sm"><a href={record.pdfUrl} target="_blank" rel="noopener noreferrer"><Download />PDF</a></Button> : null}</div>
            </div>)}
            {data.invoicePages.filter(page => page.nextCursor).map(page => <Button key={page.customerId} variant="outline" size="sm" disabled={Boolean(busy) || loading} onClick={() => void moreInvoices(page)}>{busy === page.customerId ? <LoaderCircle className="animate-spin" /> : null}Load older invoices{data.customers.length > 1 ? ` · ${data.customers.find(customer => customer.id === page.customerId)?.label}` : ""}</Button>)}
          </CardContent>
        </Card>
      </div> : null}

      <Dialog open={Boolean(confirmation)} onOpenChange={open => { if (!open && !busy) setConfirmation(null) }}>
        <DialogContent><DialogHeader><DialogTitle>{confirmation?.title}</DialogTitle><DialogDescription>{confirmation?.description}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" disabled={Boolean(busy)} onClick={() => setConfirmation(null)}>Go back</Button><Button variant={confirmation?.body.action === "cancel" ? "destructive" : "default"} disabled={Boolean(busy)} onClick={() => void confirm()}>{busy === "confirm" ? <LoaderCircle className="animate-spin" /> : null}{confirmation?.label}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(invoice)} onOpenChange={open => { if (!open) setInvoice(null) }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Invoice {invoice?.number ?? "breakdown"}</DialogTitle><DialogDescription>{invoice ? `Issued ${date(invoice.created)}${invoice.dueDate ? ` · Due ${date(invoice.dueDate)}` : ""}` : ""}</DialogDescription></DialogHeader>
          {invoice ? <>
            <BillingStatus status={invoice.status} />
            <div className="divide-y rounded-lg border px-3">{invoice.lines.map(line => <div key={line.id} className="flex justify-between gap-4 py-3 text-sm"><div><p>{line.description}</p><p className="mt-1 text-xs text-muted-foreground">{date(line.periodStart)} – {date(line.periodEnd)}{line.quantity && line.quantity > 1 ? ` · Quantity ${line.quantity}` : ""}</p></div><span className="shrink-0 font-medium">{formatBillingMoney(line.amount, invoice.currency)}</span></div>)}</div>
            <dl className="space-y-2 text-sm"><Amount label="Subtotal" amount={invoice.subtotal} currency={invoice.currency} />{invoice.discount ? <Amount label="Discounts" amount={-invoice.discount} currency={invoice.currency} /> : null}{invoice.tax ? <Amount label="Tax" amount={invoice.tax} currency={invoice.currency} /> : null}<Amount label="Invoice total" amount={invoice.total} currency={invoice.currency} />{invoice.startingBalance ? <Amount label={invoice.startingBalance < 0 ? "Account credit" : "Previous balance"} amount={invoice.startingBalance} currency={invoice.currency} /> : null}{invoice.creditNotes ? <Amount label="Credit notes" amount={-invoice.creditNotes} currency={invoice.currency} /> : null}<Amount label="Amount paid" amount={invoice.amountPaid} currency={invoice.currency} /><div className="border-t pt-2 font-semibold"><Amount label="Amount remaining" amount={invoice.amountRemaining} currency={invoice.currency} /></div></dl>
            <DialogFooter>{invoice.pdfUrl ? <Button asChild variant="outline"><a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer"><Download />Download PDF</a></Button> : null}{invoice.paymentUrl ? <Button asChild><a href={invoice.paymentUrl} target="_blank" rel="noopener noreferrer">Pay outstanding invoice</a></Button> : null}</DialogFooter>
          </> : null}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(cardSetup)} onOpenChange={open => { if (!open) setCardSetup(null) }}>
        <DialogContent className="top-24 flex max-h-[calc(100dvh-7rem)] translate-y-0 flex-col overflow-hidden sm:max-w-lg">
          <DialogHeader className="shrink-0"><DialogTitle>Add a payment card</DialogTitle><DialogDescription>{cardSetup?.label}</DialogDescription></DialogHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain">
            {cardSetup ? <BillingPaymentForm clientSecret={cardSetup.clientSecret} publishableKey={cardSetup.publishableKey} onSaved={async () => { setCardSetup(null); toast({ title: "Card saved", description: "Choose Make default to use this card for your subscriptions.", variant: "success" }); await load() }} /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{children}</div>
}

function Amount({ label, amount, currency }: { label: string; amount: number; currency: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd>{formatBillingMoney(amount, currency)}</dd></div>
}

function paymentMethodLabel(data: CustomerBillingData, subscription: BillingSubscription) {
  const method = data.customers.find(customer => customer.id === subscription.customerId)?.methods.find(item => item.id === subscription.paymentMethodId)
  return method ? `${method.label}${method.last4 ? ` •••• ${method.last4}` : ""}` : "Saved payment method"
}
