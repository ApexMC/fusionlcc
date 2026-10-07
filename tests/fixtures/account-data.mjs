import assert from "node:assert/strict"
import { loadTypeScriptModule, loadTypeScriptModuleWithMocks } from "../load-typescript.mjs"

const dependencies = Object.fromEntries(await Promise.all([
  ["@/lib/date_keys", "../lib/date_keys.ts"],
  ["@/lib/programs", "../lib/programs.ts"],
  ["@/lib/account/pagination", "../lib/account/pagination.ts"],
  ["@/lib/account/parent-enrollments", "../lib/account/parent-enrollments.ts"],
  ["@/lib/account/reporting", "../lib/account/reporting.ts"],
  ["@/lib/scheduling", "../lib/scheduling.ts"],
  ["@/lib/local_time", "../lib/local_time.ts"],
].map(async ([name, file]) => [name, await loadTypeScriptModule(file)])))

const parent = { parent_id: 1, first_name: "Pat", last_name: "Parent", email: "parent@example.test", balance: -25 }
const athletes = ["Zoe", "Amy", "Bea", "Una", "Canceled"].map((first_name, index) => ({
  athlete_id: index + 1, first_name, last_name: "Athlete", parent_id: 1, Parents: parent,
}))
const classes = [
  { class_id: 1, class_name: "Gym", type: "gymnastics", stripe_price_id: "price_gym", billing_day: 15 },
  { class_id: 2, class_name: "Tumbling", type: "gymnastics" },
  { class_id: 3, class_name: "Private", type: "gymnastics" },
]
const schedules = [
  { schedule_id: 10, class_id: 1, season_id: 1, day_of_week: "monday", start_time: "16:00:00", end_time: "17:00:00", is_active: true },
  { schedule_id: 11, class_id: 1, season_id: 1, day_of_week: "tuesday", start_time: "16:00:00", end_time: "17:00:00", is_active: true },
]

export const tables = {
  Parents: [parent],
  Athletes: athletes,
  Classes: classes,
  ClassSchedules: schedules,
  ScheduleSeasons: [{ season_id: 1, season: "fall", is_active: true }],
  Enrollments: athletes.map((athlete, index) => {
    const schedule = index === 3 ? null : schedules[index === 2 ? 1 : 0]
    return {
      enrollment_id: index + 1, athlete_id: athlete.athlete_id, class_id: 1,
      schedule_id: schedule?.schedule_id ?? null, status: index === 4 ? "canceled" : index === 1 ? "approved" : "active",
      stripe_subscription_id: null, subscription_status: null, payment_status: null,
      Athletes: athlete, ClassSchedules: schedule && { ...schedule, Classes: classes[0] },
    }
  }),
  CheerTeams: [{ team_id: 2, team_name: "Stars", tuition_price_id: "price_tuition", fee_price_id: "price_fee" }],
  CheerSchedules: [{ schedule_id: 20, team_id: 2, day_of_week: "wednesday", start_time: "18:00:00", end_time: "19:00:00" }],
  CheerEnrollments: [
    { enrollment_id: 21, athlete_id: 1, parent_id: 1, team_id: 2, status: "approved", tuition_subscription_id: null, fee_subscription_id: null, subscription_status: null, payment_status: null },
    { enrollment_id: 22, athlete_id: 2, parent_id: 1, team_id: 2, schedule_id: 20, status: "active", tuition_subscription_id: null, fee_subscription_id: null, subscription_status: null, payment_status: null },
  ],
  ClassSessions: [
    { session_id: 100, schedule_id: 10, date: "2026-10-05", status: "scheduled" },
    { session_id: 101, schedule_id: 11, date: "2026-10-06", status: "scheduled" },
  ],
  CheerSessions: [{ session_id: 200, schedule_id: 20, date: "2026-10-07", status: "scheduled" }],
  ClassSessionAttendance: [
    { attendance_id: 1, session_id: 100, enrollment_id: 1, attendance_status: "present", notes: "Reviewed" },
    { attendance_id: 2, session_id: 100, enrollment_id: 3, attendance_status: "excused", is_makeup: true },
  ],
  CoachTimeClockEntries: [],
}

export async function accountDataFixture({
  allowedTables = Object.keys(tables), failures = {}, missingBillingColumns = false,
  tableData = tables,
  modulePath = "../lib/account/data.ts",
} = {}) {
  const calls = []
  const createAdminClient = () => ({
    from(table) {
      assert.ok(allowedTables.includes(table), `Unexpected table read: ${table}`)
      let selection
      const filters = []
      function read(from, to) {
        calls.push({ table, selection, from, to })
        if (failures[table]) return { data: null, error: failures[table] }
        if (missingBillingColumns && (
          (table === "Classes" && selection.includes("stripe_price_id")) ||
          (table === "Enrollments" && selection.includes("stripe_subscription_id"))
        )) {
          return { data: null, error: { code: "42703", message: "Column unavailable" } }
        }
        const rows = tableData[table].filter(row => filters.every(filter => filter(row)))
        // Exercise actual pagination with an API cap smaller than the requested page.
        let data = structuredClone(from === undefined ? rows : rows.slice(from, Math.min(to + 1, from + 2)))
        if (missingBillingColumns && table === "Classes") {
          data = data.map(row => Object.fromEntries(selection.split(",").map(key => [key, row[key]])))
        }
        return { data, error: null, count: rows.length }
      }
      return {
        select(value) { selection = value; return this },
        order() { return this },
        is() { return this },
        eq(key, value) {
          filters.push(row => String(row[key]) === String(value))
          return this
        },
        in(key, values) {
          filters.push(row => values.map(String).includes(String(row[key])))
          return this
        },
        then(resolve, reject) { return Promise.resolve(read()).then(resolve, reject) },
        range(from, to) { return Promise.resolve(read(from, to)) },
      }
    },
  })
  const data = await loadTypeScriptModuleWithMocks(modulePath, {
    ...dependencies,
    "server-only": {},
    "@/lib/supabase/admin": { createAdminClient },
    "@/lib/stripe/server": { getStripe: () => { throw new Error("Unexpected Stripe request") } },
    "@/lib/account/auth": {},
  })
  return { data, calls }
}
