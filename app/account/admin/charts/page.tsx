import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { AdminCharts } from "@/components/account/admin/admin_charts"
import { getAdminDashboardData } from "@/lib/account/data"
import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"
import { adminDashboardRoutes } from "@/components/account/dashboard_routes"

export default async function AdminChartsPage() {
  await requireAdminOwnerAccountSession()

  const dashboardData = await getAdminDashboardData()
  const route = adminDashboardRoutes.charts

  return (
    <AccountDashboardFrame className="max-w-6xl">
      <AccountSectionHeader
        title={route.title}
        description={route.description}
        icon={route.icon}
        backLabel="Dashboard"
      />
      <AdminCharts
        statusBreakdown={dashboardData.statusBreakdown}
        monthlyTrend={dashboardData.monthlyTrend}
      />
    </AccountDashboardFrame>
  )
}
