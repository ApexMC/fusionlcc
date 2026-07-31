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

function normalizeNote(note: string | null | undefined) {
  const trimmed = note?.trim()

  return trimmed ? trimmed.slice(0, 500) : null
}

function normalizeDateTime(value: string | null | undefined) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return null
  }

  const date = new Date(trimmed)

  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeTimeClockStatus(status: string | null | undefined) {
  return status?.trim().toLowerCase() || "pending"
}

const adminReviewStatuses = ["approved", "denied"] as const
type AdminReviewStatus = (typeof adminReviewStatuses)[number]

function isAdminReviewStatus(value: string): value is AdminReviewStatus {
  return adminReviewStatuses.includes(value as AdminReviewStatus)
}

function revalidateTimeClockViews() {
  revalidatePath("/account")
  revalidatePath("/account/time-clock")
  revalidatePath("/account/admin/time-clock")
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
  const normalizedEntryId = entryId.trim()

  if (!normalizedEntryId) {
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
    .eq("time_clock_id", normalizedEntryId)
    .eq("coach_user_id", session.userId)
    .is("clock_out_at", null)
    .or("status.is.null,status.eq.pending")
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
      message: "No pending active time clock entry was found.",
    }
  }

  revalidateTimeClockViews()

  return {
    ok: true,
    message: "Clocked out.",
    clockedAt,
  }
}

export async function updateCoachTimeClockEntry({
  entryId,
  clockInAt,
  clockOutAt,
  clockInNote,
  clockOutNote,
}: {
  entryId: string
  clockInAt: string
  clockOutAt?: string | null
  clockInNote?: string | null
  clockOutNote?: string | null
}): Promise<ActionResult> {
  const session = requireStaffSession(await getAccountSession())
  const normalizedEntryId = entryId.trim()
  const normalizedClockInAt = normalizeDateTime(clockInAt)
  const normalizedClockOutAt = normalizeDateTime(clockOutAt)

  if (!normalizedEntryId) {
    return {
      ok: false,
      message: "Choose a time clock entry before editing it.",
    }
  }

  if (!normalizedClockInAt) {
    return {
      ok: false,
      message: "Enter a valid clock-in time.",
    }
  }

  if (clockOutAt?.trim() && !normalizedClockOutAt) {
    return {
      ok: false,
      message: "Enter a valid clock-out time.",
    }
  }

  if (
    normalizedClockOutAt &&
    new Date(normalizedClockOutAt).getTime() <
      new Date(normalizedClockInAt).getTime()
  ) {
    return {
      ok: false,
      message: "Clock-out time cannot be before clock-in time.",
    }
  }

  const supabase = createAdminClient()
  const { data: entry, error: loadError } = await supabase
    .from("CoachTimeClockEntries")
    .select("time_clock_id,coach_user_id,status")
    .eq("time_clock_id", normalizedEntryId)
    .maybeSingle()

  if (loadError) {
    return {
      ok: false,
      message: tableErrorMessage(loadError),
    }
  }

  if (!entry) {
    return {
      ok: false,
      message: "No time clock entry was found.",
    }
  }

  const coachUserId =
    typeof entry.coach_user_id === "string" ? entry.coach_user_id : ""

  if (!session.isAdmin && !session.isOwner && coachUserId !== session.userId) {
    return {
      ok: false,
      message: "You can only edit your own time punches.",
    }
  }

  if (normalizeTimeClockStatus(entry.status) !== "pending") {
    return {
      ok: false,
      message: "Only pending time punches can be edited.",
    }
  }

  if (!normalizedClockOutAt) {
    const { data: activeEntries, error: activeError } = await supabase
      .from("CoachTimeClockEntries")
      .select("time_clock_id")
      .eq("coach_user_id", coachUserId)
      .is("clock_out_at", null)
      .neq("time_clock_id", normalizedEntryId)
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
        message: "This coach already has another active time punch.",
      }
    }
  }

  const { data, error } = await supabase
    .from("CoachTimeClockEntries")
    .update({
      work_date: normalizedClockInAt,
      clock_in_at: normalizedClockInAt,
      clock_out_at: normalizedClockOutAt,
      clock_in_note: normalizeNote(clockInNote),
      clock_out_note: normalizeNote(clockOutNote),
      updated_at: new Date().toISOString(),
    })
    .eq("time_clock_id", normalizedEntryId)
    .or("status.is.null,status.eq.pending")
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
      message: "Only pending time punches can be edited.",
    }
  }

  revalidateTimeClockViews()

  return {
    ok: true,
    message: "Punch updated.",
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
  const { data: entry, error: loadError } = await supabase
    .from("CoachTimeClockEntries")
    .select("time_clock_id,status,clock_out_at")
    .eq("time_clock_id", normalizedEntryId)
    .maybeSingle()

  if (loadError) {
    return {
      ok: false,
      message: tableErrorMessage(loadError),
    }
  }

  if (!entry) {
    return {
      ok: false,
      message: "No time clock entry was found.",
    }
  }

  if (normalizeTimeClockStatus(entry.status) !== "pending") {
    return {
      ok: false,
      message: "Only pending time punches can be approved or denied.",
    }
  }

  if (!entry.clock_out_at) {
    return {
      ok: false,
      message: "Active time punches must be clocked out before review.",
    }
  }

  const { data, error } = await supabase
    .from("CoachTimeClockEntries")
    .update({
      status: normalizedStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("time_clock_id", normalizedEntryId)
    .or("status.is.null,status.eq.pending")
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
      message: "Only pending time punches can be approved or denied.",
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
