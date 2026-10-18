"use server"

import { revalidatePath } from "next/cache"
import { getAccountSession, requireAdminSession, requireStaffSession } from "@/lib/account/auth"
import { getCheerAttendanceData } from "@/lib/account/attendance-data"
import { isCanceledSession, normalizeAttendanceStatus } from "@/lib/account/attendance"
import { parseDateKeyParts } from "@/lib/date_keys"
import { createAdminClient } from "@/lib/supabase/admin"

function refreshAttendance() {
  revalidatePath("/account", "layout")
}

export async function saveAttendanceSeason(input: { id?: string; name: string; startsOn: string; endsOn: string }) {
  requireAdminSession(await getAccountSession())
  if (!input || typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 100 || typeof input.startsOn !== "string" || typeof input.endsOn !== "string" || (input.id !== undefined && (typeof input.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id))) || !parseDateKeyParts(input.startsOn) || !parseDateKeyParts(input.endsOn) || input.endsOn < input.startsOn) {
    return { ok: false, message: "Enter a season name and valid start and end dates." }
  }
  const db = createAdminClient()
  const values = { name: input.name.trim(), starts_on: input.startsOn, ends_on: input.endsOn }
  const query = input.id ? db.from("AthleteAttendanceSeasons").update(values).eq("season_id", input.id) : db.from("AthleteAttendanceSeasons").insert(values)
  const { data, error } = await query.select("season_id").single()
  if (error) return { ok: false, message: ["23505", "23P01"].includes(error.code) ? "Attendance seasons cannot overlap. Adjust the start or end date." : "The season could not be saved. Check attendance setup and try again." }
  refreshAttendance()
  return { ok: true, message: "Attendance season saved.", id: String(data.season_id) }
}

export async function saveCheerAttendance(input: { sessionId: string; attendance: { athleteId: string; status: string; notes: string }[] }) {
  const actor = requireStaffSession(await getAccountSession())
  if (!input || typeof input.sessionId !== "string" || !Array.isArray(input.attendance) || !input.attendance.length || input.attendance.length > 1000) {
    return { ok: false, message: "Choose a session and at least one athlete." }
  }
  const seen = new Set<string>()
  for (const entry of input.attendance) {
    if (!entry || typeof entry.athleteId !== "string" || typeof entry.status !== "string" || !normalizeAttendanceStatus(entry.status) || typeof entry.notes !== "string" || entry.notes.length > 2000 || seen.has(entry.athleteId)) {
      return { ok: false, message: "Choose valid attendance for each athlete and keep notes under 2,000 characters." }
    }
    seen.add(entry.athleteId)
  }
  const data = await getCheerAttendanceData()
  if (!data.ready) return { ok: false, message: "Cheer attendance setup is incomplete. Apply the attendance migration first." }
  const session = data.sessions.find((row) => row.id === input.sessionId)
  if (!session || !session.date || session.date > data.today || isCanceledSession(session.status)) {
    return { ok: false, message: "Attendance can only be saved for an existing, dated session today or earlier that has not been canceled." }
  }
  const roster = new Map(data.events.filter((event) => event.sessionId === session.id).map((event) => [event.athleteId, event]))
  if (input.attendance.some((entry) => !roster.has(entry.athleteId))) {
    return { ok: false, message: "The team roster changed. Refresh the page before saving attendance." }
  }
  const reviewedAt = new Date().toISOString()
  const { error } = await createAdminClient().from("CheerSessionAttendance").upsert(input.attendance.map((entry) => ({
    session_id: session.id, athlete_id: entry.athleteId, enrollment_id: roster.get(entry.athleteId)!.enrollmentId,
    attendance_status: normalizeAttendanceStatus(entry.status), notes: entry.notes.trim() || null,
    reviewed_by: actor.userId, reviewed_at: reviewedAt,
  })), { onConflict: "session_id,athlete_id" })
  if (error) return { ok: false, message: "Attendance could not be saved. Refresh the roster and try again." }
  refreshAttendance()
  return { ok: true, message: "Cheer attendance saved.", reviewedAt }
}
