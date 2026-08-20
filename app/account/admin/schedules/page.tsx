import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { CheerScheduleManager } from "@/components/account/admin/cheer_schedule_manager"
import { ClassScheduleManager } from "@/components/account/admin/class_schedule_manager"
import { getAdminDashboardData } from "@/lib/account/data"
import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"
import { adminDashboardRoutes } from "@/components/account/dashboard_routes"

export default async function AdminSchedulesPage() {
  await requireAdminOwnerAccountSession()

  const dashboardData = await getAdminDashboardData()
  const route = adminDashboardRoutes.schedules

  return (
    <AccountDashboardFrame className="max-w-[90rem]">
      <AccountSectionHeader
        title={route.title}
        description={route.description}
        icon={route.icon}
        backLabel="Dashboard"
      />
      <ClassScheduleManager
        schedules={dashboardData.classSchedules}
        seasons={dashboardData.scheduleSeasons}
        classes={dashboardData.classBilling}
      />
      <CheerScheduleManager
        schedules={dashboardData.cheerSchedules}
        teams={dashboardData.cheerBilling}
      />
    </AccountDashboardFrame>
  )
}
