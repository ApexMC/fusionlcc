"use client"

import * as React from "react"
import { Check, ChevronDown, Search, SlidersHorizontal, UserPlus, X } from "lucide-react"
import { useRouter } from "next/navigation"

import {
  createAdminCheerEnrollment,
  updateCheerEnrollmentAdminStatus,
} from "@/app/actions/cheer-enrollments"
import { EnrollmentStatusBadge } from "@/components/account/enrollment_status_badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { formatPhoneNumber } from "@/functions/shared_functions"
import type {
  AdminEnrollmentAthleteOption,
  CheerBillingRecord,
  CheerEnrollmentDisplayRecord,
} from "@/lib/account/types"

const statuses = [
  "all",
  "pending",
  "approved",
  "active",
  "denied",
  "canceled",
] as const

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

function matchesSearch(
  enrollment: CheerEnrollmentDisplayRecord,
  query: string
) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return true
  }

  return [
    enrollment.enrollmentId,
    enrollment.athleteName,
    enrollment.parentName,
    enrollment.parentPhone,
    enrollment.parentEmail,
    enrollment.teamName,
    enrollment.scheduleLabel,
    enrollment.status,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery))
}

function CreateCheerEnrollmentDialog({
  athletes,
  teams,
}: {
  athletes: AdminEnrollmentAthleteOption[]
  teams: CheerBillingRecord[]
}) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [athleteId, setAthleteId] = React.useState(athletes[0]?.athleteId ?? "")
  const [teamId, setTeamId] = React.useState(teams[0]?.teamId ?? "")
  const [status, setStatus] = React.useState("active")
  const router = useRouter()
  const { toast } = useToast()
  const canCreate = Boolean(athletes.length && teams.length)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await createAdminCheerEnrollment({
        athleteId,
        teamId,
        status,
      })

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
              Create a cheer enrollment for an athlete and team.
            </DialogDescription>
          </DialogHeader>
          <div className="my-6 grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Athlete</span>
              <SmartSelect
                value={athleteId}
                onValueChange={setAthleteId}
                options={athletes.map((athlete) => ({
                  value: athlete.athleteId,
                  label: `${athlete.athleteName} - ${athlete.parentName}`,
                }))}
                searchPlaceholder="Search athletes..."
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Team</span>
              <SmartSelect
                value={teamId}
                onValueChange={setTeamId}
                options={teams.map((team) => ({
                  value: team.teamId,
                  label: team.teamName,
                }))}
                searchPlaceholder="Search teams..."
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Status</span>
              <SmartSelect
                value={status}
                onValueChange={setStatus}
                options={statuses
                  .filter((option) => option !== "all")
                  .map((option) => ({ value: option, label: option }))}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              />
            </label>
            {!canCreate ? (
              <p className="text-sm text-muted-foreground">
                Add at least one athlete and cheer team before creating an
                enrollment.
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
              disabled={loading || !canCreate || !athleteId || !teamId}
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

export function CheerEnrollmentManagement({
  enrollments,
  athletes,
  teams,
}: {
  enrollments: CheerEnrollmentDisplayRecord[]
  athletes: AdminEnrollmentAthleteOption[]
  teams: CheerBillingRecord[]
}) {
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState<(typeof statuses)[number]>("all")
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
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
          (status === "all" || enrollment.status.toLowerCase() === status) &&
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
      const result = await updateCheerEnrollmentAdminStatus({
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

      setLocalStatuses((current) => ({
        ...current,
        [enrollmentId]: nextStatus,
      }))
      toast({
        title: "Cheer enrollment updated",
        description: result.message,
        variant: "success",
      })
      router.refresh()
    } catch (caughtError) {
      toast({
        title: "Status update failed",
        description:
          caughtError instanceof Error
            ? caughtError.message
            : "Please try again.",
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
          <CardTitle>Cheer Enrollment Management</CardTitle>
          <CreateCheerEnrollmentDialog athletes={athletes} teams={teams} />
        </div>
      </CardHeader>
      <CardContent className="overscroll-contain pr-3 [scrollbar-gutter:stable]">
        <div className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute top-2 left-2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search cheer enrollments"
                className="pl-8 sm:w-64"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4" />
              <SmartSelect
                value={status}
                onValueChange={(value) =>
                  setStatus(value as (typeof statuses)[number])
                }
                options={statuses.map((option) => ({
                  value: option,
                  label: option === "all" ? "All statuses" : option,
                }))}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              />
            </label>
          </div>

          <div className="rounded-lg border bg-muted/50">
            <div className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold">Pending Review</h3>
                <p className="text-sm text-muted-foreground">
                  {pendingEnrollments.length
                    ? `${pendingEnrollments.length} cheer enrollment request${
                        pendingEnrollments.length === 1 ? "" : "s"
                      } awaiting a decision`
                    : "No pending cheer enrollments need review."}
                </p>
              </div>
            </div>
            {pendingEnrollments.length ? (
              <div className="hidden max-h-[16rem] overflow-y-auto rounded-md border bg-background md:block">
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
                    {pendingEnrollments.map((enrollment) => (
                      <TableRow key={enrollment.enrollmentId}>
                        <TableCell className="font-medium">
                          #{enrollment.enrollmentId}
                        </TableCell>
                        <TableCell>{enrollment.athleteName}</TableCell>
                        <TableCell>
                          <div>{enrollment.parentName}</div>
                          {enrollment.parentPhone ? (
                            <div className="text-xs text-muted-foreground">
                              {formatPhoneNumber(enrollment.parentPhone)}
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
                              disabled={Boolean(busyId)}
                              onClick={() =>
                                updateStatus(enrollment.enrollmentId, "approved")
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

          <div className="max-h-[min(55rem,55svh)] space-y-3 overflow-y-auto md:hidden">
            {filteredEnrollments.length ? (
              filteredEnrollments.map((enrollment) => {
                const isExpanded = expandedId === enrollment.enrollmentId

                return (
                  <div
                    key={enrollment.enrollmentId}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium">
                          {enrollment.athleteName} — {enrollment.teamName}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          Enrollment #{enrollment.enrollmentId}
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
                        setExpandedId((current) =>
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
                      <div className="mt-3 grid gap-3 text-sm">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs font-medium text-muted-foreground">
                              Requested
                            </div>
                            <div>{formatDate(enrollment.createdAt)}</div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-muted-foreground">
                              Parent
                            </div>
                            <div>{enrollment.parentName}</div>
                          </div>
                        </div>
                        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                          Update Status
                          <SmartSelect
                            value={enrollment.status}
                            disabled={busyId === enrollment.enrollmentId}
                            onValueChange={(value) =>
                              updateStatus(enrollment.enrollmentId, value)
                            }
                            options={statuses
                              .filter((option) => option !== "all")
                              .map((option) => ({
                                value: option,
                                label: option,
                              }))}
                            className="h-10 rounded-lg border border-input bg-background px-2 text-base"
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                )
              })
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No cheer enrollments match the current filters.
              </div>
            )}
          </div>

          <div className="hidden max-h-[min(55rem,55svh)] overflow-y-auto rounded-md border md:block">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Athlete</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Team</TableHead>
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
                        {enrollment.parentPhone ? (
                          <div className="text-xs text-muted-foreground">
                            {formatPhoneNumber(enrollment.parentPhone)}
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
                          <SmartSelect
                            value={enrollment.status}
                            disabled={busyId === enrollment.enrollmentId}
                            onValueChange={(value) =>
                              updateStatus(enrollment.enrollmentId, value)
                            }
                            options={statuses
                              .filter((option) => option !== "all")
                              .map((option) => ({
                                value: option,
                                label: option,
                              }))}
                            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                          />
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
                      No cheer enrollments match the current filters.
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
