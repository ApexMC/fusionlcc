import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Clock,
  Megaphone,
  UserRound,
  Users,
} from "lucide-react"

import type { DashboardNavItem } from "@/components/account/dashboard_navigation"

export const adminDashboardRoutes = {
  customers: {
    title: "Customers",
    description: "Search parent accounts and review attached athletes.",
    href: "/account/admin/customers",
    icon: UserRound,
  },
  enrollments: {
    title: "Enrollments",
    description: "Approve, deny, and manage athlete enrollment requests.",
    href: "/account/admin/enrollments",
    icon: Users,
  },
  schedules: {
    title: "Schedules",
    description: "Manage class and cheer practice schedule rows.",
    href: "/account/admin/schedules",
    icon: CalendarDays,
  },
  sessions: {
    title: "Sessions",
    description: "Review class sessions and cheer practice sessions.",
    href: "/account/admin/sessions",
    icon: ClipboardCheck,
  },
  timeClock: {
    title: "Staff Time Clock",
    description:
      "Review coach time entries, pending approvals, and pay-period totals.",
    href: "/account/admin/time-clock",
    icon: Clock,
  },
  charts: {
    title: "Charts",
    description: "Track enrollment activity, status health, and program demand.",
    href: "/account/admin/charts",
    icon: BarChart3,
  },
  announcements: {
    title: "Announcements",
    description: "Create and manage messages shown in the site-wide banner.",
    href: "/account/admin/announcements",
    icon: Megaphone,
  },
} satisfies Record<string, DashboardNavItem>

export const coachDashboardRoutes = {
  sessions: {
    title: "Sessions",
    description: "Review class sessions and attendance for coaching work.",
    href: "/account/coach/sessions",
    icon: ClipboardCheck,
  },
  timeClock: {
    title: "Time Clock",
    description: "Clock in and out for coaching shifts.",
    href: "/account/time-clock",
    icon: Clock,
  },
} satisfies Record<string, DashboardNavItem>
