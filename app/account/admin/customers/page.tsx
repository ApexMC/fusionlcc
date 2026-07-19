import { UserRound } from "lucide-react"

import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import ParentList from "@/components/account/parents/parent_list"
import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"

export default async function AdminCustomersPage() {
  await requireAdminOwnerAccountSession()

  return (
    <AccountDashboardFrame className="max-w-[90rem]">
      <AccountSectionHeader
        title="Customers"
        description="Search parent accounts and review attached athletes."
        icon={UserRound}
        backLabel="Dashboard"
      />
      <ParentList />
    </AccountDashboardFrame>
  )
}
