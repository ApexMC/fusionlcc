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

export async function saveClassSchedule({
  scheduleId,
  classId,
  dayOfWeek,
  startTime,
  endTime,
  isActive,
}: {
  scheduleId?: string | null
  classId: string
  dayOfWeek: string
  startTime: string
  endTime: string
  isActive: boolean
}): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  const normalizedDay = dayOfWeek.trim().toLowerCase()
  const normalizedStartTime = normalizeTime(startTime)
  const normalizedEndTime = normalizeTime(endTime)

  if (!classId) {
    return {
      ok: false,
      message: "Choose a class before saving the schedule.",
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

  revalidatePath("/account")

  return {
    ok: true,
    message: scheduleId ? "Class schedule updated." : "Class schedule added.",
  }
}
