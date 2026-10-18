import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"
import { AccountDashboardFrame, AccountSectionHeader } from "@/components/account/dashboard_navigation"
import { adminDashboardRoutes } from "@/components/account/dashboard_routes"
import { AthleteAttendance } from "@/components/account/admin/athlete_attendance"
import { getAthleteAttendanceData } from "@/lib/account/attendance-data"

export default async function AdminAthletesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminOwnerAccountSession()
  const [data, query] = await Promise.all([getAthleteAttendanceData({ includeReviewers: true }), searchParams])
  const route = adminDashboardRoutes.athletes
  return <AccountDashboardFrame className="max-w-[90rem]">
    <AccountSectionHeader title={route.title} description={route.description} icon={route.icon} backLabel="Dashboard" />
    <AthleteAttendance data={data} initialAthleteId={typeof query.athlete === "string" ? query.athlete : undefined} initialSeasonId={typeof query.season === "string" ? query.season : undefined} initialFilter={query.filter === "attention" ? "attention" : "all"} />
  </AccountDashboardFrame>
}
