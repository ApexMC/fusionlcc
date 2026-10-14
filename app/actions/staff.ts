"use server"

import { revalidatePath } from "next/cache"

import { getAccountSession, requireAdminSession } from "@/lib/account/auth"
import { fetchAllRows } from "@/lib/account/pagination"
import { createAdminClient } from "@/lib/supabase/admin"

type StaffAccountPayload = {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
}

type ActionResult = {
  ok: boolean
  message: string
}

function refreshStaffViews() {
  revalidatePath("/account/admin/staff")
  revalidatePath("/account")
  revalidatePath("/account/admin/time-clock")
}

export async function createStaffAccount(payload: StaffAccountPayload): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  const firstName = payload.firstName.trim()
  const lastName = payload.lastName.trim()
  const email = payload.email.trim().toLowerCase()
  const phone = payload.phone.trim()

  if (!firstName || !lastName) {
    return { ok: false, message: "Enter the staff member's first and last name." }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Enter a valid email address." }
  }

  if (payload.password.length < 8) {
    return { ok: false, message: "Use an initial password with at least 8 characters." }
  }

  const supabase = createAdminClient()
  let createdUserId: string | null = null

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        phone,
      },
    })

    if (error || !data.user) {
      throw new Error(error?.message ?? "The staff account could not be created.")
    }

    createdUserId = data.user.id

    // The signup trigger creates a parent membership. Only change the new user's
    // default membership, and require a returned row to confirm coach access.
    const { data: memberships, error: membershipError } = await supabase
      .from("organization_members")
      .update({ role: "coach" })
      .eq("user_id", createdUserId)
      .eq("role", "parent")
      .select("user_id")

    if (membershipError || !memberships?.length) {
      throw new Error(
        membershipError?.message ?? "The new account's coach membership could not be assigned."
      )
    }
  } catch (error) {
    if (createdUserId) {
      // Auth creation and the membership update use separate APIs. Compensate
      // for a failed role update so a failed staff signup cannot remain a parent.
      try {
        const { error: cleanupError } = await supabase.auth.admin.deleteUser(createdUserId)
        if (cleanupError) throw cleanupError
      } catch {
        return {
          ok: false,
          message: "Coach access could not be assigned and the new account could not be removed. Please contact support before trying again.",
        }
      }
    }

    return {
      ok: false,
      message: error instanceof Error ? error.message : "The staff account could not be created.",
    }
  }

  refreshStaffViews()

  return {
    ok: true,
    message: "Staff account created with coach access. Share the email and initial password with the staff member.",
  }
}

export async function deleteCoachAccount(userId: string): Promise<ActionResult> {
  const session = requireAdminSession(await getAccountSession())
  const targetUserId = userId.trim()

  if (!targetUserId) {
    return { ok: false, message: "Choose a coach account before deleting." }
  }

  if (targetUserId === session.userId) {
    return { ok: false, message: "You cannot delete your own account here." }
  }

  const supabase = createAdminClient()

  try {
    const memberships = await fetchAllRows<{ role: string }>((from, to) =>
      supabase
        .from("organization_members")
        .select("role", { count: from === 0 ? "exact" : undefined })
        .eq("user_id", targetUserId)
        .order("role", { ascending: true })
        .range(from, to)
    )

    if (!memberships.some((membership) => membership.role === "coach")) {
      return { ok: false, message: "Only coach accounts can be deleted here." }
    }

    if (memberships.some((membership) => ["owner", "admin"].includes(membership.role))) {
      return { ok: false, message: "Owner and admin accounts cannot be deleted here." }
    }

    const { error } = await supabase.auth.admin.deleteUser(targetUserId)

    // Allow a retry to finish membership cleanup if Auth deletion already
    // succeeded on an earlier request. Other Auth errors leave memberships alone.
    if (error && error.code !== "user_not_found") {
      return { ok: false, message: error.message }
    }

    let membershipCleanupFailed = false
    try {
      const { error: membershipError } = await supabase
        .from("organization_members")
        .delete()
        .eq("user_id", targetUserId)
      membershipCleanupFailed = Boolean(membershipError)
    } catch {
      membershipCleanupFailed = true
    }

    refreshStaffViews()

    if (membershipCleanupFailed) {
      return {
        ok: false,
        message: "The sign-in account was deleted, but its staff membership could not be removed. Please retry deletion to finish.",
      }
    }

    return { ok: true, message: "Coach account deleted." }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "The coach account could not be deleted.",
    }
  }
}
