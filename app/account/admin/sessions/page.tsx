import { ClipboardCheck } from "lucide-react"

import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { ClassSessionReview } from "@/components/account/admin/class_session_review"
import { getAdminDashboardData } from "@/lib/account/data"
import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"

export default async function AdminSessionsPage() {
  await requireAdminOwnerAccountSession()

  const dashboardData = await getAdminDashboardData()

  return (
    <AccountDashboardFrame className="max-w-[90rem]">
      <AccountSectionHeader
        title="Sessions"
        description="Review class sessions, attendance, and expected athletes."
        icon={ClipboardCheck}
        backLabel="Dashboard"
      />
      <ClassSessionReview
        sessions={dashboardData.classSessions}
        canCancelSessions
      />
    </AccountDashboardFrame>
  )
}
