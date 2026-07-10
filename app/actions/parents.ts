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
