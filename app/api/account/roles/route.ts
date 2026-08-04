import { NextResponse } from "next/server"

import { getAccountSession } from "@/lib/account/auth"
import { createAdminClient } from "@/lib/supabase/admin"

async function getSelectionRequiredEnrollmentCount(userId: string) {
  const admin = createAdminClient()
  const { data: athletes, error: athleteError } = await admin
    .from("Athletes")
    .select("athlete_id")
    .eq("user_id", userId)

  if (athleteError) {
    return 0
  }

  const athleteIds = (athletes ?? [])
    .map((athlete) => athlete.athlete_id)
    .filter(
      (athleteId): athleteId is string | number =>
        athleteId !== null && athleteId !== undefined
    )
    .map(String)

  if (!athleteIds.length) {
    return 0
  }

  const { count, error } = await admin
    .from("Enrollments")
    .select("enrollment_id", { count: "exact", head: true })
    .in("athlete_id", athleteIds)
    .eq("selection_required", true)

  if (error) {
    return 0
  }

  return count ?? 0
}

export async function GET() {
  const session = await getAccountSession()

  if (!session) {
    return NextResponse.json({ roles: [] }, { status: 401 })
  }

  const selectionRequiredEnrollmentCount = session.isParent
    ? await getSelectionRequiredEnrollmentCount(session.userId)
    : 0

  return NextResponse.json({
    roles: session.roles,
    isStaff: session.isOwner || session.isAdmin || session.isCoach,
    isCoach: session.isCoach,
    isAdmin: session.isAdmin,
    isOwner: session.isOwner,
    selectionRequiredEnrollmentCount,
    requiresEnrollmentSelection: selectionRequiredEnrollmentCount > 0,
  })
}
