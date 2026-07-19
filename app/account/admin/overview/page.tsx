import { ListChecks } from "lucide-react"

import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { OperationsSummary } from "@/components/account/admin/operations_summary"
import { getAdminDashboardData } from "@/lib/account/data"
import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"

export default async function AdminOverviewPage() {
  await requireAdminOwnerAccountSession()

  const dashboardData = await getAdminDashboardData()

  return (
    <AccountDashboardFrame>
      <AccountSectionHeader
        title="Overview"
        description="Review the highest-priority enrollment, billing, and account signals."
        icon={ListChecks}
        backLabel="Dashboard"
      />
      <div className="space-y-4">
        <OperationsSummary actionItems={dashboardData.actionItems} metrics={dashboardData.metrics} />
      </div>
    </AccountDashboardFrame>
  )
}
