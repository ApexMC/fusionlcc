"use client"

import * as React from "react"
import { Check, X } from "lucide-react"
import { useRouter } from "next/navigation"

import {
  approveEnrollment,
  denyEnrollment,
} from "@/app/actions/enrollments"
import { EnrollmentStatusBadge } from "@/components/account/enrollment_status_badge"
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
import type { EnrollmentDisplayRecord } from "@/lib/account/types"

type PendingAction = "approve" | "deny"

export function PendingEnrollmentReview({
  enrollments,
}: {
  enrollments: EnrollmentDisplayRecord[]
}) {
  const [pendingEnrollments, setPendingEnrollments] = React.useState(enrollments)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  async function handleAction(
    enrollmentId: string,
    action: PendingAction
  ) {
    if (busyId) {
      return
    }

    setBusyId(enrollmentId)

    try {
      const result =
        action === "approve"
          ? await approveEnrollment(enrollmentId)
          : await denyEnrollment(enrollmentId)

      if (!result.ok) {
        toast({
          title: "Enrollment update failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      setPendingEnrollments((current) =>
        current.filter((enrollment) => enrollment.enrollmentId !== enrollmentId)
      )
      toast({
        title:
          result.warning
            ? "Enrollment updated; email notice issue"
            : action === "approve"
              ? "Enrollment approved"
              : "Enrollment denied",
        description: result.warning ?? result.message,
        variant: result.warning ? "error" : "success",
      })
      router.refresh()
    } catch (error) {
      toast({
        title: "Enrollment update failed",
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
        <CardTitle>Pending Enrollment Review</CardTitle>
      </CardHeader>
      <CardContent>
        {pendingEnrollments.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Enrollment</TableHead>
                <TableHead>Athlete</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={Boolean(busyId)}
                        onClick={() =>
                          handleAction(enrollment.enrollmentId, "approve")
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
                          handleAction(enrollment.enrollmentId, "deny")
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
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No pending enrollments need review.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
