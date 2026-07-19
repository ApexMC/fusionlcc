import { Clock } from "lucide-react"

import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { AdminTimeClockReview } from "@/components/account/admin/time_clock_review"
import { getAdminTimeClockReviewData } from "@/lib/account/data"
import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"

export default async function AdminTimeClockPage() {
  await requireAdminOwnerAccountSession()

  const timeClockReview = await getAdminTimeClockReviewData()

  return (
    <AccountDashboardFrame className="max-w-[90rem]">
      <AccountSectionHeader
        title="Staff Time Clock"
        description="Review coach time entries, pending approvals, and pay-period totals."
        icon={Clock}
        backLabel="Dashboard"
      />
      <AdminTimeClockReview timeClockReview={timeClockReview} />
    </AccountDashboardFrame>
  )
}
