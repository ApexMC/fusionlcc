import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { AdminTimeClockReview } from "@/components/account/admin/time_clock_review"
import { getAdminTimeClockReviewData } from "@/lib/account/data"
import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"
import { adminDashboardRoutes } from "@/components/account/dashboard_routes"

export default async function AdminTimeClockPage() {
  await requireAdminOwnerAccountSession()

  const timeClockReview = await getAdminTimeClockReviewData()
  const route = adminDashboardRoutes.timeClock

  return (
    <AccountDashboardFrame className="max-w-[90rem]">
      <AccountSectionHeader
        title={route.title}
        description={route.description}
        icon={route.icon}
        backLabel="Dashboard"
      />
      <AdminTimeClockReview timeClockReview={timeClockReview} />
    </AccountDashboardFrame>
  )
}
