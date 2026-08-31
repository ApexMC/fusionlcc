"use server"

import { revalidatePath } from "next/cache"

import { getAccountSession, requireAdminSession } from "@/lib/account/auth"
import { createAdminClient } from "@/lib/supabase/admin"

type ActionResult = {
  ok: boolean
  message: string
}

export async function updateCheerTeamBillingConfig({
  teamId,
  teamName,
  teamType,
  teamDescription,
  billingDay,
  tuitionPriceId,
  feePriceId,
}: {
  teamId?: string | null
  teamName: string
  teamType?: string | null
  teamDescription?: string | null
  billingDay: string
  tuitionPriceId: string
  feePriceId: string
}): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  const normalizedTuitionPriceId = tuitionPriceId.trim()
  const normalizedFeePriceId = feePriceId.trim()

  if (!teamName.trim()) {
    return {
      ok: false,
      message: "Add a cheer team name before saving.",
    }
  }

  if (
    (normalizedTuitionPriceId && !normalizedTuitionPriceId.startsWith("price_")) ||
    (normalizedFeePriceId && !normalizedFeePriceId.startsWith("price_"))
  ) {
    return {
      ok: false,
      message: "Stripe price IDs usually start with price_.",
    }
  }

  if (billingDay !== "1/15") {
    return {
      ok: false,
      message: "Cheer teams bill on the 1st and 15th.",
    }
  }

  const supabase = createAdminClient()
  const payload = {
    team_name: teamName.trim(),
    type: teamType?.trim() || "competitive_cheer",
    description: teamDescription?.trim() || null,
    program_type: "competitive_cheer",
    billing_day: billingDay,
    tuition_price_id: normalizedTuitionPriceId || null,
    fee_price_id: normalizedFeePriceId || null,
  }
  const mutation = teamId
    ? supabase
        .from("CheerTeams")
        .upsert({
          team_id: teamId,
          ...payload,
        })
    : supabase.from("CheerTeams").insert(payload)
  const { error } = await mutation

  if (error) {
    return {
      ok: false,
      message:
        "Cheer team billing columns are missing or the team could not be saved. Apply the cheer billing migration, then try again.",
    }
  }

  revalidatePath("/account")
  revalidatePath("/account/admin/billing")
  revalidatePath("/competitive-cheer")

  return {
    ok: true,
    message: "Cheer team billing settings updated.",
  }
}
