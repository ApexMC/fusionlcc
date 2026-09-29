import { NextResponse } from "next/server"
import { formatPhoneNumber } from "@/functions/shared_functions"
import { getAccountSession, requireAdminSession } from "@/lib/account/auth"
import { fetchAllRows, isSchemaCompatibilityError } from "@/lib/account/pagination"
import {
  getEnrollmentPaymentStatus,
  getParentPaymentStatus,
  isCurrentParentEnrollment,
  type ParentAthleteSummary,
  type ParentEnrollmentPaymentRow,
} from "@/lib/account/parent-enrollments"
import { formatLocalTime } from "@/lib/local_time"
import { formatDay } from "@/lib/scheduling"
import { createAdminClient } from "@/lib/supabase/admin"

type ParentRow = {
  parent_id: string | number
  phone?: string | null
  balance?: number | string | null
  stripe_payment_status?: string
  athletes?: ParentAthleteSummary[]
  [key: string]: unknown
}

type AthleteRow = {
  athlete_id: string | number
  parent_id?: string | number | null
  first_name?: string | null
  last_name?: string | null
  dob?: string | null
  shirt_size?: string | null
}

type ClassRow = {
  class_id: string | number
  class_name?: string | null
  type?: string | null
}

type ScheduleRow = {
  schedule_id: string | number
  class_id?: string | number | null
  team_id?: string | number | null
  day_of_week?: string | number | null
  start_time?: string | null
  end_time?: string | null
  Classes?: ClassRow | ClassRow[] | null
}

type EnrollmentRow = ParentEnrollmentPaymentRow & {
  enrollment_id: string | number
  athlete_id?: string | number | null
  class_id?: string | number | null
  schedule_id?: string | number | null
  ClassSchedules?: ScheduleRow | ScheduleRow[] | null
}

type CheerEnrollmentRow = ParentEnrollmentPaymentRow & {
  enrollment_id: string | number
  athlete_id?: string | number | null
  team_id?: string | number | null
  schedule_id?: string | number | null
}

type CheerTeamRow = {
  team_id: string | number
  team_name?: string | null
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function stringId(value: string | number | null | undefined) {
  return value === null || value === undefined ? null : String(value)
}

function formatScheduleLabel(schedule: ScheduleRow | null | undefined) {
  return schedule
    ? `${formatDay(schedule.day_of_week)} ${formatLocalTime(schedule.start_time)} - ${formatLocalTime(schedule.end_time)}`
    : null
}

async function readRows<T>(table: string, key: string, select: string, fallback?: string) {
  const supabase = createAdminClient()
  const read = (selection: string) => fetchAllRows<T>((from, to) =>
    supabase.from(table)
      .select(selection, { count: from === 0 ? "exact" : undefined })
      .order(key, { ascending: true })
      .range(from, to)
  )

  try {
    return await read(select)
  } catch (error) {
    if (!fallback || !isSchemaCompatibilityError(error)) {
      throw error
    }
    return read(fallback)
  }
}

function groupByAthlete<T extends { athlete_id?: string | number | null }>(rows: T[]) {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const athleteId = stringId(row.athlete_id)
    if (athleteId !== null) {
      const group = groups.get(athleteId) ?? []
      group.push(row)
      groups.set(athleteId, group)
    }
  }
  return groups
}

export async function GET() {
  try {
    requireAdminSession(await getAccountSession())
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  try {
    const [parents, athletes, enrollmentRows, cheerRows, classes, teams, cheerSchedules] = await Promise.all([
      readRows<ParentRow>("Parents", "parent_id", "*"),
      readRows<AthleteRow>("Athletes", "athlete_id", "athlete_id,parent_id,first_name,last_name,dob,shirt_size"),
      readRows<EnrollmentRow>("Enrollments", "enrollment_id", "*,ClassSchedules(schedule_id,class_id,day_of_week,start_time,end_time,Classes(class_id,class_name,type))", "*"),
      readRows<CheerEnrollmentRow>("CheerEnrollments", "enrollment_id", "*"),
      readRows<ClassRow>("Classes", "class_id", "class_id,class_name,type"),
      readRows<CheerTeamRow>("CheerTeams", "team_id", "team_id,team_name"),
      readRows<ScheduleRow>("CheerSchedules", "schedule_id", "schedule_id,team_id,day_of_week,start_time,end_time"),
    ])

    const enrollmentsByAthlete = groupByAthlete(enrollmentRows.filter(isCurrentParentEnrollment))
    const cheerByAthlete = groupByAthlete(cheerRows.filter(isCurrentParentEnrollment))
    const classesById = new Map(classes.map((record) => [String(record.class_id), record]))
    const teamsById = new Map(teams.map((team) => [String(team.team_id), team]))
    const schedulesById = new Map(cheerSchedules.map((schedule) => [String(schedule.schedule_id), schedule]))
    const athletesByParent = new Map<string, ParentAthleteSummary[]>()

    for (const athlete of athletes) {
      const parentId = stringId(athlete.parent_id)
      if (parentId === null) continue
      const athleteId = String(athlete.athlete_id)
      const cheerEnrollments = (cheerByAthlete.get(athleteId) ?? []).map((enrollment) => {
        const teamId = stringId(enrollment.team_id)
        const scheduleId = stringId(enrollment.schedule_id)
        return {
          enrollmentId: String(enrollment.enrollment_id),
          teamId,
          teamName: teamsById.get(teamId ?? "")?.team_name ?? (teamId === null ? "Unassigned cheer team" : `Cheer team #${teamId}`),
          scheduleId,
          scheduleLabel: formatScheduleLabel(schedulesById.get(scheduleId ?? "")),
          status: enrollment.status ?? "unknown",
          paymentStatus: getEnrollmentPaymentStatus(enrollment, "cheer"),
        }
      })
      const enrollments = (enrollmentsByAthlete.get(athleteId) ?? []).map((enrollment) => {
        const schedule = firstRelation(enrollment.ClassSchedules)
        const classId = stringId(schedule?.class_id ?? enrollment.class_id)
        const classRecord = firstRelation(schedule?.Classes) ?? classesById.get(classId ?? "")
        return {
          enrollmentId: String(enrollment.enrollment_id),
          scheduleId: stringId(enrollment.schedule_id),
          classId,
          className: classRecord?.class_name ?? (classId === null ? "Unassigned class" : `Class #${classId}`),
          classType: classRecord?.type ?? null,
          scheduleLabel: formatScheduleLabel(schedule),
          status: enrollment.status ?? "unknown",
          paymentStatus: getEnrollmentPaymentStatus(enrollment, "class", cheerEnrollments.length > 0),
        }
      })
      const summary: ParentAthleteSummary = {
        athleteId,
        firstName: athlete.first_name ?? null,
        lastName: athlete.last_name ?? null,
        dob: athlete.dob ?? null,
        shirtSize: athlete.shirt_size ?? null,
        enrollments,
        cheerEnrollments,
      }
      const group = athletesByParent.get(parentId) ?? []
      group.push(summary)
      athletesByParent.set(parentId, group)
    }

    for (const parent of parents) {
      parent.phone = parent.phone ? formatPhoneNumber(parent.phone) : parent.phone
      parent.balance = typeof parent.balance === "number" ? `$${parent.balance.toFixed(2)}` : parent.balance || "$0.00"
      parent.athletes = (athletesByParent.get(String(parent.parent_id)) ?? [])
        .sort((a, b) => (a.lastName ?? "").localeCompare(b.lastName ?? ""))
      parent.stripe_payment_status = getParentPaymentStatus(parent.athletes)
    }

    parents.sort((a, b) => String(a.last_name ?? "").localeCompare(String(b.last_name ?? "")))
    return NextResponse.json(parents)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load parent enrollments." }, { status: 500 })
  }
}
