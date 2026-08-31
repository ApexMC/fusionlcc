import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  getDateKey,
  organizationTimeZone,
  shiftDateKey,
} from "@/lib/date_keys"
import {
  formatDay,
  getWeekdaySortIndex,
  normalizeDay,
} from "@/lib/scheduling"

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

export type PublicClassSession = {
  sessionId: string
  classId: string
  className: string
  sessionDate: string
  startsAt: string | null
  endsAt: string | null
  status: string
  type: string | null
  timeLabel: string
}

export type PublicDeadPeriod = {
  periodId: string
  startsAt: string | null
  endsAt: string | null
}

type PublicClassRow = {
  class_id: string | number
  class_name?: string | null
  class_price?: number | null
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

type PublicDeadPeriodRow = {
  period_id: string | number
  starts_at?: string | null
  ends_at?: string | null
}

type PublicClassSessionRow = {
  session_id: string | number
  class_id?: string | number | null
  schedule_id?: string | number | null
  session_date?: string | null
  starts_at?: string | null
  ends_at?: string | null
  status?: string | null
  type?: string | null
}

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

function formatTimestampTime(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: organizationTimeZone,
  }).format(date)
}

function formatSessionTimeLabel(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined
) {
  const startTime = formatTimestampTime(startsAt)
  const endTime = formatTimestampTime(endsAt)

  if (startTime && endTime) {
    return `${startTime} - ${endTime}`
  }

  return startTime ?? endTime ?? "Time TBD"
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

async function fetchPublicDeadPeriods(): Promise<PublicDeadPeriod[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("DeadPeriods")
    .select("period_id,starts_at,ends_at")
    .order("starts_at", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as PublicDeadPeriodRow[]).map((row) => ({
    periodId: String(row.period_id),
    startsAt: getDateKey(row.starts_at) || null,
    endsAt: getDateKey(row.ends_at) || null,
  }))
}

async function fetchPublicClassSessionRows(
  startsOn: string,
  endsOn: string
) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("ClassSessions")
    .select(
      "session_id,class_id,schedule_id,session_date,starts_at,ends_at,status,type"
    )
    .gte("session_date", startsOn)
    .lte("session_date", endsOn)
    .order("session_date", { ascending: true })
    .order("starts_at", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as PublicClassSessionRow[]
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
      const dayComparison =
        getWeekdaySortIndex(first.dayOfWeek) -
        getWeekdaySortIndex(second.dayOfWeek)

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

export async function getPublicClassData() {
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

export async function getPublicClassCalendarData(todayDateKey: string) {
  const rangeStartDateKey = `${todayDateKey.slice(0, 7)}-01`
  const rangeEndDateKey = shiftDateKey(todayDateKey, 30)
  const [classData, sessionRows, deadPeriods] = await Promise.all([
    getPublicClassData(),
    fetchPublicClassSessionRows(rangeStartDateKey, rangeEndDateKey),
    fetchPublicDeadPeriods(),
  ])
  const publicClassIds = new Set(
    classData.classes.map((classRecord) => classRecord.classId)
  )
  const classNameById = new Map(
    classData.classes.map((classRecord) => [
      classRecord.classId,
      classRecord.className,
    ])
  )
  const scheduleById = new Map(
    classData.schedules.map((schedule) => [schedule.scheduleId, schedule])
  )
  const sessions = sessionRows.flatMap<PublicClassSession>((row) => {
    const scheduleId = toId(row.schedule_id)
    const schedule = scheduleId ? scheduleById.get(scheduleId) : null
    const classId = toId(row.class_id) ?? schedule?.classId ?? null
    const sessionDate = getDateKey(row.session_date)

    if (!classId || !publicClassIds.has(classId) || !sessionDate) {
      return []
    }

    return [
      {
        sessionId: String(row.session_id),
        classId,
        className:
          classNameById.get(classId) ?? schedule?.className ?? `Class #${classId}`,
        sessionDate,
        startsAt: row.starts_at ?? null,
        endsAt: row.ends_at ?? null,
        status: row.status?.trim() || "scheduled",
        type: row.type?.trim() || null,
        timeLabel: formatSessionTimeLabel(row.starts_at, row.ends_at),
      },
    ]
  })

  return {
    sessions,
    deadPeriods,
  }
}
