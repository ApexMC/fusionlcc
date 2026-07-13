"use server"

import { revalidatePath } from "next/cache"

import { getAccountSession, requireAdminSession } from "@/lib/account/auth"
import { createAdminClient } from "@/lib/supabase/admin"

type ActionResult = {
  ok: boolean
  message: string
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
