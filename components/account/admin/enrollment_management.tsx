"use client"

import * as React from "react"
import {
  Check,
  ChevronDown,
  Search,
  SlidersHorizontal,
  UserPlus,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"

import {
  createAdminEnrollment,
  updateEnrollmentAdminStatus,
} from "@/app/actions/enrollments"
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

function CreateEnrollmentDialog({
  athletes,
  schedules,
}: {
  athletes: AdminEnrollmentAthleteOption[]
  schedules: ClassScheduleDisplayRecord[]
}) {
  const enrollmentSchedules = React.useMemo(
    () => schedules.filter((schedule) => schedule.isActive),
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

export function EnrollmentManagement({
  enrollments,
  athletes,
  schedules,
}: {
  enrollments: EnrollmentDisplayRecord[]
  athletes: AdminEnrollmentAthleteOption[]
  schedules: ClassScheduleDisplayRecord[]
}) {
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState<(typeof statuses)[number]>("all")
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [expandedPendingEnrollmentId, setExpandedPendingEnrollmentId] =
    React.useState<string | null>(null)
  const [expandedEnrollmentId, setExpandedEnrollmentId] = React.useState<
    string | null
  >(null)
  const [localStatuses, setLocalStatuses] = React.useState<
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

  const pendingEnrollments = React.useMemo(
    () =>
      visibleEnrollments.filter(
        (enrollment) => enrollment.status.toLowerCase() === "pending"
      ),
    [visibleEnrollments]
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
        title: "Enrollment updated",
        description: result.message,
        variant: "success",
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

  return (
    <Card className="w-full bg-white dark:bg-black">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Enrollment Management</CardTitle>
          <CreateEnrollmentDialog athletes={athletes} schedules={schedules} />
        </div>
      </CardHeader>
      <CardContent className="overscroll-contain pr-3 [scrollbar-gutter:stable]">
        <div className="space-y-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
  )
}
