export const weekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

export type Weekday = (typeof weekdays)[number]

export const weekdayOptions = weekdays.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}))

export const sundayFirstWeekdayOptions = [
  weekdayOptions[6],
  ...weekdayOptions.slice(0, 6),
]

export function normalizeDay(
  value: string | number | null | undefined
): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value === 0 || value === 7) {
      return "sunday"
    }

    return weekdays[value - 1] ?? String(value)
  }

  const normalized = String(value ?? "").trim().toLowerCase()
  const numericDay = Number(normalized)

  if (normalized && Number.isInteger(numericDay)) {
    return normalizeDay(numericDay)
  }

  return normalized
}

export function formatDay(value: string | number | null | undefined) {
  const normalized = normalizeDay(value)

  if (!normalized) {
    return "Unscheduled"
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function getWeekdaySortIndex(
  value: string | number | null | undefined
) {
  const index = weekdays.indexOf(normalizeDay(value) as Weekday)

  return index === -1 ? weekdays.length : index
}
