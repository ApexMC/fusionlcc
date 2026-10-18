import Link from "next/link"
import { CalendarOff } from "lucide-react"

import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { CheerSessionReview } from "@/components/account/admin/cheer_session_review"
import { ClassSessionReview } from "@/components/account/admin/class_session_review"
import { Button } from "@/components/ui/button"
import { getAdminSessionsData } from "@/lib/account/data"
import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"
import { adminDashboardRoutes } from "@/components/account/dashboard_routes"
import { getCheerAttendanceData } from "@/lib/account/attendance-data"

export default async function AdminSessionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminOwnerAccountSession()

  const [sessionsData, attendance, query] = await Promise.all([getAdminSessionsData(), getCheerAttendanceData(), searchParams])
  const sessionId = typeof query.session === "string" ? query.session : undefined
  const route = adminDashboardRoutes.sessions

  return (
    <AccountDashboardFrame className="max-w-[90rem]">
      <AccountSectionHeader
        title={route.title}
        description={route.description}
        icon={route.icon}
        backLabel="Dashboard"
        actions={
          <Button asChild variant="outline">
            <Link href="/account/admin/dead-weeks">
              <CalendarOff />
              Dead Weeks
            </Link>
          </Button>
        }
      />
      <ClassSessionReview
        sessions={sessionsData.classSessions}
        canCancelSessions
        initialSessionId={query.kind === "class" ? sessionId : undefined}
      />
      <CheerSessionReview sessions={sessionsData.cheerSessions} attendance={attendance} initialSessionId={query.kind === "cheer" ? sessionId : undefined} />
    </AccountDashboardFrame>
  )
}
