import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { CoachTimeClock } from "@/components/account/coach/time_clock"
import { requireStaffAccountSession } from "@/app/account/_lib/route-guards"
import { getCoachTimeClockData } from "@/lib/account/data"
import { coachDashboardRoutes } from "@/components/account/dashboard_routes"

export default async function TimeClockPage() {
  const session = await requireStaffAccountSession()
  const timeClock = await getCoachTimeClockData(session.userId)
  const route = coachDashboardRoutes.timeClock

  return (
    <AccountDashboardFrame className="max-w-6xl">
      <AccountSectionHeader
        title={route.title}
        description={route.description}
        icon={route.icon}
        backLabel="Dashboard"
      />
      <CoachTimeClock timeClock={timeClock} />
    </AccountDashboardFrame>
  )
}
