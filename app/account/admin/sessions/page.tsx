import Link from "next/link"
import { CalendarOff, ClipboardCheck } from "lucide-react"

import {
  AccountDashboardFrame,
  AccountSectionHeader,
} from "@/components/account/dashboard_navigation"
import { CheerSessionReview } from "@/components/account/admin/cheer_session_review"
import { ClassSessionReview } from "@/components/account/admin/class_session_review"
import { Button } from "@/components/ui/button"
import { getAdminSessionReviewData } from "@/lib/account/data"
import { requireAdminOwnerAccountSession } from "@/app/account/_lib/route-guards"

const sessionSectionLinks = [
  { href: "#class-sessions", label: "Class Sessions" },
  { href: "#cheer-sessions", label: "Cheer Sessions" },
]

export default async function AdminSessionsPage() {
  await requireAdminOwnerAccountSession()

  const dashboardData = await getAdminSessionReviewData()

  return (
    <AccountDashboardFrame className="max-w-[90rem]">
      <AccountSectionHeader
        title="Sessions"
        description="Review class sessions and cheer practice sessions."
        icon={ClipboardCheck}
        backLabel="Dashboard"
        actions={
          <Button asChild variant="outline">
            <Link href="/account/admin/dead-weeks">
              <CalendarOff />
              Dead Weeks
            </Link>
          </Button>
        }
      />
      <nav
        aria-label="Session sections"
        className="rounded-md border-y bg-background/50 py-2 px-2 items-center justify-center flex gap-2 shadow-sm backdrop-blur-sm"
      >
        <div className="flex flex-wrap gap-2">
          {sessionSectionLinks.map((sectionLink) => (
            <Button
              key={sectionLink.href}
              asChild
              variant="outline"
              size="sm"
            >
              <Link href={sectionLink.href}>{sectionLink.label}</Link>
            </Button>
          ))}
        </div>
      </nav>
      <section id="class-sessions" className="scroll-mt-20">
        <ClassSessionReview
          sessions={dashboardData.classSessions}
          canCancelSessions
        />
      </section>
      <section id="cheer-sessions" className="scroll-mt-20">
        <CheerSessionReview sessions={dashboardData.cheerSessions} />
      </section>
    </AccountDashboardFrame>
  )
}
