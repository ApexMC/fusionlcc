"use server"

import { revalidatePath } from "next/cache"

import { getAccountSession, requireAdminSession } from "@/lib/account/auth"
import { createAdminClient } from "@/lib/supabase/admin"

type ActionResult = {
  ok: boolean
  message: string
}

async function updateEnrollmentStatus(
  enrollmentId: string,
  status: "approved" | "denied"
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

export async function requestEnrollment({
  athleteId,
  classId,
}: {
  athleteId: string
  classId: number
}): Promise<ActionResult & { enrollmentId?: string }> {
  const session = await getAccountSession()

  if (!session?.userId) {
    return {
      ok: false,
      message: "You must be signed in to request an enrollment.",
    }
  }

  const supabase = createAdminClient()
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

  const { data, error } = await supabase
    .from("Enrollments")
    .insert([
      {
        athlete_id: athleteId,
        parent_id: athlete.parent_id,
        class_id: classId,
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
