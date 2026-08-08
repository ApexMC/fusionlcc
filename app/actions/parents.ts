"use server"

import { revalidatePath } from "next/cache"

import { getAccountSession, requireAdminSession } from "@/lib/account/auth"
import { createAdminClient } from "@/lib/supabase/admin"

type ActionResult = {
  ok: boolean
  message: string
}

type ParentPayload = {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  balance?: string
}

type OwnParentProfilePayload = Pick<
  ParentPayload,
  "phone" | "address" | "city" | "state" | "zipCode"
>

function normalizeParentPayload(payload: ParentPayload) {
  const balanceText = payload.balance?.replace(/[$,]/g, "").trim()
  const balance =
    balanceText === undefined || balanceText === ""
      ? undefined
      : Number(balanceText)

  if (balance !== undefined && Number.isNaN(balance)) {
    throw new Error("Balance must be a number.")
  }

  return {
    first_name: payload.firstName.trim(),
    last_name: payload.lastName.trim(),
    email: payload.email.trim(),
    phone: payload.phone.trim(),
    address: payload.address.trim(),
    city: payload.city.trim(),
    state: payload.state.trim(),
    zip_code: payload.zipCode.trim(),
    ...(balance === undefined ? {} : { balance }),
  }
}

function normalizeOwnParentProfile(payload: OwnParentProfilePayload) {
  const normalized = {
    phone: payload.phone.trim(),
    address: payload.address.trim(),
    city: payload.city.trim(),
    state: payload.state.trim().toUpperCase(),
    zip_code: payload.zipCode.trim(),
  }

  if (normalized.phone.length > 30) {
    throw new Error("Phone number is too long.")
  }

  if (normalized.address.length > 200 || normalized.city.length > 100) {
    throw new Error("Address information is too long.")
  }

  if (normalized.state.length > 2 || normalized.zip_code.length > 10) {
    throw new Error("Enter a valid state and ZIP code.")
  }

  return normalized
}

export async function updateOwnParentProfile(
  payload: OwnParentProfilePayload
): Promise<ActionResult> {
  const session = await getAccountSession()

  if (!session?.userId || !session.isParent) {
    return { ok: false, message: "You must be signed in as a parent." }
  }

  try {
    const normalized = normalizeOwnParentProfile(payload)
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("Parents")
      .update(normalized)
      .eq("user_id", session.userId)
      .select("parent_id")
      .maybeSingle()

    if (error) {
      return { ok: false, message: "Your profile could not be updated." }
    }

    if (!data) {
      return { ok: false, message: "Parent account was not found." }
    }

    revalidatePath("/account")
    return { ok: true, message: "Profile updated." }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Profile could not be updated.",
    }
  }
}

export async function createParent(payload: ParentPayload): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from("Parents")
      .insert(normalizeParentPayload(payload))

    if (error) {
      return {
        ok: false,
        message: error.message,
      }
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Parent could not be created.",
    }
  }

  revalidatePath("/account")

  return {
    ok: true,
    message: "Parent created.",
  }
}

export async function updateParent({
  parentId,
  ...payload
}: ParentPayload & {
  parentId: string
}): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from("Parents")
      .update(normalizeParentPayload(payload))
      .eq("parent_id", parentId)

    if (error) {
      return {
        ok: false,
        message: error.message,
      }
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Parent could not be updated.",
    }
  }

  revalidatePath("/account")

  return {
    ok: true,
    message: "Parent updated.",
  }
}

export async function deleteParent(parentId: string): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("Parents")
    .delete()
    .eq("parent_id", parentId)

  if (error) {
    return {
      ok: false,
      message: error.message,
    }
  }

  revalidatePath("/account")

  return {
    ok: true,
    message: "Parent deleted.",
  }
}
