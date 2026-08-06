import Link from "next/link"
import { CalendarOff, ClipboardCheck } from "lucide-react"

import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { CheerSessionReview } from "@/components/account/admin/cheer_session_review"
import { ClassSessionReview } from "@/components/account/admin/class_session_review"
import { Button } from "@/components/ui/button"
import { getAdminDashboardData } from "@/lib/account/data"
import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"

export default async function AdminSessionsPage() {
  await requireAdminOwnerAccountSession()

  const dashboardData = await getAdminDashboardData()

  return (
    <AccountDashboardFrame className="max-w-[90rem]">
      <AccountSectionHeader
        title="Sessions"
        description="Review class sessions and cheer practice sessions."
        icon={ClipboardCheck}
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
        sessions={dashboardData.classSessions}
        canCancelSessions
      />
      <CheerSessionReview sessions={dashboardData.cheerSessions} />
    </AccountDashboardFrame>
  )
}
