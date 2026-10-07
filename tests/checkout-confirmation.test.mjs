import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import * as jsx from "react/jsx-runtime"
import { renderToStaticMarkup } from "react-dom/server"
import { loadTypeScriptModuleWithMocks as loadModule } from "./load-typescript.mjs"

async function fixture(options = {}) {
  const enrollment = { enrollment_id: 42, stripe_customer_id: "cus_family", stripe_subscription_id: null, ...options.enrollment }
  const context = {
    enrollment,
    parent: { stripe_customer_id: "cus_family" },
    athlete: { first_name: "Alex", last_name: "Athlete" },
    classRecord: { class_name: "Tumbling" },
    team: { team_name: "Limitless" },
  }
  const session = {
    id: "cs_class", status: "complete", payment_status: "paid", customer: "cus_family",
    subscription: "sub_class", metadata: { enrollment_id: "42" },
    ...options.session,
  }
  const subscription = { id: "sub_class", status: "active", customer: "cus_family", ...options.subscription }
  const calls = []
  const getContext = async id => {
    calls.push(["context", id])
    if (options.ownershipError) throw new Error("This enrollment does not belong to your account.")
    return structuredClone(context)
  }
  const helpers = await loadModule("../lib/account/checkout-confirmation.ts", {
    "server-only": {},
    "@/lib/account/cheer-payments": {
      getParentCheerEnrollmentPaymentContext: getContext,
      finalizeCompletedCheerCheckoutSession: async args => {
        calls.push(["finalizeCheer", args])
        if (options.finalizationError) throw new Error(options.finalizationError)
        return { classSubscriptionsCanceled: options.classSubscriptionsCanceled ?? false }
      },
    },
    "@/lib/account/payments": {
      getParentEnrollmentPaymentContext: getContext,
      updateEnrollmentFromSubscription: async args => {
        calls.push(["update", args])
        if (options.finalizationError) throw new Error(options.finalizationError)
        if (options.waived) enrollment.payment_status = "payment_not_required"
        else if (!options.skipSave) enrollment.stripe_subscription_id = args.subscription.id
      },
    },
    "@/lib/stripe/server": { getStripe: () => ({
      checkout: { sessions: { retrieve: async id => { calls.push(["session", id]); return session } } },
      subscriptions: { retrieve: async id => { calls.push(["subscription", id]); return subscription } },
    }) },
  })
  return { helpers, calls, context }
}

const reference = { kind: "class", enrollmentId: "42", sessionId: "cs_class" }

test("the return path preserves Stripe's session placeholder and encodes values", async () => {
  const { helpers } = await fixture()
  assert.equal(helpers.getCheckoutConfirmationPath({ ...reference, sessionId: "{CHECKOUT_SESSION_ID}" }),
    "/account/checkout-confirmation?kind=class&enrollment=42&session_id={CHECKOUT_SESSION_ID}")
  const url = new URL(helpers.getCheckoutConfirmationPath({ ...reference, sessionId: "cs_with&extra=value" }), "https://example.test")
  assert.equal(url.searchParams.get("session_id"), "cs_with&extra=value")
  assert.equal(url.searchParams.get("extra"), null)
})

test("class confirmation saves a verified subscription before returning athlete and program details", async () => {
  for (const paymentStatus of ["paid", "no_payment_required"]) {
    const { helpers, calls } = await fixture({ session: { payment_status: paymentStatus }, subscription: { status: "trialing" } })
    assert.deepEqual(await helpers.getCheckoutConfirmation(reference), {
      kind: "class", athleteName: "Alex Athlete", programName: "Tumbling",
      classSubscriptionsCanceled: false, classPaymentWaived: false,
    })
    assert.equal(calls[0][0], "context")
    assert.equal(calls.find(([name]) => name === "update")[1].eventType, "checkout.session.completed")
    assert.equal(calls.at(-1)[0], "context")
  }
})

test("unfinished, unpaid, mismatched, or unsubscribed class sessions never update enrollment", async () => {
  for (const session of [
    { status: "open" }, { status: "expired" }, { payment_status: "unpaid" },
    { metadata: { enrollment_id: "999" } }, { metadata: { enrollment_id: "42", enrollment_kind: "cheer" } },
    { customer: "cus_other" }, { subscription: null },
  ]) {
    const { helpers, calls } = await fixture({ session })
    await assert.rejects(helpers.getCheckoutConfirmation(reference))
    assert.equal(calls.some(([name]) => name === "update"), false)
  }
  for (const subscription of [{ status: "canceled" }, { customer: "cus_other" }]) {
    const { helpers, calls } = await fixture({ subscription })
    await assert.rejects(helpers.getCheckoutConfirmation(reference))
    assert.equal(calls.some(([name]) => name === "update"), false)
  }
})

test("ownership failures prevent any Stripe access for both enrollment kinds", async () => {
  for (const kind of ["class", "cheer"]) {
    const { helpers, calls } = await fixture({ ownershipError: true })
    await assert.rejects(helpers.getCheckoutConfirmation({ ...reference, kind }), /does not belong/)
    assert.deepEqual(calls, [["context", "42"]])
  }
})

test("confirmation cannot claim success when enrollment persistence fails or saves a different subscription", async () => {
  for (const options of [{ finalizationError: "Database unavailable" }, { skipSave: true }]) {
    const { helpers } = await fixture(options)
    await assert.rejects(helpers.getCheckoutConfirmation(reference))
  }
})

test("a class checkout overtaken by a cheer waiver confirms the free enrollment", async () => {
  const { helpers } = await fixture({
    waived: true,
    enrollment: { payment_status: "payment_not_required" },
    subscription: { status: "canceled" },
  })
  assert.equal((await helpers.getCheckoutConfirmation(reference)).classPaymentWaived, true)
})

test("revisiting a cheer checkout cannot restart a cancelled subscription", async () => {
  for (const enrollment of [{ status: "canceled" }, { subscription_status: "canceled" }]) {
    const { helpers, calls } = await fixture({ enrollment })
    await assert.rejects(helpers.getCheckoutConfirmation({ ...reference, kind: "cheer" }), /cancelled/)
    assert.equal(calls.some(([name]) => name === "finalizeCheer"), false)
  }
})

test("cheer confirmation uses the verified cancellation result and never claims success when cancellation fails", async () => {
  for (const classSubscriptionsCanceled of [false, true]) {
    const { helpers, calls } = await fixture({ classSubscriptionsCanceled })
    const result = await helpers.getCheckoutConfirmation({ ...reference, kind: "cheer" })
    assert.equal(result.classSubscriptionsCanceled, classSubscriptionsCanceled)
    assert.equal(result.programName, "Limitless")
    assert.deepEqual(calls.at(-1), ["finalizeCheer", { enrollmentId: "42", sessionId: "cs_class", customerId: "cus_family" }])
  }
  const { helpers } = await fixture({ finalizationError: "Cancellation failed" })
  await assert.rejects(helpers.getCheckoutConfirmation({ ...reference, kind: "cheer" }), /Cancellation failed/)
})

async function renderPage(confirmation, options = {}) {
  const { helpers } = await fixture()
  const wrapper = ({ children }) => React.createElement("div", null, children)
  const { default: Page } = await loadModule("../app/account/checkout-confirmation/page.tsx", {
    "react/jsx-runtime": jsx,
    "next/link": { default: ({ href, children }) => React.createElement("a", { href }, children) },
    "next/navigation": { redirect: url => { throw new Error(`Redirect: ${url}`) } },
    "lucide-react": { ArrowRight: () => null, CircleCheck: () => null, Clock3: () => null },
    "@/components/account/dashboard_navigation": { AccountDashboardFrame: wrapper },
    "@/components/account/checkout_confirmation_retry": {
      CheckoutConfirmationRetry: () => React.createElement("p", null, "This page will check again automatically."),
    },
    "@/components/ui/button": { Button: wrapper },
    "@/components/ui/card": { Card: wrapper, CardContent: wrapper, CardHeader: wrapper },
    "@/lib/account/checkout-confirmation": {
      ...helpers,
      getCheckoutConfirmation: async () => {
        if (options.error) throw new Error(options.error)
        return confirmation
      },
    },
  })
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve({
    kind: confirmation?.kind ?? "cheer", enrollment: "42", session_id: "cs_test", ...options.query,
  }) }))
}

test("the confirmation page shows the subscription, program, account link, and cancellation notice only when appropriate", async () => {
  for (const kind of ["class", "cheer"]) {
    for (const classSubscriptionsCanceled of kind === "cheer" ? [false, true] : [false]) {
      const markup = await renderPage({ kind, athleteName: "Alex Athlete", programName: "Limitless", classSubscriptionsCanceled })
      assert.match(markup, /Your enrollment is confirmed!/)
      assert.match(markup, /subscription has been set up successfully/)
      assert.match(markup, /Alex Athlete/)
      assert.match(markup, /href="\/account"/)
      assert.equal(markup.includes("Class subscription automatically cancelled"), classSubscriptionsCanceled)
      assert.doesNotMatch(markup, /check again automatically/)
    }
  }
})

test("confirmation failures show a retry and account link without a successful subscription or cancellation notice", async () => {
  const originalError = console.error
  console.error = () => {}
  try {
    const markup = await renderPage(null, { error: "Stripe cancellation failed" })
    assert.match(markup, /confirming your checkout/)
    assert.match(markup, /Check again/)
    assert.match(markup, /check again automatically/)
    assert.match(markup, /href="\/account"/)
    assert.doesNotMatch(markup, /subscription has been set up successfully|automatically cancelled/)
  } finally { console.error = originalError }
})

test("malformed confirmation references return to the account", async () => {
  for (const query of [{ kind: "other" }, { session_id: undefined }, { enrollment: ["42", "43"] }]) {
    await assert.rejects(renderPage(null, { query }), /Redirect: \/account/)
  }
})

test("previous cheer checkout URLs forward the session to the new confirmation page", async () => {
  const { helpers } = await fixture()
  const { GET } = await loadModule("../app/api/cheer-enrollments/[enrollmentId]/complete/route.ts", {
    "@/lib/account/checkout-confirmation": helpers,
    "next/server": { NextResponse: { redirect: url => Response.redirect(url) } },
  })
  const response = await GET(new Request("https://example.test/api/cheer-enrollments/42/complete?session_id=cs_test"), { params: Promise.resolve({ enrollmentId: "42" }) })
  const url = new URL(response.headers.get("location"))
  assert.equal(url.pathname, "/account/checkout-confirmation")
  assert.equal(url.searchParams.get("kind"), "cheer")
  assert.equal(url.searchParams.get("session_id"), "cs_test")
})

test("cheer checkout and recovered checkout both send users to the confirmation page", async () => {
  const { helpers, context } = await fixture()
  for (const recoveredSession of [false, "cs_recovered"]) {
    const createdSessions = []
    const { POST } = await loadModule("../app/api/cheer-enrollments/[enrollmentId]/checkout/route.ts", {
      "next/headers": { headers: async () => new Map([["origin", "https://example.test"]]) },
      "next/server": { NextResponse: { json: value => Response.json(value) } },
      "@/lib/account/checkout-confirmation": helpers,
      "@/lib/account/cheer-payments": {
        getParentCheerEnrollmentPaymentContext: async () => context,
        ensureApprovedCheerEnrollment() {}, ensureSignedCheerContract() {}, ensureNoCheerSubscriptions() {},
        getCheerBillingConfig: () => ({ tuitionPriceId: "price_tuition", feePriceId: "price_fee" }),
        recoverCompletedCheerCheckout: async () => recoveredSession,
        saveCheerStripeCustomerId: async () => {},
      },
      "@/lib/stripe/server": {
        getNextBillingAnchorUnix: () => 1792022400,
        getStripe: () => ({ checkout: { sessions: { create: async args => {
          createdSessions.push(args)
          return { url: "https://checkout.example.test" }
        } } } }),
      },
    })
    const response = await POST(new Request("https://example.test"), { params: Promise.resolve({ enrollmentId: "42" }) })
    const body = await response.json()
    if (recoveredSession) {
      assert.equal(createdSessions.length, 0)
      const url = new URL(body.url)
      assert.equal(url.pathname, "/account/checkout-confirmation")
      assert.equal(url.searchParams.get("session_id"), recoveredSession)
    } else {
      assert.equal(createdSessions.length, 1)
      assert.equal(createdSessions[0].success_url,
        "https://example.test/account/checkout-confirmation?kind=cheer&enrollment=42&session_id={CHECKOUT_SESSION_ID}")
    }
  }
})
