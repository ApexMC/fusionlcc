"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { updateClassSessionAttendanceBatch } from "@/app/actions/class-attendance"
import {cancelClassSession, createMakeupClassSession,sendClassSessionCancellationNotice} from "@/app/actions/class-sessions"
import type {ClassSessionAttendanceStatus, ClassSessionDisplayRecord, ClassSessionExpectedAthlete} from "@/lib/account/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle} from "@/components/ui/dialog"
import {
  ArrowUpDown,
  Ban,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Save,
  Search,
  UserPlus,
  X} from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow} from "@/components/ui/table"

const attendanceOptions = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "excused", label: "Excused" },
  { value: "late", label: "Late" },
] as const

const attendanceFilterOptions = [
  { value: "all", label: "All attendance" },
  { value: "incomplete", label: "Needs review" },
  { value: "complete", label: "Complete" },
  { value: "empty", label: "No athletes" },
] as const

const sortOptions = [
  { value: "date", label: "Session date" },
  { value: "class", label: "Class" },
  { value: "schedule", label: "Schedule" },
  { value: "status", label: "Status" },
  { value: "expected", label: "Expected athletes" },
  { value: "reviewed", label: "Attendance reviewed" },
] as const

const selectControlClassName = "h-8 rounded-lg border border-input bg-background px-2 text-sm"
const classSessionTimeZone = "America/Indiana/Tell_City"
const defaultHistoryDays = 7

type AttendanceDraft = {
  attendanceStatus: ClassSessionAttendanceStatus | ""
  notes: string
  reviewedAt: string | null
}

type AttendanceFilter = (typeof attendanceFilterOptions)[number]["value"]
type SortKey = (typeof sortOptions)[number]["value"]
type SortDirection = "asc" | "desc"

type FilterOption = {
  value: string
  label: string
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function shiftDateKey(dateKey: string, days: number) {
  const date = dateKeyToLocalDate(dateKey)

  if (!date) {
    return dateKey
  }

  date.setDate(date.getDate() + days)

  return getLocalDateKey(date)
}

function getDefaultDateRange() {
  const endDate = getLocalDateKey()

  return {
    dateFrom: shiftDateKey(endDate, -(defaultHistoryDays - 1)),
    dateTo: endDate,
  }
}

function getDateKey(value: string | null) {
  if (!value) {
    return ""
  }

  const dateText = value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]

  if (dateText) {
    return dateText
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function dateKeyToLocalDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number)

  if (!year || !month || !day) {
    return null
  }

  return new Date(year, month - 1, day)
}

function formatDate(value: string | null) {
  if (!value) {
    return "Date TBD"
  }

  const dateKey = getDateKey(value)
  const date = dateKey ? dateKeyToLocalDate(dateKey) : new Date(value)

  if (!date || Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not reviewed"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function formatTime(value: string | null) {
  if (!value) {
    return "Time TBD"
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value)

    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Indiana/Tell_City",
      }).format(date)
    }
  }

  const timeMatch = value.match(/(\d{1,2}):(\d{2})(?::\d{2})?/)
  const hour = Number(timeMatch?.[1])
  const minute = Number(timeMatch?.[2] ?? "00")

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return value
  }

  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 || 12

  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`
}

function getSessionTime(session: ClassSessionDisplayRecord) {
  return `${formatTime(session.startsAt)} - ${formatTime(session.endsAt)}`
}

function getTimeSortKey(value: string | null) {
  if (!value) {
    return ""
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value)

    if (!Number.isNaN(date.getTime())) {
      const parts = new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        hour12: false,
        hourCycle: "h23",
        minute: "2-digit",
        timeZone: classSessionTimeZone,
      }).formatToParts(date)
      const hour = parts.find((part) => part.type === "hour")?.value
      const minute = parts.find((part) => part.type === "minute")?.value

      if (hour && minute) {
        return `${hour}:${minute}`
      }
    }
  }

  const timeMatch = value.match(/(\d{1,2}):(\d{2})(?::\d{2})?/)
  const hour = Number(timeMatch?.[1])
  const minute = Number(timeMatch?.[2] ?? "00")

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return ""
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function getTimeInputValue(value: string | null) {
  return getTimeSortKey(value)
}

function getTimeMinutes(value: string | null) {
  const timeKey = getTimeSortKey(value)

  if (!timeKey) {
    return null
  }

  const [hour, minute] = timeKey.split(":").map(Number)

  return hour * 60 + minute
}

function getSessionDurationMinutes(session: ClassSessionDisplayRecord) {
  const startsAt = getTimeMinutes(session.startsAt)
  const endsAt = getTimeMinutes(session.endsAt)

  if (startsAt === null || endsAt === null || endsAt <= startsAt) {
    return 60
  }

  return endsAt - startsAt
}

function getAttendanceSummary(session: ClassSessionDisplayRecord) {
  const reviewed = session.expectedAthletes.filter(
    (athlete) => athlete.attendanceStatus
  ).length

  return {
    reviewed,
    total: session.expectedAthletes.length,
  }
}

function getAttendanceCompletion(session: ClassSessionDisplayRecord) {
  const { reviewed, total } = getAttendanceSummary(session)

  if (total === 0) {
    return "empty"
  }

  if (reviewed === 0) {
    return "not-started"
  }

  if (reviewed === total) {
    return "complete"
  }

  return "partial"
}

function matchesAttendanceFilter(
  session: ClassSessionDisplayRecord,
  filter: AttendanceFilter
) {
  const completion = getAttendanceCompletion(session)

  if (filter === "all") {
    return true
  }

  if (filter === "incomplete") {
    return completion === "not-started"
  }

  return completion === filter
}

function getScheduleDisplay(session: ClassSessionDisplayRecord) {
  return (
    session.scheduleLabel ??
    (session.scheduleId ? `Schedule #${session.scheduleId}` : "Unscheduled")
  )
}

function getScheduleFilterValue(session: ClassSessionDisplayRecord) {
  if (session.scheduleId) {
    return `schedule:${session.scheduleId}`
  }

  if (session.scheduleLabel) {
    return `label:${session.scheduleLabel}`
  }

  return "unscheduled"
}

function formatSessionStatus(status: string | null | undefined) {
  return (status || "unknown").replace(/_/g, " ")
}

function normalizeSessionStatus(status: string | null | undefined) {
  return status?.trim().toLowerCase() || "scheduled"
}

function isScheduledSession(session: ClassSessionDisplayRecord) {
  return normalizeSessionStatus(session.status) === "scheduled"
}

function isFutureScheduledSession(
  session: ClassSessionDisplayRecord,
  todayDateKey: string
) {
  const dateKey = getDateKey(session.sessionDate)

  return Boolean(dateKey && dateKey > todayDateKey && isScheduledSession(session))
}

function getParentEmailCount(session: ClassSessionDisplayRecord) {
  return new Set(
    session.expectedAthletes
      .map((athlete) => athlete.parentEmail?.trim().toLowerCase())
      .filter(Boolean)
  ).size
}

function getWeekStartDateKey(dateKey: string) {
  const date = dateKeyToLocalDate(dateKey)

  if (!date) {
    return dateKey || "unknown"
  }

  const day = date.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + mondayOffset)

  return getLocalDateKey(date)
}

function getWeekEndDateKey(weekStartDateKey: string) {
  return shiftDateKey(weekStartDateKey, 6)
}

function formatWeekRange(weekStartDateKey: string) {
  if (weekStartDateKey === "unknown") {
    return "Week TBD"
  }

  const start = dateKeyToLocalDate(weekStartDateKey)
  const end = dateKeyToLocalDate(getWeekEndDateKey(weekStartDateKey))

  if (!start || !end) {
    return weekStartDateKey
  }

  const monthDayFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  })
  const fullFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return `${monthDayFormatter.format(start)} - ${fullFormatter.format(end)}`
}

function groupSessionsByWeek(sessions: ClassSessionDisplayRecord[]) {
  const groupsByWeek = new Map<
    string,
    {
      weekStartDateKey: string
      sessions: ClassSessionDisplayRecord[]
    }
  >()

  sessions.forEach((session) => {
    const weekStartDateKey = getWeekStartDateKey(getDateKey(session.sessionDate))
    const group =
      groupsByWeek.get(weekStartDateKey) ??
      ({
        weekStartDateKey,
        sessions: [],
      } satisfies {
        weekStartDateKey: string
        sessions: ClassSessionDisplayRecord[]
      })

    group.sessions.push(session)
    groupsByWeek.set(weekStartDateKey, group)
  })

  return Array.from(groupsByWeek.values()).sort((first, second) =>
    compareText(first.weekStartDateKey, second.weekStartDateKey)
  )
}

function getSessionStatusVariant(status: string | null | undefined) {
  const normalized = (status ?? "").toLowerCase()

  if (["complete", "completed", "reviewed"].includes(normalized)) {
    return "success" as const
  }

  if (["cancelled", "canceled"].includes(normalized)) {
    return "destructive" as const
  }

  if (["pending", "in progress"].includes(normalized)) {
    return "warning" as const
  }

  return "outline" as const
}

function getAttendanceVariant(status: string | null) {
  if (status === "present") {
    return "success" as const
  }

  if (status === "late" || status === "excused") {
    return "warning" as const
  }

  if (status === "absent") {
    return "destructive" as const
  }

  return "outline" as const
}

function matchesSearch(session: ClassSessionDisplayRecord, query: string) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return true
  }

  return [
    session.sessionId,
    session.className,
    session.scheduleLabel,
    session.sessionDate,
    session.status,
    session.type,
    getSessionTime(session),
    ...session.expectedAthletes.flatMap((athlete) => [
      athlete.athleteName,
      athlete.parentName,
      athlete.parentEmail,
      athlete.parentPhone,
    ]),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery))
}

function normalizeDateRange(dateFrom: string, dateTo: string) {
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return {
      startDate: dateTo,
      endDate: dateFrom,
    }
  }

  return {
    startDate: dateFrom,
    endDate: dateTo,
  }
}

function isInDateRange(
  session: ClassSessionDisplayRecord,
  dateFrom: string,
  dateTo: string
) {
  const dateKey = getDateKey(session.sessionDate)
  const { startDate, endDate } = normalizeDateRange(dateFrom, dateTo)

  if (!dateKey) {
    return !startDate && !endDate
  }

  if (startDate && dateKey < startDate) {
    return false
  }

  if (endDate && dateKey > endDate) {
    return false
  }

  return true
}

function compareText(first: string, second: string) {
  return first.localeCompare(second, undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

function applySortDirection(
  comparison: number,
  sortDirection: SortDirection
) {
  return sortDirection === "asc" ? comparison : comparison * -1
}

function compareDateSessions(
  first: ClassSessionDisplayRecord,
  second: ClassSessionDisplayRecord,
  sortDirection: SortDirection
) {
  const firstDate = getDateKey(first.sessionDate)
  const secondDate = getDateKey(second.sessionDate)

  if (!firstDate && secondDate) {
    return 1
  }

  if (firstDate && !secondDate) {
    return -1
  }

  const comparison = compareText(
    `${firstDate} ${getTimeSortKey(first.startsAt)}`,
    `${secondDate} ${getTimeSortKey(second.startsAt)}`
  )

  return applySortDirection(comparison, sortDirection)
}

function compareSessions(
  first: ClassSessionDisplayRecord,
  second: ClassSessionDisplayRecord,
  sortKey: SortKey,
  sortDirection: SortDirection
) {
  let comparison = 0

  if (sortKey === "date") {
    comparison = compareDateSessions(first, second, sortDirection)
  } else if (sortKey === "class") {
    comparison = applySortDirection(
      compareText(first.className, second.className),
      sortDirection
    )
  } else if (sortKey === "schedule") {
    comparison = applySortDirection(
      compareText(getScheduleDisplay(first), getScheduleDisplay(second)),
      sortDirection
    )
  } else if (sortKey === "status") {
    comparison = applySortDirection(
      compareText(first.status, second.status),
      sortDirection
    )
  } else if (sortKey === "expected") {
    comparison = applySortDirection(
      first.expectedAthletes.length - second.expectedAthletes.length,
      sortDirection
    )
  } else if (sortKey === "reviewed") {
    comparison = applySortDirection(
      getAttendanceSummary(first).reviewed - getAttendanceSummary(second).reviewed,
      sortDirection
    )
  }

  if (comparison !== 0) {
    return comparison
  }

  const dateComparison = compareDateSessions(first, second, "asc")

  if (dateComparison !== 0) {
    return dateComparison
  }

  return compareText(first.sessionId, second.sessionId)
}

function getDefaultSortDirection(sortKey: SortKey): SortDirection {
  if (["class", "schedule", "status"].includes(sortKey)) {
    return "asc"
  }

  return "desc"
}

function SortHeaderButton({
  sortKey,
  activeSortKey,
  sortDirection,
  align = "left",
  onSort,
  children,
}: {
  sortKey: SortKey
  activeSortKey: SortKey
  sortDirection: SortDirection
  align?: "left" | "right"
  onSort: (sortKey: SortKey) => void
  children: React.ReactNode
}) {
  const isActive = activeSortKey === sortKey

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`h-auto px-0 text-xs font-semibold text-muted-foreground hover:bg-transparent ${
        align === "right" ? "ml-auto" : ""
      }`}
      onClick={() => onSort(sortKey)}
    >
      {children}
      <ArrowUpDown
        className={isActive ? "text-foreground" : "text-muted-foreground"}
      />
      {isActive ? (
        <span className="sr-only">sorted {sortDirection}</span>
      ) : null}
    </Button>
  )
}

function shouldIgnoreRowClick(event: React.MouseEvent<HTMLTableRowElement>) {
  const target = event.target

  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("button,a,input,select,textarea,[role='menuitem']"))
  )
}

function buildDrafts(athletes: ClassSessionExpectedAthlete[]) {
  return athletes.reduce<Record<string, AttendanceDraft>>((drafts, athlete) => {
    drafts[athlete.enrollmentId] = {
      attendanceStatus: athlete.attendanceStatus ?? "",
      notes: athlete.attendanceNotes ?? "",
      reviewedAt: athlete.attendanceReviewedAt,
    }

    return drafts
  }, {})
}

function AttendanceReviewTable({
  session,
}: {
  session: ClassSessionDisplayRecord
}) {
  const [drafts, setDrafts] = React.useState(() =>
    buildDrafts(session.expectedAthletes)
  )
  const [selectedMakeupEnrollmentIds, setSelectedMakeupEnrollmentIds] =
    React.useState<string[]>([])
  const [makeupEnrollmentId, setMakeupEnrollmentId] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const makeupAthleteByEnrollmentId = React.useMemo(
    () =>
      new Map(
        session.makeupAthleteOptions.map((athlete) => [
          athlete.enrollmentId,
          athlete,
        ])
      ),
    [session.makeupAthleteOptions]
  )
  const selectedMakeupAthletes = React.useMemo(
    () =>
      selectedMakeupEnrollmentIds.flatMap((enrollmentId) => {
        const athlete = makeupAthleteByEnrollmentId.get(enrollmentId)

        return athlete ? [athlete] : []
      }),
    [makeupAthleteByEnrollmentId, selectedMakeupEnrollmentIds]
  )
  const attendanceAthletes = React.useMemo(
    () => [...session.expectedAthletes, ...selectedMakeupAthletes],
    [selectedMakeupAthletes, session.expectedAthletes]
  )
  const availableMakeupAthletes = React.useMemo(
    () =>
      session.makeupAthleteOptions.filter(
        (athlete) =>
          !selectedMakeupEnrollmentIds.includes(athlete.enrollmentId)
      ),
    [selectedMakeupEnrollmentIds, session.makeupAthleteOptions]
  )

  function getDraft(athlete: ClassSessionExpectedAthlete) {
    return (
      drafts[athlete.enrollmentId] ?? {
        attendanceStatus: athlete.attendanceStatus ?? "",
        notes: athlete.attendanceNotes ?? "",
        reviewedAt: athlete.attendanceReviewedAt,
      }
    )
  }

  function updateDraft(
    enrollmentId: string,
    patch: Partial<AttendanceDraft>
  ) {
    setDrafts((current) => ({
      ...current,
      [enrollmentId]: {
        attendanceStatus: current[enrollmentId]?.attendanceStatus ?? "",
        notes: current[enrollmentId]?.notes ?? "",
        reviewedAt: current[enrollmentId]?.reviewedAt ?? null,
        ...patch,
      },
    }))
  }

  function addMakeupAthlete() {
    const athlete = makeupAthleteByEnrollmentId.get(makeupEnrollmentId)

    if (!athlete) {
      return
    }

    setSelectedMakeupEnrollmentIds((current) =>
      current.includes(athlete.enrollmentId)
        ? current
        : [...current, athlete.enrollmentId]
    )
    setDrafts((current) => ({
      ...current,
      [athlete.enrollmentId]: {
        attendanceStatus:
          current[athlete.enrollmentId]?.attendanceStatus || "present",
        notes:
          current[athlete.enrollmentId]?.notes ??
          athlete.attendanceNotes ??
          "",
        reviewedAt:
          current[athlete.enrollmentId]?.reviewedAt ??
          athlete.attendanceReviewedAt,
      },
    }))
    setMakeupEnrollmentId("")
  }

  function removeSelectedMakeupAthlete(enrollmentId: string) {
    setSelectedMakeupEnrollmentIds((current) =>
      current.filter(
        (currentEnrollmentId) => currentEnrollmentId !== enrollmentId
      )
    )
    setDrafts((current) => {
      const nextDrafts = { ...current }
      delete nextDrafts[enrollmentId]

      return nextDrafts
    })
  }

  const attendanceSummary = {
    reviewed: attendanceAthletes.filter(
      (athlete) => Boolean(getDraft(athlete).attendanceStatus)
    ).length,
    total: attendanceAthletes.length,
  }

  async function saveSessionAttendance() {
    const missingAttendance = attendanceAthletes.find(
      (athlete) => !getDraft(athlete).attendanceStatus
    )

    if (missingAttendance) {
      toast({
        title: "Attendance not saved",
        description: "Choose attendance for every athlete before saving.",
        variant: "error",
      })
      return
    }

    setSaving(true)

    try {
      const result = await updateClassSessionAttendanceBatch({
        sessionId: session.sessionId,
        attendance: attendanceAthletes.map((athlete) => {
          const draft = getDraft(athlete)

          return {
            enrollmentId: athlete.enrollmentId,
            athleteId: athlete.athleteId,
            isMakeup: athlete.isMakeup,
            attendanceStatus: draft.attendanceStatus,
            notes: draft.notes,
          }
        }),
      })

      if (!result.ok) {
        toast({
          title: "Attendance save failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      const reviewedAt = result.reviewedAt ?? new Date().toISOString()
      setDrafts((current) =>
        attendanceAthletes.reduce<Record<string, AttendanceDraft>>(
          (nextDrafts, athlete) => ({
            ...nextDrafts,
            [athlete.enrollmentId]: {
              attendanceStatus:
                current[athlete.enrollmentId]?.attendanceStatus ?? "",
              notes: current[athlete.enrollmentId]?.notes ?? "",
              reviewedAt,
            },
          }),
          current
        )
      )
      toast({
        title: "Attendance saved",
        description: result.message,
        variant: "success",
      })
      router.refresh()
    } catch (error) {
      toast({
        title: "Attendance save failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">
            {session.className} - {formatDate(session.sessionDate)}
          </h3>
          <p className="text-sm text-muted-foreground">
            {getSessionTime(session)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Badge variant="outline">
            {attendanceSummary.reviewed} / {attendanceSummary.total} ready
          </Badge>
          <Button
            type="button"
            size="sm"
            disabled={saving || !attendanceAthletes.length}
            onClick={saveSessionAttendance}
          >
            <Save />
            {saving ? "Saving" : "Save Attendance"}
          </Button>
        </div>
      </div>
      {availableMakeupAthletes.length ? (
        <div className="mt-4 flex flex-col gap-2 rounded-md border border-dashed p-3 sm:flex-row sm:items-end">
          <label className="grid min-w-0 flex-1 gap-1 text-xs font-medium text-muted-foreground">
            Makeup athlete
            <select
              value={makeupEnrollmentId}
              onChange={(event) => setMakeupEnrollmentId(event.target.value)}
              className="h-10 rounded-lg border border-input bg-background px-2 text-base sm:text-sm"
            >
              <option value="">Select athlete</option>
              {availableMakeupAthletes.map((athlete) => (
                <option
                  key={athlete.enrollmentId}
                  value={athlete.enrollmentId}
                >
                  {athlete.athleteName}
                  {athlete.scheduleLabel
                    ? ` - ${athlete.scheduleLabel}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            size="sm"
            disabled={!makeupEnrollmentId}
            onClick={addMakeupAthlete}
          >
            <UserPlus />
            Add
          </Button>
        </div>
      ) : null}
      <div className="mt-4 space-y-3 md:hidden">
        {attendanceAthletes.length ? (
          attendanceAthletes.map((athlete) => {
            const draft = getDraft(athlete)
            const canRemoveMakeup =
              athlete.isMakeup &&
              selectedMakeupEnrollmentIds.includes(athlete.enrollmentId)

            return (
              <div
                key={`${athlete.athleteId}-${athlete.enrollmentId}`}
                className="rounded-md border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{athlete.athleteName}</div>
                    <div className="text-xs text-muted-foreground">
                      Enrollment #{athlete.enrollmentId}
                    </div>
                    {athlete.isMakeup ? (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="warning">Makeup</Badge>
                        {athlete.scheduleLabel ? (
                          <span className="text-xs text-muted-foreground">
                            {athlete.scheduleLabel}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {draft.attendanceStatus ? (
                      <Badge
                        variant={getAttendanceVariant(draft.attendanceStatus)}
                      >
                        {draft.attendanceStatus}
                      </Badge>
                    ) : null}
                    {canRemoveMakeup ? (
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        onClick={() =>
                          removeSelectedMakeupAthlete(athlete.enrollmentId)
                        }
                        aria-label={`Remove ${athlete.athleteName}`}
                      >
                        <X />
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 text-sm">
                  <div>{athlete.parentName}</div>
                  {athlete.parentEmail ? (
                    <div className="text-xs text-muted-foreground">
                      {athlete.parentEmail}
                    </div>
                  ) : null}
                  {athlete.parentPhone ? (
                    <div className="text-xs text-muted-foreground">
                      {athlete.parentPhone}
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-2">
                  <select
                    value={draft.attendanceStatus}
                    onChange={(event) =>
                      updateDraft(athlete.enrollmentId, {
                        attendanceStatus: event.target
                          .value as ClassSessionAttendanceStatus,
                      })
                    }
                    className="h-10 w-full rounded-lg border border-input bg-background px-2 text-base"
                  >
                    <option value="">Mark attendance</option>
                    {attendanceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={draft.notes}
                    onChange={(event) =>
                      updateDraft(athlete.enrollmentId, {
                        notes: event.target.value,
                      })
                    }
                    placeholder="Optional note"
                    className="h-10"
                  />
                  <div className="text-xs text-muted-foreground">
                    Reviewed: {formatDateTime(draft.reviewedAt)}
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">
            No approved or active enrollments are available for this session.
          </div>
        )}
      </div>
      <div className="mt-4 hidden max-h-100 overflow-auto rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Athlete</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Reviewed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendanceAthletes.length ? (
              attendanceAthletes.map((athlete) => {
                const draft = getDraft(athlete)
                const canRemoveMakeup =
                  athlete.isMakeup &&
                  selectedMakeupEnrollmentIds.includes(athlete.enrollmentId)

                return (
                  <TableRow
                    key={`${athlete.athleteId}-${athlete.enrollmentId}`}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{athlete.athleteName}</span>
                        {athlete.isMakeup ? (
                          <Badge variant="warning">Makeup</Badge>
                        ) : null}
                        {canRemoveMakeup ? (
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            onClick={() =>
                              removeSelectedMakeupAthlete(
                                athlete.enrollmentId
                              )
                            }
                            aria-label={`Remove ${athlete.athleteName}`}
                          >
                            <X />
                          </Button>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Enrollment #{athlete.enrollmentId}
                      </div>
                      {athlete.isMakeup && athlete.scheduleLabel ? (
                        <div className="text-xs text-muted-foreground">
                          {athlete.scheduleLabel}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div>{athlete.parentName}</div>
                      {athlete.parentEmail ? (
                        <div className="text-xs text-muted-foreground">
                          {athlete.parentEmail}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <select
                          value={draft.attendanceStatus}
                          onChange={(event) =>
                            updateDraft(athlete.enrollmentId, {
                              attendanceStatus: event.target
                                .value as ClassSessionAttendanceStatus,
                            })
                          }
                          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                        >
                          <option value="">Mark attendance</option>
                          {attendanceOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {draft.attendanceStatus ? (
                          <Badge
                            className="w-fit"
                            variant={getAttendanceVariant(
                              draft.attendanceStatus
                            )}
                          >
                            {draft.attendanceStatus}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={draft.notes}
                        onChange={(event) =>
                          updateDraft(athlete.enrollmentId, {
                            notes: event.target.value,
                          })
                        }
                        placeholder="Optional note"
                        className="min-w-48"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(draft.reviewedAt)}
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center">
                  No approved or active enrollments are available for this
                  session.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function SessionCancelButton({
  session,
  canCancelSessions,
  isCanceling,
  onCancelSession,
  className,
  size = "sm",
}: {
  session: ClassSessionDisplayRecord
  canCancelSessions: boolean
  isCanceling: boolean
  onCancelSession: (session: ClassSessionDisplayRecord) => void
  className?: string
  size?: React.ComponentProps<typeof Button>["size"]
}) {
  if (!canCancelSessions || !isScheduledSession(session)) {
    return null
  }

  return (
    <Button
      type="button"
      size={size}
      variant="destructive"
      className={className}
      disabled={isCanceling}
      onClick={(event) => {
        event.stopPropagation()
        onCancelSession(session)
      }}
    >
      <Ban />
      {isCanceling ? "Canceling" : "Cancel"}
    </Button>
  )
}

function UpcomingSessionsPanel({
  sessions,
  open,
  canCancelSessions,
  cancelingSessionId,
  onOpenChange,
  onCancelSession,
}: {
  sessions: ClassSessionDisplayRecord[]
  open: boolean
  canCancelSessions: boolean
  cancelingSessionId: string | null
  onOpenChange: (open: boolean) => void
  onCancelSession: (session: ClassSessionDisplayRecord) => void
}) {
  const contentId = React.useId()
  const weekGroups = React.useMemo(() => groupSessionsByWeek(sessions), [sessions])
  const [openWeekKeys, setOpenWeekKeys] = React.useState<Set<string>>(
    () =>
      new Set()
  )

  function toggleWeek(weekStartDateKey: string) {
    setOpenWeekKeys((current) => {
      const next = new Set(current)
      
      if (next.has(weekStartDateKey)) {
        next.delete(weekStartDateKey)
      } else {
        next.add(weekStartDateKey)
      }

      return next
    })
  }

  return (
    <div className="rounded-lg border bg-muted/20">
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full justify-between"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => onOpenChange(!open)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarDays />
          <span className="truncate">{open ? "Hide upcoming sessions" : "View upcoming sessions"}</span>
        </span>
        <span className="flex items-center gap-2">
          <Badge variant="secondary">{sessions.length}</Badge>
          <ChevronDown
            className={
              open ? "rotate-180 transition-transform" : "transition-transform"
            }
          />
        </span>
      </Button>
      {open ? (
        <div
          id={contentId}
          className="mt-3 max-h-[min(34rem,58svh)] space-y-3 overflow-y-auto overscroll-contain pr-1"
        >
          {weekGroups.length ? (
            weekGroups.map((group) => {
              const weekOpen = openWeekKeys.has(group.weekStartDateKey)

            return (
                <div
                  key={group.weekStartDateKey}
                  className="rounded-lg border bg-background"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full justify-between rounded-lg px-3"
                    aria-expanded={weekOpen}
                    onClick={() => toggleWeek(group.weekStartDateKey)}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <CalendarDays />
                      <span className="truncate">
                        {formatWeekRange(group.weekStartDateKey)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline">{group.sessions.length}</Badge>
                      <ChevronDown
                        className={
                          weekOpen
                            ? "rotate-180 transition-transform"
                            : "transition-transform"
                        }
                      />
                    </span>
                  </Button>
                  {weekOpen ? (
                    <div className="space-y-3 border-t p-3 max-h-[min(34rem,58svh)] overflow-y-auto">
                      {group.sessions.map((session) => (
                        <div
                          key={session.sessionId}
                          className="rounded-lg border bg-muted/20 p-3"
                        >
                          <div className="flex flex-row items-start justify-between">
                            <div className="flex flex-col gap-1">
                              <div className="flex flex-row gap-3 font-medium">
                                {session.className}
                                <div className="flex flex-row gap-1 items-center">
                                  <Badge
                                    className="w-fit"
                                    variant={getSessionStatusVariant(session.status)}
                                  >
                                    {formatSessionStatus(session.status)}
                                  </Badge>
                                  {session.type === "makeup" && (
                                    <Badge
                                      className="w-fit"
                                      variant="warning"
                                    >
                                      {session.type}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDate(session.sessionDate)} -{" "}
                                {getSessionTime(session)}
                              </div>
                            </div>
                            <SessionCancelButton
                              session={session}
                              canCancelSessions={canCancelSessions}
                              isCanceling={
                              cancelingSessionId === session.sessionId
                              }
                              onCancelSession={onCancelSession}
                              className="mt-3 h-10 w-auto"
                              size="lg"
                            />
                          </div>
                          <div className="mt-3 md:mt-1 grid gap-3 text-sm sm:grid-cols-3">
                            <div>
                              <div className="text-xs font-medium text-muted-foreground">
                                Schedule
                              </div>
                              <div>{getScheduleDisplay(session)}</div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-muted-foreground">
                                Expected
                              </div>
                              <div>{session.expectedAthletes.length}</div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-muted-foreground">
                                Parent emails
                              </div>
                              <div>{getParentEmailCount(session)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                )
            })
          ) : (
            <div className="rounded-lg border border-dashed bg-background p-5 text-center text-sm text-muted-foreground">
              No upcoming scheduled sessions match the current filters.
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function ClassSessionReview({
  sessions,
  canCancelSessions = false,
}: {
  sessions: ClassSessionDisplayRecord[]
  canCancelSessions?: boolean
}) {
  const defaultDateRange = React.useMemo(() => getDefaultDateRange(), [])
  const [query, setQuery] = React.useState("")
  const [dateFrom, setDateFrom] = React.useState(defaultDateRange.dateFrom)
  const [dateTo, setDateTo] = React.useState(defaultDateRange.dateTo)
  const [classFilter, setClassFilter] = React.useState("all")
  const [scheduleFilter, setScheduleFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [attendanceFilter, setAttendanceFilter] =
    React.useState<AttendanceFilter>("all")
  const [sortKey, setSortKey] = React.useState<SortKey>("date")
  const [sortDirection, setSortDirection] =
    React.useState<SortDirection>("desc")
  const [expandedSessionId, setExpandedSessionId] = React.useState<
    string | null
  >(null)
  const [upcomingSessionsOpen, setUpcomingSessionsOpen] =
    React.useState(false)
  const [cancelSessionTarget, setCancelSessionTarget] =
    React.useState<ClassSessionDisplayRecord | null>(null)
  const [makeupSessionTarget, setMakeupSessionTarget] =
    React.useState<ClassSessionDisplayRecord | null>(null)
  const [makeupDate, setMakeupDate] = React.useState("")
  const [makeupStartTime, setMakeupStartTime] = React.useState("")
  const [makeupDurationMinutes, setMakeupDurationMinutes] =
    React.useState("60")
  const [cancelingSessionId, setCancelingSessionId] = React.useState<
    string | null
  >(null)
  const [creatingMakeupSession, setCreatingMakeupSession] =
    React.useState(false)
  const [sendingCancellationNotice, setSendingCancellationNotice] =
    React.useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false)
  const todayDateKey = React.useMemo(() => getLocalDateKey(), [])
  const filterPanelId = React.useId()
  const router = useRouter()
  const { toast } = useToast()
  const classOptions = React.useMemo(
    () =>
      Array.from(new Set(sessions.map((session) => session.className)))
        .filter(Boolean)
        .sort(compareText),
    [sessions]
  )
  const scheduleOptions = React.useMemo<FilterOption[]>(() => {
    const schedulesByValue = new Map<string, string>()

    sessions.forEach((session) => {
      schedulesByValue.set(
        getScheduleFilterValue(session),
        getScheduleDisplay(session)
      )
    })

    return Array.from(schedulesByValue.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((first, second) => compareText(first.label, second.label))
  }, [sessions])
  const statusOptions = React.useMemo(
    () =>
      Array.from(new Set(sessions.map((session) => session.status)))
        .filter(Boolean)
        .sort(compareText),
    [sessions]
  )
  const filteredSessions = React.useMemo(
    () =>
      sessions
        .filter((session) => {
          if (isFutureScheduledSession(session, todayDateKey)) {
            return false
          }

          if (!matchesSearch(session, query)) {
            return false
          }

          if (!isInDateRange(session, dateFrom, dateTo)) {
            return false
          }

          if (classFilter !== "all" && session.className !== classFilter) {
            return false
          }

          if (
            scheduleFilter !== "all" &&
            getScheduleFilterValue(session) !== scheduleFilter
          ) {
            return false
          }

          if (statusFilter !== "all" && session.status !== statusFilter) {
            return false
          }

          return matchesAttendanceFilter(session, attendanceFilter)
        })
        .sort((first, second) =>
          compareSessions(first, second, sortKey, sortDirection)
        ),
    [
      attendanceFilter,
      classFilter,
      dateFrom,
      dateTo,
      query,
      scheduleFilter,
      sessions,
      sortDirection,
      sortKey,
      statusFilter,
      todayDateKey,
    ]
  )
  const upcomingSessions = React.useMemo(
    () =>
      sessions
        .filter((session) => {
          if (!isFutureScheduledSession(session, todayDateKey)) {
            return false
          }

          if (!matchesSearch(session, query)) {
            return false
          }

          if (classFilter !== "all" && session.className !== classFilter) {
            return false
          }

          if (
            scheduleFilter !== "all" &&
            getScheduleFilterValue(session) !== scheduleFilter
          ) {
            return false
          }

          if (statusFilter !== "all" && session.status !== statusFilter) {
            return false
          }

          return matchesAttendanceFilter(session, attendanceFilter)
        })
        .sort((first, second) =>
          compareSessions(first, second, "date", "asc")
        ),
    [
      attendanceFilter,
      classFilter,
      query,
      scheduleFilter,
      sessions,
      statusFilter,
      todayDateKey,
    ]
  )
  const visibleExpandedSessionId = filteredSessions.some(
    (session) => session.sessionId === expandedSessionId
  )
    ? expandedSessionId
    : null
  const hasCustomDateRange =
    dateFrom !== defaultDateRange.dateFrom || dateTo !== defaultDateRange.dateTo
  const hasActiveFilters = Boolean(
    query.trim() ||
      hasCustomDateRange ||
      classFilter !== "all" ||
      scheduleFilter !== "all" ||
      statusFilter !== "all" ||
      attendanceFilter !== "all"
  )
  const hasCustomSort = sortKey !== "date" || sortDirection !== "desc"

  function toggleSession(sessionId: string) {
    setExpandedSessionId((current) => (current === sessionId ? null : sessionId))
  }

  function updateSort(nextSortKey: SortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
      return
    }

    setSortKey(nextSortKey)
    setSortDirection(getDefaultSortDirection(nextSortKey))
  }

  function resetFilters() {
    setQuery("")
    setDateFrom(defaultDateRange.dateFrom)
    setDateTo(defaultDateRange.dateTo)
    setClassFilter("all")
    setScheduleFilter("all")
    setStatusFilter("all")
    setAttendanceFilter("all")
    setSortKey("date")
    setSortDirection("desc")
  }

  function requestCancelSession(session: ClassSessionDisplayRecord) {
    setCancelSessionTarget(session)
  }

  async function confirmCancelSession() {
    if (!cancelSessionTarget) {
      return
    }

    const canceledSession = cancelSessionTarget

    setCancelingSessionId(cancelSessionTarget.sessionId)

    try {
      const result = await cancelClassSession(canceledSession.sessionId)

      if (!result.ok) {
        toast({
          title: "Session not canceled",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: "Session canceled",
        description: result.message,
        variant: result.warning ? "error" : "success",
      })
      setCancelSessionTarget(null)
      setMakeupDate("")
      setMakeupStartTime(getTimeInputValue(canceledSession.startsAt))
      setMakeupDurationMinutes(String(getSessionDurationMinutes(canceledSession)))
      setMakeupSessionTarget(canceledSession)
      router.refresh()
    } catch (error) {
      toast({
        title: "Session not canceled",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setCancelingSessionId(null)
    }
  }

  function resetMakeupSessionDecision() {
    setMakeupSessionTarget(null)
    setMakeupDate("")
    setMakeupStartTime("")
    setMakeupDurationMinutes("60")
  }

  async function skipMakeupSession() {
    if (!makeupSessionTarget) {
      return
    }

    setSendingCancellationNotice(true)

    try {
      const result = await sendClassSessionCancellationNotice(
        makeupSessionTarget.sessionId
      )

      if (!result.ok) {
        toast({
          title: "Cancellation email not sent",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: "Makeup skipped",
        description: result.message,
        variant: "success",
      })
      resetMakeupSessionDecision()
      router.refresh()
    } catch (error) {
      toast({
        title: "Cancellation email not sent",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setSendingCancellationNotice(false)
    }
  }

  async function submitMakeupSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!makeupSessionTarget) {
      return
    }

    setCreatingMakeupSession(true)

    try {
      const result = await createMakeupClassSession({
        sourceSessionId: makeupSessionTarget.sessionId,
        sessionDate: makeupDate,
        startTime: makeupStartTime,
        durationMinutes: Number(makeupDurationMinutes),
      })

      if (!result.ok) {
        toast({
          title: "Makeup session not created",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: "Makeup session created",
        description: result.message,
        variant: result.warning ? "error" : "success",
      })
      resetMakeupSessionDecision()
      router.refresh()
    } catch (error) {
      toast({
        title: "Makeup session not created",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setCreatingMakeupSession(false)
    }
  }

  return (
    <>
    <Card className="w-full bg-white dark:bg-black">
      <CardHeader>
        <CardTitle>Class Sessions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 overscroll-contain pr-3 scrollbar-gutter:stable">
        <div className="space-y-4 bg-white dark:bg-black">
          <div className="flex items-center justify-between gap-3 md:hidden">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 justify-between"
              aria-expanded={mobileFiltersOpen}
              aria-controls={filterPanelId}
              onClick={() => setMobileFiltersOpen((current) => !current)}
            >
              <span className="flex items-center gap-2">
                <Search />
                Filters & Sort
              </span>
              <ChevronDown
                className={
                  mobileFiltersOpen
                    ? "rotate-180 transition-transform"
                    : "transition-transform"
                }
              />
            </Button>
          </div>
          <div
            id={filterPanelId}
            className={`${
              mobileFiltersOpen ? "grid" : "hidden"
            } gap-3 md:grid md:grid-cols-2 xl:grid-cols-4`}
          >
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Search
              <div className="relative">
                <Search className="pointer-events-none absolute top-2 left-2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search sessions"
                  className="pl-8"
                />
              </div>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              From Date
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              To Date
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Class
              <select
                value={classFilter}
                onChange={(event) => setClassFilter(event.target.value)}
                className={selectControlClassName}
              >
                <option value="all">All classes</option>
                {classOptions.map((className) => (
                  <option key={className} value={className}>
                    {className}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Schedule
              <select
                value={scheduleFilter}
                onChange={(event) => setScheduleFilter(event.target.value)}
                className={selectControlClassName}
              >
                <option value="all">All schedules</option>
                {scheduleOptions.map((schedule) => (
                  <option key={schedule.value} value={schedule.value}>
                    {schedule.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={selectControlClassName}
              >
                <option value="all">All statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {formatSessionStatus(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Attendance
              <select
                value={attendanceFilter}
                onChange={(event) =>
                  setAttendanceFilter(event.target.value as AttendanceFilter)
                }
                className={selectControlClassName}
              >
                {attendanceFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Sort By
              <div className="flex gap-2">
                <select
                  value={sortKey}
                  onChange={(event) => {
                    const nextSortKey = event.target.value as SortKey
                    setSortKey(nextSortKey)
                    setSortDirection(getDefaultSortDirection(nextSortKey))
                  }}
                  className={`${selectControlClassName} min-w-0 flex-1`}
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setSortDirection((current) =>
                      current === "asc" ? "desc" : "asc"
                    )
                  }
                >
                  <ArrowUpDown />
                  {sortDirection === "asc" ? "Asc" : "Desc"}
                </Button>
              </div>
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {filteredSessions.length} / {sessions.length} sessions
              </Badge>
              {hasActiveFilters ? (
                <Badge variant="secondary">Filters active</Badge>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!hasActiveFilters && !hasCustomSort}
              onClick={resetFilters}
            >
              <X />
              Reset
            </Button>
          </div>
        </div>
        <UpcomingSessionsPanel
          sessions={upcomingSessions}
          open={upcomingSessionsOpen}
          canCancelSessions={canCancelSessions}
          cancelingSessionId={cancelingSessionId}
          onOpenChange={setUpcomingSessionsOpen}
          onCancelSession={requestCancelSession}
        />
        <div className="max-h-[min(55rem,55svh)] min-h-0 overflow-y-auto space-y-3 md:hidden">
          {filteredSessions.length ? (
            filteredSessions.map((session) => {
              const isExpanded = visibleExpandedSessionId === session.sessionId
              const attendanceSummary = getAttendanceSummary(session)

              return (
                <div key={session.sessionId} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        {formatDate(session.sessionDate)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {getSessionTime(session)}
                      </div>
                    </div>
                    <Badge variant={getSessionStatusVariant(session.status)}>
                      {formatSessionStatus(session.status)}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">
                        Class
                      </div>
                      <div>{session.className}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">
                        Schedule
                      </div>
                      <div>{getScheduleDisplay(session)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">
                        Expected
                      </div>
                      <div>{session.expectedAthletes.length}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">
                        Attendance
                      </div>
                      <div>
                        {attendanceSummary.reviewed} / {attendanceSummary.total}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      size="lg"
                      variant={isExpanded ? "secondary" : "outline"}
                      className="py-3 flex-1"
                      aria-expanded={isExpanded}
                      onClick={() => toggleSession(session.sessionId)}
                    >
                      <ClipboardCheck />
                      {isExpanded ? "Close Review" : "Review Attendance"}
                      <ChevronDown
                        className={
                          isExpanded
                            ? "rotate-180 transition-transform"
                            : "transition-transform"
                        }
                      />
                    </Button>
                  </div>
                  {isExpanded ? (
                    <div className="mt-3">
                      <AttendanceReviewTable session={session} />
                    </div>
                  ) : null}
                </div>
              )
            })
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No class sessions match the current filters.
            </div>
          )}
        </div>
        <div className="hidden max-h-[min(55rem,55svh)] min-h-0 overflow-y-auto overscroll-contain md:block">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortHeaderButton
                  sortKey="date"
                  activeSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={updateSort}
                >
                  Session
                </SortHeaderButton>
              </TableHead>
              <TableHead>
                <SortHeaderButton
                  sortKey="class"
                  activeSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={updateSort}
                >
                  Class
                </SortHeaderButton>
              </TableHead>
              <TableHead>
                <SortHeaderButton
                  sortKey="schedule"
                  activeSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={updateSort}
                >
                  Schedule
                </SortHeaderButton>
              </TableHead>
              <TableHead>
                <SortHeaderButton
                  sortKey="status"
                  activeSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={updateSort}
                >
                  Status
                </SortHeaderButton>
              </TableHead>
              <TableHead>
                <SortHeaderButton
                  sortKey="expected"
                  activeSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={updateSort}
                >
                  Expected
                </SortHeaderButton>
              </TableHead>
              <TableHead className="text-right">
                <SortHeaderButton
                  sortKey="reviewed"
                  activeSortKey={sortKey}
                  sortDirection={sortDirection}
                  align="right"
                  onSort={updateSort}
                >
                  Attendance
                </SortHeaderButton>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSessions.length ? (
              filteredSessions.map((session) => {
                const isExpanded = visibleExpandedSessionId === session.sessionId
                const attendanceSummary = getAttendanceSummary(session)

                return (
                  <React.Fragment key={session.sessionId}>
                    <TableRow
                      aria-expanded={isExpanded}
                      className="cursor-pointer"
                      onClick={(event) => {
                        if (shouldIgnoreRowClick(event)) {
                          return
                        }

                        toggleSession(session.sessionId)
                      }}
                    >
                      <TableCell>
                        <div className="font-medium">
                          {formatDate(session.sessionDate)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {getSessionTime(session)}
                        </div>
                      </TableCell>
                      <TableCell>{session.className}</TableCell>
                      <TableCell>{getScheduleDisplay(session)}</TableCell>
                      <TableCell>
                        <Badge variant={getSessionStatusVariant(session.status)}>
                          {formatSessionStatus(session.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {session.expectedAthletes.length} expected
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-3">
                          <span className="text-xs text-muted-foreground">
                            {attendanceSummary.reviewed} /{" "}
                            {attendanceSummary.total}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant={isExpanded ? "secondary" : "outline"}
                            aria-expanded={isExpanded}
                            onClick={() => toggleSession(session.sessionId)}
                          >
                            <ClipboardCheck />
                            {isExpanded ? "Close" : "Review"}
                            <ChevronDown
                              className={
                                isExpanded
                                  ? "rotate-180 transition-transform"
                                  : "transition-transform"
                              }
                            />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="whitespace-normal bg-muted/30 p-4"
                        >
                          <AttendanceReviewTable session={session} />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </React.Fragment>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No class sessions match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
    <Dialog
      open={Boolean(cancelSessionTarget)}
      onOpenChange={(open) => {
        if (!open && !cancelingSessionId) {
          setCancelSessionTarget(null)
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Class Session</DialogTitle>
          <DialogDescription>
            This will mark the session canceled. Parents will be emailed after
            you decide whether to create a makeup session.
          </DialogDescription>
        </DialogHeader>
        {cancelSessionTarget ? (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="font-medium">{cancelSessionTarget.className}</div>
            <div className="mt-1 text-muted-foreground">
              {formatDate(cancelSessionTarget.sessionDate)} -{" "}
              {getSessionTime(cancelSessionTarget)}
            </div>
            <div className="mt-3 grid gap-2 md:gap-8 sm:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  Schedule
                </div>
                <div>{getScheduleDisplay(cancelSessionTarget)}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  Parent emails
                </div>
                <div>{getParentEmailCount(cancelSessionTarget)}</div>
              </div>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={Boolean(cancelingSessionId)}
            onClick={() => setCancelSessionTarget(null)}
          >
            Keep Session
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={Boolean(cancelingSessionId)}
            onClick={confirmCancelSession}
          >
            <Ban />
            {cancelingSessionId ? "Canceling" : "Cancel Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog
      open={Boolean(makeupSessionTarget)}
      onOpenChange={() => {}}
    >
      <DialogContent showCloseButton={false}>
        <form onSubmit={submitMakeupSession} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Create Makeup Session?</DialogTitle>
            <DialogDescription>
              Add a scheduled makeup class, or skip to email cancellation-only
              details.
            </DialogDescription>
          </DialogHeader>
          {makeupSessionTarget ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{makeupSessionTarget.className}</div>
              <div className="mt-1 text-muted-foreground">
                Canceled session: {formatDate(makeupSessionTarget.sessionDate)} -{" "}
                {getSessionTime(makeupSessionTarget)}
              </div>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Date
              <Input
                type="date"
                min={todayDateKey}
                value={makeupDate}
                required
                disabled={creatingMakeupSession || sendingCancellationNotice}
                onChange={(event) => setMakeupDate(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Start Time
              <Input
                type="time"
                value={makeupStartTime}
                required
                disabled={creatingMakeupSession || sendingCancellationNotice}
                onChange={(event) => setMakeupStartTime(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
              Duration (minutes)
              <Input
                type="number"
                min={15}
                max={480}
                step={15}
                value={makeupDurationMinutes}
                required
                disabled={creatingMakeupSession || sendingCancellationNotice}
                onChange={(event) =>
                  setMakeupDurationMinutes(event.target.value)
                }
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={creatingMakeupSession || sendingCancellationNotice}
              onClick={skipMakeupSession}
            >
              {sendingCancellationNotice ? "Sending" : "Skip"}
            </Button>
            <Button
              type="submit"
              disabled={creatingMakeupSession || sendingCancellationNotice}
            >
              <CalendarDays />
              {creatingMakeupSession ? "Creating" : "Create Makeup"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}
