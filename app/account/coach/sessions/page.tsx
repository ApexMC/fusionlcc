import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { ClassSessionReview } from "@/components/account/admin/class_session_review"
import { requireCoachAccountSession } from "@/app/account/_lib/route-guards"
import { getClassSessionReviewData } from "@/lib/account/data"
import { coachDashboardRoutes } from "@/components/account/dashboard_routes"

export default async function CoachSessionsPage() {
  await requireCoachAccountSession()
  const sessions = await getClassSessionReviewData()
  const route = coachDashboardRoutes.sessions

  return (
    <AccountDashboardFrame className="max-w-[90rem]">
      <AccountSectionHeader
        title={route.title}
        description={route.description}
        icon={route.icon}
        backLabel="Dashboard"
      />
      <ClassSessionReview sessions={sessions} />
    </AccountDashboardFrame>
  )
}
