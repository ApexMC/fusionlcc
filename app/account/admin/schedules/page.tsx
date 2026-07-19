import { CalendarDays } from "lucide-react"

import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { ClassScheduleManager } from "@/components/account/admin/class_schedule_manager"
import { getAdminDashboardData } from "@/lib/account/data"
import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"

export default async function AdminSchedulesPage() {
  await requireAdminOwnerAccountSession()

  const dashboardData = await getAdminDashboardData()

  return (
    <AccountDashboardFrame className="max-w-[90rem]">
      <AccountSectionHeader
        title="Schedules"
        description="Manage class schedule rows and enrollment counts."
        icon={CalendarDays}
        backLabel="Dashboard"
      />
      <ClassScheduleManager
        schedules={dashboardData.classSchedules}
        classes={dashboardData.classBilling}
      />
    </AccountDashboardFrame>
  )
}
