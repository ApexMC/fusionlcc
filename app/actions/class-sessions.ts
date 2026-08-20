"use server"

import { revalidatePath } from "next/cache"

import { getAccountSession, requireAdminSession } from "@/lib/account/auth"
import { sendContactEmail } from "@/lib/contact/email"
import { createAdminClient } from "@/lib/supabase/admin"
import { formatDay } from "@/lib/scheduling"

type ActionResult = {
  ok: boolean
  message: string
  emailedParentCount?: number
  warning?: string
}

type MakeupSessionInput = {
  sourceSessionId: string
  sessionDate: string
  startTime: string
  durationMinutes: number
}

type CancellationNoticeContext = {
  classSession: ClassSessionRow
  className: string
  schedule: ClassScheduleRow | null
  athleteNames: string[]
  parentEmails: string[]
}

type ClassSessionRow = {
  session_id: string | number
  class_id?: string | number | null
  schedule_id?: string | number | null
  session_date?: string | null
  starts_at?: string | null
  ends_at?: string | null
  status?: string | null
  type?: string | null
}

type ClassRow = {
  class_id: string | number
  class_name?: string | null
}

type ClassScheduleRow = {
  schedule_id: string | number
  day_of_week?: string | number | null
  start_time?: string | null
  end_time?: string | null
}

type ParentRow = {
  parent_id?: string | number | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

type AthleteRow = {
  athlete_id?: string | number | null
  first_name?: string | null
  last_name?: string | null
  Parents?: ParentRow | ParentRow[] | null
}

type EnrollmentRow = {
  enrollment_id: string | number
  status?: string | null
  Athletes?: AthleteRow | AthleteRow[] | null
}

const rosterEnrollmentStatuses = ["approved", "active"] as const
const classSessionTimeZone = "America/Indiana/Tell_City"

type DateParts = {
  year: number
  month: number
  day: number
}

type DateTimeParts = DateParts & {
  hour: number
  minute: number
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function toId(value: string | number | null | undefined) {
  return value === null || value === undefined ? null : String(value)
}

function normalizeStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "scheduled"
}

function parseDateParts(value: string): DateParts | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

function normalizeDateInput(value: string) {
  const normalized = value.trim()

  return parseDateParts(normalized) ? normalized : null
}

function normalizeTimeInput(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)

  if (!match) {
    return null
  }

  const hour = Number(match[1])
  const minute = Number(match[2])

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function getDateTimeParts(dateKey: string, timeKey: string): DateTimeParts | null {
  const dateParts = parseDateParts(dateKey)
  const normalizedTime = normalizeTimeInput(timeKey)

  if (!dateParts || !normalizedTime) {
    return null
  }

  const [hour, minute] = normalizedTime.split(":").map(Number)

  return {
    ...dateParts,
    hour,
    minute,
  }
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const timeZoneName = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value

  if (!timeZoneName || timeZoneName === "GMT") {
    return 0
  }

  const match = timeZoneName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/)

  if (!match) {
    throw new Error(`Unable to determine timezone offset for ${timeZone}.`)
  }

  const sign = match[1] === "-" ? -1 : 1
  const hours = Number(match[2])
  const minutes = Number(match[3] ?? "0")

  return sign * (hours * 60 + minutes)
}

function toZonedTimestampIso(
  dateKey: string,
  timeKey: string,
  timeZone = classSessionTimeZone
) {
  const parts = getDateTimeParts(dateKey, timeKey)

  if (!parts) {
    return null
  }

  const localTimeAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute
  )
  let utcMilliseconds = localTimeAsUtc

  for (let index = 0; index < 3; index += 1) {
    const offsetMinutes = getTimeZoneOffsetMinutes(
      new Date(utcMilliseconds),
      timeZone
    )
    const nextUtcMilliseconds = localTimeAsUtc - offsetMinutes * 60_000

    if (nextUtcMilliseconds === utcMilliseconds) {
      break
    }

    utcMilliseconds = nextUtcMilliseconds
  }

  return new Date(utcMilliseconds).toISOString()
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Date TBD"
  }

  const dateText = value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
  const date = dateText ? new Date(`${dateText}T00:00:00`) : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function formatTime(value: string | null | undefined) {
  if (!value) {
    return "Time TBD"
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value)

    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: classSessionTimeZone,
      }).format(date)
    }
  }

  const timeMatch = value.match(/(\d{1,2}):(\d{2})(?::\d{2})?/)
  const hour = Number(timeMatch?.[1])
  const minute = Number(timeMatch?.[2] ?? "00")

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return value
  }

  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 || 12

  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`
}

function formatScheduleLabel(schedule: ClassScheduleRow | null) {
  if (!schedule) {
    return "Unscheduled"
  }

  return `${formatDay(schedule.day_of_week)} ${formatTime(
    schedule.start_time
  )} - ${formatTime(schedule.end_time)}`
}

function formatSessionTime(
  session: ClassSessionRow,
  schedule: ClassScheduleRow | null
) {
  return `${formatTime(session.starts_at ?? schedule?.start_time)} - ${formatTime(
    session.ends_at ?? schedule?.end_time
  )}`
}

function getDisplayName(firstName?: string | null, lastName?: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ").trim()
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown email error."
}

function buildCancellationMessage({
  className,
  session,
  schedule,
  athleteNames,
  makeupSession,
}: {
  className: string
  session: ClassSessionRow
  schedule: ClassScheduleRow | null
  athleteNames: string[]
  makeupSession?: ClassSessionRow
}) {
  const lines = [
    "Hello,",
    "",
    "The following Limitless Cheer and Gymnastics class session has been canceled:",
    "",
    `Class: ${className}`,
    `Date: ${formatDate(session.session_date)}`,
    `Time: ${formatSessionTime(session, schedule)}`,
    `Schedule: ${formatScheduleLabel(schedule)}`,
    "",
  ]

  if (makeupSession) {
    lines.push(
      "A makeup session has been scheduled:",
      "",
      `Makeup Class: ${className}`,
      `Makeup Date: ${formatDate(makeupSession.session_date)}`,
      `Makeup Time: ${formatSessionTime(makeupSession, null)}`,
      ""
    )
  }

  lines.push(
    athleteNames.length
      ? `Students enrolled: ${athleteNames.join(", ")}`
      : "Students enrolled: No active enrollments found",
    "",
    "Please contact us if you have any questions."
  )

  return lines.join("\n")
}

async function getCancellationNoticeContext(
  sessionId: string
): Promise<
  | { ok: true; context: CancellationNoticeContext }
  | { ok: false; message: string }
> {
  const supabase = createAdminClient()
  const { data: sessionData, error: sessionError } = await supabase
    .from("ClassSessions")
    .select("session_id,class_id,schedule_id,session_date,starts_at,ends_at,status,type")
    .eq("session_id", sessionId)
    .maybeSingle()

  if (sessionError) {
    return {
      ok: false,
      message: sessionError.message,
    }
  }

  if (!sessionData) {
    return {
      ok: false,
      message: "Session not found.",
    }
  }

  const classSession = sessionData as ClassSessionRow
  const classId = toId(classSession.class_id)
  const scheduleId = toId(classSession.schedule_id)
  let className = classId ? `Class #${classId}` : "Class session"
  let schedule: ClassScheduleRow | null = null
  let enrollments: EnrollmentRow[] = []

  if (classId) {
    const { data: classData, error: classError } = await supabase
      .from("Classes")
      .select("class_id,class_name")
      .eq("class_id", classId)
      .maybeSingle()

    if (classError) {
      return {
        ok: false,
        message: classError.message,
      }
    }

    className = ((classData as ClassRow | null)?.class_name ?? className).trim()
  }

  if (scheduleId) {
    const { data: scheduleData, error: scheduleError } = await supabase
      .from("ClassSchedules")
      .select("schedule_id,day_of_week,start_time,end_time")
      .eq("schedule_id", scheduleId)
      .maybeSingle()

    if (scheduleError) {
      return {
        ok: false,
        message: scheduleError.message,
      }
    }

    schedule = (scheduleData as ClassScheduleRow | null) ?? null

    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("Enrollments")
      .select(
        `
          enrollment_id,
          status,
          Athletes(
            athlete_id,
            first_name,
            last_name,
            Parents(parent_id, first_name, last_name, email)
          )
        `
      )
      .eq("schedule_id", scheduleId)
      .in("status", [...rosterEnrollmentStatuses])

    if (enrollmentError) {
      return {
        ok: false,
        message: enrollmentError.message,
      }
    }

    enrollments = (enrollmentData ?? []) as EnrollmentRow[]
  }

  const parentEmailByAddress = new Map<string, string>()
  const athleteNames: string[] = []

  enrollments.forEach((enrollment) => {
    const athlete = firstRelation(enrollment.Athletes)
    const parent = firstRelation(athlete?.Parents)
    const athleteName = getDisplayName(athlete?.first_name, athlete?.last_name)
    const parentEmail = parent?.email?.trim()

    if (athleteName) {
      athleteNames.push(athleteName)
    }

    if (parentEmail) {
      parentEmailByAddress.set(parentEmail.toLowerCase(), parentEmail)
    }
  })

  return {
    ok: true,
    context: {
      classSession,
      className,
      schedule,
      athleteNames,
      parentEmails: Array.from(parentEmailByAddress.values()),
    },
  }
}

async function sendCancellationDecisionEmail({
  sourceSessionId,
  makeupSession,
}: {
  sourceSessionId: string
  makeupSession?: ClassSessionRow
}): Promise<ActionResult> {
  const contextResult = await getCancellationNoticeContext(sourceSessionId)

  if (!contextResult.ok) {
    return contextResult
  }

  const {
    classSession,
    className,
    schedule,
    athleteNames,
    parentEmails,
  } = contextResult.context

  if (!["canceled", "cancelled"].includes(normalizeStatus(classSession.status))) {
    return {
      ok: false,
      message: "Cancel the session before emailing parents.",
      emailedParentCount: 0,
    }
  }

  if (!parentEmails.length) {
    return {
      ok: true,
      message: "No parent email addresses were found.",
      emailedParentCount: 0,
    }
  }

  const subject = makeupSession
    ? `LCC Session Canceled / Makeup Scheduled: ${className}`
    : `LCC Session Canceled: ${className} on ${formatDate(
        classSession.session_date
      )}`

  try {
    await sendContactEmail({
      email: process.env.CONTACT_FROM_EMAIL,
      subject,
      message: buildCancellationMessage({
        className,
        session: classSession,
        schedule,
        athleteNames,
        makeupSession,
      }),
      bcc: parentEmails,
    })
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
      emailedParentCount: 0,
    }
  }

  return {
    ok: true,
    message: makeupSession
      ? `Emailed ${parentEmails.length} parent${
          parentEmails.length === 1 ? "" : "s"
        } with cancellation and makeup details.`
      : `Emailed ${parentEmails.length} parent${
          parentEmails.length === 1 ? "" : "s"
        } with cancellation details.`,
    emailedParentCount: parentEmails.length,
  }
}

export async function cancelClassSession(
  sessionId: string
): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  if (!sessionId.trim()) {
    return {
      ok: false,
      message: "Choose a session before canceling.",
    }
  }

  const supabase = createAdminClient()
  const { data: sessionData, error: sessionError } = await supabase
    .from("ClassSessions")
    .select("session_id,class_id,schedule_id,session_date,starts_at,ends_at,status")
    .eq("session_id", sessionId)
    .maybeSingle()

  if (sessionError) {
    return {
      ok: false,
      message: sessionError.message,
    }
  }

  if (!sessionData) {
    return {
      ok: false,
      message: "Session not found.",
    }
  }

  const classSession = sessionData as ClassSessionRow
  const normalizedStatus = normalizeStatus(classSession.status)

  if (["canceled", "cancelled"].includes(normalizedStatus)) {
    return {
      ok: false,
      message: "This session is already canceled.",
    }
  }

  if (normalizedStatus !== "scheduled") {
    return {
      ok: false,
      message: "Only scheduled sessions can be canceled.",
    }
  }

  const { error: updateError } = await supabase
    .from("ClassSessions")
    .update({ status: "canceled" })
    .eq("session_id", sessionId)

  if (updateError) {
    return {
      ok: false,
      message: updateError.message,
    }
  }

  revalidatePath("/account")
  revalidatePath("/account/admin/sessions")
  revalidatePath("/account/coach/sessions")

  return {
    ok: true,
    message:
      "Session canceled. Choose whether to create a makeup session before notifying parents.",
  }
}

export async function sendClassSessionCancellationNotice(
  sessionId: string
): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  if (!sessionId.trim()) {
    return {
      ok: false,
      message: "Choose a canceled session before emailing parents.",
    }
  }

  const noticeResult = await sendCancellationDecisionEmail({
    sourceSessionId: sessionId,
  })

  if (!noticeResult.ok) {
    return {
      ...noticeResult,
      message: `Cancellation email failed to send: ${noticeResult.message}`,
    }
  }

  return noticeResult
}

export async function createMakeupClassSession({
  sourceSessionId,
  sessionDate,
  startTime,
  durationMinutes,
}: MakeupSessionInput): Promise<ActionResult & { sessionId?: string }> {
  requireAdminSession(await getAccountSession())

  const normalizedDate = normalizeDateInput(sessionDate)
  const normalizedStartTime = normalizeTimeInput(startTime)
  const normalizedDuration = Number(durationMinutes)

  if (!sourceSessionId.trim()) {
    return {
      ok: false,
      message: "Choose the canceled session before creating a makeup.",
    }
  }

  if (!normalizedDate) {
    return {
      ok: false,
      message: "Choose a valid makeup session date.",
    }
  }

  if (!normalizedStartTime) {
    return {
      ok: false,
      message: "Choose a valid makeup session start time.",
    }
  }

  if (
    !Number.isInteger(normalizedDuration) ||
    normalizedDuration < 15 ||
    normalizedDuration > 480
  ) {
    return {
      ok: false,
      message: "Duration must be between 15 minutes and 8 hours.",
    }
  }

  const startsAt = toZonedTimestampIso(normalizedDate, normalizedStartTime)

  if (!startsAt) {
    return {
      ok: false,
      message: "Choose a valid makeup session date and start time.",
    }
  }

  const endsAt = new Date(
    new Date(startsAt).getTime() + normalizedDuration * 60_000
  ).toISOString()

  const supabase = createAdminClient()
  const { data: sourceSessionData, error: sourceSessionError } = await supabase
    .from("ClassSessions")
    .select("session_id,class_id,schedule_id,status")
    .eq("session_id", sourceSessionId)
    .maybeSingle()

  if (sourceSessionError) {
    return {
      ok: false,
      message: sourceSessionError.message,
    }
  }

  if (!sourceSessionData) {
    return {
      ok: false,
      message: "Canceled session not found.",
    }
  }

  const sourceSession = sourceSessionData as ClassSessionRow

  if (!["canceled", "cancelled"].includes(normalizeStatus(sourceSession.status))) {
    return {
      ok: false,
      message: "Cancel the original session before creating a makeup.",
    }
  }

  const { data, error } = await supabase
    .from("ClassSessions")
    .insert({
      class_id: sourceSession.class_id ?? null,
      schedule_id: sourceSession.schedule_id ?? null,
      session_date: normalizedDate,
      starts_at: startsAt,
      ends_at: endsAt,
      status: "scheduled",
      type: "makeup",
    })
    .select("session_id,class_id,schedule_id,session_date,starts_at,ends_at,status,type")
    .single()

  if (error) {
    return {
      ok: false,
      message: error.message,
    }
  }

  const makeupSession = data as ClassSessionRow
  const noticeResult = await sendCancellationDecisionEmail({
    sourceSessionId,
    makeupSession,
  })

  revalidatePath("/account")
  revalidatePath("/account/admin/sessions")
  revalidatePath("/account/coach/sessions")

  if (!noticeResult.ok) {
    return {
      ok: true,
      message: `Makeup session created, but the parent email failed to send: ${noticeResult.message}`,
      sessionId: String(makeupSession.session_id),
      emailedParentCount: 0,
      warning: noticeResult.message,
    }
  }

  return {
    ok: true,
    message: `Makeup session created. ${noticeResult.message}`,
    sessionId: String(makeupSession.session_id),
    emailedParentCount: noticeResult.emailedParentCount,
  }
}
