"use server"

import { revalidatePath } from "next/cache"

import { getAccountSession, requireAdminSession } from "@/lib/account/auth"
import { ACTIVE_ENROLLMENT_MESSAGE } from "@/lib/enrollments"
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

function isAdminEnrollmentStatus(
  value: string
): value is AdminEnrollmentStatus {
  return adminStatuses.includes(value as AdminEnrollmentStatus)
}

function revalidateEnrollmentPages() {
  revalidatePath("/account")
  revalidatePath("/account/admin/enrollments")
  revalidatePath("/competitive-cheer/request-tryout")
}

async function createCheerEnrollment({
  athleteId,
  teamId,
  status,
  expectedUserId,
}: {
  athleteId: string
  teamId: string
  status: AdminEnrollmentStatus
  expectedUserId?: string
}): Promise<ActionResult & { enrollmentId?: string }> {
  const normalizedAthleteId = athleteId.trim()
  const normalizedTeamId = teamId.trim()

  if (!normalizedAthleteId || !normalizedTeamId) {
    return {
      ok: false,
      message: "Choose an athlete and cheer team before submitting.",
    }
  }

  const supabase = createAdminClient()
  const [{ data: athlete, error: athleteError }, { data: team, error: teamError }] =
    await Promise.all([
      supabase
        .from("Athletes")
        .select("athlete_id,user_id,parent_id")
        .eq("athlete_id", normalizedAthleteId)
        .maybeSingle(),
      supabase
        .from("CheerTeams")
        .select("team_id")
        .eq("team_id", normalizedTeamId)
        .maybeSingle(),
    ])

  if (athleteError || !athlete) {
    return {
      ok: false,
      message: athleteError?.message ?? "Athlete was not found.",
    }
  }

  if (expectedUserId && athlete.user_id !== expectedUserId) {
    return {
      ok: false,
      message: "You can only request tryouts for athletes on your account.",
    }
  }

  if (teamError || !team) {
    return {
      ok: false,
      message: teamError?.message ?? "Cheer team was not found.",
    }
  }

  const { data: existingEnrollments, error: existingError } = await supabase
    .from("CheerEnrollments")
    .select("enrollment_id,status")
    .eq("athlete_id", normalizedAthleteId)
    .eq("team_id", normalizedTeamId)
    .in("status", ["pending", "approved", "active"])

  if (existingError) {
    return {
      ok: false,
      message: existingError.message,
    }
  }

  const existingEnrollment =
    existingEnrollments?.find((enrollment) =>
      ["approved", "active", "pending"].includes(enrollment.status)
    ) ??
    existingEnrollments?.[0]

  if (["approved", "active"].includes(existingEnrollment?.status ?? "")) {
    return {
      ok: false,
      message: ACTIVE_ENROLLMENT_MESSAGE,
    }
  }

  if (existingEnrollment) {
    return {
      ok: false,
      message: `This athlete already has a ${existingEnrollment.status} cheer enrollment for that team.`,
    }
  }

  const { data, error } = await supabase
    .from("CheerEnrollments")
    .insert({
      athlete_id: normalizedAthleteId,
      parent_id: athlete.parent_id ?? null,
      team_id: normalizedTeamId,
      status,
    })
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
    message:
      status === "pending"
        ? "Your tryout request was submitted."
        : "Cheer enrollment created.",
    enrollmentId: String(data.enrollment_id),
  }
}

export async function requestCheerTryout({
  athleteId,
  teamId,
}: {
  athleteId: string
  teamId: string
}): Promise<ActionResult & { enrollmentId?: string }> {
  const session = await getAccountSession()

  if (!session?.userId) {
    return {
      ok: false,
      message: "You must be signed in to request a tryout.",
    }
  }

  return createCheerEnrollment({
    athleteId,
    teamId,
    status: "pending",
    expectedUserId: session.userId,
  })
}

export async function createAdminCheerEnrollment({
  athleteId,
  teamId,
  status,
}: {
  athleteId: string
  teamId: string
  status: string
}): Promise<ActionResult & { enrollmentId?: string }> {
  requireAdminSession(await getAccountSession())

  const normalizedStatus = status.trim().toLowerCase()

  if (!isAdminEnrollmentStatus(normalizedStatus)) {
    return {
      ok: false,
      message: "That cheer enrollment status is not supported.",
    }
  }

  return createCheerEnrollment({
    athleteId,
    teamId,
    status: normalizedStatus,
  })
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
