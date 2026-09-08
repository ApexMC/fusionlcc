import { Megaphone } from "lucide-react"

import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"
import { AnnouncementManager } from "@/components/account/admin/announcement_manager"
import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { getAnnouncements } from "@/lib/announcements"

export default async function AdminAnnouncementsPage() {
  await requireAdminOwnerAccountSession()

  const announcements = await getAnnouncements()

  return (
    <AccountDashboardFrame className="max-w-5xl">
      <AccountSectionHeader
        title="Announcements"
        description="Control the messages that rotate across the top of every page."
        icon={Megaphone}
        backLabel="Dashboard"
      />
      <AnnouncementManager announcements={announcements} />
    </AccountDashboardFrame>
  )
}
