"use client"

import { useEffect, useState } from "react";
import { columns, Parent } from "./columns"
import { EnrollmentStatusBadge } from "@/components/account/enrollment_status_badge"
import { DataTable } from "./data-table"

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

function ParentAthleteDetails({ parent }: { parent: Parent }) {
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
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
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
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {athlete.enrollments.length ? (
              athlete.enrollments.map((enrollment) => (
                <div
                  key={enrollment.enrollmentId}
                  className="flex items-center gap-2 rounded-lg border px-2 py-1 text-xs"
                >
                  <span className="font-medium">{enrollment.className}</span>
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
        renderExpandedRow={(parent) => <ParentAthleteDetails parent={parent} />}
      />
    </div>
  );
}
