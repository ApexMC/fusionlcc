"use client"

import * as React from "react"
import { Check, ChevronDown, Clock, History, X } from "lucide-react"
import { useRouter } from "next/navigation"

import { updateCoachTimeClockEntryStatus } from "@/app/actions/time-clock"
import { TimeClockEntryEditDialog } from "@/components/account/time_clock_entry_edit_dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/toast"
import { formatPhoneNumber } from "@/functions/shared_functions"
import type {
  AdminCoachTimeClockGroup,
  AdminTimeClockReviewData,
  CoachTimeClockEntry,
} from "@/lib/account/types"
import {
  formatTimeClockDate as formatDate,
  formatTimeClockDuration as formatDuration,
  formatTimeClockTime as formatTime,
  getTimeClockEntryDurationMinutes as getDurationMinutes,
  getTimeClockEntryNote as getEntryNote,
  getTimeClockEntryStatusLabel as getEntryStatusLabel,
  getTimeClockEntryStatusVariant as getEntryStatusVariant,
  isPendingTimeClockStatus,
  parseTimeClockDate,
} from "@/lib/account/time_clock_presentation"

function formatPeriod(start: string, end: string) {
  const endDate = parseTimeClockDate(end)

  if (!endDate) {
    return formatDate(start)
  }

  endDate.setDate(endDate.getDate() - 1)

  return `${formatDate(start)} - ${formatDate(endDate.toISOString())}`
}

function PunchDecisionControls({
  entry,
  status,
  busyId,
  onUpdate,
}: {
  entry: CoachTimeClockEntry
  status: string
  busyId: string | null
  onUpdate: (entryId: string, status: "approved" | "denied") => void
}) {
  const busy = busyId === entry.entryId
  const canReview = isPendingTimeClockStatus(status) && Boolean(entry.clockOutAt)

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        disabled={Boolean(busyId) || !canReview}
        onClick={() => onUpdate(entry.entryId, "approved")}
      >
        <Check />
        {busy ? "Saving" : "Approve"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={Boolean(busyId) || !canReview}
        onClick={() => onUpdate(entry.entryId, "denied")}
      >
        <X />
        Deny
      </Button>
    </div>
  )
}

function PunchMobileCard({
  entry,
  status,
  busyId,
  onUpdate,
}: {
  entry: CoachTimeClockEntry
  status: string
  busyId: string | null
  onUpdate: (entryId: string, status: "approved" | "denied") => void
}) {
  const note = getEntryNote(entry)
  const isPending = isPendingTimeClockStatus(status)

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">
            {formatDate(entry.workDate ?? entry.clockInAt)}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatTime(entry.clockInAt)} -{" "}
            {entry.clockOutAt ? formatTime(entry.clockOutAt) : "Active"}
          </div>
        </div>
        <Badge variant={getEntryStatusVariant(entry, status)}>
          {getEntryStatusLabel(entry, status)}
        </Badge>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">Hours</span>
        <span className="font-medium">
          {formatDuration(getDurationMinutes(entry))}
        </span>
      </div>
      {note ? (
        <p className="mt-2 text-sm text-muted-foreground">{note}</p>
      ) : null}
      {isPending ? (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <TimeClockEntryEditDialog
            entry={entry}
            status={status}
            disabled={Boolean(busyId)}
          />
          {entry.clockOutAt ? (
            <PunchDecisionControls
              entry={entry}
              status={status}
              busyId={busyId}
              onUpdate={onUpdate}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function CoachPunchGroup({
  coach,
  open,
  showingHistory,
  localStatuses,
  busyId,
  onToggleOpen,
  onToggleHistory,
  onUpdate,
}: {
  coach: AdminCoachTimeClockGroup
  open: boolean
  showingHistory: boolean
  localStatuses: Record<string, string>
  busyId: string | null
  onToggleOpen: (coachUserId: string) => void
  onToggleHistory: (coachUserId: string) => void
  onUpdate: (entryId: string, status: "approved" | "denied") => void
}) {
  const entries = showingHistory
    ? coach.historyEntries
    : coach.currentPeriodEntries
  const minutes = showingHistory
    ? coach.historyMinutes
    : coach.currentPeriodMinutes
  const entryLabel = entries.length === 1 ? "punch" : "punches"
  const currentEntryLabel =
    coach.currentPeriodEntries.length === 1 ? "punch" : "punches"
  const isOnTheClock = coach.historyEntries.some((entry) => !entry.clockOutAt)
  const hasPendingEntries = entries.some((entry) =>
    isPendingTimeClockStatus(localStatuses[entry.entryId] ?? entry.status)
  )

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <h3 className="truncate text-base font-semibold">
              {coach.coachName}
            </h3>
            {isOnTheClock ? (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  {/* pulse ring */}
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                  {/* solid ring */}
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500"></span>
                </span>
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Clocked In</span>
              </div>
            ) : null}
          </div>
          {coach.coachPhone ? (
            <p className="truncate text-sm text-muted-foreground">
              {formatPhoneNumber(coach.coachPhone)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Badge variant={coach.pendingCount ? "warning" : "outline"}>
            {coach.pendingCount} pending
          </Badge>
          <Badge variant="outline">
            {coach.currentPeriodEntries.length} current {currentEntryLabel}
          </Badge>
          <Badge variant="outline">
            {formatDuration(coach.currentPeriodMinutes)}
          </Badge>
          <Button
            type="button"
            size="sm"
            variant={open ? "secondary" : "outline"}
            aria-expanded={open}
            onClick={() => onToggleOpen(coach.coachUserId)}
          >
            {open ? "Collapse" : "Review Punches"}
            <ChevronDown
              className={
                open
                  ? "rotate-180 transition-transform"
                  : "transition-transform"
              }
            />
          </Button>
        </div>
      </div>
      {open ? (
        <>
          <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {showingHistory ? "Full punch history" : "Current pay period"}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Badge variant="outline">
                {entries.length} {entryLabel}
              </Badge>
              <Badge variant="outline">{formatDuration(minutes)}</Badge>
              <Button
                type="button"
                size="sm"
                variant={showingHistory ? "secondary" : "outline"}
                aria-pressed={showingHistory}
                onClick={() => onToggleHistory(coach.coachUserId)}
              >
                <History />
                {showingHistory ? "Current Period" : "Full History"}
              </Button>
            </div>
          </div>
          {entries.length ? (
            <>
              <div className="mt-4 space-y-3 pr-1 max-h-100 overflow-y-auto md:hidden">
                {entries.map((entry) => {
                  const status = localStatuses[entry.entryId] ?? entry.status

                  return (
                    <PunchMobileCard
                      key={entry.entryId}
                      entry={entry}
                      status={status}
                      busyId={busyId}
                      onUpdate={onUpdate}
                    />
                  )
                })}
              </div>
              <div className="mt-4 hidden max-h-100 min-h-0 overflow-y-auto rounded-md border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      {hasPendingEntries ? (
                        <TableHead className="text-right">Actions</TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => {
                      const status = localStatuses[entry.entryId] ?? entry.status
                      const note = getEntryNote(entry)

                      return (
                        <TableRow key={entry.entryId}>
                          <TableCell>
                            {formatDate(entry.workDate ?? entry.clockInAt)}
                          </TableCell>
                          <TableCell>{formatTime(entry.clockInAt)}</TableCell>
                          <TableCell>
                            {entry.clockOutAt
                              ? formatTime(entry.clockOutAt)
                              : "Active"}
                          </TableCell>
                          <TableCell>
                            {formatDuration(getDurationMinutes(entry))}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getEntryStatusVariant(entry, status)}
                            >
                              {getEntryStatusLabel(entry, status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-72 whitespace-normal text-muted-foreground">
                            {note || "None"}
                          </TableCell>
                          {hasPendingEntries ? (
                            <TableCell>
                              {isPendingTimeClockStatus(status) ? (
                                <div className="flex justify-end gap-2">
                                  <TimeClockEntryEditDialog
                                    entry={entry}
                                    status={status}
                                    disabled={Boolean(busyId)}
                                    iconOnly
                                  />
                                  {entry.clockOutAt ? (
                                    <PunchDecisionControls
                                      entry={entry}
                                      status={status}
                                      busyId={busyId}
                                      onUpdate={onUpdate}
                                    />
                                  ) : null}
                                </div>
                              ) : null}
                            </TableCell>
                          ) : null}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">
              No punches for this view.
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

export function AdminTimeClockReview({
  timeClockReview,
}: {
  timeClockReview: AdminTimeClockReviewData
}) {
  const [openCoachIds, setOpenCoachIds] = React.useState<
    Record<string, boolean>
  >({})
  const [historyCoachIds, setHistoryCoachIds] = React.useState<
    Record<string, boolean>
  >({})
  const [localStatuses, setLocalStatuses] = React.useState<
    Record<string, string>
  >({})
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()
  const currentPeriodPunches = timeClockReview.coaches.reduce(
    (total, coach) => total + coach.currentPeriodEntries.length,
    0
  )
  const pendingPunches = timeClockReview.coaches.reduce(
    (total, coach) => total + coach.pendingCount,
    0
  )

  function toggleCoachOpen(coachUserId: string) {
    setOpenCoachIds((current) => ({
      ...current,
      [coachUserId]: !current[coachUserId],
    }))
  }

  function toggleCoachHistory(coachUserId: string) {
    setHistoryCoachIds((current) => ({
      ...current,
      [coachUserId]: !current[coachUserId],
    }))
  }

  async function updateStatus(entryId: string, status: "approved" | "denied") {
    setBusyId(entryId)

    try {
      const result = await updateCoachTimeClockEntryStatus({
        entryId,
        status,
      })

      if (!result.ok) {
        toast({
          title: "Punch update failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      setLocalStatuses((current) => ({
        ...current,
        [entryId]: status,
      }))
      toast({
        title: "Punch updated",
        description: result.message,
        variant: "success",
      })
      router.refresh()
    } catch (error) {
      toast({
        title: "Punch update failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card className="w-full bg-white dark:bg-black">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4" />
              Coach Time Clock
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatPeriod(
                timeClockReview.periodStart,
                timeClockReview.periodEnd
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {currentPeriodPunches} current punches
            </Badge>
            <Badge variant={pendingPunches ? "warning" : "success"}>
              {pendingPunches} pending
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="max-h-[min(42rem,75svh)] min-h-0 space-y-4 overflow-y-auto overscroll-contain pr-3 [scrollbar-gutter:stable]">
        {!timeClockReview.tableReady ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
            {timeClockReview.message}
          </div>
        ) : null}
        {timeClockReview.coaches.length ? (
          timeClockReview.coaches.map((coach) => (
            <CoachPunchGroup
              key={coach.coachUserId}
              coach={coach}
              open={Boolean(openCoachIds[coach.coachUserId])}
              showingHistory={Boolean(historyCoachIds[coach.coachUserId])}
              localStatuses={localStatuses}
              busyId={busyId}
              onToggleOpen={toggleCoachOpen}
              onToggleHistory={toggleCoachHistory}
              onUpdate={updateStatus}
            />
          ))
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No coach punches have been recorded.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
