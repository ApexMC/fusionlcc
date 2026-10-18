import assert from "node:assert/strict"
import test from "node:test"
import { loadTypeScriptModule, loadTypeScriptModuleWithMocks } from "./load-typescript.mjs"

const attendance = await loadTypeScriptModule("../lib/account/attendance.ts")
const dates = await loadTypeScriptModule("../lib/date_keys.ts")
const times = await loadTypeScriptModule("../lib/local_time.ts")
const presentation = await loadTypeScriptModuleWithMocks("../lib/account/session_presentation.ts", {
  "@/lib/date_keys": dates, "@/lib/local_time": times,
})
const adapter = await loadTypeScriptModuleWithMocks("../lib/account/cheer-session-attendance.ts", {
  "@/lib/account/attendance": attendance,
})
const ui = names => Object.fromEntries(names.map(name => [name, name]))
const jsx = (type, props) => ({ type, props })
function nodes(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate))
  if (!node || typeof node !== "object") return []
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)]
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join("")
  if (node == null || typeof node === "boolean") return ""
  if (typeof node !== "object") return String(node)
  return text(node.props?.children)
}
const session = {
  sessionId: "200", teamId: "2", teamName: "Stars", scheduleId: "20", scheduleLabel: "Wednesday 6–8 PM",
  sessionDate: "2026-10-15", startsAt: "18:00", endsAt: "20:00", status: "completed", type: "practice",
}
const athletes = [
  { id: "1", name: "Amy Athlete", createdOn: null, parentName: "Pat Parent", parentPhone: "555-0100", parentEmail: "parent@example.test" },
  { id: "2", name: "Zoe Athlete", createdOn: null, parentName: "Jamie Parent", parentPhone: "555-0200", parentEmail: "jamie@example.test" },
]
function dataFixture() {
  return {
    sessions: [{ id: "200", date: session.sessionDate, status: session.status, category: "cheer", programId: "2", programName: "Stars", scheduleId: "20" }],
    athletes: structuredClone(athletes), ready: true, notices: [], today: "2026-10-17",
    events: athletes.map((athlete, index) => ({
      athleteId: athlete.id, enrollmentId: String(21 + index), sessionId: "200", status: index === 0 ? "present" : null,
      date: session.sessionDate, category: "cheer", programId: "2", programName: "Stars", sessionStatus: "completed",
      isMakeup: false, notes: index === 0 ? "Reviewed note" : null,
      reviewedAt: index === 0 ? "2026-10-15T23:00:00Z" : null, reviewedBy: index === 0 ? "coach" : null,
    })),
  }
}

async function viewFixture({ data = dataFixture(), sessions = [session], saveCheer = async () => ({ ok: true, message: "Saved", reviewedAt: "2026-10-17T18:00:00Z" }) } = {}) {
  const states = new Map(), requests = [], classRequests = [], toasts = []
  let frame, refreshes = 0
  const react = {
    useState(initial) {
      const state = frame.state, index = frame.index++
      if (index === state.length) state.push(typeof initial === "function" ? initial() : initial)
      return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value }]
    },
    useMemo: callback => callback(), useId: () => "test-id", Fragment: "Fragment",
  }
  const render = (Component, props, key) => {
    const state = states.get(key) ?? []
    states.set(key, state)
    frame = { state, index: 0 }
    return Component(props)
  }
  const shared = await loadTypeScriptModuleWithMocks("../components/account/admin/class_session_review.tsx", {
    react, "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "next/navigation": { useRouter: () => ({ refresh: () => refreshes++ }) },
    "lucide-react": ui(["ArrowUpDown", "Ban", "CalendarDays", "ChevronDown", "ClipboardCheck", "Save", "Search", "UserPlus", "X"]),
    "@/components/ui/badge": ui(["Badge"]), "@/components/ui/button": ui(["Button"]),
    "@/components/ui/input": ui(["Input"]), "@/components/ui/smart-select": ui(["SmartSelect"]),
    "@/components/ui/card": ui(["Card", "CardContent", "CardHeader", "CardTitle"]),
    "@/components/ui/dialog": ui(["Dialog", "DialogContent", "DialogDescription", "DialogFooter", "DialogHeader", "DialogTitle"]),
    "@/components/ui/table": ui(["Table", "TableBody", "TableCell", "TableHead", "TableHeader", "TableRow"]),
    "@/components/ui/toast": { useToast: () => ({ toast: value => toasts.push(value) }) },
    "@/app/actions/class-attendance": { updateClassSessionAttendanceBatch: async input => { classRequests.push(input); return { ok: true, message: "Class saved" } } },
    "@/app/actions/class-sessions": {}, "@/lib/date_keys": { ...dates, getDateKeyInTimeZone: () => "2026-10-17" },
    "@/lib/local_time": times, "@/lib/account/attendance": attendance, "@/lib/account/session_presentation": presentation,
  })
  const cheer = await loadTypeScriptModuleWithMocks("../components/account/admin/cheer_session_review.tsx", {
    react, "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/app/actions/attendance": { saveCheerAttendance: async input => { requests.push(input); return saveCheer(input) } },
    "@/components/account/admin/class_session_review": shared,
    "@/lib/account/cheer-session-attendance": adapter,
  })
  const wrapper = render(cheer.CheerSessionReview, { sessions, attendance: data, initialSessionId: "200" }, "wrapper")
  const renderReview = () => render(wrapper.type, wrapper.props, "review")
  const renderRoster = () => {
    const node = nodes(renderReview(), node => typeof node.type === "function" && node.type.name === "AttendanceReviewTable")[0]
    assert.ok(node, "an inline attendance review should be expanded")
    return render(node.type, node.props, "roster")
  }
  return { shared, wrapper, data, requests, classRequests, toasts, renderReview, renderRoster,
    refreshes: () => refreshes,
    save: () => nodes(renderRoster(), node => node.type === "Button" && text(node).includes("Save Attendance"))[0].props.onClick(),
    setStatus(name, value) { nodes(renderRoster(), node => node.type === "SmartSelect" && node.props["aria-label"] === `Attendance for ${name}`)[0].props.onValueChange(value) },
    setNotes(name, value) { nodes(renderRoster(), node => node.type === "Input" && node.props["aria-label"] === `Notes for ${name}`)[0].props.onChange({ target: { value } }) },
  }
}

test("cheer uses the class session component with the same inline review, filters and roster columns", async () => {
  const fixture = await viewFixture()
  assert.equal(fixture.wrapper.type, fixture.shared.ClassSessionReview)
  const review = fixture.renderReview()
  assert.match(text(review), /Cheer Practice Sessions/)
  assert.ok(nodes(review, node => node.type === "Button" && text(node).includes("Close Review")).length)
  assert.ok(nodes(review, node => node.type === "Button" && text(node) === "Close").length)
  assert.ok(nodes(review, node => node.type === "SmartSelect" && node.props.options.some(option => option.label === "All teams")).length)
  assert.ok(nodes(review, node => node.type === "SmartSelect" && node.props.options.some(option => option.label === "Needs review")).length)
  const roster = fixture.renderRoster()
  assert.deepEqual(nodes(roster, node => node.type === "TableHead").map(text), ["Athlete", "Parent", "Attendance", "Notes", "Reviewed"])
  assert.match(text(roster), /Pat Parent/)
  assert.match(text(roster), /555-0100/)
  assert.match(text(roster), /Enrollment #21/)
  assert.equal(nodes(roster, node => node.type === "Dialog").length, 0)
  const selector = nodes(roster, node => node.type === "SmartSelect")[0]
  assert.deepEqual(selector.props.options.map(option => option.label), ["Mark attendance", "Present", "Unexcused absence", "Excused absence", "Late"])
})

test("cheer saves edited attendance and notes through its own action without closing the inline review", async () => {
  const fixture = await viewFixture()
  fixture.setStatus("Zoe Athlete", "excused")
  fixture.setNotes("Zoe Athlete", "School game")
  await fixture.save()
  assert.deepEqual(fixture.requests, [{ sessionId: "200", attendance: [
    { athleteId: "1", status: "present", notes: "Reviewed note" },
    { athleteId: "2", status: "excused", notes: "School game" },
  ] }])
  assert.deepEqual(fixture.classRequests, [])
  assert.equal(fixture.refreshes(), 1)
  assert.equal(fixture.toasts[0].title, "Attendance saved")
  assert.match(text(fixture.renderRoster()), /2 \/ 2 ready/)
  assert.ok(nodes(fixture.renderReview(), node => node.type === "Button" && text(node).includes("Close Review")).length)
})

test("missing attendance prevents submission, and failed saves retain drafts for retry", async () => {
  let fail = true
  const fixture = await viewFixture({ saveCheer: async () => fail ? { ok: false, message: "Save failed" } : { ok: true, message: "Saved" } })
  await fixture.save()
  assert.equal(fixture.requests.length, 0)
  assert.equal(fixture.toasts[0].title, "Attendance not saved")
  fixture.setStatus("Zoe Athlete", "absent")
  fixture.setNotes("Zoe Athlete", "Work")
  await fixture.save()
  assert.equal(fixture.refreshes(), 0)
  assert.equal(fixture.toasts.at(-1).title, "Attendance save failed")
  assert.equal(nodes(fixture.renderRoster(), node => node.type === "Input" && node.props["aria-label"] === "Notes for Zoe Athlete")[0].props.value, "Work")
  fail = false
  await fixture.save()
  assert.equal(fixture.requests.length, 2)
  assert.equal(fixture.refreshes(), 1)
})

test("historical athletes without enrollment links keep independent drafts and real athlete identifiers", async () => {
  const data = dataFixture()
  data.events.forEach(event => { event.enrollmentId = null; event.status = null })
  const fixture = await viewFixture({ data })
  fixture.setStatus("Amy Athlete", "excused")
  fixture.setStatus("Zoe Athlete", "late")
  await fixture.save()
  assert.deepEqual(fixture.requests[0].attendance.map(entry => [entry.athleteId, entry.status]), [["1", "excused"], ["2", "late"]])
  assert.match(text(fixture.renderRoster()), /Historical attendance/)
  assert.doesNotMatch(text(fixture.renderRoster()), /Enrollment #1/)
})

test("pending cheer saves disable the shared status and note controls", async () => {
  let resolveSave
  const fixture = await viewFixture({ saveCheer: () => new Promise(resolve => { resolveSave = resolve }) })
  fixture.setStatus("Zoe Athlete", "present")
  const pending = fixture.save()
  const roster = fixture.renderRoster()
  assert.ok(nodes(roster, node => ["Input", "SmartSelect"].includes(node.type)).every(node => node.props.disabled))
  assert.ok(nodes(roster, node => node.type === "Button" && text(node) === "Saving")[0].props.disabled)
  resolveSave({ ok: true, message: "Saved" })
  await pending
  assert.equal(fixture.refreshes(), 1)
})

test("canceled sessions and missing database setup are reviewable but cannot be edited or saved", async () => {
  for (const options of [
    { sessions: [{ ...session, status: "cancelled" }] },
    { data: { ...dataFixture(), ready: false, notices: ["Attendance setup is incomplete."] } },
    { sessions: [{ ...session, sessionDate: "2026-10-18", status: "completed" }] },
  ]) {
    const fixture = await viewFixture(options)
    const roster = fixture.renderRoster()
    assert.ok(nodes(roster, node => ["Input", "SmartSelect"].includes(node.type)).every(node => node.props.disabled))
    assert.ok(nodes(roster, node => node.type === "Button" && text(node) === "Save Attendance")[0].props.disabled)
    await fixture.save()
    assert.equal(fixture.requests.length, 0)
  }
})

test("the shared Needs review filter includes partially marked cheer sessions and parent search works", async () => {
  const fixture = await viewFixture()
  const filter = nodes(fixture.renderReview(), node => node.type === "SmartSelect" && node.props.options.some(option => option.value === "incomplete"))[0]
  filter.props.onValueChange("incomplete")
  assert.ok(nodes(fixture.renderReview(), node => typeof node.type === "function" && node.type.name === "AttendanceReviewTable").length)
  const search = nodes(fixture.renderReview(), node => node.type === "Input" && node.props.placeholder === "Search sessions")[0]
  search.props.onChange({ target: { value: "Pat Parent" } })
  assert.ok(nodes(fixture.renderReview(), node => typeof node.type === "function" && node.type.name === "AttendanceReviewTable").length)
  search.props.onChange({ target: { value: "No matching parent" } })
  assert.match(text(fixture.renderReview()), /No cheer practice sessions match/)
})

test("the cheer adapter preserves attendance history, enrollment IDs and source records", () => {
  const data = dataFixture()
  const original = structuredClone(data)
  data.events[1].enrollmentId = null
  const records = adapter.buildCheerSessionReviewRecords([session], data)
  assert.equal(records[0].expectedAthletes[0].enrollmentId, "21")
  assert.equal(records[0].expectedAthletes[0].attendanceNotes, "Reviewed note")
  assert.equal(records[0].expectedAthletes[0].parentEmail, "parent@example.test")
  assert.equal(records[0].expectedAthletes[1].enrollmentId, "")
  assert.equal(records[0].expectedAthletes[1].attendanceKey, "2")
  data.events[1].enrollmentId = original.events[1].enrollmentId
  assert.deepEqual(data, original)
})
