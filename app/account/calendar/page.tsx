import { CalendarDays } from "lucide-react"

import { requireParentAccountSession } from "@/app/account/_lib/route-guards"
import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { ParentSchedule } from "@/components/account/parent_schedule"
import { getParentDashboardData } from "@/lib/account/data"
import { getDateKeyInTimeZone } from "@/lib/date_keys"

export default async function ParentCalendarPage() {
  const session = await requireParentAccountSession()
  const todayDateKey = getDateKeyInTimeZone()
  const { calendar } = await getParentDashboardData(session.userId, todayDateKey)

  return (
    <AccountDashboardFrame>
      <AccountSectionHeader
        title="My Calendar"
        description="View class sessions and cheer practices for your athletes."
        icon={CalendarDays}
      />
      <ParentSchedule {...calendar} todayDateKey={todayDateKey} />
    </AccountDashboardFrame>
  )
}
