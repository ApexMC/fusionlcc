"use client"

import * as React from "react"
import { ChevronDown, ClipboardCheck, Save, Search } from "lucide-react"
import { useRouter } from "next/navigation"

import { updateClassSessionAttendance } from "@/app/actions/class-attendance"
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

type AttendanceDraft = {
  attendanceStatus: ClassSessionAttendanceStatus | ""
  notes: string
  reviewedAt: string | null
}

function formatDate(value: string | null) {
  if (!value) {
    return "Date TBD"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
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

  if (value.includes("T")) {
    const date = new Date(value)

    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }).format(date)
    }
  }

  const [hourText, minuteText = "00"] = value.split(":")
  const hour = Number(hourText)
  const minute = Number(minuteText)

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

function getAttendanceSummary(session: ClassSessionDisplayRecord) {
  const reviewed = session.expectedAthletes.filter(
    (athlete) => athlete.attendanceStatus
  ).length

  return {
    reviewed,
    total: session.expectedAthletes.length,
  }
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
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery))
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
  const [busyEnrollmentId, setBusyEnrollmentId] = React.useState<string | null>(
    null
  )
  const router = useRouter()
  const { toast } = useToast()
  const attendanceSummary = getAttendanceSummary(session)

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

  async function saveAttendance(athlete: ClassSessionExpectedAthlete) {
    const draft = getDraft(athlete)

    if (!draft.attendanceStatus) {
      toast({
        title: "Attendance not saved",
        description: "Choose an attendance value first.",
        variant: "error",
      })
      return
    }

    setBusyEnrollmentId(athlete.enrollmentId)

    try {
      const result = await updateClassSessionAttendance({
        sessionId: session.sessionId,
        enrollmentId: athlete.enrollmentId,
        athleteId: athlete.athleteId,
        attendanceStatus: draft.attendanceStatus,
        notes: draft.notes,
      })

      if (!result.ok) {
        toast({
          title: "Attendance save failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      updateDraft(athlete.enrollmentId, {
        reviewedAt: result.reviewedAt ?? new Date().toISOString(),
      })
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
      setBusyEnrollmentId(null)
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
        <Badge variant="outline">
          {attendanceSummary.reviewed} / {attendanceSummary.total} reviewed
        </Badge>
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
              <TableHead className="text-right">Save</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {session.expectedAthletes.length ? (
              session.expectedAthletes.map((athlete) => {
                const draft = getDraft(athlete)
                const isBusy = busyEnrollmentId === athlete.enrollmentId

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
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          disabled={isBusy || !draft.attendanceStatus}
                          onClick={() => saveAttendance(athlete)}
                        >
                          <Save />
                          {isBusy ? "Saving" : "Save"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-20 text-center">
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
  const [expandedSessionId, setExpandedSessionId] = React.useState<
    string | null
  >(null)
  const filteredSessions = React.useMemo(
    () => sessions.filter((session) => matchesSearch(session, query)),
    [query, sessions]
  )
  const visibleExpandedSessionId = filteredSessions.some(
    (session) => session.sessionId === expandedSessionId
  )
    ? expandedSessionId
    : null

  function toggleSession(sessionId: string) {
    setExpandedSessionId((current) => (current === sessionId ? null : sessionId))
  }

  return (
    <Card className="w-full bg-white dark:bg-black">
      <CardHeader>
        <CardTitle>Class Sessions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2 left-2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sessions"
              className="pl-8 sm:w-64"
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead className="text-right">Attendance</TableHead>
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
                      <TableCell>
                        {session.scheduleLabel ??
                          (session.scheduleId
                            ? `Schedule #${session.scheduleId}`
                            : "Unscheduled")}
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
                          colSpan={5}
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
                <TableCell colSpan={5} className="h-24 text-center">
                  No class sessions match the current search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
