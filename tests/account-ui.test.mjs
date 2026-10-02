import assert from "node:assert/strict"
import { setImmediate } from "node:timers/promises"
import test from "node:test"
import { loadTypeScriptModuleWithMocks } from "./load-typescript.mjs"

function hookFixture() {
  const state = []
  const effects = []
  return {
    state, effects,
    react: {
      useState(initial) {
        const index = state.push(initial) - 1
        return [initial, value => { state[index] = value }]
      },
      useMemo: calculate => calculate(),
      useEffect: effect => { effects.push(effect) },
    },
  }
}

const jsx = (type, props) => ({ type, props })
const jsxRuntime = { jsx, jsxs: jsx }

function replaceGlobal(t, name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  })
}

async function authFixture(t) {
  const hooks = hookFixture()
  const requests = []
  const events = new EventTarget()
  let onAuth
  let unsubscribeCount = 0
  let stopEffect = () => {}
  const cleanup = () => {
    stopEffect()
    stopEffect = () => {}
  }
  t.after(cleanup)
  replaceGlobal(t, "window", events)
  t.mock.method(globalThis, "fetch", (url, options) => new Promise(resolve => {
    requests.push({
      url, signal: options.signal,
      resolve: (payload, ok = true) => resolve({ ok, json: async () => payload }),
    })
  }))
  const { default: AuthButton } = await loadTypeScriptModuleWithMocks("../components/navigation/navbar/AuthButton.tsx", {
    react: hooks.react,
    "react/jsx-runtime": jsxRuntime,
    "./logon_button": { default: "LogonButton" },
    "./profile_button": { default: "ProfileButton" },
    "@/lib/supabase/client": { default: () => ({ auth: {
      onAuthStateChange(callback) {
        onAuth = callback
        return { data: { subscription: { unsubscribe: () => { unsubscribeCount++ } } } }
      },
    } }) },
  })
  AuthButton()
  stopEffect = hooks.effects[0]()
  return {
    ...hooks, requests, cleanup,
    emit: (event, id) => onAuth(event, id ? { user: { id } } : null),
    refresh: () => events.dispatchEvent(new Event("account-enrollment-selection-updated")),
    unsubscribeCount: () => unsubscribeCount,
  }
}

test("initial session and overlapping auth events perform one role request", async t => {
  const fixture = await authFixture(t)
  fixture.emit("INITIAL_SESSION", "parent")
  fixture.emit("SIGNED_IN", "parent")
  fixture.emit("TOKEN_REFRESHED", "parent")
  assert.equal(fixture.requests.length, 1)
  assert.equal(fixture.requests[0].url, "/api/account/roles")
  fixture.requests[0].resolve({ isStaff: true, requiresEnrollmentSelection: true })
  await setImmediate()
  assert.deepEqual(fixture.state, [{ id: "parent" }, true, true])
})

test("enrollment changes replace in-flight role requests and ignore stale responses", async t => {
  const fixture = await authFixture(t)
  fixture.emit("INITIAL_SESSION", "parent")
  fixture.refresh()
  assert.equal(fixture.requests.length, 2)
  assert.equal(fixture.requests[0].signal.aborted, true)
  fixture.requests[1].resolve({ isStaff: false, requiresEnrollmentSelection: true })
  await setImmediate()
  fixture.requests[0].resolve({ isStaff: true, requiresEnrollmentSelection: false })
  await setImmediate()
  assert.deepEqual(fixture.state, [{ id: "parent" }, false, true])
})

test("account switches and sign-out clear old role access even if a response arrives later", async t => {
  const fixture = await authFixture(t)
  fixture.emit("INITIAL_SESSION", "staff")
  fixture.requests[0].resolve({ isStaff: true })
  await setImmediate()
  fixture.emit("SIGNED_IN", "parent")
  assert.deepEqual(fixture.state, [{ id: "parent" }, false, false])
  fixture.emit("SIGNED_OUT", null)
  assert.equal(fixture.requests[1].signal.aborted, true)
  fixture.requests[1].resolve({ isStaff: true, requiresEnrollmentSelection: true })
  await setImmediate()
  assert.deepEqual(fixture.state, [null, false, false])
})

test("unmount aborts role work and removes the enrollment event listener", async t => {
  const fixture = await authFixture(t)
  fixture.emit("INITIAL_SESSION", "staff")
  fixture.cleanup()
  assert.equal(fixture.requests[0].signal.aborted, true)
  assert.equal(fixture.unsubscribeCount(), 1)
  fixture.refresh()
  assert.equal(fixture.requests.length, 1)
  fixture.requests[0].resolve({ isStaff: true })
  await setImmediate()
  assert.equal(fixture.state[1], false)
})

function findElement(node, type) {
  if (!node || typeof node !== "object") return null
  if (node.type === type) return node
  for (const child of [node.props?.children].flat()) {
    const found = findElement(child, type)
    if (found) return found
  }
  return null
}

async function accountFormFixture(t, updateUser) {
  const hooks = hookFixture()
  let refreshCount = 0
  const fields = { phone: "5551234567", address: "New address", city: "New city", state: "KY", zip_code: "40202" }
  replaceGlobal(t, "FormData", class {
    get(key) { return fields[key] }
  })
  const ui = names => Object.fromEntries(names.map(name => [name, name]))
  const { default: ManageAccountCard } = await loadTypeScriptModuleWithMocks("../components/account/manage_account.tsx", {
    react: hooks.react,
    "react/jsx-runtime": jsxRuntime,
    "next/navigation": { useRouter: () => ({ refresh: () => { refreshCount++ } }) },
    "@/lib/supabase/client": { default: () => ({ auth: { updateUser } }) },
    "@/components/ui/field": ui(["Field", "FieldGroup"]),
    "@/components/ui/input": ui(["Input"]),
    "@/components/ui/label": ui(["Label"]),
    "@/components/ui/button": ui(["Button"]),
    "@/components/ui/dialog": ui(["Dialog", "DialogClose", "DialogContent", "DialogDescription", "DialogFooter", "DialogHeader", "DialogTitle", "DialogTrigger"]),
    "lucide-react": ui(["Pencil"]),
  })
  const tree = ManageAccountCard({ phone: "Old phone", address: "Old address", city: "Old city", state: "IN", zip_code: "47586" })
  tree.props.onOpenChange(true)
  return {
    ...hooks, fields,
    submit: () => findElement(tree, "form").props.onSubmit({ preventDefault() {}, currentTarget: {} }),
    refreshCount: () => refreshCount,
  }
}

test("account save submits edited contact fields and refreshes only after success", async t => {
  let payload
  const fixture = await accountFormFixture(t, async value => { payload = value; return { error: null } })
  await fixture.submit()
  assert.deepEqual(payload, { data: fixture.fields })
  assert.deepEqual(fixture.state, [false, false, null])
  assert.equal(fixture.refreshCount(), 1)
})

test("account save failures keep the dialog open and allow retry", async t => {
  let fail = true
  const fixture = await accountFormFixture(t, async () => ({ error: fail ? new Error("Save failed") : null }))
  await fixture.submit()
  assert.deepEqual(fixture.state, [true, false, "Save failed"])
  assert.equal(fixture.refreshCount(), 0)
  fail = false
  await fixture.submit()
  assert.deepEqual(fixture.state, [false, false, null])
  assert.equal(fixture.refreshCount(), 1)
})
