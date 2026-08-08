import { CalendarDays } from "lucide-react"

import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { CheerScheduleManager } from "@/components/account/admin/cheer_schedule_manager"
import { ClassScheduleManager } from "@/components/account/admin/class_schedule_manager"
import { getAdminScheduleManagementData } from "@/lib/account/data"
import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"

export default async function AdminSchedulesPage() {
  await requireAdminOwnerAccountSession()

  const dashboardData = await getAdminScheduleManagementData()

  return (
    <AccountDashboardFrame className="max-w-[90rem]">
      <AccountSectionHeader
        title="Schedules"
        description="Manage class and cheer practice schedule rows."
        icon={CalendarDays}
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
