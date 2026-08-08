"use server"

import { revalidatePath } from "next/cache"

import {
  getAccountSession,
  getParentForUser,
  requireAdminSession,
} from "@/lib/account/auth"
import { createAdminClient } from "@/lib/supabase/admin"

type ActionResult = {
  ok: boolean
  message: string
}

type AthletePayload = {
  athleteId?: string | null
  firstName: string
  lastName: string
  phone: string
  dob: string
  shirtSize: string
  gender: string
}

const allowedGenders = new Set(["Female", "Male", "Other", "Prefer not to say"])
const allowedShirtSizes = new Set(["YS", "YM", "YL", "YXL", "S", "M", "L", "XL", "2XL"])

export async function saveOwnAthlete(
  payload: AthletePayload
): Promise<ActionResult> {
  const session = await getAccountSession()

  if (!session?.userId || !session.isParent) {
    return { ok: false, message: "You must be signed in as a parent." }
  }

  const firstName = payload.firstName.trim()
  const lastName = payload.lastName.trim()
  const phone = payload.phone.trim()
  const dob = payload.dob.trim()
  const shirtSize = payload.shirtSize.trim()
  const gender = payload.gender.trim()
  const athleteId = payload.athleteId?.trim() || null

  if (!firstName || !lastName) {
    return { ok: false, message: "First and last name are required." }
  }

  if (firstName.length > 100 || lastName.length > 100 || phone.length > 30) {
    return { ok: false, message: "Athlete information is too long." }
  }

  if (gender && !allowedGenders.has(gender)) {
    return { ok: false, message: "Choose a valid gender option." }
  }

  if (shirtSize && !allowedShirtSizes.has(shirtSize)) {
    return { ok: false, message: "Choose a valid shirt size." }
  }

  if (dob && Number.isNaN(new Date(`${dob}T00:00:00`).getTime())) {
    return { ok: false, message: "Enter a valid date of birth." }
  }

  const parent = await getParentForUser(session.userId)

  if (!parent) {
    return { ok: false, message: "Parent account was not found." }
  }

  const supabase = createAdminClient()
  const values = {
    first_name: firstName,
    last_name: lastName,
    phone,
    dob: dob || null,
    shirt_size: shirtSize || null,
    gender: gender || null,
    user_id: session.userId,
    parent_id: parent.parent_id,
  }

  const mutation = athleteId
    ? supabase
        .from("Athletes")
        .update(values)
        .eq("athlete_id", athleteId)
        .eq("user_id", session.userId)
        .select("athlete_id")
        .maybeSingle()
    : supabase.from("Athletes").insert(values).select("athlete_id").single()
  const { data, error } = await mutation

  if (error) {
    return { ok: false, message: "Athlete could not be saved." }
  }

  if (!data) {
    return { ok: false, message: "Athlete was not found." }
  }

  revalidatePath("/account")
  return { ok: true, message: athleteId ? "Athlete updated." : "Athlete added." }
}

export async function deleteAthlete(athleteId: string): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  if (!athleteId.trim()) {
    return {
      ok: false,
      message: "Choose an athlete before deleting.",
    }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("Athletes")
    .delete()
    .eq("athlete_id", athleteId)

  if (error) {
    return {
      ok: false,
      message: error.message,
    }
  }

  revalidatePath("/account")

  return {
    ok: true,
    message: "Athlete deleted.",
  }
}
