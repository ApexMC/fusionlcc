import { Users } from "lucide-react"

import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { EnrollmentManagement } from "@/components/account/admin/enrollment_management"
import { getAdminEnrollmentManagementData } from "@/lib/account/data"
import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"

export default async function AdminEnrollmentsPage() {
  await requireAdminOwnerAccountSession()

  const dashboardData = await getAdminEnrollmentManagementData()

  return (
    <AccountDashboardFrame className="max-w-[90rem]">
      <AccountSectionHeader
        title="Enrollments"
        description="Approve, deny, and manage athlete enrollment requests."
        icon={Users}
        backLabel="Dashboard"
      />
      <EnrollmentManagement
        enrollments={dashboardData.allEnrollments}
        cheerEnrollments={dashboardData.cheerEnrollments}
        athletes={dashboardData.enrollmentAthletes}
        schedules={dashboardData.classSchedules}
        cheerSchedules={dashboardData.cheerSchedules}
      />
    </AccountDashboardFrame>
  )
}
