"use client"

import * as React from "react"
import { MoreHorizontal, Plus, Save } from "lucide-react"
import { useRouter } from "next/navigation"

import {
  deleteClassSchedule,
  saveClassSchedule,
} from "@/app/actions/class-schedules"
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
import type {
  ClassBillingRecord,
  ClassScheduleDisplayRecord,
} from "@/lib/account/types"

const days = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
]

type ScheduleDraft = {
  classId: string
  dayOfWeek: string
  startTime: string
  endTime: string
  isActive: boolean
}

function toTimeInputValue(value: string | null) {
  if (!value) {
    return ""
  }

  return value.slice(0, 5)
}

function getDefaultDraft(
  schedule: ClassScheduleDisplayRecord
): ScheduleDraft {
  return {
    classId: schedule.classId ?? "",
    dayOfWeek: schedule.dayOfWeek || "monday",
    startTime: toTimeInputValue(schedule.startTime),
    endTime: toTimeInputValue(schedule.endTime),
    isActive: schedule.isActive,
  }
}

function getBlankDraft(): ScheduleDraft {
  return {
    classId: "",
    dayOfWeek: "",
    startTime: "",
    endTime: "",
    isActive: false,
  }
}

export function ClassScheduleManager({
  schedules,
  classes,
}: {
  schedules: ClassScheduleDisplayRecord[]
  classes: ClassBillingRecord[]
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
    React.useState<ScheduleDraft>(() => getBlankDraft())
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [scheduleToDelete, setScheduleToDelete] =
    React.useState<ClassScheduleDisplayRecord | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  function setDraft(scheduleId: string, draft: Partial<ScheduleDraft>) {
    setDrafts((current) => ({
      ...current,
      [scheduleId]: {
        ...(current[scheduleId] ?? {
          classId: "",
          dayOfWeek: "",
          startTime: "",
          endTime: "",
          isActive: false,
        }),
        ...draft,
      },
    }))
  }

  async function saveSchedule(schedule: ClassScheduleDisplayRecord | null) {
    const draft = schedule
      ? drafts[schedule.scheduleId] ?? getDefaultDraft(schedule)
      : newScheduleDraft
    const busyKey = schedule?.scheduleId ?? "new-schedule"

    setBusyId(busyKey)

    try {
      const result = await saveClassSchedule({
        scheduleId: schedule?.scheduleId,
        classId: draft.classId,
        dayOfWeek: draft.dayOfWeek,
        startTime: draft.startTime,
        endTime: draft.endTime,
        isActive: draft.isActive,
      })

      if (!result.ok) {
        toast({
          title: "Schedule update failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: "Class schedule saved",
        description: result.message,
        variant: "success",
      })
      if (!schedule) {
        setNewScheduleDraft(getBlankDraft())
      }
      router.refresh()
    } catch (error) {
      toast({
        title: "Schedule update failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setBusyId(null)
    }
  }

  async function deleteSchedule(schedule: ClassScheduleDisplayRecord) {
    setBusyId(schedule.scheduleId)

    try {
      const result = await deleteClassSchedule(schedule.scheduleId)

      if (!result.ok) {
        toast({
          title: "Schedule delete failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: "Class schedule deleted",
        description: result.message,
        variant: "success",
      })
      setScheduleToDelete(null)
      router.refresh()
    } catch (error) {
      toast({
        title: "Schedule delete failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setBusyId(null)
    }
  }

  function renderClassSelect({
    value,
    onChange,
  }: {
    value: string
    onChange: (value: string) => void
  }) {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 min-w-48 rounded-lg border border-input bg-background px-2 text-sm"
      >
        {classes.map((classRecord) => (
          <option key={classRecord.classId} value={classRecord.classId}>
            {classRecord.className}
          </option>
        ))}
      </select>
    )
  }

  function renderDaySelect({
    value,
    onChange,
  }: {
    value: string
    onChange: (value: string) => void
  }) {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 min-w-32 rounded-lg border border-input bg-background px-2 text-sm"
      >
        {days.map((day) => (
          <option key={day.value} value={day.value}>
            {day.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <Card className="w-full bg-white dark:bg-black">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Class Schedule</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-125 overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              <TableHead>Day</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Enrolled</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>
                {renderClassSelect({
                  value: newScheduleDraft.classId,
                  onChange: (classId) =>
                    setNewScheduleDraft((current) => ({
                      ...current,
                      classId,
                    })),
                })}
              </TableCell>
              <TableCell>
                {renderDaySelect({
                  value: newScheduleDraft.dayOfWeek,
                  onChange: (dayOfWeek) =>
                    setNewScheduleDraft((current) => ({
                      ...current,
                      dayOfWeek,
                    })),
                })}
              </TableCell>
              <TableCell>
                <Input
                  type="time"
                  value={newScheduleDraft.startTime}
                  onChange={(event) =>
                    setNewScheduleDraft((current) => ({
                      ...current,
                      startTime: event.target.value,
                    }))
                  }
                  className="min-w-32"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="time"
                  value={newScheduleDraft.endTime}
                  onChange={(event) =>
                    setNewScheduleDraft((current) => ({
                      ...current,
                      endTime: event.target.value,
                    }))
                  }
                  className="min-w-32"
                />
              </TableCell>
              <TableCell>
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
                  <Badge variant={newScheduleDraft.isActive ? "success" : "outline"}>
                    {newScheduleDraft.isActive ? "active" : "inactive"}
                  </Badge>
                </label>
              </TableCell>
              <TableCell className="text-center text-sm text-muted-foreground">
                —
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busyId === "new-schedule" || !classes.length}
                    onClick={() => saveSchedule(null)}
                  >
                    <Plus />
                    {busyId === "new-schedule" ? "Saving" : "Add"}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
            {schedules.map((schedule) => {
              const draft =
                drafts[schedule.scheduleId] ?? getDefaultDraft(schedule)

              return (
                <TableRow key={schedule.scheduleId}>
                  <TableCell>
                    {renderClassSelect({
                      value: draft.classId,
                      onChange: (classId) =>
                        setDraft(schedule.scheduleId, { classId }),
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
                      <Badge variant={draft.isActive ? "success" : "outline"}>
                        {draft.isActive ? "active" : "inactive"}
                      </Badge>
                    </label>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline"> {schedule.enrollmentCount} </Badge>
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
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">
                              Open schedule actions
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
      <Dialog
        open={Boolean(scheduleToDelete)}
        onOpenChange={(open) => !open && setScheduleToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Class Schedule</DialogTitle>
            <DialogDescription>
              Delete {scheduleToDelete?.className ?? "this class schedule"} on{" "}
              {scheduleToDelete?.scheduleLabel ?? "the selected time"}.
              Existing class session links may prevent deletion.
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
              onClick={() => scheduleToDelete && deleteSchedule(scheduleToDelete)}
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
