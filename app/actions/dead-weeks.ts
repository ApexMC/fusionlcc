"use server"

import { revalidatePath } from "next/cache"

import { getAccountSession, requireAdminSession } from "@/lib/account/auth"
import { createAdminClient } from "@/lib/supabase/admin"

type ActionResult = {
  ok: boolean
  message: string
}

type DateParts = {
  year: number
  month: number
  day: number
}

const deadPeriodLeadTimeDays = 31
const classSessionTimeZone = "America/Indiana/Tell_City"

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

function getLocalDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: classSessionTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const dateParts = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  )

  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`
}

function shiftDateKey(dateKey: string, days: number) {
  const dateParts = parseDateParts(dateKey)

  if (!dateParts) {
    return dateKey
  }

  const date = new Date(
    Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + days)
  )
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function getMinimumDeadPeriodStartDate() {
  return shiftDateKey(getLocalDateKey(), deadPeriodLeadTimeDays)
}

export async function saveDeadPeriod({
  startsAt,
  endsAt,
}: {
  startsAt: string
  endsAt: string
}): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  const normalizedStartsAt = normalizeDateInput(startsAt)
  const normalizedEndsAt = normalizeDateInput(endsAt)

  if (!normalizedStartsAt || !normalizedEndsAt) {
    return {
      ok: false,
      message: "Start and end dates are required.",
    }
  }

  if (normalizedStartsAt < getMinimumDeadPeriodStartDate()) {
    return {
      ok: false,
      message: "Start date must be at least 31 days from today.",
    }
  }

  if (normalizedEndsAt < normalizedStartsAt) {
    return {
      ok: false,
      message: "End date must be on or after the start date.",
    }
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from("DeadPeriods").insert({
    starts_at: normalizedStartsAt,
    ends_at: normalizedEndsAt,
  })

  if (error) {
    return {
      ok: false,
      message: error.message,
    }
  }

  revalidatePath("/account/admin/dead-weeks")

  return {
    ok: true,
    message: "Dead week added.",
  }
}

export async function deleteDeadPeriod(
  periodId: string
): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  const normalizedPeriodId = periodId.trim()

  if (!normalizedPeriodId) {
    return {
      ok: false,
      message: "Choose a dead week before deleting.",
    }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("DeadPeriods")
    .delete()
    .eq("period_id", normalizedPeriodId)

  if (error) {
    return {
      ok: false,
      message: error.message,
    }
  }

  revalidatePath("/account/admin/dead-weeks")

  return {
    ok: true,
    message: "Dead week deleted.",
  }
}
