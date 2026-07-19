import "server-only"

import { redirect } from "next/navigation"

import { getAccountSession } from "@/lib/account/auth"

export async function requireAdminOwnerAccountSession() {
  const session = await getAccountSession()

  if (!session) {
    redirect("/login")
  }

  if (!session.isAdmin && !session.isOwner) {
    redirect("/account")
  }

  return session
}

export async function requireCoachAccountSession() {
  const session = await getAccountSession()

  if (!session) {
    redirect("/login")
  }

  if (!session.isCoach) {
    redirect("/account")
  }

  return session
}

export async function requireStaffAccountSession() {
  const session = await getAccountSession()

  if (!session) {
    redirect("/login")
  }

  if (!session.isOwner && !session.isAdmin && !session.isCoach) {
    redirect("/account")
  }

  return session
}
