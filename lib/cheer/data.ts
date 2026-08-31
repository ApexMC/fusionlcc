import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

export type PublicCheerTeam = {
  teamId: string
  name: string
  level: string | null
  description: string | null
}

type CheerTeamRow = {
  team_id: string | number
  team_name: string | null
  type: string | null
  description: string | null
}

export async function getPublicCheerTeams(): Promise<PublicCheerTeam[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("CheerTeams")
    .select("team_id,team_name,type,description")
    .order("team_id", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as CheerTeamRow[]).map((team) => ({
    teamId: String(team.team_id),
    name: team.team_name?.trim() || `Team #${team.team_id}`,
    level: team.type?.trim() || null,
    description: team.description?.trim() || null,
  }))
}
