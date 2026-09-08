"use server"

import { revalidatePath, updateTag } from "next/cache"

import { getAccountSession, requireAdminSession } from "@/lib/account/auth"
import { announcementsCacheTag } from "@/lib/announcements"
import { createAdminClient } from "@/lib/supabase/admin"

type ActionResult = {
  ok: boolean
  message: string
}

const maximumAnnouncementLength = 500

function validateAnnouncementText(value: string) {
  const announcementText = value.trim().replace(/\s+/g, " ")

  if (!announcementText) {
    return { announcementText, error: "Enter an announcement before saving." }
  }

  if (announcementText.length > maximumAnnouncementLength) {
    return {
      announcementText,
      error: `Keep announcements under ${maximumAnnouncementLength} characters.`,
    }
  }

  return { announcementText, error: null }
}

function refreshAnnouncements() {
  updateTag(announcementsCacheTag)
  revalidatePath("/", "layout")
  revalidatePath("/account/admin/announcements")
}

export async function saveAnnouncement({
  announcementId,
  announcementText,
}: {
  announcementId?: string | null
  announcementText: string
}): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  const validation = validateAnnouncementText(announcementText)

  if (validation.error) {
    return { ok: false, message: validation.error }
  }

  const normalizedAnnouncementId = announcementId?.trim() || null
  const supabase = createAdminClient()
  const mutation = normalizedAnnouncementId
    ? supabase
        .from("Announcements")
        .update({ announcement_text: validation.announcementText })
        .eq("announcement_id", normalizedAnnouncementId)
    : supabase.from("Announcements").insert({
        announcement_text: validation.announcementText,
      })
  const { error } = await mutation

  if (error) {
    return { ok: false, message: error.message }
  }

  refreshAnnouncements()

  return {
    ok: true,
    message: normalizedAnnouncementId
      ? "Announcement updated."
      : "Announcement published.",
  }
}

export async function deleteAnnouncement(
  announcementId: string
): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  const normalizedAnnouncementId = announcementId.trim()

  if (!normalizedAnnouncementId) {
    return { ok: false, message: "Choose an announcement before deleting." }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("Announcements")
    .delete()
    .eq("announcement_id", normalizedAnnouncementId)

  if (error) {
    return { ok: false, message: error.message }
  }

  refreshAnnouncements()

  return { ok: true, message: "Announcement deleted." }
}
