"use client"

import * as React from "react"
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  Search,
  SlidersHorizontal,
  UserPlus,
  X,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  createAdminEnrollment,
  reassignEnrollment,
  updateEnrollmentAdminStatus,
} from "@/app/actions/enrollments"
import {
  createAdminCheerEnrollment,
  updateCheerEnrollmentAdminStatus,
} from "@/app/actions/cheer-enrollments"
import { EnrollmentStatusBadge } from "@/components/account/enrollment_status_badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
  AdminEnrollmentAthleteOption,
  CheerEnrollmentDisplayRecord,
  CheerScheduleDisplayRecord,
  ClassScheduleDisplayRecord,
  EnrollmentDisplayRecord,
} from "@/lib/account/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const statuses = ["all", "pending", "approved", "active", "denied", "canceled"] as const

type CreateEnrollmentDraft = {
  athleteId: string
  parentId: string | null
  classId: string
  scheduleId: string
  status: string
}

type CreateCheerEnrollmentDraft = {
  athleteId: string
  parentId: string | null
  scheduleId: string
  status: string
}

type ReassignmentDraft = {
  classId: string
  scheduleId: string
  confirmed: boolean
}

type ReassignmentClassOption = {
  classId: string
  className: string
}

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown"
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

function getEnrollmentSchedules(schedules: ClassScheduleDisplayRecord[]) {
  return schedules.filter(
    (schedule) =>
      schedule.isActive && schedule.seasonIsActive && schedule.classId
  )
}

function getReassignmentClassOptions(
  schedules: ClassScheduleDisplayRecord[]
): ReassignmentClassOption[] {
  const classNameById = new Map<string, string>()

  schedules.forEach((schedule) => {
    if (!schedule.classId || classNameById.has(schedule.classId)) {
      return
    }

    classNameById.set(schedule.classId, schedule.className)
  })

  return Array.from(classNameById.entries())
    .map(([classId, className]) => ({
      classId,
      className,
    }))
    .sort((first, second) => first.className.localeCompare(second.className))
}

function getFirstScheduleForClass(
  schedules: ClassScheduleDisplayRecord[],
  classId: string,
  currentScheduleId?: string | null
) {
  return (
    schedules.find(
      (schedule) =>
        schedule.classId === classId &&
        schedule.scheduleId !== currentScheduleId
    ) ?? schedules.find((schedule) => schedule.classId === classId)
  )
}

function getInitialReassignmentDraft(
  enrollment: EnrollmentDisplayRecord,
  schedules: ClassScheduleDisplayRecord[]
): ReassignmentDraft {
  const currentClassId = enrollment.classId ?? ""
  const selectedClassId =
    schedules.find((schedule) => schedule.classId === currentClassId)
      ?.classId ??
    schedules[0]?.classId ??
    ""
  const selectedSchedule = getFirstScheduleForClass(
    schedules,
    selectedClassId,
    enrollment.scheduleId
  )

  return {
    classId: selectedClassId,
    scheduleId: selectedSchedule?.scheduleId ?? "",
    confirmed: false,
  }
}

function getCreateDraft(
  athletes: AdminEnrollmentAthleteOption[],
  schedules: ClassScheduleDisplayRecord[]
): CreateEnrollmentDraft {
  return {
    athleteId: athletes[0]?.athleteId ?? "",
    parentId: athletes[0]?.parentId ?? "",
    classId: schedules[0]?.classId ?? "",
    scheduleId: schedules[0]?.scheduleId ?? "",
    status: "active",
  }
}

function getCheerEnrollmentSchedules(
  schedules: CheerScheduleDisplayRecord[]
) {
  return schedules.filter((schedule) => schedule.isActive && schedule.teamId)
}

function getCheerCreateDraft(
  athletes: AdminEnrollmentAthleteOption[],
  schedules: CheerScheduleDisplayRecord[]
): CreateCheerEnrollmentDraft {
  return {
    athleteId: athletes[0]?.athleteId ?? "",
    parentId: athletes[0]?.parentId ?? "",
    scheduleId: schedules[0]?.scheduleId ?? "",
    status: "active",
  }
}

function getAthleteParentId(
  athletes: AdminEnrollmentAthleteOption[],
  athleteId: string
) {
  return (
    athletes.find((athlete) => athlete.athleteId === athleteId)?.parentId ??
    null
  )
}

function matchesSearch(enrollment: EnrollmentDisplayRecord, query: string) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return true
  }

  return [
    enrollment.enrollmentId,
    enrollment.athleteName,
    enrollment.parentName,
    enrollment.parentEmail,
    enrollment.className,
    enrollment.scheduleLabel,
    enrollment.status,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery))
}

function matchesCheerSearch(
  enrollment: CheerEnrollmentDisplayRecord,
  query: string
) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return true
  }

  return [
    enrollment.enrollmentId,
    enrollment.athleteId,
    enrollment.athleteName,
    enrollment.parentId,
    enrollment.parentName,
    enrollment.parentEmail,
    enrollment.teamId,
    enrollment.teamName,
    enrollment.scheduleId,
    enrollment.scheduleLabel,
    enrollment.status,
    enrollment.paymentStatus,
    enrollment.subscriptionStatus,
    enrollment.stripeCustomerId,
    enrollment.tuitionSubscriptionId,
    enrollment.feeSubscriptionId,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery))
}

function formatOptional(value: string | null) {
  return value?.trim() || "Not set"
}

function formatPeriod(start: string | null, end: string | null) {
  if (start && end) {
    return `${formatDate(start)} - ${formatDate(end)}`
  }

  if (start) {
    return `From ${formatDate(start)}`
  }

  if (end) {
    return `Through ${formatDate(end)}`
  }

  return "Not set"
}

type CheerEnrollmentGroup = {
  groupId: string
  teamId: string | null
  teamName: string
  enrollments: CheerEnrollmentDisplayRecord[]
}

function getCheerEnrollmentGroupId(enrollment: CheerEnrollmentDisplayRecord) {
  return enrollment.teamId
    ? `team:${enrollment.teamId}`
    : `team-name:${enrollment.teamName.toLowerCase()}`
}

function buildCheerEnrollmentGroups(
  enrollments: CheerEnrollmentDisplayRecord[]
): CheerEnrollmentGroup[] {
  const groupsById = new Map<string, CheerEnrollmentGroup>()

  enrollments.forEach((enrollment) => {
    const groupId = getCheerEnrollmentGroupId(enrollment)
    const group =
      groupsById.get(groupId) ??
      ({
        groupId,
        teamId: enrollment.teamId,
        teamName: enrollment.teamName,
        enrollments: [],
      } satisfies CheerEnrollmentGroup)

    group.enrollments.push(enrollment)
    groupsById.set(groupId, group)
  })

  return Array.from(groupsById.values())
    .map((group) => ({
      ...group,
      enrollments: group.enrollments.sort((first, second) => {
        const athleteComparison = first.athleteName.localeCompare(
          second.athleteName
        )

        if (athleteComparison !== 0) {
          return athleteComparison
        }

        return first.enrollmentId.localeCompare(second.enrollmentId)
      }),
    }))
    .sort((first, second) => first.teamName.localeCompare(second.teamName))
}

function CheerEnrollmentPaymentBadges({
  enrollment,
}: {
  enrollment: CheerEnrollmentDisplayRecord
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {enrollment.paymentStatus ? (
        <EnrollmentStatusBadge status={enrollment.paymentStatus} />
      ) : null}
      {enrollment.subscriptionStatus ? (
        <EnrollmentStatusBadge status={enrollment.subscriptionStatus} />
      ) : null}
      {!enrollment.paymentStatus && !enrollment.subscriptionStatus ? (
        <span className="text-xs text-muted-foreground">Not started</span>
      ) : null}
    </div>
  )
}

function CheerEnrollmentDetails({
  enrollment,
}: {
  enrollment: CheerEnrollmentDisplayRecord
}) {
  return (
    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
      <div>
        <div className="text-xs font-medium text-muted-foreground">Parent</div>
        <div>{enrollment.parentName}</div>
        {enrollment.parentEmail ? (
          <div className="break-all text-xs text-muted-foreground">
            {enrollment.parentEmail}
          </div>
        ) : null}
        <div className="text-xs text-muted-foreground">
          Parent ID: {formatOptional(enrollment.parentId)}
        </div>
      </div>
      <div>
        <div className="text-xs font-medium text-muted-foreground">Team</div>
        <div>{enrollment.teamName}</div>
        {enrollment.scheduleLabel ? (
          <div className="text-xs text-muted-foreground">
            {enrollment.scheduleLabel}
          </div>
        ) : null}
        <div className="text-xs text-muted-foreground">
          Team ID: {formatOptional(enrollment.teamId)}
        </div>
        <div className="text-xs text-muted-foreground">
          Schedule ID: {formatOptional(enrollment.scheduleId)}
        </div>
      </div>
      <div>
        <div className="text-xs font-medium text-muted-foreground">
          Enrolled
        </div>
        <div>{formatDate(enrollment.enrolledAt)}</div>
      </div>
      <div>
        <div className="text-xs font-medium text-muted-foreground">
          Billing Period
        </div>
        <div>
          {formatPeriod(
            enrollment.currentPeriodStart,
            enrollment.currentPeriodEnd
          )}
        </div>
      </div>
      <div>
        <div className="text-xs font-medium text-muted-foreground">
          Stripe Customer
        </div>
        <div className="break-all">
          {formatOptional(enrollment.stripeCustomerId)}
        </div>
      </div>
      <div>
        <div className="text-xs font-medium text-muted-foreground">
          Tuition Subscription
        </div>
        <div className="break-all">
          {formatOptional(enrollment.tuitionSubscriptionId)}
        </div>
      </div>
      <div>
        <div className="text-xs font-medium text-muted-foreground">
          Fee Subscription
        </div>
        <div className="break-all">
          {formatOptional(enrollment.feeSubscriptionId)}
        </div>
      </div>
    </div>
  )
}

function CreateEnrollmentDialog({
  athletes,
  schedules,
}: {
  athletes: AdminEnrollmentAthleteOption[]
  schedules: ClassScheduleDisplayRecord[]
}) {
  const enrollmentSchedules = React.useMemo(
    () => getEnrollmentSchedules(schedules),
    [schedules]
  )
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<CreateEnrollmentDraft>(() =>
    getCreateDraft(athletes, enrollmentSchedules)
  )
  const router = useRouter()
  const { toast } = useToast()
  const canCreate = Boolean(athletes.length && enrollmentSchedules.length)
  const selectedAthleteHasParent = Boolean(draft.parentId)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await createAdminEnrollment(draft)

      if (!result.ok) {
        setError(result.message)
        toast({
          title: "Enrollment create failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: "Enrollment created",
        description: result.message,
        variant: "success",
      })
      setDraft(getCreateDraft(athletes, enrollmentSchedules))
      setOpen(false)
      router.refresh()
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Please try again."
      setError(message)
      toast({
        title: "Enrollment create failed",
        description: message,
        variant: "error",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Add enrollment"
        >
          <UserPlus />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Enrollment</DialogTitle>
            <DialogDescription>
              Create an enrollment for an athlete.
            </DialogDescription>
          </DialogHeader>
          <div className="my-6 grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Athlete</span>
              <select
                value={draft.athleteId}
                onChange={(event) => {
                  const athleteId = event.target.value

                  setDraft((current) => ({
                    ...current,
                    athleteId,
                    parentId: getAthleteParentId(athletes, athleteId),
                  }))
                }}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              >
                {athletes.map((athlete) => (
                  <option key={athlete.athleteId} value={athlete.athleteId}>
                    {athlete.athleteName} - {athlete.parentName}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Class Schedule</span>
              <select
                value={draft.scheduleId}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    scheduleId: event.target.value,
                  }))
                }
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              >
                {enrollmentSchedules.map((schedule) => (
                  <option key={schedule.scheduleId} value={schedule.scheduleId}>
                    {schedule.className} - {schedule.scheduleLabel}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Status</span>
              <select
                value={draft.status}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              >
                {statuses
                  .filter((option) => option !== "all")
                  .map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
              </select>
            </label>
            {!canCreate ? (
              <p className="text-sm text-muted-foreground">
                Add at least one athlete and active class schedule before
                creating enrollments.
              </p>
            ) : null}
            {canCreate && !selectedAthleteHasParent ? (
              <p className="text-sm text-muted-foreground">
                This athlete does not have a linked parent account.
              </p>
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={
                loading ||
                !canCreate ||
                !draft.athleteId ||
                !draft.parentId ||
                !draft.scheduleId
              }
            >
              <UserPlus />
              {loading ? "Creating" : "Create Enrollment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CreateCheerEnrollmentDialog({
  athletes,
  schedules,
}: {
  athletes: AdminEnrollmentAthleteOption[]
  schedules: CheerScheduleDisplayRecord[]
}) {
  const enrollmentSchedules = React.useMemo(
    () => getCheerEnrollmentSchedules(schedules),
    [schedules]
  )
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<CreateCheerEnrollmentDraft>(() =>
    getCheerCreateDraft(athletes, enrollmentSchedules)
  )
  const router = useRouter()
  const { toast } = useToast()
  const canCreate = Boolean(athletes.length && enrollmentSchedules.length)
  const selectedAthleteHasParent = Boolean(draft.parentId)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await createAdminCheerEnrollment(draft)

      if (!result.ok) {
        setError(result.message)
        toast({
          title: "Cheer enrollment create failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: "Cheer enrollment created",
        description: result.message,
        variant: "success",
      })
      setDraft(getCheerCreateDraft(athletes, enrollmentSchedules))
      setOpen(false)
      router.refresh()
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Please try again."
      setError(message)
      toast({
        title: "Cheer enrollment create failed",
        description: message,
        variant: "error",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Add cheer enrollment"
        >
          <UserPlus />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Cheer Enrollment</DialogTitle>
            <DialogDescription>
              Enroll an athlete in a cheer team schedule.
            </DialogDescription>
          </DialogHeader>
          <div className="my-6 grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Athlete</span>
              <select
                value={draft.athleteId}
                onChange={(event) => {
                  const athleteId = event.target.value

                  setDraft((current) => ({
                    ...current,
                    athleteId,
                    parentId: getAthleteParentId(athletes, athleteId),
                  }))
                }}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              >
                {athletes.map((athlete) => (
                  <option key={athlete.athleteId} value={athlete.athleteId}>
                    {athlete.athleteName} - {athlete.parentName}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Cheer Team Schedule</span>
              <select
                value={draft.scheduleId}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    scheduleId: event.target.value,
                  }))
                }
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              >
                {enrollmentSchedules.map((schedule) => (
                  <option key={schedule.scheduleId} value={schedule.scheduleId}>
                    {schedule.teamName} - {schedule.scheduleLabel}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Status</span>
              <select
                value={draft.status}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              >
                {statuses
                  .filter((option) => option !== "all")
                  .map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
              </select>
            </label>
            {!canCreate ? (
              <p className="text-sm text-muted-foreground">
                Add at least one athlete and active cheer team schedule before
                creating cheer enrollments.
              </p>
            ) : null}
            {canCreate && !selectedAthleteHasParent ? (
              <p className="text-sm text-muted-foreground">
                This athlete does not have a linked parent account.
              </p>
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={
                loading ||
                !canCreate ||
                !draft.athleteId ||
                !draft.parentId ||
                !draft.scheduleId
              }
            >
              <UserPlus />
              {loading ? "Creating" : "Create Cheer Enrollment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ReassignEnrollmentDialog({
  enrollment,
  schedules,
  disabled,
  onReassigned,
}: {
  enrollment: EnrollmentDisplayRecord
  schedules: ClassScheduleDisplayRecord[]
  disabled?: boolean
  onReassigned: () => void
}) {
  const enrollmentSchedules = React.useMemo(
    () => getEnrollmentSchedules(schedules),
    [schedules]
  )
  const classOptions = React.useMemo(
    () => getReassignmentClassOptions(enrollmentSchedules),
    [enrollmentSchedules]
  )
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<ReassignmentDraft>(() =>
    getInitialReassignmentDraft(enrollment, enrollmentSchedules)
  )
  const { toast } = useToast()
  const selectedClassSchedules = enrollmentSchedules.filter(
    (schedule) => schedule.classId === draft.classId
  )
  const selectedSchedule = enrollmentSchedules.find(
    (schedule) => schedule.scheduleId === draft.scheduleId
  )
  const changed = selectedSchedule?.scheduleId !== enrollment.scheduleId
  const canSubmit = Boolean(
    selectedSchedule && changed && draft.confirmed && !loading
  )

  function resetDraft() {
    setDraft(getInitialReassignmentDraft(enrollment, enrollmentSchedules))
    setError(null)
  }

  function setClassId(classId: string) {
    const nextSchedule = getFirstScheduleForClass(
      enrollmentSchedules,
      classId,
      enrollment.scheduleId
    )

    setDraft({
      classId,
      scheduleId: nextSchedule?.scheduleId ?? "",
      confirmed: false,
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await reassignEnrollment({
        enrollmentId: enrollment.enrollmentId,
        classId: draft.classId,
        scheduleId: draft.scheduleId,
        confirmed: draft.confirmed,
      })

      if (!result.ok) {
        setError(result.message)
        toast({
          title: "Reassignment failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: "Enrollment reassigned",
        description: result.message,
        variant: "success",
      })
      setOpen(false)
      resetDraft()
      onReassigned()
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Please try again."
      setError(message)
      toast({
        title: "Reassignment failed",
        description: message,
        variant: "error",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)

        if (nextOpen) {
          resetDraft()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
        >
          <ArrowLeftRight />
          Re-Assign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Re-Assign Enrollment</DialogTitle>
            <DialogDescription>
              Move {enrollment.athleteName} to a new class schedule.
            </DialogDescription>
          </DialogHeader>
          <div className="my-6 grid gap-4">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="text-xs font-medium text-muted-foreground">
                Current assignment
              </div>
              <div className="mt-1 font-medium">{enrollment.className}</div>
              {enrollment.scheduleLabel ? (
                <div className="text-muted-foreground">
                  {enrollment.scheduleLabel}
                </div>
              ) : null}
            </div>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">New Class</span>
              <select
                value={draft.classId}
                onChange={(event) => setClassId(event.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              >
                {classOptions.map((option) => (
                  <option key={option.classId} value={option.classId}>
                    {option.className}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">New Class Schedule</span>
              <select
                value={draft.scheduleId}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    scheduleId: event.target.value,
                    confirmed: false,
                  }))
                }
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                disabled={!selectedClassSchedules.length}
              >
                {selectedClassSchedules.length ? (
                  selectedClassSchedules.map((schedule) => (
                    <option
                      key={schedule.scheduleId}
                      value={schedule.scheduleId}
                    >
                      {schedule.scheduleLabel}
                    </option>
                  ))
                ) : (
                  <option value="">No active schedules</option>
                )}
              </select>
            </label>
            {selectedSchedule ? (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="text-xs font-medium text-muted-foreground">
                  New assignment
                </div>
                <div className="mt-1 font-medium">
                  {selectedSchedule.className}
                </div>
                <div className="text-muted-foreground">
                  {selectedSchedule.scheduleLabel}
                </div>
              </div>
            ) : null}
            {!classOptions.length ? (
              <p className="text-sm text-muted-foreground">
                Add an active class schedule in the active season before
                reassigning enrollments.
              </p>
            ) : null}
            {selectedSchedule && !changed ? (
              <p className="text-sm text-muted-foreground">
                Choose a different class schedule before reassigning.
              </p>
            ) : null}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.confirmed}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    confirmed: event.target.checked,
                  }))
                }
                className="mt-0.5 size-4"
              />
              <span>
                I understand this will update the parent&apos;s Stripe subscription
                when this enrollment has one.
              </span>
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!canSubmit}>
              <ArrowLeftRight />
              {loading ? "Reassigning" : "Confirm Re-Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EnrollmentManagement({
  enrollments,
  cheerEnrollments,
  athletes,
  schedules,
  cheerSchedules,
}: {
  enrollments: EnrollmentDisplayRecord[]
  cheerEnrollments: CheerEnrollmentDisplayRecord[]
  athletes: AdminEnrollmentAthleteOption[]
  schedules: ClassScheduleDisplayRecord[]
  cheerSchedules: CheerScheduleDisplayRecord[]
}) {
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState<(typeof statuses)[number]>("all")
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [expandedPendingEnrollmentId, setExpandedPendingEnrollmentId] =
    React.useState<string | null>(null)
  const [
    expandedPendingCheerEnrollmentId,
    setExpandedPendingCheerEnrollmentId,
  ] = React.useState<string | null>(null)
  const [expandedEnrollmentId, setExpandedEnrollmentId] = React.useState<
    string | null
  >(null)
  const [collapsedCheerTeamIds, setCollapsedCheerTeamIds] = React.useState<
    Record<string, boolean>
  >({})
  const [expandedCheerEnrollmentId, setExpandedCheerEnrollmentId] =
    React.useState<string | null>(null)
  const [localStatuses, setLocalStatuses] = React.useState<
    Record<string, string>
  >({})
  const [busyCheerEnrollmentId, setBusyCheerEnrollmentId] = React.useState<
    string | null
  >(null)
  const [localCheerStatuses, setLocalCheerStatuses] = React.useState<
    Record<string, string>
  >({})
  const router = useRouter()
  const { toast } = useToast()

  const visibleEnrollments = React.useMemo(
    () =>
      enrollments.map((enrollment) => ({
        ...enrollment,
        status: localStatuses[enrollment.enrollmentId] ?? enrollment.status,
      })),
    [enrollments, localStatuses]
  )

  const filteredEnrollments = React.useMemo(
    () =>
      visibleEnrollments.filter(
        (enrollment) =>
          (status === "all" || enrollment.status === status) &&
          matchesSearch(enrollment, query)
      ),
    [query, status, visibleEnrollments]
  )

  const visibleCheerEnrollments = React.useMemo(
    () =>
      cheerEnrollments.map((enrollment) => ({
        ...enrollment,
        status:
          localCheerStatuses[enrollment.enrollmentId] ?? enrollment.status,
      })),
    [cheerEnrollments, localCheerStatuses]
  )

  const filteredCheerEnrollments = React.useMemo(
    () =>
      visibleCheerEnrollments.filter(
        (enrollment) =>
          (status === "all" || enrollment.status === status) &&
          matchesCheerSearch(enrollment, query)
      ),
    [query, status, visibleCheerEnrollments]
  )

  const cheerEnrollmentGroups = React.useMemo(
    () => buildCheerEnrollmentGroups(filteredCheerEnrollments),
    [filteredCheerEnrollments]
  )

  const pendingEnrollments = React.useMemo(
    () =>
      visibleEnrollments.filter(
        (enrollment) => enrollment.status.toLowerCase() === "pending"
      ),
    [visibleEnrollments]
  )

  const pendingCheerEnrollments = React.useMemo(
    () =>
      visibleCheerEnrollments.filter(
        (enrollment) => enrollment.status.toLowerCase() === "pending"
      ),
    [visibleCheerEnrollments]
  )

  async function updateStatus(enrollmentId: string, nextStatus: string) {
    setBusyId(enrollmentId)

    try {
      const result = await updateEnrollmentAdminStatus({
        enrollmentId,
        status: nextStatus,
      })

      if (!result.ok) {
        toast({
          title: "Status update failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: result.warning
          ? "Enrollment updated; email notice issue"
          : "Enrollment updated",
        description: result.warning ?? result.message,
        variant: result.warning ? "error" : "success",
      })
      setLocalStatuses((current) => ({
        ...current,
        [enrollmentId]: nextStatus,
      }))
      router.refresh()
    } catch (error) {
      toast({
        title: "Status update failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setBusyId(null)
    }
  }

  async function updateCheerStatus(
    enrollmentId: string,
    nextStatus: string
  ) {
    setBusyCheerEnrollmentId(enrollmentId)

    try {
      const result = await updateCheerEnrollmentAdminStatus({
        enrollmentId,
        status: nextStatus,
      })

      if (!result.ok) {
        toast({
          title: "Cheer enrollment status update failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: "Cheer enrollment updated",
        description: result.message,
        variant: "success",
      })
      setLocalCheerStatuses((current) => ({
        ...current,
        [enrollmentId]: nextStatus,
      }))
      router.refresh()
    } catch (error) {
      toast({
        title: "Cheer enrollment status update failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setBusyCheerEnrollmentId(null)
    }
  }

  const sessionSectionLinks = [
  { href: "#class-enrollments", label: "Class Enrollments" },
  { href: "#cheer-enrollments", label: "Cheer Enrollments" },
]

  function toggleCheerTeamGroup(groupId: string) {
    setCollapsedCheerTeamIds((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }))
  }

  return (
    <div className="space-y-6">
      <nav
        aria-label="Session sections"
        className="sticky top-0 z-20 -mx-1 border-y bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        <div className="flex flex-wrap gap-2">
          {sessionSectionLinks.map((sectionLink) => (
            <Button
              key={sectionLink.href}
              asChild
              variant="outline"
              size="sm"
            >
              <Link href={sectionLink.href}>{sectionLink.label}</Link>
            </Button>
          ))}
        </div>
      </nav>

      <section id="class-enrollments" className="scroll-mt-20">
        <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute top-2 left-2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search enrollments"
                className="pl-8 sm:w-64"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4" />
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as (typeof statuses)[number])
                }
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              >
                {statuses.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All statuses" : option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <Card className="w-full bg-white dark:bg-black">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Enrollment Management</CardTitle>
              <CreateEnrollmentDialog athletes={athletes} schedules={schedules} />
            </div>
          </CardHeader>
          <CardContent className="overscroll-contain pr-3 scrollbar-gutter-stable">
            <div className="space-y-6">
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold">Pending Review</h3>
                  <p className="text-sm text-muted-foreground">
                    {pendingEnrollments.length
                      ? `${pendingEnrollments.length} enrollment request${
                          pendingEnrollments.length === 1 ? "" : "s"
                        } awaiting a decision`
                      : "No pending enrollments need review."}
                  </p>
                </div>
              </div>
              {pendingEnrollments.length ? (
                <div className="mt-4 space-y-3 md:hidden">
                  {pendingEnrollments.map((enrollment) => {
                    const isExpanded =
                      expandedPendingEnrollmentId === enrollment.enrollmentId

                    return (
                      <div
                        key={enrollment.enrollmentId}
                        className="rounded-lg border bg-background p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium">
                              Enrollment #{enrollment.enrollmentId}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {enrollment.athleteName} / {enrollment.className}
                            </div>
                          </div>
                          <EnrollmentStatusBadge status={enrollment.status} />
                        </div>
                        <Button
                          type="button"
                          size="lg"
                          variant={isExpanded ? "secondary" : "outline"}
                          className="mt-3 h-10 w-full justify-between"
                          aria-expanded={isExpanded}
                          onClick={() =>
                            setExpandedPendingEnrollmentId((current) =>
                              current === enrollment.enrollmentId
                                ? null
                                : enrollment.enrollmentId
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
                          <div className="mt-3">
                            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                              <div>
                                <div className="text-xs font-medium text-muted-foreground">
                                  Requested
                                </div>
                                <div>{formatDate(enrollment.createdAt)}</div>
                              </div>
                              <div>
                                <div className="text-xs font-medium text-muted-foreground">
                                  Athlete
                                </div>
                                <div>{enrollment.athleteName}</div>
                              </div>
                              <div>
                                <div className="text-xs font-medium text-muted-foreground">
                                  Parent
                                </div>
                                <div>{enrollment.parentName}</div>
                                {enrollment.parentEmail ? (
                                  <div className="break-all text-xs text-muted-foreground">
                                    {enrollment.parentEmail}
                                  </div>
                                ) : null}
                              </div>
                              <div>
                                <div className="text-xs font-medium text-muted-foreground">
                                  Class
                                </div>
                                <div>{enrollment.className}</div>
                                {enrollment.scheduleLabel ? (
                                  <div className="text-xs text-muted-foreground">
                                    {enrollment.scheduleLabel}
                                  </div>
                                ) : null}
                                {enrollment.classType ? (
                                  <div className="text-xs text-muted-foreground">
                                    {enrollment.classType}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <Button
                                type="button"
                                size="lg"
                                disabled={Boolean(busyId)}
                                onClick={() =>
                                  updateStatus(
                                    enrollment.enrollmentId,
                                    "approved"
                                  )
                                }
                              >
                                <Check />
                                {busyId === enrollment.enrollmentId
                                  ? "Saving"
                                  : "Approve"}
                              </Button>
                              <Button
                                type="button"
                                size="lg"
                                variant="destructive"
                                disabled={Boolean(busyId)}
                                onClick={() =>
                                  updateStatus(
                                    enrollment.enrollmentId,
                                    "denied"
                                  )
                                }
                              >
                                <X />
                                Deny
                              </Button>
                            </div>
                            <div className="mt-3">
                              <ReassignEnrollmentDialog
                                enrollment={enrollment}
                                schedules={schedules}
                                disabled={Boolean(busyId)}
                                onReassigned={() => router.refresh()}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : null}
              {pendingEnrollments.length ? (
                <div className="mt-4 hidden max-h-[16rem] min-h-0 overflow-y-auto rounded-md border bg-background md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Enrollment</TableHead>
                        <TableHead>Athlete</TableHead>
                        <TableHead>Parent</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead className="text-right">Decision</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingEnrollments.map((enrollment) => (
                        <TableRow key={enrollment.enrollmentId}>
                          <TableCell className="font-medium">
                            #{enrollment.enrollmentId}
                          </TableCell>
                          <TableCell>{enrollment.athleteName}</TableCell>
                          <TableCell>
                            <div>{enrollment.parentName}</div>
                            {enrollment.parentEmail ? (
                              <div className="text-xs text-muted-foreground">
                                {enrollment.parentEmail}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <div>{enrollment.className}</div>
                            {enrollment.scheduleLabel ? (
                              <div className="text-xs text-muted-foreground">
                                {enrollment.scheduleLabel}
                              </div>
                            ) : null}
                            {enrollment.classType ? (
                              <div className="text-xs text-muted-foreground">
                                {enrollment.classType}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <ReassignEnrollmentDialog
                                enrollment={enrollment}
                                schedules={schedules}
                                disabled={Boolean(busyId)}
                                onReassigned={() => router.refresh()}
                              />
                              <Button
                                type="button"
                                size="sm"
                                disabled={Boolean(busyId)}
                                onClick={() =>
                                  updateStatus(
                                    enrollment.enrollmentId,
                                    "approved"
                                  )
                                }
                              >
                                <Check />
                                {busyId === enrollment.enrollmentId
                                  ? "Saving"
                                  : "Approve"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={Boolean(busyId)}
                                onClick={() =>
                                  updateStatus(enrollment.enrollmentId, "denied")
                                }
                              >
                                <X />
                                Deny
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </div>
            <div className="max-h-[min(55rem,55svh)] min-h-0 overflow-y-auto space-y-3 md:hidden">
              {filteredEnrollments.length ? (
                filteredEnrollments.map((enrollment) => {
                  const isExpanded =
                    expandedEnrollmentId === enrollment.enrollmentId

                  return (
                    <div
                      key={enrollment.enrollmentId}
                      className="rounded-lg border p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium">
                            {enrollment.athleteName} — {enrollment.className}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            Enrollment #{enrollment.enrollmentId}
                          </div>
                        </div>
                        <EnrollmentStatusBadge status={enrollment.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {enrollment.paymentStatus ||
                        enrollment.subscriptionStatus ? (
                          <EnrollmentStatusBadge
                            status={
                              enrollment.paymentStatus ??
                              enrollment.subscriptionStatus
                            }
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Payment not started
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="lg"
                        variant={isExpanded ? "secondary" : "outline"}
                        className="mt-3 h-10 w-full justify-between"
                        aria-expanded={isExpanded}
                        onClick={() =>
                          setExpandedEnrollmentId((current) =>
                            current === enrollment.enrollmentId
                              ? null
                              : enrollment.enrollmentId
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
                        <div className="mt-3">
                          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                            <div>
                              <div className="text-xs font-medium text-muted-foreground">
                                Requested
                              </div>
                              <div>{formatDate(enrollment.createdAt)}</div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-muted-foreground">
                                Athlete
                              </div>
                              <div>{enrollment.athleteName}</div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-muted-foreground">
                                Parent
                              </div>
                              <div>{enrollment.parentName}</div>
                              {enrollment.parentEmail ? (
                                <div className="break-all text-xs text-muted-foreground">
                                  {enrollment.parentEmail}
                                </div>
                              ) : null}
                            </div>
                            <div>
                              <div className="text-xs font-medium text-muted-foreground">
                                Class
                              </div>
                              <div>{enrollment.className}</div>
                              {enrollment.scheduleLabel ? (
                                <div className="text-xs text-muted-foreground">
                                  {enrollment.scheduleLabel}
                                </div>
                              ) : null}
                              {enrollment.classType ? (
                                <div className="text-xs text-muted-foreground">
                                  {enrollment.classType}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <label className="mt-3 grid gap-1 text-xs font-medium text-muted-foreground">
                            Update Status
                            <div className="flex items-center gap-2">
                              <select
                                value={enrollment.status}
                                disabled={busyId === enrollment.enrollmentId}
                                onChange={(event) =>
                                  updateStatus(
                                    enrollment.enrollmentId,
                                    event.target.value
                                  )
                                }
                                className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-base"
                              >
                                {statuses
                                  .filter((option) => option !== "all")
                                  .map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                              </select>
                              {busyId === enrollment.enrollmentId ? (
                                <span className="text-xs text-muted-foreground">
                                  Saving
                                </span>
                              ) : null}
                            </div>
                          </label>
                          <div className="mt-3">
                            <ReassignEnrollmentDialog
                              enrollment={enrollment}
                              schedules={schedules}
                              disabled={Boolean(busyId)}
                              onReassigned={() => router.refresh()}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No enrollments match the current filters.
                </div>
              )}
            </div>
            <div className="hidden max-h-[min(55rem,55svh)] min-h-0 overflow-y-auto rounded-md border md:block">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Athlete</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="text-right">Update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEnrollments.length ? (
                    filteredEnrollments.map((enrollment) => (
                      <TableRow key={enrollment.enrollmentId}>
                        <TableCell className="font-medium">
                          #{enrollment.enrollmentId}
                        </TableCell>
                        <TableCell>{enrollment.athleteName}</TableCell>
                        <TableCell>
                          <div>{enrollment.parentName}</div>
                          {enrollment.parentEmail ? (
                            <div className="text-xs text-muted-foreground">
                              {enrollment.parentEmail}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <div>{enrollment.className}</div>
                          {enrollment.scheduleLabel ? (
                            <div className="text-xs text-muted-foreground">
                              {enrollment.scheduleLabel}
                            </div>
                          ) : null}
                          {enrollment.classType ? (
                            <div className="text-xs text-muted-foreground">
                              {enrollment.classType}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <EnrollmentStatusBadge status={enrollment.status} />
                        </TableCell>
                        <TableCell>
                          {enrollment.paymentStatus ||
                          enrollment.subscriptionStatus ? (
                            <EnrollmentStatusBadge
                              status={
                                enrollment.paymentStatus ??
                                enrollment.subscriptionStatus
                              }
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Not started
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(enrollment.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <ReassignEnrollmentDialog
                              enrollment={enrollment}
                              schedules={schedules}
                              disabled={Boolean(busyId)}
                              onReassigned={() => router.refresh()}
                            />
                            <select
                              value={enrollment.status}
                              disabled={busyId === enrollment.enrollmentId}
                              onChange={(event) =>
                                updateStatus(
                                  enrollment.enrollmentId,
                                  event.target.value
                                )
                              }
                              className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                            >
                              {statuses
                                .filter((option) => option !== "all")
                                .map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                            </select>
                            {busyId === enrollment.enrollmentId ? (
                              <span className="self-center text-xs text-muted-foreground">
                                Saving
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                        No enrollments match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
      </section>

      <section id="cheer-enrollments" className="scroll-mt-20">
        <Card className="w-full bg-white dark:bg-black">
        <CardHeader>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Cheer Team Enrollments</CardTitle>
              <p className="text-sm text-muted-foreground">
                {filteredCheerEnrollments.length
                  ? `${filteredCheerEnrollments.length} cheer enrollment${
                      filteredCheerEnrollments.length === 1 ? "" : "s"
                    }`
                  : "No cheer enrollments match the current filters."}
              </p>
            </div>
            <CreateCheerEnrollmentDialog
              athletes={athletes}
              schedules={cheerSchedules}
            />
          </div>
        </CardHeader>
        <CardContent className="overscroll-contain pr-3 [scrollbar-gutter:stable]">
          <div className="space-y-6">
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold">Pending Review</h3>
                  <p className="text-sm text-muted-foreground">
                    {pendingCheerEnrollments.length
                      ? `${pendingCheerEnrollments.length} cheer enrollment request${
                          pendingCheerEnrollments.length === 1 ? "" : "s"
                        } awaiting a decision`
                      : "No pending cheer enrollments need review."}
                  </p>
                </div>
              </div>
              {pendingCheerEnrollments.length ? (
                <div className="mt-4 space-y-3 md:hidden">
                  {pendingCheerEnrollments.map((enrollment) => {
                    const isExpanded =
                      expandedPendingCheerEnrollmentId ===
                      enrollment.enrollmentId

                    return (
                      <div
                        key={enrollment.enrollmentId}
                        className="rounded-lg border bg-background p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium">
                              Cheer enrollment #{enrollment.enrollmentId}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {enrollment.athleteName} / {enrollment.teamName}
                            </div>
                          </div>
                          <EnrollmentStatusBadge status={enrollment.status} />
                        </div>
                        <Button
                          type="button"
                          size="lg"
                          variant={isExpanded ? "secondary" : "outline"}
                          className="mt-3 h-10 w-full justify-between"
                          aria-expanded={isExpanded}
                          onClick={() =>
                            setExpandedPendingCheerEnrollmentId((current) =>
                              current === enrollment.enrollmentId
                                ? null
                                : enrollment.enrollmentId
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
                          <div className="mt-3">
                            <CheerEnrollmentDetails enrollment={enrollment} />
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <Button
                                type="button"
                                size="lg"
                                disabled={Boolean(busyCheerEnrollmentId)}
                                onClick={() =>
                                  updateCheerStatus(
                                    enrollment.enrollmentId,
                                    "approved"
                                  )
                                }
                              >
                                <Check />
                                {busyCheerEnrollmentId ===
                                enrollment.enrollmentId
                                  ? "Saving"
                                  : "Approve"}
                              </Button>
                              <Button
                                type="button"
                                size="lg"
                                variant="destructive"
                                disabled={Boolean(busyCheerEnrollmentId)}
                                onClick={() =>
                                  updateCheerStatus(
                                    enrollment.enrollmentId,
                                    "denied"
                                  )
                                }
                              >
                                <X />
                                Deny
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : null}
              {pendingCheerEnrollments.length ? (
                <div className="mt-4 hidden max-h-[16rem] min-h-0 overflow-y-auto rounded-md border bg-background md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Enrollment</TableHead>
                        <TableHead>Athlete</TableHead>
                        <TableHead>Parent</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-right">Decision</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingCheerEnrollments.map((enrollment) => (
                        <TableRow key={enrollment.enrollmentId}>
                          <TableCell className="font-medium">
                            #{enrollment.enrollmentId}
                          </TableCell>
                          <TableCell>{enrollment.athleteName}</TableCell>
                          <TableCell>
                            <div>{enrollment.parentName}</div>
                            {enrollment.parentEmail ? (
                              <div className="text-xs text-muted-foreground">
                                {enrollment.parentEmail}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <div>{enrollment.teamName}</div>
                            {enrollment.scheduleLabel ? (
                              <div className="text-xs text-muted-foreground">
                                {enrollment.scheduleLabel}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={Boolean(busyCheerEnrollmentId)}
                                onClick={() =>
                                  updateCheerStatus(
                                    enrollment.enrollmentId,
                                    "approved"
                                  )
                                }
                              >
                                <Check />
                                {busyCheerEnrollmentId ===
                                enrollment.enrollmentId
                                  ? "Saving"
                                  : "Approve"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={Boolean(busyCheerEnrollmentId)}
                                onClick={() =>
                                  updateCheerStatus(
                                    enrollment.enrollmentId,
                                    "denied"
                                  )
                                }
                              >
                                <X />
                                Deny
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </div>
            {cheerEnrollmentGroups.length ? (
            <div className="max-h-[min(55rem,55svh)] min-h-0 overflow-y-auto space-y-3">
              {cheerEnrollmentGroups.map((group) => {
                const isTeamCollapsed =
                  collapsedCheerTeamIds[group.groupId] === true

                return (
                  <div key={group.groupId} className="rounded-md border">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 p-3 text-left"
                      aria-expanded={!isTeamCollapsed}
                      onClick={() => toggleCheerTeamGroup(group.groupId)}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold">{group.teamName}</div>
                        <div className="text-xs text-muted-foreground">
                          {group.enrollments.length} enrollment
                          {group.enrollments.length === 1 ? "" : "s"}
                          {group.teamId ? ` / Team ID: ${group.teamId}` : ""}
                        </div>
                      </div>
                      <ChevronDown
                        className={
                          isTeamCollapsed
                            ? "shrink-0 transition-transform"
                            : "shrink-0 rotate-180 transition-transform"
                        }
                      />
                    </button>
                    {!isTeamCollapsed ? (
                      <div className="border-t p-3">
                        <div className="space-y-3 md:hidden">
                          {group.enrollments.map((enrollment) => {
                            const isEnrollmentExpanded =
                              expandedCheerEnrollmentId ===
                              enrollment.enrollmentId

                            return (
                              <div
                                key={enrollment.enrollmentId}
                                className="rounded-lg border bg-background p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-medium">
                                      {enrollment.athleteName}
                                    </div>
                                    <div className="truncate text-xs text-muted-foreground">
                                      Cheer enrollment #{enrollment.enrollmentId}
                                    </div>
                                    <div className="truncate text-xs text-muted-foreground">
                                      Athlete ID:{" "}
                                      {formatOptional(enrollment.athleteId)}
                                    </div>
                                  </div>
                                  <EnrollmentStatusBadge
                                    status={enrollment.status}
                                  />
                                </div>
                                <div className="mt-2">
                                  <CheerEnrollmentPaymentBadges
                                    enrollment={enrollment}
                                  />
                                </div>
                                <Button
                                  type="button"
                                  size="lg"
                                  variant={
                                    isEnrollmentExpanded
                                      ? "secondary"
                                      : "outline"
                                  }
                                  className="mt-3 h-10 w-full justify-between"
                                  aria-expanded={isEnrollmentExpanded}
                                  onClick={() =>
                                    setExpandedCheerEnrollmentId((current) =>
                                      current === enrollment.enrollmentId
                                        ? null
                                        : enrollment.enrollmentId
                                    )
                                  }
                                >
                                  {isEnrollmentExpanded
                                    ? "Hide Details"
                                    : "View Details"}
                                  <ChevronDown
                                    className={
                                      isEnrollmentExpanded
                                        ? "rotate-180 transition-transform"
                                        : "transition-transform"
                                    }
                                  />
                                </Button>
                                {isEnrollmentExpanded ? (
                                  <div className="mt-3">
                                    <CheerEnrollmentDetails
                                      enrollment={enrollment}
                                    />
                                  </div>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                        <div className="hidden overflow-x-auto rounded-md border md:block">
                          <Table>
                            <TableHeader className="sticky top-0 bg-background">
                              <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Athlete</TableHead>
                                <TableHead>Parent</TableHead>
                                <TableHead>Schedule</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Payment</TableHead>
                                <TableHead>Enrolled</TableHead>
                                <TableHead className="text-right">
                                  Details
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.enrollments.map((enrollment) => {
                                const isEnrollmentExpanded =
                                  expandedCheerEnrollmentId ===
                                  enrollment.enrollmentId

                                return (
                                  <React.Fragment key={enrollment.enrollmentId}>
                                    <TableRow>
                                      <TableCell className="font-medium">
                                        #{enrollment.enrollmentId}
                                      </TableCell>
                                      <TableCell>
                                        <div>{enrollment.athleteName}</div>
                                        <div className="text-xs text-muted-foreground">
                                          Athlete ID:{" "}
                                          {formatOptional(
                                            enrollment.athleteId
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div>{enrollment.parentName}</div>
                                        {enrollment.parentEmail ? (
                                          <div className="text-xs text-muted-foreground">
                                            {enrollment.parentEmail}
                                          </div>
                                        ) : null}
                                        <div className="text-xs text-muted-foreground">
                                          Parent ID:{" "}
                                          {formatOptional(enrollment.parentId)}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div>
                                          {formatOptional(
                                            enrollment.scheduleLabel
                                          )}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          Schedule ID:{" "}
                                          {formatOptional(enrollment.scheduleId)}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <EnrollmentStatusBadge
                                          status={enrollment.status}
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <CheerEnrollmentPaymentBadges
                                          enrollment={enrollment}
                                        />
                                      </TableCell>
                                      <TableCell>
                                        {formatDate(enrollment.enrolledAt)}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex justify-end">
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant={
                                              isEnrollmentExpanded
                                                ? "secondary"
                                                : "outline"
                                            }
                                            aria-expanded={isEnrollmentExpanded}
                                            onClick={() =>
                                              setExpandedCheerEnrollmentId(
                                                (current) =>
                                                  current ===
                                                  enrollment.enrollmentId
                                                    ? null
                                                    : enrollment.enrollmentId
                                              )
                                            }
                                          >
                                            {isEnrollmentExpanded
                                              ? "Hide Details"
                                              : "View Details"}
                                            <ChevronDown
                                              className={
                                                isEnrollmentExpanded
                                                  ? "rotate-180 transition-transform"
                                                  : "transition-transform"
                                              }
                                            />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                    {isEnrollmentExpanded ? (
                                      <TableRow>
                                        <TableCell
                                          colSpan={8}
                                          className="bg-muted/30"
                                        >
                                          <CheerEnrollmentDetails
                                            enrollment={enrollment}
                                          />
                                        </TableCell>
                                      </TableRow>
                                    ) : null}
                                  </React.Fragment>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No cheer enrollments match the current filters.
              </div>
            )}
          </div>
        </CardContent>
        </Card>
      </section>
    </div>
  )
}
