"use client"

import * as React from "react"
import { CalendarDays, Search, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CheerSessionDisplayRecord } from "@/lib/account/types"

const selectControlClassName =
  "h-8 rounded-lg border border-input bg-background px-2 text-sm"
const classSessionTimeZone = "America/Indiana/Tell_City"

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
        timeZone: classSessionTimeZone,
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

function getSessionTime(session: CheerSessionDisplayRecord) {
  return `${formatTime(session.startsAt)} - ${formatTime(session.endsAt)}`
}

function getScheduleDisplay(session: CheerSessionDisplayRecord) {
  return (
    session.scheduleLabel ??
    (session.scheduleId ? `Schedule #${session.scheduleId}` : "Unscheduled")
  )
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

function matchesSearch(session: CheerSessionDisplayRecord, query: string) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return true
  }

  return [
    session.sessionId,
    session.teamName,
    session.scheduleLabel,
    session.sessionDate,
    session.status,
    session.type,
    getSessionTime(session),
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
  session: CheerSessionDisplayRecord,
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

function compareSessions(
  first: CheerSessionDisplayRecord,
  second: CheerSessionDisplayRecord
) {
  const firstKey = `${getDateKey(first.sessionDate)} ${first.startsAt ?? ""}`
  const secondKey = `${getDateKey(second.sessionDate)} ${second.startsAt ?? ""}`

  return secondKey.localeCompare(firstKey, undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

export function CheerSessionReview({
  sessions,
}: {
  sessions: CheerSessionDisplayRecord[]
}) {
  const [query, setQuery] = React.useState("")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [teamFilter, setTeamFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState("all")

  const teamOptions = React.useMemo(
    () =>
      Array.from(new Set(sessions.map((session) => session.teamName)))
        .filter(Boolean)
        .sort(),
    [sessions]
  )
  const statusOptions = React.useMemo(
    () =>
      Array.from(new Set(sessions.map((session) => session.status)))
        .filter(Boolean)
        .sort(),
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

          if (teamFilter !== "all" && session.teamName !== teamFilter) {
            return false
          }

          if (statusFilter !== "all" && session.status !== statusFilter) {
            return false
          }

          return true
        })
        .sort(compareSessions),
    [dateFrom, dateTo, query, sessions, statusFilter, teamFilter]
  )
  const hasActiveFilters = Boolean(
    query.trim() ||
      dateFrom ||
      dateTo ||
      teamFilter !== "all" ||
      statusFilter !== "all"
  )

  function resetFilters() {
    setQuery("")
    setDateFrom("")
    setDateTo("")
    setTeamFilter("all")
    setStatusFilter("all")
  }

  return (
    <Card className="w-full bg-white dark:bg-black">
      <CardHeader>
        <CardTitle>Cheer Practice Sessions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 overscroll-contain pr-3 [scrollbar-gutter:stable]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Search
            <div className="relative">
              <Search className="pointer-events-none absolute top-2 left-2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search cheer sessions"
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
            Team
            <select
              value={teamFilter}
              onChange={(event) => setTeamFilter(event.target.value)}
              className={selectControlClassName}
            >
              <option value="all">All teams</option>
              {teamOptions.map((teamName) => (
                <option key={teamName} value={teamName}>
                  {teamName}
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
            disabled={!hasActiveFilters}
            onClick={resetFilters}
          >
            <X />
            Reset
          </Button>
        </div>
        <div className="max-h-[min(55rem,55svh)] min-h-0 overflow-y-auto space-y-3 md:hidden">
          {filteredSessions.length ? (
            filteredSessions.map((session) => (
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
                      Team
                    </div>
                    <div>{session.teamName}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">
                      Schedule
                    </div>
                    <div>{getScheduleDisplay(session)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">
                      Type
                    </div>
                    <div>{session.type ?? "practice"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">
                      Session
                    </div>
                    <div>#{session.sessionId}</div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No cheer practice sessions match the current filters.
            </div>
          )}
        </div>
        <div className="hidden max-h-[min(55rem,55svh)] min-h-0 overflow-y-auto overscroll-contain rounded-md border md:block">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSessions.length ? (
                filteredSessions.map((session) => (
                  <TableRow key={session.sessionId}>
                    <TableCell>
                      <div className="font-medium">
                        {formatDate(session.sessionDate)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <CalendarDays className="mr-1 inline size-3" />
                        {getSessionTime(session)}
                      </div>
                    </TableCell>
                    <TableCell>{session.teamName}</TableCell>
                    <TableCell>{getScheduleDisplay(session)}</TableCell>
                    <TableCell>
                      <Badge variant={getSessionStatusVariant(session.status)}>
                        {formatSessionStatus(session.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {session.type ?? "practice"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No cheer practice sessions match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
