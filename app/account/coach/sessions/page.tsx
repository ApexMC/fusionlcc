import { ClipboardCheck } from "lucide-react"

import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { ClassSessionReview } from "@/components/account/admin/class_session_review"
import { requireCoachAccountSession } from "@/app/account/_lib/route-guards"
import { getCoachDashboardData } from "@/lib/account/data"

export default async function CoachSessionsPage() {
  const session = await requireCoachAccountSession()
  const dashboardData = await getCoachDashboardData(session.userId)

  return (
    <AccountDashboardFrame className="max-w-[90rem]">
      <AccountSectionHeader
        title="Sessions"
        description="Review class sessions and attendance for coaching work."
        icon={ClipboardCheck}
        backLabel="Dashboard"
      />
      <ClassSessionReview sessions={dashboardData.classSessions} />
    </AccountDashboardFrame>
  )
}
