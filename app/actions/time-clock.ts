"use server"

import { revalidatePath } from "next/cache"

import {
  getAccountSession,
  requireAdminSession,
  requireStaffSession,
} from "@/lib/account/auth"
import { createAdminClient } from "@/lib/supabase/admin"

type ActionResult = {
  ok: boolean
  message: string
}

function tableErrorMessage(error: { code?: string; message?: string }) {
  return error.message ?? "Time clock could not be updated."
}

function normalizeNote(note: string | undefined) {
  const trimmed = note?.trim()

  return trimmed ? trimmed.slice(0, 500) : null
}

const adminReviewStatuses = ["approved", "denied"] as const
type AdminReviewStatus = (typeof adminReviewStatuses)[number]

function isAdminReviewStatus(value: string): value is AdminReviewStatus {
  return adminReviewStatuses.includes(value as AdminReviewStatus)
}

function revalidateTimeClockViews() {
  revalidatePath("/account")
  revalidatePath("/account/time-clock")
}

export async function clockInCoach({
  note,
}: {
  note?: string
} = {}): Promise<ActionResult & { clockedAt?: string }> {
  const session = requireStaffSession(await getAccountSession())
  const now = new Date()
  const clockedAt = now.toISOString()
  const supabase = createAdminClient()
  const { data: activeEntries, error: activeError } = await supabase
    .from("CoachTimeClockEntries")
    .select("time_clock_id")
    .eq("coach_user_id", session.userId)
    .is("clock_out_at", null)
    .limit(1)

  if (activeError) {
    return {
      ok: false,
      message: tableErrorMessage(activeError),
    }
  }

  if (activeEntries?.length) {
    return {
      ok: false,
      message: "You are already clocked in.",
    }
  }

  const { error } = await supabase.from("CoachTimeClockEntries").insert({
    coach_user_id: session.userId,
    work_date: clockedAt,
    clock_in_at: clockedAt,
    clock_in_note: normalizeNote(note),
    status: "pending",
  })

  if (error) {
    return {
      ok: false,
      message: tableErrorMessage(error),
    }
  }

  revalidateTimeClockViews()

  return {
    ok: true,
    message: "Clocked in.",
    clockedAt,
  }
}

export async function clockOutCoach({
  entryId,
  note,
}: {
  entryId: string
  note?: string
}): Promise<ActionResult & { clockedAt?: string }> {
  const session = requireStaffSession(await getAccountSession())
  const clockedAt = new Date().toISOString()

  if (!entryId.trim()) {
    return {
      ok: false,
      message: "Choose an active time clock entry before clocking out.",
    }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("CoachTimeClockEntries")
    .update({
      clock_out_at: clockedAt,
      clock_out_note: normalizeNote(note),
      updated_at: new Date().toISOString(),
    })
    .eq("time_clock_id", entryId)
    .eq("coach_user_id", session.userId)
    .is("clock_out_at", null)
    .select("time_clock_id")
    .maybeSingle()

  if (error) {
    return {
      ok: false,
      message: tableErrorMessage(error),
    }
  }

  if (!data) {
    return {
      ok: false,
      message: "No active time clock entry was found.",
    }
  }

  revalidateTimeClockViews()

  return {
    ok: true,
    message: "Clocked out.",
    clockedAt,
  }
}

export async function updateCoachTimeClockEntryStatus({
  entryId,
  status,
}: {
  entryId: string
  status: string
}): Promise<ActionResult> {
  const session = requireAdminSession(await getAccountSession())
  const normalizedEntryId = entryId.trim()
  const normalizedStatus = status.trim().toLowerCase()

  if (!normalizedEntryId) {
    return {
      ok: false,
      message: "Choose a time clock entry before updating it.",
    }
  }

  if (!isAdminReviewStatus(normalizedStatus)) {
    return {
      ok: false,
      message: "Time clock entries can only be approved or denied.",
    }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("CoachTimeClockEntries")
    .update({
      status: normalizedStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("time_clock_id", normalizedEntryId)
    .select("time_clock_id")
    .maybeSingle()

  if (error) {
    return {
      ok: false,
      message: tableErrorMessage(error),
    }
  }

  if (!data) {
    return {
      ok: false,
      message: "No time clock entry was found.",
    }
  }

  revalidateTimeClockViews()

  return {
    ok: true,
    message: `Punch ${normalizedStatus} by ${
      session.roles.includes("owner") ? "owner" : "admin"
    }.`,
  }
}
