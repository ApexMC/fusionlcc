import { CalendarOff } from "lucide-react"

import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { DeadWeeks } from "@/components/account/admin/dead_weeks"
import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"
import { getDeadPeriods } from "@/lib/account/data"

export default async function AdminDeadWeeksPage() {
  await requireAdminOwnerAccountSession()

  const deadPeriods = await getDeadPeriods()

  return (
    <AccountDashboardFrame className="max-w-5xl">
      <AccountSectionHeader
        title="Dead Weeks"
        description="Configure date ranges when regular sessions should pause."
        icon={CalendarOff}
        backHref="/account/admin/sessions"
        backLabel="Sessions"
      />
      <DeadWeeks deadPeriods={deadPeriods} />
    </AccountDashboardFrame>
  )
}
