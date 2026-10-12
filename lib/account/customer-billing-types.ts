export type BillingSubscription = {
  id: string
  customerId: string
  name: string
  athleteName: string | null
  kind: "class" | "cheer" | "other"
  role: string | null
  status: string
  currency: string
  items: { name: string; amount: number | null; quantity: number; interval: string | null; intervalCount: number }[]
  periodStart: number | null
  periodEnd: number | null
  cancelAt: number | null
  cancelAtPeriodEnd: boolean
  endedAt: number | null
  paymentMethodId: string | null
  canManage: boolean
}

export type BillingPaymentMethod = {
  id: string
  label: string
  last4: string | null
  expiry: string | null
  isDefault: boolean
  inUse: boolean
}

export type BillingCustomer = {
  id: string
  label: string
  email: string | null
  methods: BillingPaymentMethod[]
  // Stripe invoice-balance signs: negative is available credit; positive is owed.
  balances: { currency: string; amount: number }[]
}

export type BillingCreditTransaction = {
  id: string
  customerId: string
  created: number
  currency: string
  type: string
  amount: number
  endingBalance: number
  invoiceId: string | null
  invoiceNumber: string | null
  creditNoteNumber: string | null
}

export type BillingCreditPage = {
  customerId: string
  transactions: BillingCreditTransaction[]
  nextCursor: string | null
}

export type BillingInvoice = {
  id: string
  customerId: string
  number: string | null
  created: number
  status: string
  currency: string
  total: number
  amountPaid: number
  amountRemaining: number
  dueDate: number | null
  pdfUrl: string | null
  paymentUrl: string | null
}

export type BillingInvoiceDetail = BillingInvoice & {
  subtotal: number
  discount: number
  tax: number
  startingBalance: number
  creditNotes: number
  lines: { id: string; description: string; amount: number; quantity: number | null; periodStart: number; periodEnd: number }[]
}

export type BillingInvoicePage = {
  customerId: string
  invoices: BillingInvoice[]
  nextCursor: string | null
}

export type CustomerBillingData = {
  customers: BillingCustomer[]
  subscriptions: BillingSubscription[]
  invoicePages: BillingInvoicePage[]
  creditPages: BillingCreditPage[]
  canAddPaymentMethod: boolean
}

export function isEndedSubscription(status: string) {
  return ["canceled", "incomplete_expired"].includes(status)
}

export function formatBillingMoney(amount: number, currency: string) {
  // Stripe uses the currency's minor unit, including zero-decimal currencies.
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency })
  // ISK and UGX retain two decimal places in Stripe's API for compatibility.
  const digits = ["isk", "ugx"].includes(currency.toLowerCase()) ? 2 : formatter.resolvedOptions().maximumFractionDigits ?? 2
  return formatter.format(amount / 10 ** digits)
}
