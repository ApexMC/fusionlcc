import { Clock } from "lucide-react"

import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { CoachTimeClock } from "@/components/account/coach/time_clock"
import { requireStaffAccountSession } from "@/app/account/_lib/route-guards"
import { getCoachTimeClockData } from "@/lib/account/data"

export default async function TimeClockPage() {
  const session = await requireStaffAccountSession()
  const timeClock = await getCoachTimeClockData(session.userId)

  return (
    <AccountDashboardFrame className="max-w-6xl">
      <AccountSectionHeader
        title="Time Clock"
        description="Clock in and out for coaching shifts."
        icon={Clock}
        backLabel="Dashboard"
      />
      <CoachTimeClock timeClock={timeClock} />
    </AccountDashboardFrame>
  )
}
