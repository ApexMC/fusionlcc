import { CreditCard } from "lucide-react"

import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { CheerBillingManager } from "@/components/account/admin/cheer_billing_manager"
import { ClassBillingManager } from "@/components/account/admin/class_billing_manager"
import { getAdminDashboardData } from "@/lib/account/data"
import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"

export default async function AdminBillingPage() {
  await requireAdminOwnerAccountSession()

  const dashboardData = await getAdminDashboardData()

  return (
    <AccountDashboardFrame className="max-w-[90rem]">
      <AccountSectionHeader
        title="Billing"
        description="Maintain billing settings, Stripe prices, and billing days by class and cheer team."
        icon={CreditCard}
        backLabel="Dashboard"
      />
      <ClassBillingManager classes={dashboardData.classBilling} />
      <CheerBillingManager teams={dashboardData.cheerBilling} />
    </AccountDashboardFrame>
  )
}
