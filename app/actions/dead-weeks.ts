"use server"

import { revalidatePath } from "next/cache"

import { getAccountSession, requireAdminSession } from "@/lib/account/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  getDateKeyInTimeZone as getLocalDateKey,
  parseDateKeyParts as parseDateParts,
  shiftDateKey,
} from "@/lib/date_keys"

type ActionResult = {
  ok: boolean
  message: string
}

const deadPeriodLeadTimeDays = 31

function normalizeDateInput(value: string) {
  const normalized = value.trim()

  return parseDateParts(normalized) ? normalized : null
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
  revalidatePath("/classes/calendar")

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
  revalidatePath("/classes/calendar")

  return {
    ok: true,
    message: "Dead week deleted.",
  }
}
