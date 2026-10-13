import "server-only"

import type Stripe from "stripe"
import { getAccountSession, getParentForUser } from "@/lib/account/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe/server"
import { fetchAllRows } from "@/lib/account/pagination"
import { isEndedSubscription } from "@/lib/account/customer-billing-types"
import type { BillingCreditPage, BillingInvoice, BillingInvoiceDetail, BillingInvoicePage, BillingSubscription, CustomerBillingData } from "@/lib/account/customer-billing-types"

export class BillingError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

type Athlete = { athlete_id: string | number; first_name: string | null; last_name: string | null }
type Enrollment = {
  enrollment_id: string | number
  athlete_id: string | number
  parent_id?: string | number | null
  stripe_customer_id: string | null
  stripe_subscription_id?: string | null
  tuition_subscription_id?: string | null
  fee_subscription_id?: string | null
}
type BillingLink = { kind: "class" | "cheer"; enrollmentId: string; athleteName: string; subscriptionIds: string[] }
export type BillingContext = { userId: string; customerIds: string[]; links: BillingLink[] }

const stripeId = (value: string | { id: string } | null | undefined) => typeof value === "string" ? value : value?.id ?? null

/** Build the allowlist from authenticated database records, never browser IDs. */
export async function getCustomerBillingContext(): Promise<BillingContext> {
  const session = await getAccountSession()
  if (!session) throw new BillingError("Sign in to view billing.", 401)
  if (!session.isParent) throw new BillingError("Parent access is required.", 403)
  const parent = await getParentForUser(session.userId)
  if (!parent) throw new BillingError("Your family profile could not be found.", 404)
  const admin = createAdminClient()
  const [userAthletes, parentAthletes] = await Promise.all([
    fetchAllRows<Athlete>((from, to) => admin.from("Athletes")
      .select("athlete_id,first_name,last_name", { count: "exact" })
      .eq("user_id", session.userId).order("athlete_id").range(from, to)),
    fetchAllRows<Athlete>((from, to) => admin.from("Athletes")
      .select("athlete_id,first_name,last_name", { count: "exact" })
      .eq("parent_id", parent.parent_id).order("athlete_id").range(from, to)),
  ])
  const athletes = [...new Map([...userAthletes, ...parentAthletes].map(athlete => [String(athlete.athlete_id), athlete])).values()]
  const athleteNames = new Map(athletes.map(athlete => [String(athlete.athlete_id),
    [athlete.first_name, athlete.last_name].filter(Boolean).join(" ") || "Athlete"]))
  const athleteIds = athletes.map(athlete => athlete.athlete_id)
  const [classes, cheer] = athleteIds.length ? await Promise.all([
    fetchAllRows<Enrollment>((from, to) => admin.from("Enrollments")
      .select("enrollment_id,athlete_id,stripe_customer_id,stripe_subscription_id", { count: "exact" })
      .in("athlete_id", athleteIds).order("enrollment_id").range(from, to)),
    fetchAllRows<Enrollment>((from, to) => admin.from("CheerEnrollments")
      .select("enrollment_id,athlete_id,parent_id,stripe_customer_id,tuition_subscription_id,fee_subscription_id", { count: "exact" })
      .in("athlete_id", athleteIds).order("enrollment_id").range(from, to)),
  ]) : [[], []]
  const ownedCheer = cheer.filter(row => row.parent_id == null || String(row.parent_id) === String(parent.parent_id))
  const links: BillingLink[] = [
    ...classes.map(row => ({ kind: "class" as const, enrollmentId: String(row.enrollment_id),
      athleteName: athleteNames.get(String(row.athlete_id))!, subscriptionIds: [row.stripe_subscription_id].filter((id): id is string => Boolean(id)) })),
    ...ownedCheer.map(row => ({ kind: "cheer" as const, enrollmentId: String(row.enrollment_id),
      athleteName: athleteNames.get(String(row.athlete_id))!, subscriptionIds: [row.tuition_subscription_id, row.fee_subscription_id].filter((id): id is string => Boolean(id)) })),
  ]
  const customerIds = [...new Set([parent.stripe_customer_id, ...classes.map(row => row.stripe_customer_id),
    ...ownedCheer.map(row => row.stripe_customer_id)].filter((id): id is string => Boolean(id)))]
  return { userId: session.userId, customerIds, links }
}

export function requireBillingCustomer(context: BillingContext, customerId: string | null) {
  if (!customerId || !context.customerIds.includes(customerId)) {
    throw new BillingError("This billing record does not belong to your account.", 403)
  }
  return customerId
}

function findLink(context: BillingContext, subscription: Stripe.Subscription) {
  return context.links.find(link => link.subscriptionIds.includes(subscription.id)) ?? context.links.find(link =>
    link.kind === (subscription.metadata.enrollment_kind === "cheer" ? "cheer" : "class") &&
    link.enrollmentId === (link.kind === "cheer" ? subscription.metadata.cheer_enrollment_id : subscription.metadata.enrollment_id))
}

function canManage(subscription: Stripe.Subscription, link: BillingLink | undefined) {
  return Boolean(link?.subscriptionIds.includes(subscription.id) &&
    ["active", "trialing", "past_due", "unpaid"].includes(subscription.status) &&
    !subscription.schedule && (!subscription.cancel_at || subscription.cancel_at_period_end))
}

async function listSubscriptions(customerId: string) {
  const subscriptions: Stripe.Subscription[] = []
  for await (const subscription of getStripe().subscriptions.list({ customer: customerId, status: "all", limit: 100 })) {
    subscriptions.push(subscription)
  }
  return subscriptions
}

async function getSubscriptionProductNames(subscriptions: Stripe.Subscription[]) {
  // Expanding data.items.data.price.product exceeds Stripe's four-level limit.
  // Read each distinct product separately, only when rendering billing information.
  const productIds = [...new Set(subscriptions.flatMap(subscription => subscription.items.data
    .map(item => item.price.product).filter((product): product is string => typeof product === "string")))]
  const products = await Promise.all(productIds.map(id => getStripe().products.retrieve(id)))
  return new Map(products.filter(product => !product.deleted).map(product => [product.id, product.name]))
}

function subscriptionRecord(context: BillingContext, subscription: Stripe.Subscription, customerDefault: string | null, productNames: Map<string, string>): BillingSubscription {
  const link = findLink(context, subscription)
  const first = subscription.items.data[0]
  const role = subscription.metadata.subscription_role ?? null
  const items = subscription.items.data.map(item => {
    const product = item.price.product
    const name = typeof product === "string" ? productNames.get(product) : !product.deleted ? product.name : null
    return { name: name ?? item.price.nickname ?? "Subscription",
      amount: item.price.unit_amount, quantity: item.quantity ?? 1,
      interval: item.price.recurring?.interval ?? null, intervalCount: item.price.recurring?.interval_count ?? 1 }
  })
  return { id: subscription.id, customerId: stripeId(subscription.customer)!,
    name: items.map(item => item.name).join(" + ") || "Subscription", athleteName: link?.athleteName ?? null,
    kind: link?.kind ?? "other", role, status: subscription.status, currency: subscription.currency,
    items, periodStart: first?.current_period_start ?? null, periodEnd: first?.current_period_end ?? null,
    cancelAt: subscription.cancel_at, cancelAtPeriodEnd: subscription.cancel_at_period_end,
    endedAt: subscription.ended_at, paymentMethodId: stripeId(subscription.default_payment_method) ??
      (subscription.default_source ? null : customerDefault), canManage: canManage(subscription, link) }
}

export function invoiceRecord(invoice: Stripe.Invoice): BillingInvoice {
  return { id: invoice.id, customerId: stripeId(invoice.customer)!, number: invoice.number,
    created: invoice.created, status: invoice.status ?? "draft", currency: invoice.currency,
    total: invoice.total, amountPaid: invoice.amount_paid, amountRemaining: invoice.amount_remaining,
    dueDate: invoice.due_date, pdfUrl: invoice.invoice_pdf ?? null, paymentUrl: invoice.status === "open" ? invoice.hosted_invoice_url ?? null : null }
}

export async function getBillingInvoicePage(context: BillingContext, customerId: string, cursor?: string): Promise<BillingInvoicePage> {
  requireBillingCustomer(context, customerId)
  if (cursor && !/^in_[a-zA-Z0-9]+$/.test(cursor)) throw new BillingError("Invalid invoice cursor.")
  const page = await getStripe().invoices.list({ customer: customerId, limit: 12, ...(cursor ? { starting_after: cursor } : {}) })
  return { customerId, invoices: page.data.map(invoiceRecord), nextCursor: page.has_more ? page.data.at(-1)?.id ?? null : null }
}

export async function getBillingCreditPage(context: BillingContext, customerId: string, cursor?: string): Promise<BillingCreditPage> {
  requireBillingCustomer(context, customerId)
  if (cursor && !/^cbtxn_[a-zA-Z0-9]+$/.test(cursor)) throw new BillingError("Invalid credit history cursor.")
  const page = await getStripe().customers.listBalanceTransactions(customerId, {
    limit: 12, expand: ["data.invoice", "data.credit_note"], ...(cursor ? { starting_after: cursor } : {}),
  })
  return { customerId, transactions: page.data.map(transaction => ({
    id: transaction.id, customerId, created: transaction.created, currency: transaction.currency,
    type: transaction.type, amount: transaction.amount, endingBalance: transaction.ending_balance,
    invoiceId: stripeId(transaction.invoice),
    invoiceNumber: typeof transaction.invoice === "object" ? transaction.invoice?.number ?? null : null,
    creditNoteNumber: typeof transaction.credit_note === "object" ? transaction.credit_note?.number ?? null : null,
    // Stripe adjustment descriptions can contain staff-only notes. Expose only billing references.
  })), nextCursor: page.has_more ? page.data.at(-1)?.id ?? null : null }
}

export async function getBillingInvoice(context: BillingContext, invoiceId: string): Promise<BillingInvoiceDetail> {
  const stripe = getStripe()
  const invoice = await stripe.invoices.retrieve(invoiceId)
  requireBillingCustomer(context, stripeId(invoice.customer))
  const lines: BillingInvoiceDetail["lines"] = []
  // The embedded lines on an invoice are truncated; paginate the full breakdown.
  for await (const line of stripe.invoices.listLineItems(invoiceId, { limit: 100 })) {
    lines.push({ id: line.id, description: line.description ?? "Invoice item", amount: line.amount,
      quantity: line.quantity, periodStart: line.period.start, periodEnd: line.period.end })
  }
  return { ...invoiceRecord(invoice), lines, subtotal: invoice.subtotal,
    discount: invoice.total_discount_amounts?.reduce((total, discount) => total + discount.amount, 0) ?? 0,
    tax: invoice.total_taxes?.reduce((total, tax) => total + tax.amount, 0) ?? 0,
    startingBalance: invoice.starting_balance,
    creditNotes: invoice.pre_payment_credit_notes_amount + invoice.post_payment_credit_notes_amount }
}

export async function getCustomerBilling(context: BillingContext): Promise<CustomerBillingData> {
  const stripe = context.customerIds.length ? getStripe() : null
  const accounts = await Promise.all(context.customerIds.map(async (customerId, index) => {
    const [customer, subscriptions, invoicePage, creditPage, methods] = await Promise.all([
      stripe!.customers.retrieve(customerId, { expand: ["invoice_credit_balance"] }),
      listSubscriptions(customerId), getBillingInvoicePage(context, customerId), getBillingCreditPage(context, customerId),
      (async () => {
        const result: Stripe.PaymentMethod[] = []
        for await (const method of stripe!.customers.listPaymentMethods(customerId, { limit: 100 })) result.push(method)
        return result
      })(),
    ])
    if (customer.deleted) throw new BillingError("A billing account is no longer available. Please contact us.")
    const defaultMethod = stripeId(customer.invoice_settings.default_payment_method)
    const productNames = await getSubscriptionProductNames(subscriptions)
    const records = subscriptions.map(subscription => subscriptionRecord(context, subscription, defaultMethod, productNames))
    // The multi-currency field uses the opposite sign to customer.balance and the ledger.
    const balances = new Map(Object.entries(customer.invoice_credit_balance ?? {}).map(([currency, amount]) => [currency, -amount]))
    const currency = customer.currency ?? creditPage.transactions[0]?.currency ?? subscriptions[0]?.currency ?? invoicePage.invoices[0]?.currency
    if (currency && !balances.has(currency)) balances.set(currency, customer.balance)
    return { invoicePage, creditPage, subscriptions: records, customer: { id: customerId,
      label: context.customerIds.length > 1 ? `Billing account ${index + 1}` : "Family billing",
      balances: [...balances].map(([currency, amount]) => ({ currency, amount })),
      email: customer.email, methods: methods.map(method => ({ id: method.id,
        label: method.card?.brand ?? method.us_bank_account?.bank_name ?? method.type.replaceAll("_", " "),
        last4: method.card?.last4 ?? method.us_bank_account?.last4 ?? method.sepa_debit?.last4 ?? null,
        expiry: method.card ? `${String(method.card.exp_month).padStart(2, "0")}/${method.card.exp_year}` : null,
        isDefault: method.id === defaultMethod,
        inUse: records.some(record => !isEndedSubscription(record.status) && record.paymentMethodId === method.id) })) } }
  }))
  return { customers: accounts.map(account => account.customer),
    subscriptions: accounts.flatMap(account => account.subscriptions).sort((a, b) => (b.periodStart ?? 0) - (a.periodStart ?? 0)),
    invoicePages: accounts.map(account => account.invoicePage), creditPages: accounts.map(account => account.creditPage),
    canAddPaymentMethod: Boolean(getPublishableKey()) }
}

export async function changeBillingSubscription(context: BillingContext, subscriptionId: string, action: "cancel" | "keep") {
  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  requireBillingCustomer(context, stripeId(subscription.customer))
  const link = findLink(context, subscription)
  if (!canManage(subscription, link)) throw new BillingError("This subscription cannot be changed here. Please contact us.")
  // Cheer tuition and fees form one enrollment. Never cancel only one half.
  if (link!.kind === "cheer" && link!.subscriptionIds.length !== 2) {
    throw new BillingError("The cheer billing pair is incomplete. Please contact us before changing it.")
  }
  const group = link!.kind === "cheer" ? await Promise.all(link!.subscriptionIds.map(id => stripe.subscriptions.retrieve(id))) : [subscription]
  if (action === "keep" && group.some(item => isEndedSubscription(item.status))) {
    throw new BillingError("One of the cheer subscriptions has already ended. Please contact us to restart the enrollment.")
  }
  for (const item of group) {
    requireBillingCustomer(context, stripeId(item.customer))
    if (!isEndedSubscription(item.status) && !canManage(item, link)) throw new BillingError("A linked subscription cannot be changed here. Please contact us.")
  }
  // Preflight every member before making changes; retrying a partial failure is safe.
  for (const item of group.filter(item => !isEndedSubscription(item.status))) {
    if (item.cancel_at_period_end === (action === "cancel")) continue
    await stripe.subscriptions.update(item.id, { cancel_at_period_end: action === "cancel", proration_behavior: "none" })
  }
}

export async function createBillingSetupIntent(context: BillingContext, customerId: string) {
  requireBillingCustomer(context, customerId)
  const publishableKey = getPublishableKey()
  if (!publishableKey) throw new BillingError("Adding cards is not configured yet. Please contact us.")
  const intent = await getStripe().setupIntents.create({ customer: customerId, usage: "off_session", payment_method_types: ["card"],
    metadata: { user_id: context.userId, purpose: "dashboard_payment_method" } })
  return { clientSecret: intent.client_secret, publishableKey }
}

function getPublishableKey() {
  const key = process.env.STRIPE_PUBLISHABLE_KEY
  return key?.startsWith("pk_") ? key : null
}

export async function changeBillingPaymentMethod(context: BillingContext, customerId: string, methodId: string, action: "default" | "remove") {
  requireBillingCustomer(context, customerId)
  const stripe = getStripe()
  const method = await stripe.paymentMethods.retrieve(methodId)
  if (stripeId(method.customer) !== customerId) throw new BillingError("This payment method does not belong to your billing account.", 403)
  const [customer, subscriptions] = await Promise.all([stripe.customers.retrieve(customerId), listSubscriptions(customerId)])
  if (customer.deleted) throw new BillingError("The billing account is no longer available.")
  const current = subscriptions.filter(subscription => !isEndedSubscription(subscription.status))
  if (action === "remove") {
    if (stripeId(customer.invoice_settings.default_payment_method) === methodId || current.some(subscription => stripeId(subscription.default_payment_method) === methodId)) {
      throw new BillingError("Choose a different default payment method before removing this one.")
    }
    if (current.some(subscription => !subscription.default_payment_method && !subscription.default_source) && !customer.invoice_settings.default_payment_method && !customer.default_source) {
      throw new BillingError("Set a default payment method before removing cards while subscriptions are running.")
    }
    await stripe.paymentMethods.detach(methodId)
    return
  }
  // Subscription-level overrides otherwise keep charging the old card.
  for (const subscription of current) {
    await stripe.subscriptions.update(subscription.id, { default_payment_method: methodId })
  }
  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: methodId } })
}
