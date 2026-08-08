import "server-only"

import { unstable_cache } from "next/cache"

import { createAdminClient } from "@/lib/supabase/admin"

export type PublicClass = {
  classId: string
  className: string
  classType: string | null
  slug: string
  description: string | null
  price: number | null
  durationMinutes: number | null
  imageSrc: string
  imageAlt: string
  scheduleSummary: string | null
  displayOrder: number
}

export type PublicClassSchedule = {
  scheduleId: string
  classId: string | null
  className: string
  dayOfWeek: string
  startTime: string | null
  endTime: string | null
  scheduleLabel: string
  timeLabel: string
}

type PublicClassRow = {
  class_id: string | number
  class_name?: string | null
  class_price?: number | null
  class_description?: string | null
  type?: string | null
  program_type?: string | null
  stripe_price_id?: string | null
  billing_day?: number | null
  created_at?: string | null
  [key: string]: unknown
}

type PublicClassScheduleRow = {
  schedule_id: string | number
  class_id?: string | number | null
  season_id?: string | number | null
  day_of_week?: string | number | null
  start_time?: string | null
  end_time?: string | null
  is_active?: boolean | null
  created_at?: string | null
  archived_at?: string | null
  [key: string]: unknown
}

type PublicScheduleSeasonRow = {
  season_id: string | number
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

function toId(value: string | number | null | undefined) {
  return value === null || value === undefined ? null : String(value)
}

function normalizeProgramType(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const normalized = value.toLowerCase().replace(/[\s-]+/g, "_")

  if (normalized.includes("cheer")) {
    return "competitive_cheer"
  }

  if (normalized.includes("gym")) {
    return "gymnastics"
  }

  return normalized
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

function formatTimeLabel(
  startTime: string | null | undefined,
  endTime: string | null | undefined
) {
  return `${formatTime(startTime)} - ${formatTime(endTime)}`
}

function formatScheduleLabel(row: PublicClassScheduleRow) {
  return `${formatDay(row.day_of_week)} ${formatTimeLabel(
    row.start_time,
    row.end_time
  )}`
}

function getText(row: PublicClassRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key]

    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function getNumber(row: PublicClassRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key]

    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }

    if (typeof value === "string" && value.trim()) {
      const numericValue = Number(value)

      if (Number.isFinite(numericValue)) {
        return numericValue
      }
    }
  }

  return null
}

function getBoolean(row: PublicClassRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key]

    if (typeof value === "boolean") {
      return value
    }
  }

  return null
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function getClassSlug(row: PublicClassRow, className: string) {
  return getText(row, ["slug", "class_slug", "public_slug"]) ?? slugify(className)
}

function getClassImageSrc(row: PublicClassRow, classId: string) {
  const imageSrc = getText(row, ["image_src"])

  if (imageSrc?.startsWith("/")) {
    return imageSrc
  }

  return `/images/classes/class_${classId}.png`
}

function getClassPrice(row: PublicClassRow) {
  return getNumber(row, ["class_price", "monthly_price", "price", "tuition"])
}

function getScheduleDurationMinutes(schedule: PublicClassScheduleRow) {
  if (!schedule.start_time || !schedule.end_time) {
    return null
  }

  const [startHour, startMinute] = schedule.start_time.split(":").map(Number)
  const [endHour, endMinute] = schedule.end_time.split(":").map(Number)

  if (
    [startHour, startMinute, endHour, endMinute].some((value) =>
      Number.isNaN(value)
    )
  ) {
    return null
  }

  const duration = endHour * 60 + endMinute - (startHour * 60 + startMinute)

  return duration > 0 ? duration : null
}

async function fetchPublicClassRows() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("Classes")
    .select("*")
    .order("class_id", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as PublicClassRow[]
}

async function fetchPublicClassScheduleRows() {
  const activeSeasonIds = await fetchActivePublicScheduleSeasonIds()

  if (!activeSeasonIds.length) {
    return []
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("ClassSchedules")
    .select("*")
    .eq("is_active", true)
    .in("season_id", activeSeasonIds)
    .is("archived_at", null)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true })

  if (!error) {
    return (data ?? []) as PublicClassScheduleRow[]
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("ClassSchedules")
    .select("*")
    .eq("is_active", true)
    .in("season_id", activeSeasonIds)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true })

  if (fallbackError) {
    throw new Error(fallbackError.message)
  }

  return (fallbackData ?? []) as PublicClassScheduleRow[]
}

async function fetchActivePublicScheduleSeasonIds() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("ScheduleSeasons")
    .select("season_id")
    .eq("is_active", true)

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as PublicScheduleSeasonRow[]).map((row) =>
    String(row.season_id)
  )
}

function isPublicClass(row: PublicClassRow) {
  const active = getBoolean(row, ["is_active", "active"])
  const isPublic = getBoolean(row, ["is_public", "public"])
  const programType = normalizeProgramType(
    row.program_type ?? row.type ?? getText(row, ["program"])
  )

  return active !== false && isPublic !== false && programType !== "competitive_cheer"
}

function buildPublicSchedules(
  scheduleRows: PublicClassScheduleRow[],
  classNameById: Map<string, string>
) {
  return scheduleRows
    .map<PublicClassSchedule>((row) => {
      const classId = toId(row.class_id)

      return {
        scheduleId: String(row.schedule_id),
        classId,
        className:
          (classId ? classNameById.get(classId) : null) ??
          (classId ? `Class #${classId}` : "Unassigned class"),
        dayOfWeek: normalizeDay(row.day_of_week),
        startTime: row.start_time ?? null,
        endTime: row.end_time ?? null,
        scheduleLabel: formatScheduleLabel(row),
        timeLabel: formatTimeLabel(row.start_time, row.end_time),
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
}

function buildScheduleSummary(schedules: PublicClassSchedule[]) {
  if (!schedules.length) {
    return null
  }

  return schedules.map((schedule) => schedule.scheduleLabel).join(", ")
}

function buildPublicClass(
  row: PublicClassRow,
  schedules: PublicClassScheduleRow[],
  scheduleSummary: string | null
): PublicClass {
  const classId = String(row.class_id)
  const className = row.class_name?.trim() || `Class #${classId}`
  const durationMinutes =
    getNumber(row, ["duration_minutes", "duration"]) ??
    schedules.map(getScheduleDurationMinutes).find(Boolean) ??
    null

  return {
    classId,
    className,
    classType: row.type ?? null,
    slug: getClassSlug(row, className),
    description:
      getText(row, ["description", "public_description", "class_description"]) ??
      "A skill-building class focused on safe progressions, confidence, and strong technique.",
    price: getClassPrice(row),
    durationMinutes,
    imageSrc: getClassImageSrc(row, classId),
    imageAlt: getText(row, ["image_alt", "alt_text"]) ?? className,
    scheduleSummary,
    displayOrder: getNumber(row, ["display_order", "sort_order", "order"]) ?? Number(classId),
  }
}

async function loadPublicClassData() {
  const [classRows, scheduleRows] = await Promise.all([
    fetchPublicClassRows(),
    fetchPublicClassScheduleRows(),
  ])
  const publicClassRows = classRows.filter(isPublicClass)
  const classNameById = new Map(
    publicClassRows.map((row) => [
      String(row.class_id),
      row.class_name?.trim() || `Class #${row.class_id}`,
    ])
  )
  const publicSchedules = buildPublicSchedules(scheduleRows, classNameById)
  const schedulesByClassId = new Map<string, PublicClassSchedule[]>()

  publicSchedules.forEach((schedule) => {
    if (!schedule.classId) {
      return
    }

    schedulesByClassId.set(schedule.classId, [
      ...(schedulesByClassId.get(schedule.classId) ?? []),
      schedule,
    ])
  })

  return {
    classes: publicClassRows
      .map((row) => {
        const classId = String(row.class_id)

        return buildPublicClass(
          row,
          scheduleRows.filter(
            (scheduleRow) => toId(scheduleRow.class_id) === classId
          ),
          buildScheduleSummary(schedulesByClassId.get(classId) ?? [])
        )
      })
      .sort((first, second) => {
        if (first.displayOrder !== second.displayOrder) {
          return first.displayOrder - second.displayOrder
        }

        return first.className.localeCompare(second.className)
      }),
    schedules: publicSchedules,
  }
}

const getCachedPublicClassData = unstable_cache(
  loadPublicClassData,
  ["public-class-data"],
  { revalidate: 300, tags: ["public-class-data"] }
)

export async function getPublicClassData() {
  return getCachedPublicClassData()
}

export async function getPublicClasses() {
  return (await getPublicClassData()).classes
}

export async function getPublicClassBySlug(slug: string) {
  const classData = await getPublicClassData()
  const selectedClass = classData.classes.find(
    (classRecord) => classRecord.slug === slug
  )

  if (!selectedClass) {
    return null
  }

  return {
    classRecord: selectedClass,
    schedules: classData.schedules.filter(
      (schedule) => schedule.classId === selectedClass.classId
    ),
    classes: classData.classes,
  }
}

export async function getPublicClassSchedules() {
  return (await getPublicClassData()).schedules
}
