import { BarChart3 } from "lucide-react"

import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { AdminCharts } from "@/components/account/admin/admin_charts"
import { getAdminDashboardData } from "@/lib/account/data"
import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"

export default async function AdminChartsPage() {
  await requireAdminOwnerAccountSession()

  const dashboardData = await getAdminDashboardData()

  return (
    <AccountDashboardFrame className="max-w-6xl">
      <AccountSectionHeader
        title="Charts"
        description="See enrollment status and request trends at a glance."
        icon={BarChart3}
        backLabel="Dashboard"
      />
      <AdminCharts
        statusBreakdown={dashboardData.statusBreakdown}
        monthlyTrend={dashboardData.monthlyTrend}
      />
    </AccountDashboardFrame>
  )
}
