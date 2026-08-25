"use client"

import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react"

import { deleteAthlete } from "@/app/actions/athletes"
import { columns, Parent } from "./columns"
import { EnrollmentStatusBadge } from "@/components/account/enrollment_status_badge"
import { DataTable } from "./data-table"
import { Button } from "@/components/ui/button"
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
import { useToast } from "@/components/ui/toast"

function getAge(dob: string | null | undefined) {
  if (!dob) {
    return "Unknown"
  }

  const birthDate = new Date(dob)

  if (Number.isNaN(birthDate.getTime())) {
    return "Unknown"
  }

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDifference = today.getMonth() - birthDate.getMonth()

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1
  }

  return String(age)
}

function getAthleteName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
) {
  return [firstName, lastName].filter(Boolean).join(" ") || "Unnamed athlete"
}

function getCustomerAccountSearchText(parent: Parent) {
  return [
    parent.parent_id,
    parent.user_id,
    parent.first_name,
    parent.last_name,
    parent.email,
    parent.phone,
    parent.address,
    parent.city,
    parent.state,
    parent.zip_code,
    parent.balance,
    parent.stripe_customer_id,
    parent.stripe_payment_status,
    ...(parent.athletes ?? []).flatMap((athlete) => [
      athlete.athleteId,
      athlete.firstName,
      athlete.lastName,
      athlete.dob,
      athlete.shirtSize,
      ...athlete.enrollments.flatMap((enrollment) => [
        enrollment.enrollmentId,
        enrollment.scheduleId,
        enrollment.classId,
        enrollment.className,
        enrollment.classType,
        enrollment.scheduleLabel,
        enrollment.status,
      ]),
    ]),
  ]
    .filter((value) => value !== null && value !== undefined && value !== "")
    .join(" ")
}

function ParentAthleteActions({
  athlete,
  onDeleted,
}: {
  athlete: NonNullable<Parent["athletes"]>[number]
  onDeleted: (athleteId: string) => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const athleteName = getAthleteName(athlete.firstName, athlete.lastName)

  async function submitDelete() {
    setLoading(true)
    setError(null)

    try {
      const result = await deleteAthlete(athlete.athleteId)

      if (!result.ok) {
        setError(result.message)
        toast({
          title: "Athlete delete failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: "Athlete deleted",
        description: result.message,
        variant: "success",
      })
      setDeleteOpen(false)
      onDeleted(athlete.athleteId)
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Please try again."
      setError(message)
      toast({
        title: "Athlete delete failed",
        description: message,
        variant: "error",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open athlete actions</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            Delete athlete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => !open && setDeleteOpen(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Athlete</DialogTitle>
            <DialogDescription>
              Delete {athleteName} from this customer account. Existing
              enrollment links may prevent deletion.
            </DialogDescription>
          </DialogHeader>
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={loading}
              onClick={submitDelete}
            >
              {loading ? "Deleting" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ParentAthleteDetails({
  parent,
  onAthleteDeleted,
}: {
  parent: Parent
  onAthleteDeleted: (parentId: string, athleteId: string) => void
}) {
  const athletes = parent.athletes ?? []

  if (!athletes.length) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No athletes are attached to this parent account.
      </div>
    )
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {athletes.map((athlete) => (
        <div
          key={athlete.athleteId}
          className="rounded-lg border bg-background p-4"
        >
          <div className="flex flex-row gap-1 sm:flex-row sm:items-start justify-between">
            <div>
              <div className="font-semibold">
                {getAthleteName(athlete.firstName, athlete.lastName)}
              </div>
              <div className="text-xs text-muted-foreground">
                Age {getAge(athlete.dob)}
                {" / "}
                Shirt {athlete.shirtSize || "Unknown"}
              </div>
            </div>
            <ParentAthleteActions
              athlete={athlete}
              onDeleted={(athleteId) =>
                onAthleteDeleted(String(parent.parent_id), athleteId)
              }
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {athlete.enrollments.length ? (
              athlete.enrollments.map((enrollment) => (
                <div
                  key={enrollment.enrollmentId}
                  className="flex items-center gap-2 rounded-lg border px-2 py-1 text-xs"
                >
                  <span className="font-medium">
                    {enrollment.className}
                    {enrollment.scheduleLabel ? (
                      <span className="ml-1 text-muted-foreground">
                        {enrollment.scheduleLabel}
                      </span>
                    ) : null}
                  </span>
                  <EnrollmentStatusBadge status={enrollment.status} />
                </div>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">
                No current enrollments
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ParentList() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function removeAthlete(parentId: string, athleteId: string) {
    setParents((current) =>
      current.map((parent) =>
        String(parent.parent_id) === parentId
          ? {
              ...parent,
              athletes: (parent.athletes ?? []).filter(
                (athlete) => athlete.athleteId !== athleteId
              ),
            }
          : parent
      )
    )
  }

  useEffect(() => {
    let mounted = true;
    fetch("/api/parents")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!mounted) return;
        setParents(Array.isArray(data) ? data : []);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="p-4">Loading parents…</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  return (
    <div className="w-full">
      <DataTable
        title="Customer Accounts"
        columns={columns}
        data={parents}
        getRowId={(parent) => String(parent.parent_id)}
        getSearchText={getCustomerAccountSearchText}
        searchPlaceholder="Search customer accounts..."
        renderExpandedRow={(parent) => (
          <ParentAthleteDetails
            parent={parent}
            onAthleteDeleted={removeAthlete}
          />
        )}
      />
    </div>
  );
}
