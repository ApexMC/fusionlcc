import { NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"

type ClassRelation = {
  class_id?: string | number | null
  class_name?: string | null
}

type ClassScheduleRow = {
  schedule_id: string | number
  class_id?: string | number | null
  day_of_week?: string | number | null
  start_time?: string | null
  end_time?: string | null
  is_active?: boolean | null
  Classes?: ClassRelation | ClassRelation[] | null
}

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

function formatTime(value: string | null | undefined) {
  if (!value) {
    return "Time TBD"
  }

  const [hourText, minuteText = "00"] = value.split(":")
  const hour = Number(hourText)
  const minute = Number(minuteText)

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return value
  }

  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 || 12

  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`
}

function formatScheduleLabel(row: ClassScheduleRow) {
  return `${formatDay(row.day_of_week)} ${formatTime(row.start_time)} - ${formatTime(row.end_time)}`
}

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("ClassSchedules")
    .select(
      "schedule_id,class_id,day_of_week,start_time,end_time,is_active,Classes(class_id,class_name)"
    )
    .eq("is_active", true)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const schedules = ((data ?? []) as ClassScheduleRow[])
    .map((row) => {
      const classRecord = firstRelation(row.Classes)
      const classId = row.class_id ?? classRecord?.class_id ?? null

      return {
        scheduleId: String(row.schedule_id),
        classId: classId === null ? null : String(classId),
        className:
          classRecord?.class_name ??
          (classId === null ? "Unassigned class" : `Class #${classId}`),
        dayOfWeek: normalizeDay(row.day_of_week),
        startTime: row.start_time ?? null,
        scheduleLabel: formatScheduleLabel(row),
      }
    })
    .sort((first, second) => {
      const firstDay = dayOrder.indexOf(first.dayOfWeek)
      const secondDay = dayOrder.indexOf(second.dayOfWeek)
      const dayComparison =
        (firstDay === -1 ? dayOrder.length : firstDay) -
        (secondDay === -1 ? dayOrder.length : secondDay)

      if (dayComparison !== 0) {
        return dayComparison
      }

      return (first.startTime ?? "").localeCompare(second.startTime ?? "")
    })

  return NextResponse.json(schedules)
}
