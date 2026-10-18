import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import ParentList from "@/components/account/parents/parent_list"
import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"
import { adminDashboardRoutes } from "@/components/account/dashboard_routes"
import { getAthleteAttendanceData } from "@/lib/account/attendance-data"
import { selectAttendanceSeason, summarizeAthleteAttendance } from "@/lib/account/attendance"

export default async function AdminCustomersPage() {
  await requireAdminOwnerAccountSession()
  const route = adminDashboardRoutes.customers
  const attendance = await getAthleteAttendanceData()
  const season = selectAttendanceSeason(attendance.seasons, attendance.today)
  const summaries = season ? summarizeAthleteAttendance(attendance, season) : []
  const attendanceSummaries = Object.fromEntries(summaries.map((athlete) => [athlete.id, {
    standing: athlete.standing, incomplete: athlete.incomplete, policyApplies: athlete.policyApplies,
    cheer: { excused: athlete.totals.cheer.excused, unexcused: athlete.totals.cheer.unexcused },
    gymnastics: { excused: athlete.totals.gymnastics.excused, unexcused: athlete.totals.gymnastics.unexcused },
  }]))

  return (
    <AccountDashboardFrame className="max-w-[90rem]">
      <AccountSectionHeader
        title={route.title}
        description={route.description}
        icon={route.icon}
        backLabel="Dashboard"
      />
      <ParentList attendanceSummaries={attendanceSummaries} attendanceSeason={season?.name} attendanceSeasonId={season?.id} attendanceUnavailable={attendance.notices.length > 0} />
    </AccountDashboardFrame>
  )
}
