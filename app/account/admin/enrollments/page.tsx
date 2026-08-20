import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { EnrollmentManagement } from "@/components/account/admin/enrollment_management"
import { getAdminDashboardData } from "@/lib/account/data"
import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"
import { adminDashboardRoutes } from "@/components/account/dashboard_routes"

export default async function AdminEnrollmentsPage() {
  await requireAdminOwnerAccountSession()

  const dashboardData = await getAdminDashboardData()
  const route = adminDashboardRoutes.enrollments

  return (
    <AccountDashboardFrame className="max-w-[90rem]">
      <AccountSectionHeader
        title={route.title}
        description={route.description}
        icon={route.icon}
        backLabel="Dashboard"
      />
      <EnrollmentManagement
        enrollments={dashboardData.allEnrollments}
        athletes={dashboardData.enrollmentAthletes}
        schedules={dashboardData.classSchedules}
      />
    </AccountDashboardFrame>
  )
}
