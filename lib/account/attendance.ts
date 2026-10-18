export const absenceLimits = { excused: 4, unexcused: 2 } as const

export type AttendanceCategory = "cheer" | "gymnastics" | "other"
export type AttendanceStatus = "present" | "absent" | "excused" | "late"
export type AttendanceStanding = "over-limit" | "at-limit" | "approaching" | "within" | "no-records" | "not-applicable"
export type AttendanceSeason = { id: string; name: string; startsOn: string; endsOn: string }
export type AttendanceAthlete = {
  id: string; name: string; createdOn: string | null
  parentName: string; parentEmail: string | null; parentPhone: string | null
}
export type AttendanceEnrollment = {
  id: string; athleteId: string; programId: string; scheduleId: string | null
  active: boolean; startsOn: string | null
}
export type AttendanceSession = {
  id: string; date: string | null; status: string; category: AttendanceCategory
  programId: string; programName: string; scheduleId: string | null
}
export type SavedAttendance = {
  sessionId: string; athleteId: string | null; enrollmentId: string | null
  status: string | null; notes: string | null; reviewedAt: string | null
  reviewedBy: string | null; isMakeup: boolean
}
export type AttendanceEvent = SavedAttendance & {
  athleteId: string; category: AttendanceCategory; date: string | null
  programId: string; programName: string; sessionStatus: string
}
export type AbsenceTotals = {
  excused: number; unexcused: number; present: number; late: number
  incomplete: number; recorded: number; standing: AttendanceStanding
}
export type AthleteAttendanceSummary = AttendanceAthlete & {
  programs: string[]; programKeys: string[]; policyApplies: boolean
  totals: Record<AttendanceCategory, AbsenceTotals>; standing: AttendanceStanding
  incomplete: number; history: AttendanceEvent[]
}
export type AthleteAttendanceData = {
  seasons: AttendanceSeason[]; athletes: AttendanceAthlete[]; events: AttendanceEvent[]
  cheerMemberships: (AttendanceEnrollment & { programName: string })[]; notices: string[]; seasonsReady: boolean
  reviewers: Record<string, string>; today: string
}
export type CheerAttendanceData = {
  sessions: AttendanceSession[]; events: AttendanceEvent[]; athletes: AttendanceAthlete[]
  ready: boolean; notices: string[]; today: string
}

export const attendanceLabels: Record<AttendanceStatus, string> = {
  present: "Present", absent: "Unexcused absence", excused: "Excused absence", late: "Late",
}
export const categoryLabels: Record<AttendanceCategory, string> = {
  cheer: "Cheer", gymnastics: "Gymnastics", other: "Other classes",
}
export const standingLabels: Record<AttendanceStanding, string> = {
  "over-limit": "Over limit", "at-limit": "At limit", approaching: "Approaching limit",
  within: "Within limits", "no-records": "No attendance recorded", "not-applicable": "Tracking only",
}
export const standingPriority: Record<AttendanceStanding, number> = {
  "over-limit": 0, "at-limit": 1, approaching: 2, "no-records": 3, within: 4, "not-applicable": 5,
}

export function normalizeAttendanceStatus(value: string | null): AttendanceStatus | null {
  const normalized = value?.trim().toLowerCase()
  if (normalized === "unexcused") return "absent"
  return normalized && normalized in attendanceLabels && Object.hasOwn(attendanceLabels, normalized)
    ? normalized as AttendanceStatus : null
}

export function isCanceledSession(status: string) {
  return ["canceled", "cancelled"].includes(status.trim().toLowerCase())
}

export function getAbsenceStanding(excused: number, unexcused: number): AttendanceStanding {
  if (excused > absenceLimits.excused || unexcused > absenceLimits.unexcused) return "over-limit"
  if (excused === absenceLimits.excused || unexcused === absenceLimits.unexcused) return "at-limit"
  if (excused >= absenceLimits.excused - 1 || unexcused >= absenceLimits.unexcused - 1) return "approaching"
  return "within"
}

export function selectAttendanceSeason(seasons: AttendanceSeason[], today: string) {
  return seasons.find((season) => season.startsOn <= today && today <= season.endsOn)
    ?? [...seasons].filter((season) => season.startsOn <= today).sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0]
    ?? [...seasons].sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0]
    ?? null
}

/** Saved records remain visible even after an enrollment is canceled or moved. */
export function buildAttendanceEvents({ sessions, enrollments, athletes, saved }: {
  sessions: AttendanceSession[]; enrollments: AttendanceEnrollment[]
  athletes: AttendanceAthlete[]; saved: SavedAttendance[]
}): AttendanceEvent[] {
  const athleteById = new Map(athletes.map((athlete) => [athlete.id, athlete]))
  const enrollmentById = new Map(enrollments.map((enrollment) => [enrollment.id, enrollment]))
  const enrollmentsByProgram = new Map<string, AttendanceEnrollment[]>()
  for (const enrollment of enrollments) {
    const rows = enrollmentsByProgram.get(enrollment.programId) ?? []
    rows.push(enrollment)
    enrollmentsByProgram.set(enrollment.programId, rows)
  }
  const savedBySession = new Map<string, SavedAttendance[]>()
  for (const record of saved) {
    const records = savedBySession.get(record.sessionId) ?? []
    records.push(record)
    savedBySession.set(record.sessionId, records)
  }
  return sessions.flatMap((session) => {
    const byAthlete = new Map<string, AttendanceEvent>()
    function event(athleteId: string, record: SavedAttendance): AttendanceEvent {
      return { ...record, athleteId, category: session.category, date: session.date,
        programId: session.programId, programName: session.programName, sessionStatus: session.status }
    }
    for (const enrollment of enrollmentsByProgram.get(session.programId) ?? []) {
      if (!enrollment.active || enrollment.programId !== session.programId) continue
      // All cheer team members attend every team practice. Class rosters need a matching schedule.
      if (session.category !== "cheer" && (!session.scheduleId || enrollment.scheduleId !== session.scheduleId)) continue
      const athlete = athleteById.get(enrollment.athleteId)
      if (!athlete || (session.date && [athlete.createdOn, enrollment.startsOn].some((date) => date && date > session.date!))) continue
      if (!byAthlete.has(athlete.id)) byAthlete.set(athlete.id, event(athlete.id, {
        sessionId: session.id, athleteId: athlete.id, enrollmentId: enrollment.id,
        status: null, notes: null, reviewedAt: null, reviewedBy: null, isMakeup: false,
      }))
    }
    // Deduplicate multiple enrollment records for the same athlete/session using the latest review.
    for (const record of [...(savedBySession.get(session.id) ?? [])].sort((a, b) => (a.reviewedAt ?? "").localeCompare(b.reviewedAt ?? ""))) {
      const athleteId = record.athleteId ?? (record.enrollmentId ? enrollmentById.get(record.enrollmentId)?.athleteId : null)
      if (athleteId) byAthlete.set(athleteId, event(athleteId, record))
    }
    return [...byAthlete.values()]
  })
}

export function summarizeAthleteAttendance(data: Pick<AthleteAttendanceData, "athletes" | "events" | "cheerMemberships" | "today">, season: AttendanceSeason): AthleteAttendanceSummary[] {
  const events = data.events.filter((event) => event.date && event.date >= season.startsOn && event.date <= season.endsOn && event.date <= data.today && !isCanceledSession(event.sessionStatus))
  const cheerAthletes = new Set([
    ...data.cheerMemberships.filter((membership) => membership.active && (!membership.startsOn || membership.startsOn <= season.endsOn)).map((membership) => membership.athleteId),
    ...events.filter((event) => event.category === "cheer").map((event) => event.athleteId),
  ])
  const byAthlete = new Map<string, AttendanceEvent[]>()
  for (const event of events) {
    const history = byAthlete.get(event.athleteId) ?? []
    history.push(event)
    byAthlete.set(event.athleteId, history)
  }
  return data.athletes.map((athlete) => {
    const history = (byAthlete.get(athlete.id) ?? []).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.programName.localeCompare(b.programName))
    const policyApplies = cheerAthletes.has(athlete.id)
    const totals = Object.fromEntries((["cheer", "gymnastics", "other"] as const).map((category) => {
      const total: AbsenceTotals = { excused: 0, unexcused: 0, present: 0, late: 0, incomplete: 0, recorded: 0, standing: "not-applicable" }
      for (const record of history.filter((event) => event.category === category)) {
        // Optional makeup attendance never consumes an absence allowance.
        if (record.isMakeup) continue
        const status = normalizeAttendanceStatus(record.status)
        if (!status) { total.incomplete++; continue }
        total.recorded++
        if (status === "absent") total.unexcused++
        else total[status]++
      }
      if (policyApplies && category !== "other") total.standing = total.recorded ? getAbsenceStanding(total.excused, total.unexcused) : "no-records"
      return [category, total]
    })) as Record<AttendanceCategory, AbsenceTotals>
    const standings = [totals.cheer, totals.gymnastics].filter((total) => total.recorded > 0).map((total) => total.standing)
    const standing = policyApplies
      ? standings.sort((a, b) => standingPriority[a] - standingPriority[b])[0] ?? "no-records"
      : "not-applicable"
    return { ...athlete, programs: [...new Set(history.map((event) => event.programName))],
      programKeys: [...new Set(history.map((event) => `${event.category}:${event.programId}`))],
      history, policyApplies, totals, standing,
      incomplete: Object.values(totals).reduce((sum, total) => sum + total.incomplete, 0) }
  }).sort((a, b) => standingPriority[a.standing] - standingPriority[b.standing] || b.incomplete - a.incomplete || a.name.localeCompare(b.name))
}
