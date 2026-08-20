"use client"

import * as React from "react"
import { Clock, LogIn, LogOut, NotebookTabs, Timer } from "lucide-react"
import { useRouter } from "next/navigation"

import { clockInCoach, clockOutCoach } from "@/app/actions/time-clock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { TimeClockEntryEditDialog } from "@/components/account/time_clock_entry_edit_dialog"
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
  CoachTimeClockData,
  CoachTimeClockEntry,
} from "@/lib/account/types"
import {
  formatTimeClockDate as formatDate,
  formatTimeClockDateTime as formatDateTime,
  formatTimeClockDuration as formatDuration,
  formatTimeClockStatus,
  formatTimeClockTime as formatTime,
  getTimeClockEntryDurationMinutes as getDurationMinutes,
  getTimeClockEntryNote as getEntryNote,
  getTimeClockStatusVariant,
  isPendingTimeClockStatus,
} from "@/lib/account/time_clock_presentation"

function TimeClockEntryMobileRow({
  entry,
  now,
}: {
  entry: CoachTimeClockEntry
  now: Date
}) {
  const note = getEntryNote(entry)
  const isPending = isPendingTimeClockStatus(entry.status)

  return (
    <div className="border-t py-3 first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">
            {formatDate(entry.workDate ?? entry.clockInAt)}
          </div>
          <div className="text-sm text-muted-foreground">
            {formatTime(entry.clockInAt)} -{" "}
            {entry.clockOutAt ? formatTime(entry.clockOutAt) : "Active"}
          </div>
        </div>
        <div className="flex flex-row items-center gap-1">
          <Badge variant={entry.clockOutAt ? "outline" : "success"}>
            {entry.clockOutAt
              ? formatDuration(getDurationMinutes(entry, now))
              : "Active"}
          </Badge>
          {entry.clockOutAt ? (
            <Badge variant={getTimeClockStatusVariant(entry.status)}>
              {formatTimeClockStatus(entry.status)}
            </Badge>
          ) : null}
        </div>
      </div>
      {note ? (
        <p className="mt-2 text-sm text-muted-foreground">{note}</p>
      ) : null}
      {isPending ? (
        <div className="mt-3 flex justify-end">
          <TimeClockEntryEditDialog entry={entry} status={entry.status} />
        </div>
      ) : null}
    </div>
  )
}

export function CoachTimeClock({
  timeClock,
}: {
  timeClock: CoachTimeClockData
}) {
  const [note, setNote] = React.useState("")
  const [saving, setSaving] = React.useState<"in" | "out" | null>(null)
  const [now, setNow] = React.useState(() => new Date())
  const router = useRouter()
  const { toast } = useToast()
  const activeEntry = timeClock.activeEntry
  const hasEditableRecentEntries = timeClock.recentEntries.some((entry) =>
    isPendingTimeClockStatus(entry.status)
  )

  React.useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30000)

    return () => window.clearInterval(interval)
  }, [])

  async function handleClockToggle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(activeEntry ? "out" : "in")

    try {
      const result = activeEntry
        ? await clockOutCoach({ entryId: activeEntry.entryId, note })
        : await clockInCoach({ note })

      if (!result.ok) {
        toast({
          title: "Time clock not saved",
          description: result.message,
          variant: "error",
        })
        return
      }

      setNote("")
      toast({
        title: activeEntry ? "Clocked out" : "Clocked in",
        description: result.message,
        variant: "success",
      })
      router.refresh()
    } catch (error) {
      toast({
        title: "Time clock not saved",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setSaving(null)
    }
  }

  return (
    <Card className="w-full bg-white dark:bg-black">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-4" />
          Time Clock
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!timeClock.tableReady ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
            {timeClock.message}
          </div>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={activeEntry ? "success" : "outline"}>
                {activeEntry ? "Clocked in" : "Off clock"}
              </Badge>
              {activeEntry ? (
                <span className="text-sm text-muted-foreground">
                  Since {formatDateTime(activeEntry.clockInAt)}
                </span>
              ) : null}
            </div>
            <div className="mt-4 flex items-end gap-3">
              <Timer className="mb-1 size-5 text-muted-foreground" />
              <div className="text-3xl font-semibold">
                {activeEntry
                  ? formatDuration(getDurationMinutes(activeEntry, now))
                  : "Ready"}
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {activeEntry
                ? "Clock out at the end of the day or when your shift is done."
                : "Clock in before coaching or covering a class."}
            </p>
          </div>
          <form
            onSubmit={handleClockToggle}
            className="rounded-lg border p-4"
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Note
              <Input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={
                  activeEntry ? "Optional clock-out note" : "Optional clock-in note"
                }
                disabled={Boolean(saving) || !timeClock.tableReady}
              />
            </label>
            <Button
              type="submit"
              size="lg"
              variant={activeEntry ? "destructive" : "default"}
              className="mt-3 h-12 w-full text-base"
              disabled={Boolean(saving) || !timeClock.tableReady}
            >
              {activeEntry ? <LogOut /> : <LogIn />}
              {saving ? "Saving" : activeEntry ? "Clock Out" : "Clock In"}
            </Button>
          </form>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <NotebookTabs className="size-4 text-muted-foreground" />
            <h3 className="font-semibold">Recent Entries</h3>
          </div>
          {timeClock.recentEntries.length ? (
            <>
              <div className="md:hidden">
                {timeClock.recentEntries.map((entry) => (
                  <TimeClockEntryMobileRow
                    key={entry.entryId}
                    entry={entry}
                    now={now}
                  />
                ))}
              </div>
              <div className="hidden rounded-md border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Status</TableHead>
                      {hasEditableRecentEntries ? (
                        <TableHead className="text-right">Actions</TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeClock.recentEntries.map((entry) => {
                      const noteText = getEntryNote(entry)

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
                            {formatDuration(getDurationMinutes(entry, now))}
                          </TableCell>
                          <TableCell className="max-w-80 whitespace-normal text-muted-foreground">
                            {noteText || "None"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getTimeClockStatusVariant(entry.status)}>
                              {formatTimeClockStatus(entry.status)}
                            </Badge>
                          </TableCell>
                          {hasEditableRecentEntries ? (
                            <TableCell>
                              {isPendingTimeClockStatus(entry.status) ? (
                                <div className="flex justify-end">
                                  <TimeClockEntryEditDialog
                                    entry={entry}
                                    status={entry.status}
                                    iconOnly
                                  />
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
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No time clock entries yet.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
