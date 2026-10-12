import assert from "node:assert/strict"
import test from "node:test"
import { loadTypeScriptModuleWithMocks as loadModule } from "./load-typescript.mjs"

const jsx = (type, props) => ({ type, props })

async function formFixture(t, result) {
  const state = [], refs = [], effects = [], confirmations = []
  let stateIndex = 0, refIndex = 0, saved = 0, destroyed = 0
  const elements = { create: (type, options) => {
    assert.equal(type, "payment")
    assert.equal(options.wallets.link, "never", "The add-card form must not offer the optional Link signup")
    return { mount() {}, destroy() { destroyed++ }, on(event, callback) { if (event === "ready") callback() } }
  } }
  const stripe = {
    elements(options) { assert.equal(options.clientSecret, "seti_demo_secret"); return elements },
    async confirmSetup(options) { confirmations.push(options); return result },
  }
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: { origin: "https://fusion.test" }, Stripe(key) { assert.equal(key, "pk_test_demo"); return stripe },
  } })
  t.after(() => { if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else delete globalThis.window })
  const { BillingPaymentForm } = await loadModule("../components/account/billing_payment_form.tsx", {
    react: {
      useState(initial) {
        const index = stateIndex++
        if (!(index in state)) state[index] = initial
        return [state[index], value => { state[index] = value }]
      },
      useRef(initial) { const index = refIndex++; return refs[index] ??= { current: initial } },
      useEffect(effect) { effects.push(effect) },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/script": { default: "Script" },
    "next-themes": { useTheme: () => ({ resolvedTheme: "light" }) },
    "lucide-react": { LoaderCircle: "LoaderCircle", LockKeyhole: "LockKeyhole" },
    "@/components/ui/button": { Button: "Button" },
  })
  const render = () => {
    stateIndex = 0; refIndex = 0; effects.length = 0
    return BillingPaymentForm({ clientSecret: "seti_demo_secret", publishableKey: "pk_test_demo", onSaved: async () => { saved++ } })
  }
  const first = render()
  first.props.children.find(child => child?.type === "Script").props.onReady()
  refs[0].current = {}
  render()
  const cleanup = effects[0]()
  const tree = render()
  return { state, confirmations, elements, cleanup, saved: () => saved, destroyed: () => destroyed,
    submit: () => tree.props.onSubmit({ preventDefault() {} }) }
}

test("saving a card confirms only the SetupIntent and reports success after Stripe verification", async t => {
  const f = await formFixture(t, { setupIntent: { status: "succeeded", payment_method: "pm_demo" } })
  await f.submit()
  assert.equal(f.saved(), 1)
  assert.deepEqual(f.confirmations[0], { elements: f.elements, redirect: "if_required", confirmParams: { return_url: "https://fusion.test/account#billing" } })
  assert.equal(f.state[2], false)
  f.cleanup()
  assert.equal(f.destroyed(), 1)
})

test("a Stripe verification error keeps the form open and never reports a saved card", async t => {
  const f = await formFixture(t, { error: { message: "Your card could not be verified." } })
  await f.submit()
  assert.equal(f.saved(), 0)
  assert.equal(f.state[3], "Your card could not be verified.")
  assert.equal(f.state[2], false)
})

test("a pending setup never claims the payment method is saved", async t => {
  const f = await formFixture(t, { setupIntent: { status: "processing", payment_method: null } })
  await f.submit()
  assert.equal(f.saved(), 0)
  assert.match(f.state[3], /still being verified/)
})
