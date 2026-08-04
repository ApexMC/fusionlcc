"use client"

import * as React from "react"
import {
  AlertTriangle,
  CalendarClock,
  CreditCard,
  Eye,
  Settings,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"

import {
  cancelEnrollmentRequest,
  selectEnrollmentScheduleSlot,
} from "@/app/actions/enrollments"
import { EnrollmentStatusBadge } from "@/components/account/enrollment_status_badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import type {
  ClassOption,
  ClassScheduleOption,
  EnrollmentDisplayRecord,
  ParentAthleteEnrollment,
} from "@/lib/account/types"

type StripeResponse = {
  url?: string
  error?: string
}

function isActiveSubscription(enrollment: EnrollmentDisplayRecord) {
  return ["active", "trialing", "past_due"].includes(
    enrollment.subscriptionStatus ?? ""
  )
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not available"
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

function getScheduleOptions(
  enrollment: EnrollmentDisplayRecord,
  classOptions: ClassOption[]
) {
  if (!enrollment.classId) {
    return [] as ClassScheduleOption[]
  }

  return (
    classOptions.find((option) => option.classId === enrollment.classId)
      ?.schedules ?? []
  )
}

function getDefaultScheduleSelection(
  enrollment: EnrollmentDisplayRecord,
  scheduleOptions: ClassScheduleOption[]
) {
  if (
    enrollment.scheduleId &&
    scheduleOptions.some((option) => option.scheduleId === enrollment.scheduleId)
  ) {
    return enrollment.scheduleId
  }

  return scheduleOptions[0]?.scheduleId ?? ""
}

export function ParentEnrollments({
  athletes,
  classOptions,
}: {
  athletes: ParentAthleteEnrollment[]
  classOptions: ClassOption[]
}) {
  const [busyKey, setBusyKey] = React.useState<string | null>(null)
  const [selectedEnrollment, setSelectedEnrollment] =
    React.useState<EnrollmentDisplayRecord | null>(null)
  const [scheduleSelections, setScheduleSelections] = React.useState<
    Record<string, string>
  >({})
  const [resolvedSelectionIds, setResolvedSelectionIds] = React.useState<
    Record<string, boolean>
  >({})
  const router = useRouter()
  const { toast } = useToast()
  const requiredSelectionCount = athletes.reduce(
    (count, athlete) =>
      count +
      athlete.enrollments.filter(
        (enrollment) =>
          enrollment.selectionRequired &&
          !resolvedSelectionIds[enrollment.enrollmentId]
      ).length,
    0
  )

  async function openStripeSession(
    enrollment: EnrollmentDisplayRecord,
    route: "checkout" | "portal"
  ) {
    const busyId = `${route}-${enrollment.enrollmentId}`
    setBusyKey(busyId)

    try {
      const response = await fetch(
        `/api/enrollments/${enrollment.enrollmentId}/${route}`,
        {
          method: "POST",
        }
      )
      const data = (await response.json().catch(() => ({}))) as StripeResponse

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Stripe session could not be created.")
      }

      window.location.assign(data.url)
    } catch (error) {
      toast({
        title:
          route === "checkout"
            ? "Unable to start payment"
            : "Unable to open subscription",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
      setBusyKey(null)
    }
  }

  async function cancelRequest(enrollment: EnrollmentDisplayRecord) {
    setBusyKey(`cancel-${enrollment.enrollmentId}`)

    try {
      const result = await cancelEnrollmentRequest(enrollment.enrollmentId)

      if (!result.ok) {
        toast({
          title: "Cancel failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: "Request canceled",
        description: result.message,
        variant: "success",
      })
      router.refresh()
    } catch (error) {
      toast({
        title: "Cancel failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setBusyKey(null)
    }
  }

  async function updateScheduleSelection(
    enrollment: EnrollmentDisplayRecord,
    selectedScheduleId: string
  ) {
    setBusyKey(`schedule-${enrollment.enrollmentId}`)

    try {
      const result = await selectEnrollmentScheduleSlot({
        enrollmentId: enrollment.enrollmentId,
        scheduleId: selectedScheduleId,
      })

      if (!result.ok) {
        toast({
          title: "Schedule update failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      setResolvedSelectionIds((current) => ({
        ...current,
        [enrollment.enrollmentId]: true,
      }))
      toast({
        title: "Schedule updated",
        description: result.message,
        variant: "success",
      })
      window.dispatchEvent(new Event("account-enrollment-selection-updated"))
      router.refresh()
    } catch (error) {
      toast({
        title: "Schedule update failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <section className="w-full max-w-6xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Enrollments
        </h2>
      </div>
      {requiredSelectionCount ? (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <div className="font-medium">Schedule selection needed</div>
              <p className="mt-1">
                Choose a new class time for{" "}
                {requiredSelectionCount === 1
                  ? "the enrollment marked below"
                  : `${requiredSelectionCount} enrollments marked below`}
                .
              </p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {athletes.map((athlete) => (
          <Card key={athlete.athleteId} className="bg-white dark:bg-black">
            <CardHeader>
              <CardTitle>{athlete.athleteName}</CardTitle>
            </CardHeader>
            <CardContent>
              {athlete.enrollments.length ? (
                <div className="space-y-3">
                  {athlete.enrollments.map((enrollment) => {
                    const canStartSubscription =
                      enrollment.status === "approved" &&
                      !isActiveSubscription(enrollment)
                    const canManageSubscription =
                      Boolean(enrollment.stripeSubscriptionId) &&
                      isActiveSubscription(enrollment)
                    const needsScheduleSelection =
                      enrollment.selectionRequired &&
                      !resolvedSelectionIds[enrollment.enrollmentId]
                    const scheduleOptions = getScheduleOptions(
                      enrollment,
                      classOptions
                    )
                    const selectedScheduleId =
                      scheduleSelections[enrollment.enrollmentId] ??
                      getDefaultScheduleSelection(enrollment, scheduleOptions)

                    return (
                      <div
                        key={enrollment.enrollmentId}
                        className="rounded-lg border p-3"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">
                              {enrollment.className}
                              {enrollment.scheduleLabel ? (
                                <span className="ml-2 text-sm font-normal text-zinc-600 dark:text-zinc-400">
                                  {enrollment.scheduleLabel}
                                </span>
                              ) : null}
                              {needsScheduleSelection ? (
                                <Badge
                                  variant="warning"
                                  className="ml-2 align-middle"
                                >
                                  schedule needed
                                </Badge>
                              ) : null}
                            </div>
                            <div className="mt-1 flex flex-col gap-2">
                              <div className="flex flex-row gap-2">
                                <p className="text-zinc-900 dark:text-zinc-50 text-sm">
                                  Enrollment:
                                </p>
                                <EnrollmentStatusBadge status={enrollment.status}/>
                              </div>
                              {enrollment.subscriptionStatus ? (
                                <div className="flex flex-row gap-2">
                                  <p className="text-zinc-900 dark:text-zinc-50 text-sm">
                                    Subscription:
                                  </p>
                                  <EnrollmentStatusBadge status={enrollment.subscriptionStatus}/>
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedEnrollment(enrollment)}
                            >
                              <Eye />
                              View
                            </Button>
                            {canStartSubscription ? (
                              <Button
                                type="button"
                                size="sm"
                                disabled={Boolean(busyKey)}
                                onClick={() =>
                                  openStripeSession(enrollment, "checkout")
                                }
                              >
                                <CreditCard />
                                {busyKey ===
                                `checkout-${enrollment.enrollmentId}`
                                  ? "Opening"
                                  : "Pay"}
                              </Button>
                            ) : null}
                            {canManageSubscription ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={Boolean(busyKey)}
                                onClick={() =>
                                  openStripeSession(enrollment, "portal")
                                }
                              >
                                <Settings />
                                {busyKey === `portal-${enrollment.enrollmentId}`
                                  ? "Opening"
                                  : "Manage"}
                              </Button>
                            ) : null}
                            {enrollment.status === "pending" ? (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={Boolean(busyKey)}
                                onClick={() => cancelRequest(enrollment)}
                              >
                                <X />
                                {busyKey ===
                                `cancel-${enrollment.enrollmentId}`
                                  ? "Canceling"
                                  : "Cancel"}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        {needsScheduleSelection ? (
                          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                            <div className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
                              <CalendarClock className="mt-0.5 size-4 shrink-0" />
                              <div>
                                <div className="font-medium">
                                  Choose a new schedule slot
                                </div>
                                <p className="mt-1">
                                  Select an available time for{" "}
                                  {enrollment.className}.
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                              <select
                                value={selectedScheduleId}
                                disabled={
                                  !scheduleOptions.length ||
                                  busyKey ===
                                    `schedule-${enrollment.enrollmentId}`
                                }
                                onChange={(event) =>
                                  setScheduleSelections((current) => ({
                                    ...current,
                                    [enrollment.enrollmentId]:
                                      event.target.value,
                                  }))
                                }
                                className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground disabled:opacity-60"
                                aria-label={`New schedule slot for ${enrollment.className}`}
                              >
                                {scheduleOptions.length ? (
                                  scheduleOptions.map((option) => (
                                    <option
                                      key={option.scheduleId}
                                      value={option.scheduleId}
                                    >
                                      {option.scheduleLabel}
                                    </option>
                                  ))
                                ) : (
                                  <option value="">
                                    No active times available
                                  </option>
                                )}
                              </select>
                              <Button
                                type="button"
                                size="sm"
                                disabled={
                                  !selectedScheduleId ||
                                  busyKey ===
                                    `schedule-${enrollment.enrollmentId}`
                                }
                                onClick={() =>
                                  updateScheduleSelection(
                                    enrollment,
                                    selectedScheduleId
                                  )
                                }
                              >
                                {busyKey ===
                                `schedule-${enrollment.enrollmentId}`
                                  ? "Saving"
                                  : "Save schedule"}
                              </Button>
                            </div>
                            {!scheduleOptions.length ? (
                              <p className="mt-2 text-xs text-amber-900 dark:text-amber-200">
                                No active schedule slots are available for this
                                class yet. Please contact us for help.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No enrollments yet.
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog
        open={Boolean(selectedEnrollment)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEnrollment(null)
          }
        }}
      >
        <DialogContent>
          {selectedEnrollment ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedEnrollment.className}</DialogTitle>
                <DialogDescription>
                  Enrollment #{selectedEnrollment.enrollmentId}
                </DialogDescription>
              </DialogHeader>
              <dl className="grid gap-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Athlete</dt>
                  <dd>{selectedEnrollment.athleteName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Enrollment status</dt>
                  <dd>
                    <EnrollmentStatusBadge status={selectedEnrollment.status} />
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Subscription status</dt>
                  <dd>
                    {selectedEnrollment.subscriptionStatus ? (
                      <EnrollmentStatusBadge
                        status={selectedEnrollment.subscriptionStatus}
                      />
                    ) : (
                      "Not started"
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Payment status</dt>
                  <dd>{selectedEnrollment.paymentStatus ?? "Not available"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Current period</dt>
                  <dd className="text-right">
                    {formatDate(selectedEnrollment.currentPeriodStart)} to{" "}
                    {formatDate(selectedEnrollment.currentPeriodEnd)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Billing day</dt>
                  <dd>
                    {selectedEnrollment.billingDay
                      ? `${selectedEnrollment.billingDay} of each month`
                      : "Not configured"}
                  </dd>
                </div>
              </dl>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}
