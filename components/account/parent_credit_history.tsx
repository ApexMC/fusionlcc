"use client"

import { useEffect } from "react"
import { History, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatBillingMoney } from "@/lib/account/customer-billing-types"
import type { BillingCreditPage, BillingCreditTransaction, BillingCustomer } from "@/lib/account/customer-billing-types"

function activity(transaction: BillingCreditTransaction) {
  const labels: Record<string, string> = {
    adjustment: transaction.amount < 0 ? "Credit added" : "Balance adjustment",
    applied_to_invoice: transaction.amount > 0 ? "Credit applied to invoice" : "Balance applied to invoice",
    credit_note: "Credit note",
    initial: "Opening balance",
    invoice_overpaid: "Invoice overpayment credit",
    invoice_too_large: "Invoice balance carried forward",
    invoice_too_small: "Invoice balance carried forward",
    unspent_receiver_credit: "Unused payment credited",
    unapplied_from_invoice: "Invoice balance application reversed",
    checkout_session_subscription_payment: "Credit applied at checkout",
    checkout_session_subscription_payment_canceled: "Checkout credit restored",
    migration: "Credit balance transferred",
  }
  return labels[transaction.type] ?? "Balance adjustment"
}

export function ParentCreditHistory({ customers, pages, disabled, busy, onMore, onInvoice }: {
  customers: BillingCustomer[]
  pages: BillingCreditPage[]
  disabled: boolean
  busy: string | null
  onMore: (page: BillingCreditPage) => void
  onInvoice: (invoiceId: string) => void
}) {
  useEffect(() => {
    // Billing loads after the dashboard, so honor links followed before this card exists.
    if (window.location.hash === "#credit-balance") {
      document.getElementById("credit-balance")?.scrollIntoView({ block: "start" })
    }
  }, [])

  return <Card id="credit-balance" className="@container/billing-card min-h-0 max-h-[32rem] scroll-mt-24 rounded-lg bg-white dark:bg-black">
    <CardHeader className="shrink-0 space-y-2">
      <CardTitle className="flex items-center gap-2 text-lg"><History className="size-4" />Credit balance &amp; history</CardTitle>
      <p className="text-sm text-muted-foreground">Available credit automatically reduces future invoices in the same currency. This balance does not include unpaid invoices.</p>
    </CardHeader>
    <CardContent tabIndex={0} role="region" aria-label="Credit balance and history" className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain outline-none [scrollbar-gutter:stable] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
      {!customers.length ? <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Credit history will appear after your billing account is created.</div> : null}
      {customers.map(customer => {
        const page = pages.find(item => item.customerId === customer.id)
        return <div key={customer.id} className="space-y-3">
          <h3 className="text-sm font-semibold">{customer.label}</h3>
          <div className="flex flex-wrap gap-3">
            {customer.balances.map(balance => <div key={balance.currency} className="min-w-40 flex-1 rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">{balance.amount > 0 ? "Balance carried forward" : "Available credit"} · {balance.currency.toUpperCase()}</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${balance.amount < 0 ? "text-emerald-700 dark:text-emerald-300" : ""}`}>{formatBillingMoney(Math.abs(balance.amount), balance.currency)}</p>
              {balance.amount > 0 ? <p className="mt-1 text-xs text-muted-foreground">Added to a future invoice.</p> : null}
            </div>)}
            {!customer.balances.length ? <p className="text-sm text-muted-foreground">No available credit.</p> : null}
          </div>
          {!page?.transactions.length ? <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No credit balance activity yet.</div> : null}
          {page?.transactions.length ? <ol className="divide-y rounded-lg border bg-background px-4" aria-label={`${customer.label} credit balance history, newest first`}>
            {page.transactions.map(transaction => <li key={transaction.id} className="flex flex-col justify-between gap-3 py-4 @lg/billing-card:flex-row @lg/billing-card:items-start">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">{activity(transaction)}</p>
                <p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(transaction.created * 1000))}{transaction.creditNoteNumber ? ` · Credit note ${transaction.creditNoteNumber}` : ""}</p>
                {transaction.invoiceId ? <Button variant="link" size="sm" className="h-auto max-w-full justify-start whitespace-normal p-0 text-xs" disabled={disabled} onClick={() => onInvoice(transaction.invoiceId!)}>{busy === transaction.invoiceId ? <LoaderCircle className="size-3 animate-spin" /> : null}View invoice{transaction.invoiceNumber ? ` ${transaction.invoiceNumber}` : ""}</Button> : null}
              </div>
              <dl className="flex shrink-0 flex-wrap gap-6 text-sm @lg/billing-card:text-right">
                <div><dt className="text-xs text-muted-foreground">Credit change</dt><dd className={`mt-1 font-medium tabular-nums ${transaction.amount < 0 ? "text-emerald-700 dark:text-emerald-300" : ""}`}>{transaction.amount < 0 ? "+" : transaction.amount > 0 ? "−" : ""}{formatBillingMoney(Math.abs(transaction.amount), transaction.currency)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Balance after</dt><dd className="mt-1 tabular-nums">{formatBillingMoney(Math.abs(transaction.endingBalance), transaction.currency)}{transaction.endingBalance < 0 ? " credit" : transaction.endingBalance > 0 ? " owed" : ""}</dd></div>
              </dl>
            </li>)}
          </ol> : null}
          {page?.nextCursor ? <Button size="sm" variant="outline" disabled={disabled} aria-label={`Load more credit history for ${customer.label}`} onClick={() => onMore(page)}>{busy === `credits:${customer.id}` ? <LoaderCircle className="animate-spin" /> : null}Load more credit history</Button> : null}
        </div>
      })}
      {pages.some(page => page.transactions.length) ? <p className="text-xs text-muted-foreground">Positive changes add credit or reduce an amount owed. Negative changes use credit or increase an amount owed. Activity is shown newest first.</p> : null}
    </CardContent>
  </Card>
}
