import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"
import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { adminDashboardRoutes } from "@/components/account/dashboard_routes"
import { StaffManager } from "@/components/account/admin/staff_manager"
import { getCoachAccounts } from "@/lib/account/staff"

export default async function AdminStaffPage() {
  await requireAdminOwnerAccountSession()
  const accounts = await getCoachAccounts()
  const route = adminDashboardRoutes.staff

  return (
    <AccountDashboardFrame>
      <AccountSectionHeader
        title={route.title}
        description={route.description}
        icon={route.icon}
        backLabel="Dashboard"
      />
      <StaffManager accounts={accounts} />
    </AccountDashboardFrame>
  )
}
