"use server"

import { revalidatePath } from "next/cache"

import { getAccountSession, requireStaffSession } from "@/lib/account/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ClassSessionAttendanceStatus } from "@/lib/account/types"

type ActionResult = {
  ok: boolean
  message: string
}

type AttendanceUpdate = {
  enrollmentId: string
  athleteId?: string | null
  attendanceStatus: string
  notes?: string
}

const attendanceStatuses = ["present", "absent", "excused", "late"] as const

function isAttendanceStatus(
  value: string
): value is ClassSessionAttendanceStatus {
  return attendanceStatuses.includes(
    value as (typeof attendanceStatuses)[number]
  )
}

function isMissingAttendanceTableError(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /ClassSessionAttendance|schema cache|does not exist/i.test(
      error.message ?? ""
    )
  )
}

export async function updateClassSessionAttendance({
  sessionId,
  enrollmentId,
  athleteId,
  attendanceStatus,
  notes,
}: {
  sessionId: string
  enrollmentId: string
  athleteId?: string | null
  attendanceStatus: string
  notes?: string
}): Promise<ActionResult & { reviewedAt?: string }> {
  const session = requireStaffSession(await getAccountSession())
  const normalizedAttendanceStatus = attendanceStatus.trim().toLowerCase()

  if (!sessionId || !enrollmentId) {
    return {
      ok: false,
      message: "Session and enrollment are required.",
    }
  }

  if (!isAttendanceStatus(normalizedAttendanceStatus)) {
    return {
      ok: false,
      message: "Choose present, absent, excused, or late.",
    }
  }

  const reviewedAt = new Date().toISOString()
  const supabase = createAdminClient()
  const { error } = await supabase.from("ClassSessionAttendance").upsert(
    {
      session_id: sessionId,
      enrollment_id: enrollmentId,
      athlete_id: athleteId && athleteId !== "unknown" ? athleteId : null,
      attendance_status: normalizedAttendanceStatus,
      notes: notes?.trim() || null,
      reviewed_by: session.userId,
      reviewed_at: reviewedAt,
    },
    { onConflict: "session_id,enrollment_id" }
  )

  if (error) {
    return {
      ok: false,
      message: isMissingAttendanceTableError(error)
        ? "Apply the class session attendance migration before saving attendance."
        : error.message,
    }
  }

  revalidatePath("/account")

  return {
    ok: true,
    message: "Attendance saved.",
    reviewedAt,
  }
}

export async function updateClassSessionAttendanceBatch({
  sessionId,
  attendance,
}: {
  sessionId: string
  attendance: AttendanceUpdate[]
}): Promise<ActionResult & { reviewedAt?: string }> {
  const session = requireStaffSession(await getAccountSession())

  if (!sessionId || !attendance.length) {
    return {
      ok: false,
      message: "Session and attendance records are required.",
    }
  }

  const normalizedAttendance = attendance.map((entry) => ({
    ...entry,
    attendanceStatus: entry.attendanceStatus.trim().toLowerCase(),
  }))
  const invalidEntry = normalizedAttendance.find(
    (entry) => !entry.enrollmentId || !isAttendanceStatus(entry.attendanceStatus)
  )

  if (invalidEntry) {
    return {
      ok: false,
      message: "Choose present, absent, excused, or late for every athlete.",
    }
  }

  const reviewedAt = new Date().toISOString()
  const supabase = createAdminClient()
  const { error } = await supabase.from("ClassSessionAttendance").upsert(
    normalizedAttendance.map((entry) => ({
      session_id: sessionId,
      enrollment_id: entry.enrollmentId,
      athlete_id:
        entry.athleteId && entry.athleteId !== "unknown"
          ? entry.athleteId
          : null,
      attendance_status: entry.attendanceStatus,
      notes: entry.notes?.trim() || null,
      reviewed_by: session.userId,
      reviewed_at: reviewedAt,
    })),
    { onConflict: "session_id,enrollment_id" }
  )

  if (error) {
    return {
      ok: false,
      message: isMissingAttendanceTableError(error)
        ? "Apply the class session attendance migration before saving attendance."
        : error.message,
    }
  }

  revalidatePath("/account")

  return {
    ok: true,
    message: "Attendance saved.",
    reviewedAt,
  }
}
