"use server"

import { revalidatePath } from "next/cache"

import { getAccountSession, requireAdminSession } from "@/lib/account/auth"
import { createAdminClient } from "@/lib/supabase/admin"

type ActionResult = {
  ok: boolean
  message: string
}

const adminStatuses = [
  "pending",
  "approved",
  "active",
  "denied",
  "canceled",
] as const

type AdminEnrollmentStatus = (typeof adminStatuses)[number]

type CheerScheduleRecord = {
  schedule_id: string | number
  team_id?: string | number | null
  is_active?: boolean | null
  archived_at?: string | null
}

function isAdminEnrollmentStatus(
  value: string
): value is AdminEnrollmentStatus {
  return adminStatuses.includes(value as AdminEnrollmentStatus)
}

function revalidateEnrollmentPages() {
  revalidatePath("/account")
  revalidatePath("/account/admin/enrollments")
}

async function getCheerSchedule(scheduleId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("CheerSchedules")
    .select("schedule_id,team_id,is_active,archived_at")
    .eq("schedule_id", scheduleId)
    .maybeSingle()

  if (!error) {
    return {
      data: data as CheerScheduleRecord | null,
      error: null,
    }
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("CheerSchedules")
    .select("schedule_id,team_id")
    .eq("schedule_id", scheduleId)
    .maybeSingle()

  return {
    data: (fallbackData as CheerScheduleRecord | null) ?? null,
    error: fallbackError,
  }
}

export async function updateCheerEnrollmentAdminStatus({
  enrollmentId,
  status,
}: {
  enrollmentId: string
  status: string
}): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  const normalizedEnrollmentId = enrollmentId.trim()
  const normalizedStatus = status.trim().toLowerCase()

  if (!normalizedEnrollmentId) {
    return {
      ok: false,
      message: "Choose a cheer enrollment before updating its status.",
    }
  }

  if (!isAdminEnrollmentStatus(normalizedStatus)) {
    return {
      ok: false,
      message: "That cheer enrollment status is not supported.",
    }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("CheerEnrollments")
    .update({ status: normalizedStatus })
    .eq("enrollment_id", normalizedEnrollmentId)
    .select("enrollment_id")
    .maybeSingle()

  if (error) {
    return {
      ok: false,
      message: error.message,
    }
  }

  if (!data) {
    return {
      ok: false,
      message: "Cheer enrollment was not found.",
    }
  }

  revalidateEnrollmentPages()

  return {
    ok: true,
    message: `Cheer enrollment ${normalizedStatus}.`,
  }
}

export async function createAdminCheerEnrollment({
  athleteId,
  parentId,
  scheduleId,
  status,
}: {
  athleteId: string
  parentId?: string | null
  scheduleId: string
  status: string
}): Promise<ActionResult & { enrollmentId?: string }> {
  requireAdminSession(await getAccountSession())

  const normalizedAthleteId = athleteId.trim()
  const normalizedParentId = parentId?.trim() || null
  const normalizedScheduleId = scheduleId.trim()
  const normalizedStatus = status.trim().toLowerCase()

  if (!normalizedAthleteId || !normalizedScheduleId) {
    return {
      ok: false,
      message:
        "Choose an athlete and cheer team schedule before creating an enrollment.",
    }
  }

  if (!isAdminEnrollmentStatus(normalizedStatus)) {
    return {
      ok: false,
      message: "That cheer enrollment status is not supported.",
    }
  }

  const supabase = createAdminClient()
  const { data: athlete, error: athleteError } = await supabase
    .from("Athletes")
    .select("athlete_id,parent_id")
    .eq("athlete_id", normalizedAthleteId)
    .maybeSingle()

  if (athleteError || !athlete) {
    return {
      ok: false,
      message: athleteError?.message ?? "Athlete was not found.",
    }
  }

  const { data: schedule, error: scheduleError } =
    await getCheerSchedule(normalizedScheduleId)

  if (scheduleError || !schedule) {
    return {
      ok: false,
      message: scheduleError?.message ?? "Cheer schedule was not found.",
    }
  }

  if (schedule.is_active === false || schedule.archived_at) {
    return {
      ok: false,
      message: "Choose an active cheer team schedule.",
    }
  }

  const teamId =
    schedule.team_id === null || schedule.team_id === undefined
      ? null
      : String(schedule.team_id)

  if (!teamId) {
    return {
      ok: false,
      message: "The selected cheer schedule is not assigned to a team.",
    }
  }

  const resolvedParentId =
    normalizedParentId ??
    (athlete.parent_id === null || athlete.parent_id === undefined
      ? null
      : String(athlete.parent_id))

  if (!resolvedParentId) {
    return {
      ok: false,
      message: "The selected athlete does not have a linked parent account.",
    }
  }

  const { data: existingEnrollment, error: existingError } = await supabase
    .from("CheerEnrollments")
    .select("enrollment_id,status")
    .eq("athlete_id", normalizedAthleteId)
    .eq("schedule_id", normalizedScheduleId)
    .in("status", ["pending", "approved", "active"])
    .maybeSingle()

  if (existingError) {
    return {
      ok: false,
      message: existingError.message,
    }
  }

  if (existingEnrollment) {
    return {
      ok: false,
      message: `This athlete already has a ${existingEnrollment.status} enrollment for that cheer schedule.`,
    }
  }

  const { data, error } = await supabase
    .from("CheerEnrollments")
    .insert([
      {
        athlete_id: normalizedAthleteId,
        parent_id: resolvedParentId,
        team_id: teamId,
        schedule_id: normalizedScheduleId,
        status: normalizedStatus,
        enrolled_at: new Date().toISOString(),
      },
    ])
    .select("enrollment_id")
    .single()

  if (error) {
    return {
      ok: false,
      message: error.message,
    }
  }

  revalidateEnrollmentPages()

  return {
    ok: true,
    message: "Cheer enrollment created.",
    enrollmentId: String(data.enrollment_id),
  }
}
