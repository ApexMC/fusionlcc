"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ParentActions } from "@/components/account/parents/parent_actions"
import { EnrollmentStatusBadge } from "@/components/account/enrollment_status_badge"

export type ParentAthleteEnrollment = {
  enrollmentId: string;
  classId: string | null;
  className: string;
  classType: string | null;
  status: string;
}

export type ParentAthleteSummary = {
  athleteId: string;
  firstName: string | null;
  lastName: string | null;
  dob: string | null;
  shirtSize: string | null;
  enrollments: ParentAthleteEnrollment[];
}

export type Parent = {
  parent_id: string | number;
  user_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  balance?: number | string | null;
  zip_code?: string | null;
  stripe_customer_id?: string | null;
  stripe_payment_status?: string | null;
  athletes?: ParentAthleteSummary[];
  [key: string]: unknown;
}

export const columns: ColumnDef<Parent>[] = [
  {
    id: "actions",
    cell: ({ row }) => {
      const parent = row.original
 
      return <ParentActions parent={parent} />
    },
  },
  {
    accessorKey: "last_name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
            Last Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
  },
  {
    accessorKey: "first_name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
            First Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
  },
  {
    accessorKey: "stripe_payment_status",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
            Stripe Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <EnrollmentStatusBadge status={row.original.stripe_payment_status} />
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "phone",
    header: "Phone",
  },
  {
    accessorKey: "address",
    header: "Address",
  },
  {
    accessorKey: "city",
    header: "City",
  },
  {
    accessorKey: "state",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
            State
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
  },
  {
    accessorKey: "zip_code",
    header: "Zip Code",
  },
]
