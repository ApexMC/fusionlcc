"use client"

import * as React from "react"
import {
  AlertTriangle,
  ChevronDown,
  Leaf,
  Mail,
  MoreHorizontal,
  Plus,
  Save,
  Snowflake,
  Sprout,
  Sun,
} from "lucide-react"
import { useRouter } from "next/navigation"

import {
  activateScheduleSeason,
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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Input } from "@/components/ui/input"
import { SmartSelect } from "@/components/ui/smart-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { weekdayOptions } from "@/lib/scheduling"
import type {
  ClassBillingRecord,
  ClassScheduleDisplayRecord,
  ScheduleSeasonRecord,
} from "@/lib/account/types"

type ScheduleDraft = {
  classId: string
  seasonId: string
  dayOfWeek: string
  startTime: string
  endTime: string
  isActive: boolean
}

const seasonStyles = {
  spring: {
    icon: Sprout,
    tab: "border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100 dark:hover:bg-emerald-950/50",
    selected:
      "border-emerald-500 bg-emerald-100 text-emerald-950 ring-2 ring-emerald-500/25 dark:border-emerald-400 dark:bg-emerald-900/50 dark:text-emerald-50",
    iconShell: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200",
  },
  summer: {
    icon: Sun,
    tab: "border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/50",
    selected:
      "border-amber-500 bg-amber-100 text-amber-950 ring-2 ring-amber-500/25 dark:border-amber-400 dark:bg-amber-900/50 dark:text-amber-50",
    iconShell: "bg-amber-500/15 text-amber-700 dark:text-amber-200",
  },
  fall: {
    icon: Leaf,
    tab: "border-orange-200 bg-orange-50 text-orange-950 hover:bg-orange-100 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-100 dark:hover:bg-orange-950/50",
    selected:
      "border-orange-500 bg-orange-100 text-orange-950 ring-2 ring-orange-500/25 dark:border-orange-400 dark:bg-orange-900/50 dark:text-orange-50",
    iconShell: "bg-orange-500/15 text-orange-700 dark:text-orange-200",
  },
  winter: {
    icon: Snowflake,
    tab: "border-sky-200 bg-sky-50 text-sky-950 hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100 dark:hover:bg-sky-950/50",
    selected:
      "border-sky-500 bg-sky-100 text-sky-950 ring-2 ring-sky-500/25 dark:border-sky-400 dark:bg-sky-900/50 dark:text-sky-50",
    iconShell: "bg-sky-500/15 text-sky-700 dark:text-sky-200",
  },
}

function normalizeSeasonName(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase()
}

function getSeasonStyle(season: string) {
  const normalizedSeason = normalizeSeasonName(season)

  return (
    seasonStyles[normalizedSeason as keyof typeof seasonStyles] ??
    seasonStyles.spring
  )
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
    seasonId: schedule.seasonId ?? "",
    dayOfWeek: schedule.dayOfWeek || "monday",
    startTime: toTimeInputValue(schedule.startTime),
    endTime: toTimeInputValue(schedule.endTime),
    isActive: schedule.isActive,
  }
}

function getBlankDraft(
  classes: ClassBillingRecord[],
  seasonId: string
): ScheduleDraft {
  return {
    classId: classes[0]?.classId ?? "",
    seasonId,
    dayOfWeek: "monday",
    startTime: "",
    endTime: "",
    isActive: true,
  }
}

function getInitialSeasonId(
  seasons: ScheduleSeasonRecord[],
  schedules: ClassScheduleDisplayRecord[]
) {
  return (
    seasons.find((season) => season.isActive)?.seasonId ??
    seasons[0]?.seasonId ??
    schedules.find((schedule) => schedule.seasonId)?.seasonId ??
    ""
  )
}

export function ClassScheduleManager({
  schedules,
  seasons,
  classes,
}: {
  schedules: ClassScheduleDisplayRecord[]
  seasons: ScheduleSeasonRecord[]
  classes: ClassBillingRecord[]
}) {
  const [selectedSeasonId, setSelectedSeasonId] = React.useState(() =>
    getInitialSeasonId(seasons, schedules)
  )
  const [activeSeasonId, setActiveSeasonId] = React.useState(
    () => seasons.find((season) => season.isActive)?.seasonId ?? ""
  )
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
    React.useState<ScheduleDraft>(() =>
      getBlankDraft(classes, selectedSeasonId)
    )
  const [addDialogOpen, setAddDialogOpen] = React.useState(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [expandedScheduleCardId, setExpandedScheduleCardId] =
    React.useState<string | null>(null)
  const [expandedRosterCardId, setExpandedRosterCardId] =
    React.useState<string | null>(null)
  const [scheduleToDelete, setScheduleToDelete] =
    React.useState<ClassScheduleDisplayRecord | null>(null)
  const [seasonToActivate, setSeasonToActivate] =
    React.useState<ScheduleSeasonRecord | null>(null)
  const router = useRouter()
  const { toast } = useToast()
  const seasonOptions = React.useMemo(
    () =>
      seasons.map((season) => ({
        ...season,
        isActive: activeSeasonId
          ? season.seasonId === activeSeasonId
          : season.isActive,
      })),
    [activeSeasonId, seasons]
  )
  const selectedSeason =
    seasonOptions.find((season) => season.seasonId === selectedSeasonId) ??
    seasonOptions.find((season) => season.isActive) ??
    seasonOptions[0] ??
    null
  const filteredSchedules = selectedSeason
    ? schedules.filter(
        (schedule) => schedule.seasonId === selectedSeason.seasonId
      )
    : schedules

  function selectSeason(seasonId: string) {
    setSelectedSeasonId(seasonId)
    setNewScheduleDraft((current) => ({
      ...current,
      seasonId,
    }))
  }

  function setDraft(scheduleId: string, draft: Partial<ScheduleDraft>) {
    setDrafts((current) => ({
      ...current,
      [scheduleId]: {
        ...(current[scheduleId] ?? {
          classId: classes[0]?.classId ?? "",
          seasonId: selectedSeason?.seasonId ?? "",
          dayOfWeek: "monday",
          startTime: "",
          endTime: "",
          isActive: true,
        }),
        ...draft,
      },
    }))
  }

  async function confirmActivateSeason(season: ScheduleSeasonRecord) {
    const busyKey = `season:${season.seasonId}`
    setBusyId(busyKey)

    try {
      const result = await activateScheduleSeason(season.seasonId)

      if (!result.ok) {
        toast({
          title: "Season activation failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      setActiveSeasonId(season.seasonId)
      selectSeason(season.seasonId)
      toast({
        title: "Class season activated",
        description: result.message,
        variant: result.warning ? "error" : "success",
      })
      setSeasonToActivate(null)
      router.refresh()
    } catch (error) {
      toast({
        title: "Season activation failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setBusyId(null)
    }
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
        seasonId: selectedSeason?.seasonId || draft.seasonId || "",
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
        setNewScheduleDraft(
          getBlankDraft(classes, selectedSeason?.seasonId ?? selectedSeasonId)
        )
        setAddDialogOpen(false)
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
    className = "h-8 min-w-48 rounded-lg border border-input bg-background px-2 text-sm",
  }: {
    value: string
    onChange: (value: string) => void
    className?: string
  }) {
    return (
      <SmartSelect
        value={value}
        onValueChange={onChange}
        options={classes.map((classRecord) => ({
          value: classRecord.classId,
          label: classRecord.className,
        }))}
        searchPlaceholder="Search classes..."
        className={className}
      />
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
      <SmartSelect
        value={value}
        onValueChange={onChange}
        options={weekdayOptions}
        className={className}
      />
    )
  }

  function renderSeasonSelector() {
    if (!seasonOptions.length) {
      return (
        <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
          No schedule seasons are configured.
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <div
          role="tablist"
          aria-label="Class schedule seasons"
          className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"
        >
          {seasonOptions.map((season) => {
            const style = getSeasonStyle(season.season)
            const Icon = style.icon
            const isSelected = selectedSeason?.seasonId === season.seasonId
            const scheduleCount = schedules.filter(
              (schedule) => schedule.seasonId === season.seasonId
            ).length

            return (
              <button
                key={season.seasonId}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={cn(
                  "flex h-16 min-w-0 items-center gap-3 rounded-lg border px-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isSelected ? style.selected : style.tab
                )}
                onClick={() => selectSeason(season.seasonId)}
              >
                <span
                  className={cn(
                    "inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
                    style.iconShell
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {season.season}
                  </span>
                  <span className="block truncate text-xs opacity-75">
                    {scheduleCount} {scheduleCount === 1 ? "schedule" : "schedules"}
                  </span>
                </span>
                {season.isActive ? (
                  <Badge variant="success" className="shrink-0">
                    active
                  </Badge>
                ) : null}
              </button>
            )
          })}
        </div>
        {selectedSeason ? (
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {selectedSeason.season} schedule
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedSeason.isActive
                  ? "Public enrollment uses this season."
                  : "Not public until activated."}
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant={selectedSeason.isActive ? "secondary" : "default"}
              disabled={
                selectedSeason.isActive ||
                busyId === `season:${selectedSeason.seasonId}`
              }
              onClick={() => setSeasonToActivate(selectedSeason)}
            >
              {busyId === `season:${selectedSeason.seasonId}`
                ? "Activating"
                : selectedSeason.isActive
                ? "Active"
                : "Make active"}
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  function handleAddSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void saveSchedule(null)
  }

  return (
    <Card className="w-full bg-white dark:bg-black">
      <CardHeader>
        <div className="flex items-center justify-between gap-3 mb-2">
          <CardTitle>Class Schedule</CardTitle>
          <Button
            type="button"
            size="sm"
            className="md:hidden"
            disabled={!classes.length || !selectedSeason}
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus />
            Add Schedule
          </Button>
        </div>
        {renderSeasonSelector()}
      </CardHeader>
      <CardContent className="max-h-[min(42rem,55svh)] min-h-0 overflow-y-auto overscroll-contain pr-3 [scrollbar-gutter:stable]">
        <div className="space-y-3 md:hidden">
          {filteredSchedules.length ? (
            filteredSchedules.map((schedule) => {
              const draft =
                drafts[schedule.scheduleId] ?? getDefaultDraft(schedule)
              const isExpanded =
                expandedScheduleCardId === schedule.scheduleId
              const isRosterExpanded =
                expandedRosterCardId === schedule.scheduleId

              return (
                <div key={schedule.scheduleId} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{schedule.className}</div>
                      <div className="text-xs text-muted-foreground">
                        {schedule.scheduleLabel ??
                          `Schedule #${schedule.scheduleId}`}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={draft.isActive ? "success" : "outline"}>
                        {draft.isActive ? "active" : "inactive"}
                      </Badge>
                      <Badge variant="outline">
                        {schedule.enrollmentCount} enrolled
                      </Badge>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="lg"
                    variant={isRosterExpanded ? "secondary" : "outline"}
                    className="mt-3 h-10 w-full justify-between"
                    aria-expanded={isRosterExpanded}
                    aria-controls={`schedule-roster-${schedule.scheduleId}`}
                    onClick={() =>
                      setExpandedRosterCardId((current) =>
                        current === schedule.scheduleId
                          ? null
                          : schedule.scheduleId
                      )
                    }
                  >
                    {isRosterExpanded ? "Hide Roster" : "View Roster"}
                    <ChevronDown
                      className={
                        isRosterExpanded
                          ? "rotate-180 transition-transform"
                          : "transition-transform"
                      }
                    />
                  </Button>
                  {isRosterExpanded ? (
                    <div
                      id={`schedule-roster-${schedule.scheduleId}`}
                      className="mt-3 rounded-lg bg-muted/50 p-3"
                    >
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Enrolled athletes:
                      </div>
                      {schedule.athleteNames.length ? (
                        <ul className="mt-2 grid gap-1 text-sm">
                          {schedule.athleteNames.map((athleteName, index) => (
                            <li key={`${athleteName}-${index}`}>
                              {athleteName}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          No athletes enrolled.
                        </p>
                      )}
                    </div>
                  ) : null}
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
                        Class
                        {renderClassSelect({
                          value: draft.classId,
                          onChange: (classId) =>
                            setDraft(schedule.scheduleId, { classId }),
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
                              aria-label="Open schedule actions"
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
            })
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              No schedules are set for{" "}
              {selectedSeason?.season ?? "this season"}.
            </div>
          )}
        </div>
        <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              <TableHead>Day</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Enrolled</TableHead>
              <TableHead className="text-right">
                <Button
                  type="button"
                  size="sm"
                  disabled={!classes.length || !selectedSeason}
                  onClick={() => setAddDialogOpen(true)}
                >
                  <Plus />
                  Add Schedule
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSchedules.length ? (
              filteredSchedules.map((schedule) => {
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
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <button
                            type="button"
                            className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                            aria-label={`${schedule.enrollmentCount} athletes enrolled in ${schedule.className}. View roster.`}
                          >
                            <Badge variant="outline">
                              {schedule.enrollmentCount}
                            </Badge>
                          </button>
                        </HoverCardTrigger>
                        <HoverCardContent align="center">
                          <div className="text-sm font-medium">
                            Enrolled athletes:
                          </div>
                          {schedule.athleteNames.length ? (
                            <ul className="mt-2 grid gap-1 text-sm">
                              {schedule.athleteNames.map(
                                (athleteName, index) => (
                                  <li key={`${athleteName}-${index}`}>
                                    {athleteName}
                                  </li>
                                )
                              )}
                            </ul>
                          ) : (
                            <p className="mt-2 text-sm text-muted-foreground">
                              No athletes enrolled.
                            </p>
                          )}
                        </HoverCardContent>
                      </HoverCard>
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
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-20 text-center text-sm text-muted-foreground"
                >
                  No schedules are set for{" "}
                  {selectedSeason?.season ?? "this season"}.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </CardContent>
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleAddSubmit}>
            <DialogHeader>
              <DialogTitle>Add Class Schedule</DialogTitle>
              <DialogDescription>
                Create a class time for {selectedSeason?.season ?? "this season"}.
              </DialogDescription>
            </DialogHeader>
            <div className="my-6 grid gap-4">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Class</span>
                {renderClassSelect({
                  value: newScheduleDraft.classId,
                  onChange: (classId) =>
                    setNewScheduleDraft((current) => ({
                      ...current,
                      classId,
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
                disabled={busyId === "new-schedule"}
                onClick={() => setAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  busyId === "new-schedule" ||
                  !classes.length ||
                  !selectedSeason
                }
              >
                <Plus />
                {busyId === "new-schedule" ? "Adding" : "Add Schedule"}
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
            <DialogTitle>Delete Class Schedule</DialogTitle>
            <DialogDescription>
              Delete {scheduleToDelete?.className ?? "this class schedule"} on{" "}
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
              onClick={() => scheduleToDelete && deleteSchedule(scheduleToDelete)}
            >
              {scheduleToDelete && busyId === scheduleToDelete.scheduleId
                ? "Deleting"
                : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(seasonToActivate)}
        onOpenChange={(open) => {
          if (!open && !busyId?.startsWith("season:")) {
            setSeasonToActivate(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate Schedule Season</DialogTitle>
            <DialogDescription>
              Make {seasonToActivate?.season ?? "this season"} the public class
              schedule season?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 text-sm text-purple-900 dark:text-purple-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                Parents will be notified by email and asked to update their
                enrollment schedules for the new season.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(busyId?.startsWith("season:"))}
              onClick={() => setSeasonToActivate(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                !seasonToActivate ||
                busyId === `season:${seasonToActivate.seasonId}`
              }
              onClick={() =>
                seasonToActivate && confirmActivateSeason(seasonToActivate)
              }
            >
              <Mail />
              {seasonToActivate &&
              busyId === `season:${seasonToActivate.seasonId}`
                ? "Activating"
                : "Notify parents & activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
