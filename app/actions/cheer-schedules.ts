"use server"

import { revalidatePath } from "next/cache"

import { getAccountSession, requireAdminSession } from "@/lib/account/auth"
import { normalizeLocalTime } from "@/lib/local_time"
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
  let query = supabase.from("CheerSchedules").select("day_of_week").limit(1)

  if (scheduleId) {
    query = query.eq("schedule_id", scheduleId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    return null
  }

  return data?.day_of_week ?? null
}

export async function saveCheerSchedule({
  scheduleId,
  teamId,
  dayOfWeek,
  startTime,
  endTime,
  isActive,
}: {
  scheduleId?: string | null
  teamId: string
  dayOfWeek: string
  startTime: string
  endTime: string
  isActive: boolean
}): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  const normalizedDay = dayOfWeek.trim().toLowerCase()
  const normalizedStartTime = normalizeLocalTime(startTime)
  const normalizedEndTime = normalizeLocalTime(endTime)

  if (!teamId) {
    return {
      ok: false,
      message: "Choose a cheer team before saving the schedule.",
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
  const dayOfWeekValue = toDayNumber(normalizedDay, dayStorageSample)
  const payload = {
    team_id: teamId,
    day_of_week: dayOfWeekValue,
    start_time: normalizedStartTime,
    end_time: normalizedEndTime,
    is_active: isActive,
  }
  const supabase = createAdminClient()
  const mutation = scheduleId
    ? supabase
        .from("CheerSchedules")
        .update(payload)
        .eq("schedule_id", scheduleId)
    : supabase.from("CheerSchedules").insert(payload)
  const { error } = await mutation

  if (error) {
    return {
      ok: false,
      message: error.message,
    }
  }

  revalidatePath("/account")
  revalidatePath("/account/admin/schedules")

  return {
    ok: true,
    message: scheduleId
      ? "Cheer schedule updated."
      : "Cheer schedule added.",
  }
}

export async function deleteCheerSchedule(
  scheduleId: string
): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  if (!scheduleId.trim()) {
    return {
      ok: false,
      message: "Choose a cheer schedule before deleting.",
    }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("CheerSchedules")
    .update({
      is_active: false,
      archived_at: new Date().toISOString(),
    })
    .eq("schedule_id", scheduleId)

  if (error) {
    const { error: fallbackError } = await supabase
      .from("CheerSchedules")
      .update({ is_active: false })
      .eq("schedule_id", scheduleId)

    if (fallbackError) {
      return {
        ok: false,
        message: fallbackError.message,
      }
    }
  }

  revalidatePath("/account")
  revalidatePath("/account/admin/schedules")

  return {
    ok: true,
    message: "Cheer schedule deleted.",
  }
}
