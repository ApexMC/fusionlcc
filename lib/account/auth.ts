import "server-only"

import { cache } from "react"

import createClient from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ParentRecord } from "@/lib/account/types"

export type MembershipRole = "owner" | "admin" | "coach" | "parent" | string

export type AccountSession = {
  userId: string
  roles: MembershipRole[]
  isAdmin: boolean
  isOwner: boolean
  isCoach: boolean
  isParent: boolean
}

export const getAccountSession = cache(async (): Promise<AccountSession | null> => {
  const supabase = await createClient()
  const { data: claims, error } = await supabase.auth.getClaims()

  if (error || !claims?.claims?.sub) {
    return null
  }

  const userId = claims.claims.sub
  const admin = createAdminClient()
  const { data: memberRecords } = await admin
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["owner", "admin", "coach", "parent"])

  const roles = (memberRecords ?? [])
    .map((record) => record.role)
    .filter((role): role is string => typeof role === "string")

  return {
    userId,
    roles,
    isAdmin: roles.includes("admin"),
    isOwner: roles.includes("owner"),
    isCoach: roles.includes("coach"),
    isParent: roles.includes("parent"),
  }
})

export function requireAdminSession(session: AccountSession | null) {
  if (!session || (!session.isAdmin && !session.isOwner)) {
    throw new Error("Unauthorized")
  }

  return session
}

export function requireStaffSession(session: AccountSession | null) {
  if (!session || (!session.isAdmin && !session.isOwner && !session.isCoach)) {
    throw new Error("Unauthorized")
  }

  return session
}

export const getParentForUser = cache(async (userId: string) => {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("Parents")
    .select(
      "parent_id,user_id,first_name,last_name,phone,email,address,city,state,zip_code,balance,stripe_customer_id"
    )
    .eq("user_id", userId)
    .maybeSingle()

  if (!error) {
    return data as ParentRecord | null
  }

  const { data: fallbackData, error: fallbackError } = await admin
    .from("Parents")
    .select(
      "parent_id,user_id,first_name,last_name,phone,email,address,city,state,zip_code,balance"
    )
    .eq("user_id", userId)
    .maybeSingle()

  if (fallbackError) {
    throw new Error(fallbackError.message)
  }

  return fallbackData as ParentRecord | null
})
