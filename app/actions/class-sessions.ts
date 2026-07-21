"use server"

import { revalidatePath } from "next/cache"

import { getAccountSession, requireAdminSession } from "@/lib/account/auth"
import { sendContactEmail } from "@/lib/contact/email"
import { createAdminClient } from "@/lib/supabase/admin"

type ActionResult = {
  ok: boolean
  message: string
  emailedParentCount?: number
  warning?: string
}

type ClassSessionRow = {
  session_id: string | number
  class_id?: string | number | null
  schedule_id?: string | number | null
  session_date?: string | null
  starts_at?: string | null
  ends_at?: string | null
  status?: string | null
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
const dayOrder = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function toId(value: string | number | null | undefined) {
  return value === null || value === undefined ? null : String(value)
}

function normalizeStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "scheduled"
}

function normalizeDay(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value === 0 || value === 7) {
      return "sunday"
    }

    return dayOrder[value - 1] ?? String(value)
  }

  const normalized = String(value ?? "").trim().toLowerCase()
  const numericDay = Number(normalized)

  if (normalized && Number.isInteger(numericDay)) {
    return normalizeDay(numericDay)
  }

  return normalized
}

function formatDay(value: string | number | null | undefined) {
  const normalized = normalizeDay(value)

  if (!normalized) {
    return "Unscheduled"
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
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
}: {
  className: string
  session: ClassSessionRow
  schedule: ClassScheduleRow | null
  athleteNames: string[]
}) {
  return [
    "Hello,",
    "",
    "The following Limitless Cheer and Gymnastics class session has been canceled:",
    "",
    `Class: ${className}`,
    `Date: ${formatDate(session.session_date)}`,
    `Time: ${formatSessionTime(session, schedule)}`,
    `Schedule: ${formatScheduleLabel(schedule)}`,
    "",
    athleteNames.length
      ? `Students enrolled: ${athleteNames.join(", ")}`
      : "Students enrolled: No active enrollments found",
    "",
    "Please contact us if you have any questions.",
  ].join("\n")
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

  const parentEmails = Array.from(parentEmailByAddress.values())
  const subject = `LCC Session Canceled: ${className} on ${formatDate(
    classSession.session_date
  )}`
  let warning: string | undefined

  if (parentEmails.length) {
    try {
      await sendContactEmail({
        email: process.env.CONTACT_FROM_EMAIL,
        subject,
        message: buildCancellationMessage({
          className,
          session: classSession,
          schedule,
          athleteNames,
        }),
        bcc: parentEmails,
      })
    } catch (error) {
      warning = getErrorMessage(error)
    }
  }

  revalidatePath("/account")
  revalidatePath("/account/admin/sessions")
  revalidatePath("/account/coach/sessions")

  if (warning) {
    return {
      ok: true,
      message: `Session canceled, but the parent email failed to send: ${warning}`,
      emailedParentCount: 0,
      warning,
    }
  }

  return {
    ok: true,
    message: parentEmails.length
      ? `Session canceled and emailed ${parentEmails.length} parent${
          parentEmails.length === 1 ? "" : "s"
        }.`
      : "Session canceled. No parent email addresses were found.",
    emailedParentCount: parentEmails.length,
  }
}
