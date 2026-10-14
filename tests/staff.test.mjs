import assert from "node:assert/strict"
import test from "node:test"
import { loadTypeScriptModule, loadTypeScriptModuleWithMocks } from "./load-typescript.mjs"

const pagination = await loadTypeScriptModule("../lib/account/pagination.ts")
const payload = {
  firstName: " Jamie ", lastName: " Coach ", email: " JAMIE@example.test ",
  phone: " 5551234567 ", password: " Initial-password-1 ",
}
const owner = { userId: "owner", isOwner: true, isAdmin: false, isCoach: false }
const auth = await loadTypeScriptModuleWithMocks("../lib/account/auth.ts", {
  "server-only": {}, "@/lib/supabase/server": {}, "@/lib/supabase/admin": {},
})

async function actionFixture({ session = owner, createError, roleError, noMembership = false, roleThrows = false, cleanupError, cleanupThrows = false } = {}) {
  const members = [{ user_id: "new-coach", role: "parent" }, { user_id: "existing-parent", role: "parent" }]
  const calls = []
  const refreshed = []
  let clientAccesses = 0
  const client = {
    auth: { admin: {
      async createUser(attributes) {
        calls.push({ operation: "create", attributes })
        return { data: { user: createError ? null : { id: "new-coach" } }, error: createError ?? null }
      },
      async deleteUser(userId) {
        calls.push({ operation: "delete", userId })
        if (cleanupThrows) throw new Error("Cleanup disconnected")
        return { error: cleanupError ?? null }
      },
    } },
    from(table) {
      assert.equal(table, "organization_members")
      const filters = []
      let updates
      const query = {
        update(value) { updates = value; return query },
        eq(key, value) { filters.push([key, value]); return query },
        async select() {
          calls.push({ operation: "role", filters, updates })
          if (roleThrows) throw new Error("Database disconnected")
          if (roleError || noMembership) return { data: [], error: roleError ?? null }
          const matches = members.filter(member => filters.every(([key, value]) => member[key] === value))
          for (const member of matches) Object.assign(member, updates)
          return { data: matches.map(({ user_id }) => ({ user_id })), error: null }
        },
      }
      return query
    },
  }
  const actions = await loadTypeScriptModuleWithMocks("../app/actions/staff.ts", {
    "next/cache": { revalidatePath: path => refreshed.push(path) },
    "@/lib/account/auth": { ...auth, getAccountSession: async () => session },
    "@/lib/account/pagination": pagination,
    "@/lib/supabase/admin": { createAdminClient: () => { clientAccesses++; return client } },
  })
  return { ...actions, calls, members, refreshed, clientAccesses: () => clientAccesses }
}

test("owners and admins create sign-in accounts and replace only the new user's default parent membership", async () => {
  for (const session of [owner, { ...owner, isOwner: false, isAdmin: true }]) {
    const fixture = await actionFixture({ session })
    const result = await fixture.createStaffAccount(payload)
    assert.equal(result.ok, true)
    assert.deepEqual(fixture.calls.map(call => call.operation), ["create", "role"])
    assert.deepEqual(fixture.calls[0].attributes, {
      email: "jamie@example.test", password: payload.password, email_confirm: true,
      user_metadata: { first_name: "Jamie", last_name: "Coach", full_name: "Jamie Coach", phone: "5551234567" },
    })
    assert.deepEqual(fixture.members, [
      { user_id: "new-coach", role: "coach" }, { user_id: "existing-parent", role: "parent" },
    ])
    assert.deepEqual(fixture.refreshed, ["/account/admin/staff", "/account", "/account/admin/time-clock"])
  }
})

test("signed-out users, parents, and coaches cannot create staff accounts", async () => {
  for (const session of [null, { isParent: true }, { isCoach: true }]) {
    const fixture = await actionFixture({ session })
    await assert.rejects(fixture.createStaffAccount(payload), /Unauthorized/)
    assert.equal(fixture.clientAccesses(), 0)
    assert.deepEqual(fixture.calls, [])
  }
})

test("invalid names, emails, and passwords are rejected before any auth or database mutation", async () => {
  for (const change of [{ firstName: " " }, { lastName: " " }, { email: "invalid" }, { password: "short" }]) {
    const fixture = await actionFixture()
    assert.equal((await fixture.createStaffAccount({ ...payload, ...change })).ok, false)
    assert.equal(fixture.clientAccesses(), 0)
  }
})

test("duplicate email and other auth errors do not change or delete an existing account", async () => {
  const fixture = await actionFixture({ createError: { message: "Email already registered" } })
  assert.deepEqual(await fixture.createStaffAccount(payload), { ok: false, message: "Email already registered" })
  assert.deepEqual(fixture.calls.map(call => call.operation), ["create"])
  assert.deepEqual(fixture.refreshed, [])
})

test("role errors, zero updated memberships, and thrown database errors remove the newly created auth account", async () => {
  for (const options of [{ roleError: { message: "Role update denied" } }, { noMembership: true }, { roleThrows: true }]) {
    const fixture = await actionFixture(options)
    assert.equal((await fixture.createStaffAccount(payload)).ok, false)
    assert.deepEqual(fixture.calls.map(call => call.operation), ["create", "role", "delete"])
    assert.equal(fixture.calls[2].userId, "new-coach")
    assert.deepEqual(fixture.refreshed, [])
  }
})

test("cleanup failures report the incomplete account and ask the owner to avoid another signup", async () => {
  for (const options of [{ cleanupError: { message: "Delete failed" } }, { cleanupThrows: true }]) {
    const fixture = await actionFixture({ noMembership: true, ...options })
    const result = await fixture.createStaffAccount(payload)
    assert.equal(result.ok, false)
    assert.match(result.message, /new account could not be removed/)
    assert.match(result.message, /before trying again/)
    assert.deepEqual(fixture.refreshed, [])
  }
})

async function deletionFixture({
  session = owner, targetRoles = ["coach"], readError, authError, authThrows = false,
  membershipError, membershipThrows = false,
} = {}) {
  const targetId = "target-coach"
  let members = [
    ...targetRoles.map(role => ({ user_id: targetId, role })),
    { user_id: "unrelated-parent", role: "parent" },
  ]
  const calls = []
  const refreshed = []
  let authDeleted = false
  let clientAccesses = 0
  const client = {
    auth: { admin: { async deleteUser(userId) {
      calls.push({ operation: "deleteAuth", userId })
      if (authThrows) throw new Error("Auth disconnected")
      if (authError) return { error: authError }
      if (authDeleted) return { error: { code: "user_not_found", message: "User not found" } }
      authDeleted = true
      return { error: null }
    } } },
    from(table) {
      assert.equal(table, "organization_members")
      const filters = []
      const query = {
        select() { return query },
        eq(key, value) { filters.push([key, value]); return query },
        order(key) { assert.equal(key, "role"); return query },
        async range(from) {
          calls.push({ operation: "readRoles", from, filters })
          const matches = members.filter(member => filters.every(([key, value]) => member[key] === value))
            .sort((a, b) => a.role.localeCompare(b.role))
          return { data: matches.slice(from, from + 1), count: matches.length, error: readError ?? null }
        },
        delete() { return query },
        then(resolve, reject) {
          calls.push({ operation: "deleteMembership", filters })
          if (membershipThrows) return Promise.reject(new Error("Cleanup disconnected")).then(resolve, reject)
          if (membershipError) return Promise.resolve({ error: membershipError }).then(resolve, reject)
          members = members.filter(member => !filters.every(([key, value]) => member[key] === value))
          return Promise.resolve({ error: null }).then(resolve, reject)
        },
      }
      return query
    },
  }
  const actions = await loadTypeScriptModuleWithMocks("../app/actions/staff.ts", {
    "next/cache": { revalidatePath: path => refreshed.push(path) },
    "@/lib/account/auth": { ...auth, getAccountSession: async () => session },
    "@/lib/account/pagination": pagination,
    "@/lib/supabase/admin": { createAdminClient: () => { clientAccesses++; return client } },
  })
  return {
    ...actions, targetId, calls, refreshed,
    members: () => members, authDeleted: () => authDeleted, clientAccesses: () => clientAccesses,
    allowMembershipCleanup() { membershipError = null; membershipThrows = false },
  }
}

test("owners and admins delete the coach's sign-in account and only that user's memberships", async () => {
  for (const session of [owner, { ...owner, isOwner: false, isAdmin: true }]) {
    const fixture = await deletionFixture({ session, targetRoles: ["coach", "parent"] })
    assert.equal((await fixture.deleteCoachAccount(` ${fixture.targetId} `)).ok, true)
    assert.equal(fixture.authDeleted(), true)
    assert.deepEqual(fixture.members(), [{ user_id: "unrelated-parent", role: "parent" }])
    const mutations = fixture.calls.filter(call => call.operation !== "readRoles")
    assert.deepEqual(mutations, [
      { operation: "deleteAuth", userId: fixture.targetId },
      { operation: "deleteMembership", filters: [["user_id", fixture.targetId]] },
    ])
    assert.deepEqual(fixture.refreshed, ["/account/admin/staff", "/account", "/account/admin/time-clock"])
  }
})

test("signed-out users, parents, and coaches cannot delete coach accounts", async () => {
  for (const session of [null, { isParent: true }, { isCoach: true }]) {
    const fixture = await deletionFixture({ session })
    await assert.rejects(fixture.deleteCoachAccount(fixture.targetId), /Unauthorized/)
    assert.equal(fixture.clientAccesses(), 0)
    assert.deepEqual(fixture.calls, [])
  }
})

test("blank IDs and self-deletion are rejected before accessing the service client", async () => {
  for (const userId of [" ", ` ${owner.userId} `]) {
    const fixture = await deletionFixture()
    assert.equal((await fixture.deleteCoachAccount(userId)).ok, false)
    assert.equal(fixture.clientAccesses(), 0)
  }
})

test("deletion rejects non-coaches and all owner/admin accounts, checking every membership page", async () => {
  for (const targetRoles of [[], ["parent"], ["owner"], ["admin"], ["coach", "owner"], ["admin", "coach"], ["coach", "coach", "owner"]]) {
    const fixture = await deletionFixture({ targetRoles })
    assert.equal((await fixture.deleteCoachAccount(fixture.targetId)).ok, false)
    assert.equal(fixture.authDeleted(), false)
    assert.ok(fixture.calls.every(call => call.operation === "readRoles"))
    assert.deepEqual(fixture.refreshed, [])
  }
})

test("membership read failures and Auth deletion failures leave all memberships intact", async () => {
  for (const options of [{ readError: { message: "Read failed" } }, { authError: { message: "Delete failed" } }, { authThrows: true }]) {
    const fixture = await deletionFixture(options)
    assert.equal((await fixture.deleteCoachAccount(fixture.targetId)).ok, false)
    assert.equal(fixture.authDeleted(), false)
    assert.equal(fixture.members().length, 2)
    assert.ok(!fixture.calls.some(call => call.operation === "deleteMembership"))
    assert.deepEqual(fixture.refreshed, [])
  }
})

test("failed membership cleanup is reported honestly and can be retried after Auth deletion", async () => {
  for (const options of [{ membershipError: { message: "Delete failed" } }, { membershipThrows: true }]) {
    const fixture = await deletionFixture(options)
    const result = await fixture.deleteCoachAccount(fixture.targetId)
    assert.equal(result.ok, false)
    assert.match(result.message, /sign-in account was deleted.*retry deletion/)
    assert.equal(fixture.authDeleted(), true)
    assert.equal(fixture.members().length, 2)

    fixture.allowMembershipCleanup()
    assert.equal((await fixture.deleteCoachAccount(fixture.targetId)).ok, true)
    assert.deepEqual(fixture.members(), [{ user_id: "unrelated-parent", role: "parent" }])
  }
})

async function listFixture({ session = owner, readError, profileError, extraMembers = [], extraProfiles = {} } = {}) {
  const members = [
    { user_id: "z", role: "coach" }, { user_id: "parent", role: "parent" },
    { user_id: "a", role: "coach" }, { user_id: "a", role: "coach" },
    { user_id: "fallback", role: "coach" },
    ...extraMembers,
  ]
  const profiles = {
    z: { email: "z@example.test", user_metadata: { full_name: " Zoe Coach ", phone: "5551234567" } },
    a: { email: "a@example.test", phone: "5557654321", user_metadata: { first_name: "Amy", last_name: "Coach" } },
    fallback: { email: "fallback@example.test", user_metadata: {} },
    ...extraProfiles,
  }
  const ranges = []
  const users = []
  let clientAccesses = 0
  const staff = await loadTypeScriptModuleWithMocks("../lib/account/staff.ts", {
    "server-only": {},
    "@/lib/account/auth": { ...auth, getAccountSession: async () => session },
    "@/lib/account/pagination": pagination,
    "@/lib/supabase/admin": { createAdminClient: () => {
      clientAccesses++
      return {
        from(table) {
          assert.equal(table, "organization_members")
          let roles
          const query = {
            select() { return query },
            in(key, values) { assert.equal(key, "role"); roles = values; return query },
            order(key) { assert.ok(["user_id", "role"].includes(key)); return query },
            async range(from, to) {
              ranges.push([from, to])
              const rows = members.filter(member => roles.includes(member.role)).sort((a, b) => a.user_id.localeCompare(b.user_id) || a.role.localeCompare(b.role))
              return { data: rows.slice(from, Math.min(from + 2, to + 1)), count: rows.length, error: readError ?? null }
            },
          }
          return query
        },
        auth: { admin: { async getUserById(userId) {
          users.push(userId)
          return { data: { user: profiles[userId] }, error: profileError ?? null }
        } } },
      }
    } },
  })
  return { ...staff, ranges, users, clientAccesses: () => clientAccesses }
}

test("coach listing reads all membership pages, excludes parents, deduplicates users, and sorts profile names", async () => {
  const fixture = await listFixture()
  assert.deepEqual(await fixture.getCoachAccounts(), [
    { userId: "a", name: "Amy Coach", email: "a@example.test", phone: "5557654321", canDelete: true },
    { userId: "fallback", name: "fallback@example.test", email: "fallback@example.test", phone: null, canDelete: true },
    { userId: "z", name: "Zoe Coach", email: "z@example.test", phone: "5551234567", canDelete: true },
  ])
  assert.deepEqual(fixture.ranges.map(([from]) => from), [0, 2])
  assert.deepEqual(fixture.users, ["a", "fallback", "z"])
})

test("coach account reads enforce owner/admin access before using the service client", async () => {
  for (const session of [null, { isParent: true }, { isCoach: true }]) {
    const fixture = await listFixture({ session })
    await assert.rejects(fixture.getCoachAccounts(), /Unauthorized/)
    assert.equal(fixture.clientAccesses(), 0)
  }
})

test("coach listing reports database and auth failures instead of showing an empty list", async () => {
  for (const options of [{ readError: { message: "Memberships unavailable" } }, { profileError: { message: "Profiles unavailable" } }]) {
    const fixture = await listFixture(options)
    await assert.rejects(fixture.getCoachAccounts(), /unavailable/)
  }
})

test("coach listing protects self, owners and admins, including roles on later membership pages", async () => {
  const fixture = await listFixture({
    session: { ...owner, userId: "a" },
    extraMembers: [{ user_id: "z", role: "admin" }, { user_id: "fallback", role: "owner" }],
  })
  assert.ok((await fixture.getCoachAccounts()).every(account => !account.canDelete))
  assert.equal(fixture.ranges.length, 3)
})

test("deleted auth accounts remain visible so incomplete membership cleanup can be retried", async () => {
  const fixture = await listFixture({ profileError: { code: "user_not_found", message: "User not found" } })
  const accounts = await fixture.getCoachAccounts()
  assert.equal(accounts.length, 3)
  assert.ok(accounts.every(account => account.name.startsWith("Deleted coach account") && account.canDelete))
})

test("the staff page redirects unauthorized visitors before loading coach accounts", async () => {
  for (const [session, destination] of [[null, "/login"], [{ isParent: true }, "/account"], [{ isCoach: true }, "/account"]]) {
    let reads = 0
    const guards = await loadTypeScriptModuleWithMocks("../app/account/_lib/route-guards.ts", {
      "server-only": {},
      "next/navigation": { redirect(path) { throw new Error(`Redirect: ${path}`) } },
      "@/lib/account/auth": { getAccountSession: async () => session },
    })
    const page = await loadTypeScriptModuleWithMocks("../app/account/admin/staff/page.tsx", {
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "@/app/account/_lib/route-guards": guards,
      "@/components/account/dashboard_navigation": ui(["AccountDashboardFrame", "AccountSectionHeader"]),
      "@/components/account/dashboard_routes": { adminDashboardRoutes: { staff: {} } },
      "@/components/account/admin/staff_manager": ui(["StaffManager"]),
      "@/lib/account/staff": { getCoachAccounts() { reads++; return [] } },
    })
    await assert.rejects(page.default(), error => error.message === `Redirect: ${destination}`)
    assert.equal(reads, 0)
  }
})

const ui = names => Object.fromEntries(names.map(name => [name, name]))
const jsx = (type, props) => ({ type, props })

function findForm(node) {
  if (!node || typeof node !== "object") return null
  if (node.type === "form") return node
  for (const child of [node.props?.children].flat()) {
    const form = findForm(child)
    if (form) return form
  }
  return null
}

async function formFixture(t, createStaffAccount, { accounts = [], deleteCoachAccount = async () => ({ ok: true, message: "Deleted" }) } = {}) {
  const state = []
  let hookIndex = 0
  let resetCount = 0
  let refreshCount = 0
  const toasts = []
  const form = { reset() { resetCount++ } }
  const originalFormData = Object.getOwnPropertyDescriptor(globalThis, "FormData")
  Object.defineProperty(globalThis, "FormData", {
    configurable: true,
    value: class {
      constructor(value) { assert.equal(value, form) }
      get(key) { return payload[key] }
    },
  })
  t.after(() => Object.defineProperty(globalThis, "FormData", originalFormData))
  const { StaffManager } = await loadTypeScriptModuleWithMocks("../components/account/admin/staff_manager.tsx", {
    react: { useState(initial) {
      const index = hookIndex++
      if (index === state.length) state.push(initial)
      return [state[index], value => { state[index] = value }]
    } },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "lucide-react": ui(["UserRoundPlus", "Trash2"]),
    "next/navigation": { useRouter: () => ({ refresh() { refreshCount++ } }) },
    "@/app/actions/staff": { createStaffAccount, deleteCoachAccount },
    "@/components/ui/badge": ui(["Badge"]),
    "@/components/ui/button": ui(["Button"]),
    "@/components/ui/card": ui(["Card", "CardContent", "CardHeader", "CardTitle"]),
    "@/components/ui/dialog": ui(["Dialog", "DialogContent", "DialogDescription", "DialogFooter", "DialogHeader", "DialogTitle"]),
    "@/components/ui/input": ui(["Input"]),
    "@/components/ui/label": ui(["Label"]),
    "@/components/ui/table": ui(["Table", "TableBody", "TableCell", "TableHead", "TableHeader", "TableRow"]),
    "@/components/ui/toast": { useToast: () => ({ toast: value => toasts.push(value) }) },
    "@/functions/shared_functions": { formatPhoneNumber: value => value },
  })
  const render = () => {
    hookIndex = 0
    return StaffManager({ accounts })
  }
  render()
  return {
    state, toasts, render,
    submit: () => findForm(render()).props.onSubmit({ preventDefault() {}, currentTarget: form }),
    resetCount: () => resetCount, refreshCount: () => refreshCount,
  }
}

test("staff form submits account details, clears credentials and refreshes the coach list after success", async t => {
  let submitted
  const fixture = await formFixture(t, async value => { submitted = value; return { ok: true, message: "Coach created" } })
  await fixture.submit()
  assert.deepEqual(submitted, payload)
  assert.deepEqual(fixture.state.slice(0, 2), [false, null])
  assert.equal(fixture.resetCount(), 1)
  assert.equal(fixture.refreshCount(), 1)
  assert.equal(fixture.toasts[0].variant, "success")
})

test("staff form preserves input for retry and shows returned or thrown creation errors", async t => {
  for (const create of [async () => ({ ok: false, message: "Create failed" }), async () => { throw new Error("Create failed") }]) {
    await t.test(async t => {
      const fixture = await formFixture(t, create)
      await fixture.submit()
      assert.deepEqual(fixture.state.slice(0, 2), [false, "Create failed"])
      assert.equal(fixture.resetCount(), 0)
      assert.equal(fixture.refreshCount(), 0)
      assert.deepEqual(fixture.toasts, [])
    })
  }
})

function findElements(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => findElements(child, predicate))
  if (!node || typeof node !== "object") return []
  return [...(predicate(node) ? [node] : []), ...findElements(node.props?.children, predicate)]
}

const coachToDelete = { userId: "coach", name: "Jamie Coach", email: "jamie@example.test", phone: null, canDelete: true }
const deleteRowButton = fixture => findElements(fixture.render(), node => node.type === "Button" && node.props["aria-label"] === "Delete Jamie Coach's account")[0]
const confirmDeleteButton = fixture => findElements(fixture.render(), node => node.type === "Button" && ["Delete account", "Deleting account…"].includes(node.props.children))[0]

test("deleting requires explicit confirmation, cancellation makes no request, and success refreshes the list", async t => {
  const requests = []
  const fixture = await formFixture(t, async () => {}, {
    accounts: [coachToDelete],
    deleteCoachAccount: async userId => { requests.push(userId); return { ok: true, message: "Deleted" } },
  })
  deleteRowButton(fixture).props.onClick()
  assert.deepEqual(requests, [])
  assert.equal(fixture.state[2].userId, coachToDelete.userId)
  const cancelButton = findElements(fixture.render(), node => node.type === "Button" && node.props.children === "Cancel")[0]
  cancelButton.props.onClick()
  assert.equal(fixture.state[2], null)
  assert.deepEqual(requests, [])

  deleteRowButton(fixture).props.onClick()
  await confirmDeleteButton(fixture).props.onClick()
  assert.deepEqual(requests, [coachToDelete.userId])
  assert.deepEqual(fixture.state.slice(2), [null, false, null])
  assert.equal(fixture.refreshCount(), 1)
  assert.equal(fixture.toasts[0].title, "Coach account deleted")
})

test("deletion errors stay visible in the confirmation dialog and allow retry", async t => {
  for (const failure of [async () => ({ ok: false, message: "Delete failed" }), async () => { throw new Error("Delete failed") }]) {
    await t.test(async t => {
      const fixture = await formFixture(t, async () => {}, { accounts: [coachToDelete], deleteCoachAccount: failure })
      deleteRowButton(fixture).props.onClick()
      await confirmDeleteButton(fixture).props.onClick()
      assert.deepEqual(fixture.state.slice(2), [coachToDelete, false, "Delete failed"])
      assert.equal(fixture.refreshCount(), 0)
      assert.deepEqual(fixture.toasts, [])
    })
  }
})

test("pending deletion disables repeat submission and keeps the confirmation open", async t => {
  let finish
  const fixture = await formFixture(t, async () => {}, {
    accounts: [coachToDelete], deleteCoachAccount: () => new Promise(resolve => { finish = resolve }),
  })
  deleteRowButton(fixture).props.onClick()
  const pending = confirmDeleteButton(fixture).props.onClick()
  assert.equal(confirmDeleteButton(fixture).props.disabled, true)
  assert.equal(deleteRowButton(fixture).props.disabled, true)
  const dialog = findElements(fixture.render(), node => node.type === "Dialog")[0]
  dialog.props.onOpenChange(false)
  assert.equal(fixture.state[2].userId, coachToDelete.userId)
  finish({ ok: true, message: "Deleted" })
  await pending
  assert.equal(fixture.state[2], null)
})

test("protected coach rows disable the delete button", async t => {
  const fixture = await formFixture(t, async () => {}, { accounts: [{ ...coachToDelete, canDelete: false }] })
  assert.equal(deleteRowButton(fixture).props.disabled, true)
})
