"use client"

import * as React from "react"
import { ChevronDown, MoreHorizontal, Plus, Save } from "lucide-react"
import { useRouter } from "next/navigation"

import {
  deleteCheerSchedule,
  saveCheerSchedule,
} from "@/app/actions/cheer-schedules"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/toast"
import { weekdayOptions } from "@/lib/scheduling"
import type {
  CheerBillingRecord,
  CheerScheduleDisplayRecord,
} from "@/lib/account/types"

type ScheduleDraft = {
  teamId: string
  dayOfWeek: string
  startTime: string
  endTime: string
  isActive: boolean
}

function toTimeInputValue(value: string | null) {
  return value ? value.slice(0, 5) : ""
}

function getDefaultDraft(
  schedule: CheerScheduleDisplayRecord
): ScheduleDraft {
  return {
    teamId: schedule.teamId ?? "",
    dayOfWeek: schedule.dayOfWeek || "monday",
    startTime: toTimeInputValue(schedule.startTime),
    endTime: toTimeInputValue(schedule.endTime),
    isActive: schedule.isActive,
  }
}

function getBlankDraft(teams: CheerBillingRecord[]): ScheduleDraft {
  return {
    teamId: teams[0]?.teamId ?? "",
    dayOfWeek: "monday",
    startTime: "",
    endTime: "",
    isActive: true,
  }
}

export function CheerScheduleManager({
  schedules,
  teams,
}: {
  schedules: CheerScheduleDisplayRecord[]
  teams: CheerBillingRecord[]
}) {
  const [drafts, setDrafts] = React.useState<Record<string, ScheduleDraft>>(
    () =>
      Object.fromEntries(
        schedules.map((schedule) => [
          schedule.scheduleId,
          getDefaultDraft(schedule),
        ])
      )
  )
  const [newScheduleDraft, setNewScheduleDraft] =
    React.useState<ScheduleDraft>(() => getBlankDraft(teams))
  const [addDialogOpen, setAddDialogOpen] = React.useState(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [expandedScheduleCardId, setExpandedScheduleCardId] =
    React.useState<string | null>(null)
  const [scheduleToDelete, setScheduleToDelete] =
    React.useState<CheerScheduleDisplayRecord | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  function setDraft(scheduleId: string, draft: Partial<ScheduleDraft>) {
    setDrafts((current) => ({
      ...current,
      [scheduleId]: {
        ...(current[scheduleId] ?? getBlankDraft(teams)),
        ...draft,
      },
    }))
  }

  async function saveSchedule(schedule: CheerScheduleDisplayRecord | null) {
    const draft = schedule
      ? drafts[schedule.scheduleId] ?? getDefaultDraft(schedule)
      : newScheduleDraft
    const busyKey = schedule?.scheduleId ?? "new-cheer-schedule"

    setBusyId(busyKey)

    try {
      const result = await saveCheerSchedule({
        scheduleId: schedule?.scheduleId,
        teamId: draft.teamId,
        dayOfWeek: draft.dayOfWeek,
        startTime: draft.startTime,
        endTime: draft.endTime,
        isActive: draft.isActive,
      })

      if (!result.ok) {
        toast({
          title: "Cheer schedule update failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: "Cheer schedule saved",
        description: result.message,
        variant: "success",
      })
      if (!schedule) {
        setNewScheduleDraft(getBlankDraft(teams))
        setAddDialogOpen(false)
      }
      router.refresh()
    } catch (error) {
      toast({
        title: "Cheer schedule update failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setBusyId(null)
    }
  }

  async function deleteSchedule(schedule: CheerScheduleDisplayRecord) {
    setBusyId(schedule.scheduleId)

    try {
      const result = await deleteCheerSchedule(schedule.scheduleId)

      if (!result.ok) {
        toast({
          title: "Cheer schedule delete failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: "Cheer schedule deleted",
        description: result.message,
        variant: "success",
      })
      setScheduleToDelete(null)
      router.refresh()
    } catch (error) {
      toast({
        title: "Cheer schedule delete failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setBusyId(null)
    }
  }

  function renderTeamSelect({
    value,
    onChange,
    className = "h-8 min-w-48 rounded-lg border border-input bg-background px-2 text-sm",
  }: {
    value: string
    onChange: (value: string) => void
    className?: string
  }) {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      >
        {teams.map((team) => (
          <option key={team.teamId} value={team.teamId}>
            {team.teamName}
          </option>
        ))}
      </select>
    )
  }

  function renderDaySelect({
    value,
    onChange,
    className = "h-8 min-w-32 rounded-lg border border-input bg-background px-2 text-sm",
  }: {
    value: string
    onChange: (value: string) => void
    className?: string
  }) {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      >
        {weekdayOptions.map((day) => (
          <option key={day.value} value={day.value}>
            {day.label}
          </option>
        ))}
      </select>
    )
  }

  function handleAddSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void saveSchedule(null)
  }

  return (
    <Card className="w-full bg-white dark:bg-black">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Cheer Schedule</CardTitle>
          <Button
            type="button"
            size="sm"
            className="md:hidden"
            disabled={!teams.length}
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus />
            Add Schedule
          </Button>
        </div>
      </CardHeader>
      <CardContent className="max-h-[min(42rem,55svh)] min-h-0 overflow-y-auto overscroll-contain pr-3 [scrollbar-gutter:stable]">
        <div className="space-y-3 md:hidden">
          {schedules.map((schedule) => {
            const draft =
              drafts[schedule.scheduleId] ?? getDefaultDraft(schedule)
            const isExpanded =
              expandedScheduleCardId === schedule.scheduleId

            return (
              <div key={schedule.scheduleId} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{schedule.teamName}</div>
                    <div className="text-xs text-muted-foreground">
                      {schedule.scheduleLabel}
                    </div>
                  </div>
                  <Badge variant={draft.isActive ? "success" : "outline"}>
                    {draft.isActive ? "active" : "inactive"}
                  </Badge>
                </div>
                <Button
                  type="button"
                  size="lg"
                  variant={isExpanded ? "secondary" : "outline"}
                  className="mt-3 h-10 w-full justify-between"
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpandedScheduleCardId((current) =>
                      current === schedule.scheduleId
                        ? null
                        : schedule.scheduleId
                    )
                  }
                >
                  {isExpanded ? "Hide Details" : "View Details"}
                  <ChevronDown
                    className={
                      isExpanded
                        ? "rotate-180 transition-transform"
                        : "transition-transform"
                    }
                  />
                </Button>
                {isExpanded ? (
                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                      Team
                      {renderTeamSelect({
                        value: draft.teamId,
                        onChange: (teamId) =>
                          setDraft(schedule.scheduleId, { teamId }),
                        className:
                          "h-10 w-full rounded-lg border border-input bg-background px-2 text-base",
                      })}
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                      Day
                      {renderDaySelect({
                        value: draft.dayOfWeek,
                        onChange: (dayOfWeek) =>
                          setDraft(schedule.scheduleId, { dayOfWeek }),
                        className:
                          "h-10 w-full rounded-lg border border-input bg-background px-2 text-base",
                      })}
                    </label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        Start
                        <Input
                          type="time"
                          value={draft.startTime}
                          onChange={(event) =>
                            setDraft(schedule.scheduleId, {
                              startTime: event.target.value,
                            })
                          }
                          className="h-10"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        End
                        <Input
                          type="time"
                          value={draft.endTime}
                          onChange={(event) =>
                            setDraft(schedule.scheduleId, {
                              endTime: event.target.value,
                            })
                          }
                          className="h-10"
                        />
                      </label>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.isActive}
                        onChange={(event) =>
                          setDraft(schedule.scheduleId, {
                            isActive: event.target.checked,
                          })
                        }
                        className="size-4"
                      />
                      <Badge variant={draft.isActive ? "success" : "outline"}>
                        {draft.isActive ? "active" : "inactive"}
                      </Badge>
                    </label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="lg"
                        className="min-w-0 flex-1"
                        disabled={busyId === schedule.scheduleId}
                        onClick={() => saveSchedule(schedule)}
                      >
                        <Save />
                        {busyId === schedule.scheduleId ? "Saving" : "Save"}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-lg"
                            aria-label="Open cheer schedule actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setScheduleToDelete(schedule)}
                          >
                            Delete schedule
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
        <div className="hidden rounded-md border md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!teams.length}
                    onClick={() => setAddDialogOpen(true)}
                  >
                    <Plus />
                    Add Schedule
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => {
                const draft =
                  drafts[schedule.scheduleId] ?? getDefaultDraft(schedule)

                return (
                  <TableRow key={schedule.scheduleId}>
                    <TableCell>
                      {renderTeamSelect({
                        value: draft.teamId,
                        onChange: (teamId) =>
                          setDraft(schedule.scheduleId, { teamId }),
                      })}
                    </TableCell>
                    <TableCell>
                      {renderDaySelect({
                        value: draft.dayOfWeek,
                        onChange: (dayOfWeek) =>
                          setDraft(schedule.scheduleId, { dayOfWeek }),
                      })}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={draft.startTime}
                        onChange={(event) =>
                          setDraft(schedule.scheduleId, {
                            startTime: event.target.value,
                          })
                        }
                        className="min-w-32"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={draft.endTime}
                        onChange={(event) =>
                          setDraft(schedule.scheduleId, {
                            endTime: event.target.value,
                          })
                        }
                        className="min-w-32"
                      />
                    </TableCell>
                    <TableCell>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.isActive}
                          onChange={(event) =>
                            setDraft(schedule.scheduleId, {
                              isActive: event.target.checked,
                            })
                          }
                          className="size-4"
                        />
                        <Badge
                          variant={draft.isActive ? "success" : "outline"}
                        >
                          {draft.isActive ? "active" : "inactive"}
                        </Badge>
                      </label>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          disabled={busyId === schedule.scheduleId}
                          onClick={() => saveSchedule(schedule)}
                        >
                          <Save />
                          {busyId === schedule.scheduleId ? "Saving" : "Save"}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                            >
                              <span className="sr-only">
                                Open cheer schedule actions
                              </span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setScheduleToDelete(schedule)}
                            >
                              Delete schedule
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleAddSubmit}>
            <DialogHeader>
              <DialogTitle>Add Cheer Schedule</DialogTitle>
              <DialogDescription>
                Create a cheer practice time for a team.
              </DialogDescription>
            </DialogHeader>
            <div className="my-6 grid gap-4">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Team</span>
                {renderTeamSelect({
                  value: newScheduleDraft.teamId,
                  onChange: (teamId) =>
                    setNewScheduleDraft((current) => ({
                      ...current,
                      teamId,
                    })),
                  className:
                    "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm",
                })}
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Day</span>
                {renderDaySelect({
                  value: newScheduleDraft.dayOfWeek,
                  onChange: (dayOfWeek) =>
                    setNewScheduleDraft((current) => ({
                      ...current,
                      dayOfWeek,
                    })),
                  className:
                    "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm",
                })}
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Start</span>
                  <Input
                    type="time"
                    value={newScheduleDraft.startTime}
                    onChange={(event) =>
                      setNewScheduleDraft((current) => ({
                        ...current,
                        startTime: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">End</span>
                  <Input
                    type="time"
                    value={newScheduleDraft.endTime}
                    onChange={(event) =>
                      setNewScheduleDraft((current) => ({
                        ...current,
                        endTime: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newScheduleDraft.isActive}
                  onChange={(event) =>
                    setNewScheduleDraft((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                  className="size-4"
                />
                <span className="font-medium">Active</span>
              </label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busyId === "new-cheer-schedule"}
                onClick={() => setAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={busyId === "new-cheer-schedule" || !teams.length}
              >
                <Plus />
                {busyId === "new-cheer-schedule" ? "Adding" : "Add Schedule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(scheduleToDelete)}
        onOpenChange={(open) => !open && setScheduleToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Cheer Schedule</DialogTitle>
            <DialogDescription>
              Delete {scheduleToDelete?.teamName ?? "this cheer schedule"} on{" "}
              {scheduleToDelete?.scheduleLabel ?? "the selected time"}?
              Session history from this schedule will be retained.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setScheduleToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                !scheduleToDelete || busyId === scheduleToDelete.scheduleId
              }
              onClick={() =>
                scheduleToDelete && deleteSchedule(scheduleToDelete)
              }
            >
              {scheduleToDelete && busyId === scheduleToDelete.scheduleId
                ? "Deleting"
                : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
