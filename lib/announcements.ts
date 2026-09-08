import "server-only"

import { unstable_cache } from "next/cache"

import { createAdminClient } from "@/lib/supabase/admin"

export const announcementsCacheTag = "announcements"

export type Announcement = {
  announcementId: string
  announcementText: string
  createdAt: string | null
}

type AnnouncementRow = {
  announcement_id: string | number
  announcement_text?: string | null
  created_at?: string | null
}

async function fetchAnnouncements(): Promise<Announcement[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("Announcements")
    .select("announcement_id,announcement_text,created_at")
    .order("created_at", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as AnnouncementRow[])
    .map((announcement) => ({
      announcementId: String(announcement.announcement_id),
      announcementText: announcement.announcement_text?.trim() ?? "",
      createdAt: announcement.created_at ?? null,
    }))
    .filter((announcement) => announcement.announcementText.length > 0)
}

export const getAnnouncements = unstable_cache(
  fetchAnnouncements,
  ["site-announcements"],
  {
    tags: [announcementsCacheTag],
    revalidate: 300,
  }
)
