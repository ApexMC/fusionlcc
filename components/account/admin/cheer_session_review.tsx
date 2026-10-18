"use client"

import { useMemo } from "react"

import { saveCheerAttendance } from "@/app/actions/attendance"
import type { updateClassSessionAttendanceBatch } from "@/app/actions/class-attendance"
import { SessionReview } from "@/components/account/admin/class_session_review"
import type { CheerAttendanceData } from "@/lib/account/attendance"
import { buildCheerSessionReviewRecords } from "@/lib/account/cheer-session-attendance"
import type { CheerSessionDisplayRecord } from "@/lib/account/types"

async function saveSessionAttendance(input: Parameters<typeof updateClassSessionAttendanceBatch>[0]) {
  return saveCheerAttendance({
    sessionId: input.sessionId,
    attendance: input.attendance.map((entry) => ({
      athleteId: entry.athleteId ?? "",
      status: entry.attendanceStatus,
      notes: entry.notes ?? "",
    })),
  })
}

export function CheerSessionReview({
  sessions,
  attendance,
  initialSessionId,
}: {
  sessions: CheerSessionDisplayRecord[]
  attendance: CheerAttendanceData
  initialSessionId?: string
}) {
  const reviewSessions = useMemo(
    () => buildCheerSessionReviewRecords(sessions, attendance),
    [sessions, attendance]
  )

  return (
    <SessionReview
      sessions={reviewSessions}
      program="cheer"
      saveAttendance={saveSessionAttendance}
      attendanceUnavailableReason={attendance.ready ? undefined : attendance.notices.join(" ") || "Cheer attendance setup is incomplete."}
      initialSessionId={initialSessionId}
    />
  )
}
