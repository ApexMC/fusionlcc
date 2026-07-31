import { NextResponse } from "next/server"

import { getPublicClassSchedules } from "@/lib/classes/data"

export async function GET() {
  try {
    const schedules = await getPublicClassSchedules()

    return NextResponse.json(schedules)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Class times could not be loaded.",
      },
      { status: 500 }
    )
  }
}
