"use server"

import { revalidatePath } from "next/cache"

import { getAccountSession, requireAdminSession } from "@/lib/account/auth"
import { createAdminClient } from "@/lib/supabase/admin"

type ActionResult = {
  ok: boolean
  message: string
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

function normalizeTime(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return ""
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)

  if (!match) {
    return trimmed
  }

  return `${match[1].padStart(2, "0")}:${match[2]}`
}

function formatSeason(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase()

  if (!normalized) {
    return "Selected"
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function revalidateClassSchedulePaths() {
  revalidatePath("/account")
  revalidatePath("/classes")
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

  revalidateClassSchedulePaths()

  return {
    ok: true,
    message: `${formatSeason(scheduleSeason.season.season)} schedule activated.`,
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
  const normalizedStartTime = normalizeTime(startTime)
  const normalizedEndTime = normalizeTime(endTime)
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
