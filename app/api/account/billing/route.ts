import { NextResponse } from "next/server"
import {
  BillingError,
  changeBillingPaymentMethod,
  changeBillingSubscription,
  createBillingSetupIntent,
  getBillingCreditPage,
  getBillingInvoice,
  getBillingInvoicePage,
  getCustomerBilling,
  getCustomerBillingContext,
} from "@/lib/account/customer-billing"

const privateHeaders = { "Cache-Control": "private, no-store" }

function failure(error: unknown) {
  if (!(error instanceof BillingError)) console.error("Customer billing request failed", error)
  return NextResponse.json({ error: error instanceof BillingError ? error.message :
    "Billing could not be updated or loaded. Refresh to check the latest information, then try again." },
  { status: error instanceof BillingError ? error.status : 502, headers: privateHeaders })
}

export async function GET(request: Request) {
  try {
    const context = await getCustomerBillingContext()
    const query = new URL(request.url).searchParams
    const invoiceId = query.get("invoiceId")
    const customerId = query.get("customerId")
    const creditHistory = query.get("history") === "credits"
    if (invoiceId && !/^in_[a-zA-Z0-9]+$/.test(invoiceId)) throw new BillingError("Invalid invoice.")
    if (creditHistory && !customerId) throw new BillingError("Select a billing account.")
    const data = creditHistory ? await getBillingCreditPage(context, customerId!, query.get("cursor") ?? undefined) :
      invoiceId ? await getBillingInvoice(context, invoiceId) : customerId ?
      await getBillingInvoicePage(context, customerId, query.get("cursor") ?? undefined) : await getCustomerBilling(context)
    return NextResponse.json(data, { headers: privateHeaders })
  } catch (error) { return failure(error) }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin")
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
      throw new BillingError("Billing changes must be made from this site.", 403)
    }
    const context = await getCustomerBillingContext()
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const action = body?.action
    if (action === "cancel" || action === "keep") {
      if (typeof body?.subscriptionId !== "string" || !/^sub_[a-zA-Z0-9]+$/.test(body.subscriptionId)) throw new BillingError("Invalid subscription.")
      await changeBillingSubscription(context, body.subscriptionId, action)
    } else if (action === "setup" || action === "default" || action === "remove") {
      if (typeof body?.customerId !== "string") throw new BillingError("Select a billing account.")
      if (action === "setup") return NextResponse.json(await createBillingSetupIntent(context, body.customerId), { headers: privateHeaders })
      if (typeof body?.methodId !== "string" || !/^pm_[a-zA-Z0-9]+$/.test(body.methodId)) throw new BillingError("Invalid payment method.")
      await changeBillingPaymentMethod(context, body.customerId, body.methodId, action)
    } else throw new BillingError("Unknown billing action.")
    return NextResponse.json({ ok: true }, { headers: privateHeaders })
  } catch (error) { return failure(error) }
}
