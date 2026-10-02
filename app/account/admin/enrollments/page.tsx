import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { EnrollmentManagement } from "@/components/account/admin/enrollment_management"
import { CheerEnrollmentManagement } from "@/components/account/admin/cheer_enrollment_management"
import { getAdminEnrollmentsData } from "@/lib/account/data"
import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"
import { adminDashboardRoutes } from "@/components/account/dashboard_routes"

export default async function AdminEnrollmentsPage() {
  await requireAdminOwnerAccountSession()

  const enrollmentsData = await getAdminEnrollmentsData()
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
        enrollments={enrollmentsData.allEnrollments}
        athletes={enrollmentsData.enrollmentAthletes}
        schedules={enrollmentsData.classSchedules}
      />
      <CheerEnrollmentManagement
        enrollments={enrollmentsData.cheerEnrollments}
        athletes={enrollmentsData.enrollmentAthletes}
        teams={enrollmentsData.cheerBilling}
      />
    </AccountDashboardFrame>
  )
}
