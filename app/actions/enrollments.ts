"use server"

import { revalidatePath } from "next/cache"

import { getAccountSession, requireAdminSession } from "@/lib/account/auth"
import { createAdminClient } from "@/lib/supabase/admin"

type ActionResult = {
  ok: boolean
  message: string
}

const adminStatuses = ["pending", "approved", "active", "denied", "canceled"] as const
type AdminEnrollmentStatus = (typeof adminStatuses)[number]

function isAdminEnrollmentStatus(value: string): value is AdminEnrollmentStatus {
  return adminStatuses.includes(value as AdminEnrollmentStatus)
}

async function getAvailableClassSchedule(scheduleId: string) {
  const supabase = createAdminClient()
  const { data: scheduleRecord, error: scheduleError } = await supabase
    .from("ClassSchedules")
    .select("schedule_id,is_active,season_id")
    .eq("schedule_id", scheduleId)
    .maybeSingle()

  if (scheduleError || !scheduleRecord) {
    return {
      ok: false as const,
      message: scheduleError?.message ?? "Class schedule was not found.",
    }
  }

  if (scheduleRecord.is_active === false) {
    return {
      ok: false as const,
      message: "Choose an active class schedule.",
    }
  }

  if (scheduleRecord.season_id === null || scheduleRecord.season_id === undefined) {
    return {
      ok: false as const,
      message: "Choose a schedule in the active season.",
    }
  }

  const { data: seasonRecord, error: seasonError } = await supabase
    .from("ScheduleSeasons")
    .select("is_active")
    .eq("season_id", String(scheduleRecord.season_id))
    .maybeSingle()

  if (seasonError || !seasonRecord) {
    return {
      ok: false as const,
      message: seasonError?.message ?? "Schedule season was not found.",
    }
  }

  if (seasonRecord.is_active !== true) {
    return {
      ok: false as const,
      message: "Choose a schedule in the active season.",
    }
  }

  return {
    ok: true as const,
    message: "",
  }
}

async function updateEnrollmentStatus(
  enrollmentId: string,
  status: AdminEnrollmentStatus
): Promise<ActionResult> {
  const session = requireAdminSession(await getAccountSession())
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("Enrollments")
    .update({ status })
    .eq("enrollment_id", enrollmentId)

  if (error) {
    return {
      ok: false,
      message: error.message,
    }
  }

  revalidatePath("/account")

  return {
    ok: true,
    message: `Enrollment ${status} by ${session.roles.includes("owner") ? "owner" : "admin"}.`,
  }
}

export async function approveEnrollment(enrollmentId: string) {
  return updateEnrollmentStatus(enrollmentId, "approved")
}

export async function denyEnrollment(enrollmentId: string) {
  return updateEnrollmentStatus(enrollmentId, "denied")
}

export async function updateEnrollmentAdminStatus({
  enrollmentId,
  status,
}: {
  enrollmentId: string
  status: string
}) {
  if (!isAdminEnrollmentStatus(status)) {
    return {
      ok: false,
      message: "That enrollment status is not supported.",
    }
  }

  return updateEnrollmentStatus(enrollmentId, status)
}

export async function createAdminEnrollment({
  athleteId,
  parentId,
  classId,
  scheduleId,
  status,
}: {
  athleteId: string
  parentId?: string | null
  classId: string
  scheduleId: string
  status: string
}): Promise<ActionResult & { enrollmentId?: string }> {
  requireAdminSession(await getAccountSession())

  const normalizedAthleteId = athleteId.trim()
  const normalizedScheduleId = scheduleId.trim()
  const normalizedClassId = classId.toString().trim()
  const normalizedParentId = parentId?.trim() || null
  const normalizedStatus = status.trim().toLowerCase()

  if (!normalizedAthleteId || !normalizedScheduleId || !normalizedClassId) {
    return {
      ok: false,
      message: "Choose an athlete, class, and class schedule before creating an enrollment.",
    }
  }

  if (!isAdminEnrollmentStatus(normalizedStatus)) {
    return {
      ok: false,
      message: "That enrollment status is not supported.",
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

  const scheduleRecord = await getAvailableClassSchedule(normalizedScheduleId)

  if (!scheduleRecord.ok) {
    return {
      ok: false,
      message: scheduleRecord.message,
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
    .from("Enrollments")
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
      message: `This athlete already has a ${existingEnrollment.status} enrollment for that class schedule.`,
    }
  }

  const { data, error } = await supabase
    .from("Enrollments")
    .insert([
      {
        athlete_id: normalizedAthleteId,
        class_id: normalizedClassId,
        schedule_id: normalizedScheduleId,
        parent_id: resolvedParentId,
        status: normalizedStatus,
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

  revalidatePath("/account")

  return {
    ok: true,
    message: "Enrollment created.",
    enrollmentId: String(data.enrollment_id),
  }
}

export async function requestEnrollment({
  athleteId,
  classId,
  scheduleId,
}: {
  athleteId: string
  classId: string | number
  scheduleId: string | number
}): Promise<ActionResult & { enrollmentId?: string }> {
  const session = await getAccountSession()

  if (!session?.userId) {
    return {
      ok: false,
      message: "You must be signed in to request an enrollment.",
    }
  }

  const supabase = createAdminClient()
  const normalizedScheduleId = String(scheduleId).trim()
  const normalizedClassId = String(classId).trim()

  if (!normalizedScheduleId) {
    return {
      ok: false,
      message: "Choose a class schedule before requesting enrollment.",
    }
  }

  const { data: athlete, error: athleteError } = await supabase
    .from("Athletes")
    .select("athlete_id,user_id,parent_id")
    .eq("athlete_id", athleteId)
    .maybeSingle()

  if (athleteError || !athlete) {
    return {
      ok: false,
      message: athleteError?.message ?? "Athlete was not found.",
    }
  }

  if (athlete.user_id !== session.userId) {
    return {
      ok: false,
      message: "You can only request enrollments for your own athletes.",
    }
  }

  const scheduleRecord = await getAvailableClassSchedule(normalizedScheduleId)

  if (!scheduleRecord.ok) {
    return {
      ok: false,
      message: scheduleRecord.message,
    }
  }

  const { data: existingEnrollment, error: existingError } = await supabase
    .from("Enrollments")
    .select("enrollment_id,status")
    .eq("athlete_id", athleteId)
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
      message: `This athlete already has a ${existingEnrollment.status} enrollment for that class schedule.`,
    }
  }

  const { data, error } = await supabase
    .from("Enrollments")
    .insert([
      {
        athlete_id: athleteId,
        class_id: normalizedClassId,
        schedule_id: normalizedScheduleId,
        status: "pending",
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

  revalidatePath("/account")

  return {
    ok: true,
    message: "Your enrollment request was submitted.",
    enrollmentId: String(data.enrollment_id),
  }
}

export async function cancelEnrollmentRequest(
  enrollmentId: string
): Promise<ActionResult> {
  const session = await getAccountSession()

  if (!session?.userId) {
    return {
      ok: false,
      message: "You must be signed in to cancel an enrollment request.",
    }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("Enrollments")
    .select(
      "enrollment_id,status,Athletes(athlete_id,user_id,parent_id,Parents(parent_id,user_id))"
    )
    .eq("enrollment_id", enrollmentId)
    .maybeSingle()

  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? "Enrollment was not found.",
    }
  }

  const athlete = Array.isArray(data.Athletes)
    ? data.Athletes[0]
    : data.Athletes
  const parent = Array.isArray(athlete?.Parents)
    ? athlete?.Parents[0]
    : athlete?.Parents
  const ownsEnrollment =
    athlete?.user_id === session.userId || parent?.user_id === session.userId

  if (!ownsEnrollment) {
    return {
      ok: false,
      message: "You can only cancel enrollment requests for your own athletes.",
    }
  }

  if (data.status !== "pending") {
    return {
      ok: false,
      message: "Only pending enrollment requests can be canceled here.",
    }
  }

  const { error: updateError } = await supabase
    .from("Enrollments")
    .update({ status: "canceled" })
    .eq("enrollment_id", enrollmentId)

  if (updateError) {
    return {
      ok: false,
      message: updateError.message,
    }
  }

  revalidatePath("/account")

  return {
    ok: true,
    message: "Enrollment request canceled.",
  }
}

export async function updateClassBillingConfig({
  classId,
  className,
  classType,
  programType,
  billingDay,
  stripePriceId,
}: {
  classId?: string | null
  className: string
  classType?: string | null
  programType: string
  billingDay: number
  stripePriceId: string
}): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  const normalizedProgramType = programType.trim()
  const normalizedPriceId = stripePriceId.trim()

  if (!["competitive_cheer", "gymnastics"].includes(normalizedProgramType)) {
    return {
      ok: false,
      message: "Choose competitive cheer or gymnastics.",
    }
  }

  if (billingDay !== 1 && billingDay !== 15) {
    return {
      ok: false,
      message: "Billing day must be 1 or 15.",
    }
  }

  if (normalizedPriceId && !normalizedPriceId.startsWith("price_")) {
    return {
      ok: false,
      message: "Stripe price IDs usually start with price_.",
    }
  }

  const supabase = createAdminClient()
  const payload = {
    class_name: className.trim() || "Untitled class",
    type: classType?.trim() || normalizedProgramType,
    program_type: normalizedProgramType,
    billing_day: billingDay,
    stripe_price_id: normalizedPriceId || null,
  }
  const mutation = classId
    ? supabase
        .from("Classes")
        .upsert({
          class_id: classId,
          ...payload,
        })
    : supabase.from("Classes").insert(payload)
  const { error } = await mutation

  if (error) {
    return {
      ok: false,
      message:
        "Class billing columns are missing or the class could not be saved. Apply the billing migration, then try again.",
    }
  }

  revalidatePath("/account")

  return {
    ok: true,
    message: "Class billing settings updated.",
  }
}
