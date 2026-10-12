import assert from "node:assert/strict"
import test from "node:test"
import { setImmediate } from "node:timers/promises"
import * as React from "react"
import * as jsxRuntime from "react/jsx-runtime"
import { renderToStaticMarkup } from "react-dom/server"
import { loadTypeScriptModule, loadTypeScriptModuleWithMocks as loadModule } from "./load-typescript.mjs"

const types = await loadTypeScriptModule("../lib/account/customer-billing-types.ts")
const wrapper = ({ children, className }) => React.createElement("div", { className }, children)
const card = Object.fromEntries(["Card", "CardContent", "CardHeader", "CardTitle"].map(name => [name, wrapper]))
const { ParentCreditHistory } = await loadModule("../components/account/parent_credit_history.tsx", {
  react: React,
  "react/jsx-runtime": jsxRuntime,
  "lucide-react": { History: () => null, LoaderCircle: () => null },
  "@/components/ui/button": { Button: ({ children, disabled, onClick, className, "aria-label": label }) => React.createElement("button", { disabled, onClick, className, "aria-label": label }, children) },
  "@/components/ui/card": card,
  "@/lib/account/customer-billing-types": types,
})

const customer = { id: "cus_family", label: "Family billing", email: null, methods: [], balances: [{ currency: "usd", amount: -3000 }] }
const transaction = { id: "cbtxn_used", customerId: "cus_family", created: 1700000000, currency: "usd",
  type: "applied_to_invoice", amount: 2000, endingBalance: -3000, invoiceId: "in_owned", invoiceNumber: "FUS-001", creditNoteNumber: null }
const page = { customerId: "cus_family", transactions: [transaction], nextCursor: "cbtxn_used" }
const props = { customers: [customer], pages: [page], disabled: false, busy: null, onMore() {}, onInvoice() {} }

test("credit history displays credits used, credits added, and the balance after each change", () => {
  const markup = renderToStaticMarkup(React.createElement(ParentCreditHistory, { ...props, pages: [{ ...page, transactions: [transaction,
    { ...transaction, id: "cbtxn_added", type: "adjustment", amount: -5000, endingBalance: -5000, invoiceId: null }] }] }))
  assert.match(markup, /Available credit/)
  assert.match(markup, /Credit applied to invoice/)
  assert.match(markup, /−\$20\.00/)
  assert.match(markup, /\$30\.00 credit/)
  assert.match(markup, /Credit added/)
  assert.match(markup, /\+\$50\.00/)
  assert.match(markup, /View invoice.*FUS-001/)
  assert.match(markup, /Load more credit history/)
})

test("carried-forward amounts are shown as owed, and zero-decimal credits retain their currency", () => {
  const markup = renderToStaticMarkup(React.createElement(ParentCreditHistory, { ...props,
    customers: [{ ...customer, balances: [{ currency: "usd", amount: 1200 }, { currency: "jpy", amount: -500 }] }],
    pages: [{ ...page, nextCursor: null, transactions: [{ ...transaction, amount: 1200, endingBalance: 1200 }] }] }))
  assert.match(markup, /Balance carried forward/)
  assert.match(markup, /\$12\.00 owed/)
  assert.match(markup, /¥500/)
  assert.doesNotMatch(markup, /Load more credit history/)
})

test("empty credit history and missing billing accounts explain the empty state", () => {
  const emptyHistory = renderToStaticMarkup(React.createElement(ParentCreditHistory, { ...props,
    customers: [{ ...customer, balances: [] }], pages: [{ ...page, transactions: [], nextCursor: null }] }))
  assert.match(emptyHistory, /No available credit/)
  assert.match(emptyHistory, /No credit balance activity yet/)
  const noAccount = renderToStaticMarkup(React.createElement(ParentCreditHistory, { ...props, customers: [], pages: [] }))
  assert.match(noAccount, /Credit history will appear after your billing account is created/)
})

function findElement(node, type) {
  if (!node || typeof node !== "object") return null
  if (node.type === type) return node
  for (const child of [node.props?.children].flat(Infinity)) {
    const found = findElement(child, type)
    if (found) return found
  }
  return null
}

async function parentFixture(t, response) {
  const state = [], requests = [], toasts = []
  let stateIndex = 0
  const legacyPage = { customerId: "cus_legacy", transactions: [], nextCursor: null }
  const initial = { customers: [customer], subscriptions: [], invoicePages: [], creditPages: [page, legacyPage], canAddPaymentMethod: false }
  t.mock.method(globalThis, "fetch", async url => { requests.push(url); return Response.json(response.body, { status: response.status ?? 200 }) })
  const stub = names => Object.fromEntries(names.map(name => [name, name]))
  const jsx = (type, props) => ({ type, props })
  const { ParentBilling } = await loadModule("../components/account/parent_billing.tsx", {
    react: {
      useState(value) {
        const index = stateIndex++
        if (!(index in state)) state[index] = index === 0 ? structuredClone(initial) : index === 2 ? false : value
        return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value }]
      },
      useCallback: callback => callback, useEffect() {},
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "lucide-react": stub(["CreditCard", "Download", "FileText", "LoaderCircle", "Plus", "RefreshCw", "Wallet"]),
    "@/components/ui/badge": stub(["Badge"]), "@/components/ui/button": stub(["Button"]),
    "@/components/ui/card": stub(["Card", "CardContent", "CardHeader", "CardTitle"]),
    "@/components/ui/dialog": stub(["Dialog", "DialogContent", "DialogDescription", "DialogFooter", "DialogHeader", "DialogTitle"]),
    "@/components/ui/toast": { useToast: () => ({ toast: value => toasts.push(value) }) },
    "@/components/account/billing_payment_form": stub(["BillingPaymentForm"]),
    "@/components/account/parent_credit_history": stub(["ParentCreditHistory"]),
    "@/lib/account/customer-billing-types": types,
  })
  const render = () => { stateIndex = 0; return ParentBilling() }
  return { state, requests, toasts, render, initial }
}

test("loading older credits appends distinct entries and preserves other accounts", async t => {
  const older = { ...transaction, id: "cbtxn_older", created: 1699000000 }
  const f = await parentFixture(t, { body: { ...page, transactions: [transaction, older], nextCursor: null } })
  const creditCard = findElement(f.render(), "ParentCreditHistory")
  creditCard.props.onMore(page)
  await setImmediate()
  assert.equal(f.requests[0], "/api/account/billing?history=credits&customerId=cus_family&cursor=cbtxn_used")
  assert.deepEqual(f.state[0].creditPages[0].transactions.map(item => item.id), ["cbtxn_used", "cbtxn_older"])
  assert.equal(f.state[0].creditPages[0].nextCursor, null)
  assert.deepEqual(f.state[0].creditPages[1], f.initial.creditPages[1])
  assert.equal(f.state[3], null)
})

test("credit pagination failures retain history and allow retry", async t => {
  const f = await parentFixture(t, { status: 502, body: { error: "Credit history is unavailable." } })
  findElement(f.render(), "ParentCreditHistory").props.onMore(page)
  await setImmediate()
  assert.deepEqual(f.state[0], f.initial)
  assert.equal(f.toasts[0].description, "Credit history is unavailable.")
  assert.equal(findElement(f.render(), "ParentCreditHistory").props.disabled, false)
})

test("credit invoice references open the existing authorized invoice breakdown", async t => {
  const f = await parentFixture(t, { body: { id: "in_owned", lines: [] } })
  findElement(f.render(), "ParentCreditHistory").props.onInvoice("in_owned")
  await setImmediate()
  assert.equal(f.requests[0], "/api/account/billing?invoiceId=in_owned")
  assert.equal(f.state[6].id, "in_owned")
})
