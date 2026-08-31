"use server"

import { revalidatePath } from "next/cache"

import { getAccountSession, requireAdminSession } from "@/lib/account/auth"
import { sendContactEmail } from "@/lib/contact/email"
import { normalizeLocalTime } from "@/lib/local_time"
import { createAdminClient } from "@/lib/supabase/admin"

type ActionResult = {
  ok: boolean
  message: string
  emailedParentCount?: number
  warning?: string
}

const dayOfWeeks = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

type DayOfWeek = (typeof dayOfWeeks)[number]

type ParentEmailRow = {
  email?: string | null
}

function isDayOfWeek(value: string): value is DayOfWeek {
  return dayOfWeeks.includes(value as DayOfWeek)
}

function toDayNumber(dayOfWeek: DayOfWeek, sample: number) {
  if (dayOfWeek === "sunday") {
    return sample === 0 ? 0 : 7
  }

  return dayOfWeeks.indexOf(dayOfWeek) + 1
}

async function getDayStorageSample(scheduleId: string | null | undefined) {
  const supabase = createAdminClient()
  let query = supabase.from("ClassSchedules").select("day_of_week").limit(1)

  if (scheduleId) {
    query = query.eq("schedule_id", scheduleId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    return null
  }

  return data?.day_of_week ?? null
}

function formatSeason(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase()

  if (!normalized) {
    return "Selected"
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function getAccountUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()

  if (configuredUrl) {
    return `${configuredUrl.replace(/\/$/, "")}/account`
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/account`
  }

  return "https://fusionlcc.com/account"
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown email error."
}

function buildScheduleSeasonChangeMessage(seasonName: string | null) {
  return [
    "Hello,",
    "",
    `The ${formatSeason(
      seasonName
    )} class schedule is now active for Limitless Cheer and Gymnastics.`,
    "",
    "Please sign in to your parent account and update each athlete's enrollment schedule for the new season.",
    `Account dashboard: ${getAccountUrl()}`,
    "",
    "Please contact us if you have any questions.",
  ].join("\n")
}

function revalidateClassSchedulePaths() {
  revalidatePath("/account")
  revalidatePath("/classes")
  revalidatePath("/classes/calendar")
  revalidatePath("/classes/[className]/schedule", "page")
  revalidatePath("/classes/[className]/register", "page")
  revalidatePath("/api/class-schedules")
}

async function getScheduleSeason(seasonId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("ScheduleSeasons")
    .select("season_id,season")
    .eq("season_id", seasonId)
    .maybeSingle()

  if (error) {
    return {
      ok: false as const,
      message: error.message,
      season: null,
    }
  }

  if (!data) {
    return {
      ok: false as const,
      message: "Choose a valid schedule season.",
      season: null,
    }
  }

  return {
    ok: true as const,
    message: "",
    season: {
      seasonId: String(data.season_id),
      season: typeof data.season === "string" ? data.season : null,
    },
  }
}

async function getParentNotificationEmails() {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from("Parents").select("email")

  if (error) {
    return {
      ok: false as const,
      message: error.message,
      parentEmails: [],
    }
  }

  const parentEmailsByAddress = new Map<string, string>()
  const parentRows = (data ?? []) as ParentEmailRow[]

  parentRows.forEach((parent) => {
    const parentEmail = parent.email?.trim()

    if (parentEmail) {
      parentEmailsByAddress.set(parentEmail.toLowerCase(), parentEmail)
    }
  })

  return {
    ok: true as const,
    message: "",
    parentEmails: Array.from(parentEmailsByAddress.values()),
  }
}

async function sendScheduleSeasonChangeNotice(
  seasonName: string | null
): Promise<ActionResult> {
  const parentEmailResult = await getParentNotificationEmails()

  if (!parentEmailResult.ok) {
    return {
      ok: false,
      message: parentEmailResult.message,
      emailedParentCount: 0,
    }
  }

  if (!parentEmailResult.parentEmails.length) {
    return {
      ok: true,
      message: "No parent email addresses were found.",
      emailedParentCount: 0,
      warning: "No parent email addresses were found.",
    }
  }

  try {
    await sendContactEmail({
      email: process.env.CONTACT_FROM_EMAIL,
      subject: `LCC Schedule Season Changed: ${formatSeason(
        seasonName
      )} now active`,
      message: buildScheduleSeasonChangeMessage(seasonName),
      bcc: parentEmailResult.parentEmails,
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
    message: `Emailed ${parentEmailResult.parentEmails.length} parent${
      parentEmailResult.parentEmails.length === 1 ? "" : "s"
    } to update enrollment schedules.`,
    emailedParentCount: parentEmailResult.parentEmails.length,
  }
}

export async function activateScheduleSeason(
  seasonId: string
): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  const normalizedSeasonId = seasonId.trim()

  if (!normalizedSeasonId) {
    return {
      ok: false,
      message: "Choose a schedule season before activating it.",
    }
  }

  const scheduleSeason = await getScheduleSeason(normalizedSeasonId)

  if (!scheduleSeason.ok) {
    return {
      ok: false,
      message: scheduleSeason.message,
    }
  }

  const supabase = createAdminClient()
  const { error: deactivateError } = await supabase
    .from("ScheduleSeasons")
    .update({ is_active: false })
    .neq("season_id", normalizedSeasonId)

  if (deactivateError) {
    return {
      ok: false,
      message: deactivateError.message,
    }
  }

  const { error } = await supabase
    .from("ScheduleSeasons")
    .update({ is_active: true })
    .eq("season_id", normalizedSeasonId)

  if (error) {
    return {
      ok: false,
      message: error.message,
    }
  }

  const { error: rpcError } = await supabase.rpc(
    "switch_schedule_season",
    {
      p_season_id: normalizedSeasonId,
      p_days_to_generate: 30,
    }
  )

  if (rpcError) {
    throw new Error(`Unable to switch season: ${rpcError.message}`)
  }

  const noticeResult = await sendScheduleSeasonChangeNotice(
    scheduleSeason.season.season
  )

  revalidateClassSchedulePaths()

  const activationMessage = `${formatSeason(
    scheduleSeason.season.season
  )} schedule activated.`

  if (!noticeResult.ok) {
    return {
      ok: true,
      message: `${activationMessage} Parent notification failed to send: ${noticeResult.message}`,
      emailedParentCount: 0,
      warning: noticeResult.message,
    }
  }

  return {
    ok: true,
    message: `${activationMessage} ${noticeResult.message}`,
    emailedParentCount: noticeResult.emailedParentCount,
    warning: noticeResult.warning,
  }
}

export async function saveClassSchedule({
  scheduleId,
  classId,
  seasonId,
  dayOfWeek,
  startTime,
  endTime,
  isActive,
}: {
  scheduleId?: string | null
  classId: string
  seasonId: string
  dayOfWeek: string
  startTime: string
  endTime: string
  isActive: boolean
}): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  const normalizedDay = dayOfWeek.trim().toLowerCase()
  const normalizedStartTime = normalizeLocalTime(startTime)
  const normalizedEndTime = normalizeLocalTime(endTime)
  const normalizedSeasonId = seasonId.trim()

  if (!classId) {
    return {
      ok: false,
      message: "Choose a class before saving the schedule.",
    }
  }

  if (!normalizedSeasonId) {
    return {
      ok: false,
      message: "Choose a schedule season before saving the schedule.",
    }
  }

  const scheduleSeason = await getScheduleSeason(normalizedSeasonId)

  if (!scheduleSeason.ok) {
    return {
      ok: false,
      message: scheduleSeason.message,
    }
  }

  if (!isDayOfWeek(normalizedDay)) {
    return {
      ok: false,
      message: "Choose a valid day of the week.",
    }
  }

  if (!normalizedStartTime || !normalizedEndTime) {
    return {
      ok: false,
      message: "Start and end times are required.",
    }
  }

  const dayStorageSample = await getDayStorageSample(scheduleId)
  const dayOfWeekValue =
    typeof dayStorageSample === "number"
      ? toDayNumber(normalizedDay, dayStorageSample)
      : normalizedDay
  const payload = {
    class_id: classId,
    season_id: normalizedSeasonId,
    day_of_week: dayOfWeekValue,
    start_time: normalizedStartTime,
    end_time: normalizedEndTime,
    is_active: isActive,
  }
  const supabase = createAdminClient()
  const mutation = scheduleId
    ? supabase
        .from("ClassSchedules")
        .update(payload)
        .eq("schedule_id", scheduleId)
    : supabase.from("ClassSchedules").insert(payload)
  const { error } = await mutation

  if (error) {
    return {
      ok: false,
      message: error.message,
    }
  }

  revalidateClassSchedulePaths()

  return {
    ok: true,
    message: scheduleId ? "Class schedule updated." : "Class schedule added.",
  }
}

export async function deleteClassSchedule(
  scheduleId: string
): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  if (!scheduleId.trim()) {
    return {
      ok: false,
      message: "Choose a class schedule before deleting.",
    }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("ClassSchedules")
    .update({
      is_active: false,
      archived_at: new Date().toLocaleString(),
    })
    .eq("schedule_id", scheduleId)

  if (error) {
    return {
      ok: false,
      message: error.message,
    }
  }

  revalidateClassSchedulePaths()

  return {
    ok: true,
    message: "Class schedule deleted.",
  }
}
