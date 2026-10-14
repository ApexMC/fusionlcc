import "server-only"

import { getAccountSession, requireAdminSession } from "@/lib/account/auth"
import { fetchAllRows } from "@/lib/account/pagination"
import { createAdminClient } from "@/lib/supabase/admin"

export type CoachAccount = {
  userId: string
  name: string
  email: string | null
  phone: string | null
  canDelete: boolean
}

function metadataText(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === "string" ? value.trim() : ""
}

export async function getCoachAccounts(): Promise<CoachAccount[]> {
  const session = requireAdminSession(await getAccountSession())

  const supabase = createAdminClient()
  const members = await fetchAllRows<{ user_id: string; role: string }>((from, to) =>
    supabase
      .from("organization_members")
      .select("user_id,role", { count: from === 0 ? "exact" : undefined })
      .in("role", ["owner", "admin", "coach"])
      .order("user_id", { ascending: true })
      .order("role", { ascending: true })
      .range(from, to)
  )
  const protectedUserIds = new Set(
    members.filter((member) => ["owner", "admin"].includes(member.role))
      .map((member) => member.user_id)
  )
  const userIds = Array.from(new Set(
    members.filter((member) => member.role === "coach").map((member) => member.user_id)
  ))
  const accounts = await Promise.all(
    userIds.map(async (userId): Promise<CoachAccount> => {
      const { data, error } = await supabase.auth.admin.getUserById(userId)
      const canDelete = userId !== session.userId && !protectedUserIds.has(userId)

      if (error?.code === "user_not_found") {
        // Keep an orphaned membership visible so an owner can finish a deletion
        // when the Auth account was removed but membership cleanup failed.
        return {
          userId,
          name: `Deleted coach account (${userId.slice(0, 8)})`,
          email: null,
          phone: null,
          canDelete,
        }
      }

      if (error || !data.user) {
        throw new Error(error?.message ?? "A coach account could not be loaded.")
      }

      const user = data.user
      const metadata = user.user_metadata ?? {}
      const name =
        metadataText(metadata, "full_name") ||
        metadataText(metadata, "name") ||
        [metadataText(metadata, "first_name"), metadataText(metadata, "last_name")]
          .filter(Boolean)
          .join(" ") ||
        user.email ||
        `Coach ${userId.slice(0, 8)}`

      return {
        userId,
        name,
        email: user.email ?? null,
        phone: metadataText(metadata, "phone") || user.phone || null,
        canDelete,
      }
    })
  )

  return accounts.sort((first, second) =>
    first.name.localeCompare(second.name) || first.userId.localeCompare(second.userId)
  )
}
