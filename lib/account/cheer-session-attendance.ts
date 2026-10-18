import { normalizeAttendanceStatus, type CheerAttendanceData } from "@/lib/account/attendance"
import type { CheerSessionDisplayRecord, ClassSessionDisplayRecord } from "@/lib/account/types"

/** Adapt cheer rosters to the shared session review without substituting enrollment IDs. */
export function buildCheerSessionReviewRecords(
  sessions: CheerSessionDisplayRecord[],
  attendance: CheerAttendanceData
): ClassSessionDisplayRecord[] {
  const athletes = new Map(attendance.athletes.map((athlete) => [athlete.id, athlete]))
  const eventsBySession = new Map<string, CheerAttendanceData["events"]>()
  for (const event of attendance.events) {
    const events = eventsBySession.get(event.sessionId) ?? []
    events.push(event)
    eventsBySession.set(event.sessionId, events)
  }

  return sessions.map((session) => ({
    sessionId: session.sessionId,
    classId: session.teamId,
    className: session.teamName,
    scheduleId: session.scheduleId,
    scheduleLabel: session.scheduleLabel,
    sessionDate: session.sessionDate,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    status: session.status,
    type: session.type,
    expectedAthletes: (eventsBySession.get(session.sessionId) ?? []).map((event) => {
      const athlete = athletes.get(event.athleteId)
      return {
        attendanceKey: event.athleteId,
        athleteId: event.athleteId,
        athleteName: athlete?.name ?? `Former athlete #${event.athleteId}`,
        enrollmentId: event.enrollmentId ?? "",
        enrollmentStatus: event.reviewedAt ? "reviewed" : "expected",
        scheduleId: session.scheduleId,
        scheduleLabel: session.scheduleLabel,
        parentName: athlete?.parentName ?? "No linked parent",
        parentPhone: athlete?.parentPhone ?? null,
        parentEmail: athlete?.parentEmail ?? null,
        isMakeup: false,
        attendanceStatus: normalizeAttendanceStatus(event.status),
        attendanceNotes: event.notes,
        attendanceReviewedAt: event.reviewedAt,
        attendanceReviewedBy: event.reviewedBy,
      }
    }).sort((first, second) => first.athleteName.localeCompare(second.athleteName)),
    makeupAthleteOptions: [],
  }))
}
