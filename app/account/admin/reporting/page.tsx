import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { AdminReporting } from "@/components/account/admin/admin_reporting"
import { getAdminReportingData } from "@/lib/account/data"
import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"
import { adminDashboardRoutes } from "@/components/account/dashboard_routes"

export default async function AdminReportingPage() {
  await requireAdminOwnerAccountSession()

  const reportingData = await getAdminReportingData()
  const route = adminDashboardRoutes.reporting

  return (
    <AccountDashboardFrame className="max-w-[90rem]">
      <AccountSectionHeader
        title={route.title}
        description={route.description}
        icon={route.icon}
        backLabel="Dashboard"
      />
      <AdminReporting data={reportingData} />
    </AccountDashboardFrame>
  )
}
