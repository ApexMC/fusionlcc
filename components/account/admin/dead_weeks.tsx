"use client"

import * as React from "react"
import { CalendarOff, MoreVertical, Plus } from "lucide-react"
import { useRouter } from "next/navigation"

import { deleteDeadPeriod, saveDeadPeriod } from "@/app/actions/dead-weeks"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DeadPeriodRecord } from "@/lib/account/types"
import {
  dateKeyToLocalDate,
  getDateKey,
  getDateKeyInTimeZone as getLocalDateKey,
  shiftDateKey,
} from "@/lib/date_keys"

type DeadWeekDraft = {
  startsAt: string
  endsAt: string
}

const deadPeriodLeadTimeDays = 1

function getBlankDraft(): DeadWeekDraft {
  return {
    startsAt: "",
    endsAt: "",
  }
}

function formatDate(value: string | null) {
  const dateKey = getDateKey(value)
  const date = dateKey ? dateKeyToLocalDate(dateKey) : null

  if (!date || Number.isNaN(date.getTime())) {
    return value ?? "Date TBD"
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function getDurationLabel(period: DeadPeriodRecord) {
  const startsAt = getDateKey(period.startsAt)
  const endsAt = getDateKey(period.endsAt)

  if (!startsAt || !endsAt) {
    return "Date range"
  }

  const startDate = dateKeyToLocalDate(startsAt)
  const endDate = dateKeyToLocalDate(endsAt)

  if (!startDate || !endDate) {
    return "Date range"
  }

  const days =
    Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1

  return `${days.toLocaleString()} ${days === 1 ? "day" : "days"}`
}

function getPeriodStatus(period: DeadPeriodRecord, todayDateKey: string) {
  const startsAt = getDateKey(period.startsAt)
  const endsAt = getDateKey(period.endsAt)

  if (!startsAt || !endsAt) {
    return {
      label: "Unscheduled",
      variant: "outline" as const,
    }
  }

  if (startsAt <= todayDateKey && endsAt >= todayDateKey) {
    return {
      label: "Current",
      variant: "warning" as const,
    }
  }

  if (startsAt > todayDateKey) {
    return {
      label: "Upcoming",
      variant: "success" as const,
    }
  }

  return {
    label: "Past",
    variant: "outline" as const,
  }
}

export function DeadWeeks({
  deadPeriods,
}: {
  deadPeriods: DeadPeriodRecord[]
}) {
  const [draft, setDraft] = React.useState<DeadWeekDraft>(getBlankDraft)
  const [busy, setBusy] = React.useState(false)
  const [busyPeriodId, setBusyPeriodId] = React.useState<string | null>(null)
  const [periodToDelete, setPeriodToDelete] =
    React.useState<DeadPeriodRecord | null>(null)
  const router = useRouter()
  const { toast } = useToast()
  const todayDateKey = React.useMemo(() => getLocalDateKey(), [])
  const minimumStartDateKey = React.useMemo(
    () => shiftDateKey(getLocalDateKey(), deadPeriodLeadTimeDays),
    []
  )

  async function submitDeadWeek(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)

    try {
      const result = await saveDeadPeriod({
        startsAt: draft.startsAt,
        endsAt: draft.endsAt,
      })

      if (!result.ok) {
        toast({
          title: "Dead week was not added",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: "Dead week added",
        description: result.message,
        variant: "success",
      })
      setDraft(getBlankDraft())
      router.refresh()
    } catch (error) {
      toast({
        title: "Dead week was not added",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setBusy(false)
    }
  }

  async function confirmDeleteDeadWeek(period: DeadPeriodRecord) {
    setBusyPeriodId(period.periodId)

    try {
      const result = await deleteDeadPeriod(period.periodId)

      if (!result.ok) {
        toast({
          title: "Dead week was not deleted",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: "Dead week deleted",
        description: result.message,
        variant: "success",
      })
      setPeriodToDelete(null)
      router.refresh()
    } catch (error) {
      toast({
        title: "Dead week was not deleted",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setBusyPeriodId(null)
    }
  }

  function renderPeriodActions(period: DeadPeriodRecord) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open dead week actions"
          >
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setPeriodToDelete(period)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <Card className="w-full bg-white dark:bg-black">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle>Dead Week Configuration</CardTitle>
        <div className="rounded-lg border bg-background p-2 text-foreground shadow-sm">
          <CalendarOff className="size-5" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          onSubmit={submitDeadWeek}
          className="grid gap-3 rounded-lg border bg-muted/40 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="dead-week-start">Start Date</Label>
            <Input
              id="dead-week-start"
              type="date"
              min={minimumStartDateKey}
              defaultValue={minimumStartDateKey}
              value={draft.startsAt}
              onChange={(event) => {
                const startsAt = event.target.value

                setDraft((current) => ({
                  ...current,
                  startsAt,
                  endsAt:
                    current.endsAt && startsAt && current.endsAt < startsAt
                      ? startsAt
                      : current.endsAt,
                }))
              }}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dead-week-end">End Date</Label>
            <Input
              id="dead-week-end"
              type="date"
              min={draft.startsAt || minimumStartDateKey}
              value={draft.endsAt}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  endsAt: event.target.value,
                }))
              }
              required
            />
          </div>
          <Button type="submit" disabled={busy} className="h-8">
            <Plus />
            {busy ? "Adding" : "Add"}
          </Button>
        </form>

        {deadPeriods.length ? (
          <>
            <div className="space-y-3 md:hidden">
              {deadPeriods.map((period) => {
                const status = getPeriodStatus(period, todayDateKey)

                return (
                  <div
                    key={period.periodId}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">
                          {formatDate(period.startsAt)} -{" "}
                          {formatDate(period.endsAt)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {getDurationLabel(period)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={status.variant}>{status.label}</Badge>
                        {renderPeriodActions(period)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="hidden rounded-md border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Length</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deadPeriods.map((period) => {
                    const status = getPeriodStatus(period, todayDateKey)

                    return (
                      <TableRow key={period.periodId}>
                        <TableCell>{formatDate(period.startsAt)}</TableCell>
                        <TableCell>{formatDate(period.endsAt)}</TableCell>
                        <TableCell>{getDurationLabel(period)}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            {renderPeriodActions(period)}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No dead weeks configured.
          </div>
        )}
      </CardContent>
      <Dialog
        open={Boolean(periodToDelete)}
        onOpenChange={(open) => !open && setPeriodToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Dead Week</DialogTitle>
            <DialogDescription>
              Delete the dead week from {formatDate(periodToDelete?.startsAt ?? null)}{" "}
              to {formatDate(periodToDelete?.endsAt ?? null)}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPeriodToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                !periodToDelete || busyPeriodId === periodToDelete.periodId
              }
              onClick={() =>
                periodToDelete && confirmDeleteDeadWeek(periodToDelete)
              }
            >
              {periodToDelete && busyPeriodId === periodToDelete.periodId
                ? "Deleting"
                : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
