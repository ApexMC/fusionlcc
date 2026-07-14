"use client"

import * as React from "react"
import {
  ArrowUpDown,
  ChevronDown,
  ClipboardCheck,
  Save,
  Search,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"

import { updateClassSessionAttendanceBatch } from "@/app/actions/class-attendance"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/toast"
import type {
  ClassSessionAttendanceStatus,
  ClassSessionDisplayRecord,
  ClassSessionExpectedAthlete,
} from "@/lib/account/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

const selectControlClassName =
  "h-8 rounded-lg border border-input bg-background px-2 text-sm"

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

  const timeMatch = value.match(/(\d{1,2}):(\d{2})(?::\d{2})?/)
  const hour = Number(timeMatch?.[1])
  const minute = Number(timeMatch?.[2] ?? "00")

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return ""
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
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
    getSessionTime(session),
    ...session.expectedAthletes.flatMap((athlete) => [
      athlete.athleteName,
      athlete.parentName,
      athlete.parentEmail,
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
  const [saving, setSaving] = React.useState(false)
  const router = useRouter()
  const { toast } = useToast()

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

  const attendanceSummary = {
    reviewed: session.expectedAthletes.filter(
      (athlete) => Boolean(getDraft(athlete).attendanceStatus)
    ).length,
    total: session.expectedAthletes.length,
  }

  async function saveSessionAttendance() {
    const missingAttendance = session.expectedAthletes.find(
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
        attendance: session.expectedAthletes.map((athlete) => {
          const draft = getDraft(athlete)

          return {
            enrollmentId: athlete.enrollmentId,
            athleteId: athlete.athleteId,
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
        session.expectedAthletes.reduce<Record<string, AttendanceDraft>>(
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
            disabled={saving || !session.expectedAthletes.length}
            onClick={saveSessionAttendance}
          >
            <Save />
            {saving ? "Saving" : "Save Attendance"}
          </Button>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-md border">
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
            {session.expectedAthletes.length ? (
              session.expectedAthletes.map((athlete) => {
                const draft = getDraft(athlete)

                return (
                  <TableRow
                    key={`${athlete.athleteId}-${athlete.enrollmentId}`}
                  >
                    <TableCell className="font-medium">
                      <div>{athlete.athleteName}</div>
                      <div className="text-xs text-muted-foreground">
                        Enrollment #{athlete.enrollmentId}
                      </div>
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
                  No approved or active enrollments are expected for this
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

export function ClassSessionReview({
  sessions,
}: {
  sessions: ClassSessionDisplayRecord[]
}) {
  const [query, setQuery] = React.useState("")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
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
    ]
  )
  const visibleExpandedSessionId = filteredSessions.some(
    (session) => session.sessionId === expandedSessionId
  )
    ? expandedSessionId
    : null
  const hasActiveFilters = Boolean(
    query.trim() ||
      dateFrom ||
      dateTo ||
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
    setDateFrom("")
    setDateTo("")
    setClassFilter("all")
    setScheduleFilter("all")
    setStatusFilter("all")
    setAttendanceFilter("all")
    setSortKey("date")
    setSortDirection("desc")
  }

  return (
    <Card className="w-full bg-white dark:bg-black">
      <CardHeader>
        <CardTitle>Class Sessions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
      </CardContent>
    </Card>
  )
}
