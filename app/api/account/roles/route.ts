import { NextResponse } from "next/server"

import { getAccountSession } from "@/lib/account/auth"

export async function GET() {
  const session = await getAccountSession()

  if (!session) {
    return NextResponse.json({ roles: [] }, { status: 401 })
  }

  return NextResponse.json({
    roles: session.roles,
    isStaff: session.isOwner || session.isAdmin || session.isCoach,
    isCoach: session.isCoach,
    isAdmin: session.isAdmin,
    isOwner: session.isOwner,
  })
}
