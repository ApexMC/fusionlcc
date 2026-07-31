"use client"

import * as React from "react"
import { ChevronDown, Save } from "lucide-react"
import { useRouter } from "next/navigation"

import { updateCheerTeamBillingConfig } from "@/app/actions/cheer-billing"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/toast"
import type { CheerBillingRecord } from "@/lib/account/types"

type Draft = {
  teamName: string
  teamType: string
  billingDay: string
  stripePriceId: string
}

function getDefaultDraft(team: CheerBillingRecord): Draft {
  return {
    teamName: team.teamName,
    teamType: team.teamType ?? "",
    billingDay: team.billingDay ?? "1/15",
    stripePriceId: team.stripePriceId ?? "",
  }
}

function getBlankDraft(): Draft {
  return {
    teamName: "",
    teamType: "",
    billingDay: "1/15",
    stripePriceId: "",
  }
}

function getBillDayLabel() {
  return "1st & 15th"
}

function isReady(draft: Draft) {
  return Boolean(draft.teamName && draft.billingDay && draft.stripePriceId)
}

export function CheerBillingManager({
  teams,
}: {
  teams: CheerBillingRecord[]
}) {
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      teams.map((team) => [team.teamId, getDefaultDraft(team)])
    )
  )
  const [newTeamDraft, setNewTeamDraft] = React.useState<Draft>(getBlankDraft)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [expandedBillingCardId, setExpandedBillingCardId] =
    React.useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  function setDraft(teamId: string, draft: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [teamId]: {
        ...(current[teamId] ?? getBlankDraft()),
        ...draft,
      },
    }))
  }

  async function saveTeam(team: CheerBillingRecord | null) {
    const draft = team
      ? drafts[team.teamId] ?? getDefaultDraft(team)
      : newTeamDraft

    if (!draft.teamName.trim()) {
      toast({
        title: "Team name required",
        description: "Add a cheer team name before saving.",
        variant: "error",
      })
      return
    }

    const busyKey = team?.teamId ?? "new-cheer-team"
    setBusyId(busyKey)

    try {
      const result = await updateCheerTeamBillingConfig({
        teamId: team?.teamId,
        teamName: draft.teamName,
        teamType: draft.teamType,
        billingDay: draft.billingDay,
        stripePriceId: draft.stripePriceId,
      })

      if (!result.ok) {
        toast({
          title: "Cheer billing update failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: "Cheer billing updated",
        description: result.message,
        variant: "success",
      })
      if (!team) {
        setNewTeamDraft(getBlankDraft())
        setExpandedBillingCardId(null)
      }
      router.refresh()
    } catch (error) {
      toast({
        title: "Cheer billing update failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setBusyId(null)
    }
  }

  const isNewTeamExpanded = expandedBillingCardId === "new-cheer-team"

  return (
    <Card className="w-full bg-white dark:bg-black">
      <CardHeader>
        <CardTitle>Cheer Billing</CardTitle>
      </CardHeader>
      <CardContent className="max-h-[min(55rem,55svh)] min-h-0 overflow-y-auto overscroll-contain pr-3 [scrollbar-gutter:stable]">
        <div className="space-y-3 md:hidden">
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">Add Cheer Team</div>
                <div className="text-xs text-muted-foreground">
                  Create billing settings for a new cheer team.
                </div>
              </div>
              <Badge variant="outline">new</Badge>
            </div>
            <Button
              type="button"
              size="lg"
              variant={isNewTeamExpanded ? "secondary" : "outline"}
              className="mt-3 h-10 w-full justify-between"
              aria-expanded={isNewTeamExpanded}
              onClick={() =>
                setExpandedBillingCardId((current) =>
                  current === "new-cheer-team" ? null : "new-cheer-team"
                )
              }
            >
              {isNewTeamExpanded ? "Hide Details" : "View Details"}
              <ChevronDown
                className={
                  isNewTeamExpanded
                    ? "rotate-180 transition-transform"
                    : "transition-transform"
                }
              />
            </Button>
            {isNewTeamExpanded ? (
              <div className="mt-3 grid gap-3">
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Team
                  <Input
                    value={newTeamDraft.teamName}
                    onChange={(event) =>
                      setNewTeamDraft((current) => ({
                        ...current,
                        teamName: event.target.value,
                      }))
                    }
                    placeholder="New cheer team"
                    className="h-10"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Type
                  <Input
                    value={newTeamDraft.teamType}
                    onChange={(event) =>
                      setNewTeamDraft((current) => ({
                        ...current,
                        teamType: event.target.value,
                      }))
                    }
                    placeholder="Level, division, or team type"
                    className="h-10"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Bill Day
                  <select
                    value={newTeamDraft.billingDay}
                    onChange={(event) =>
                      setNewTeamDraft((current) => ({
                        ...current,
                        billingDay: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-input bg-background px-2 text-base"
                  >
                    <option value="1/15">1st & 15th</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Stripe Price
                  <Input
                    value={newTeamDraft.stripePriceId}
                    onChange={(event) =>
                      setNewTeamDraft((current) => ({
                        ...current,
                        stripePriceId: event.target.value,
                      }))
                    }
                    placeholder="price_..."
                    className="h-10"
                  />
                </label>
                <Button
                  type="button"
                  size="lg"
                  disabled={busyId === "new-cheer-team"}
                  onClick={() => saveTeam(null)}
                >
                  <Save />
                  {busyId === "new-cheer-team" ? "Saving" : "Add Team"}
                </Button>
              </div>
            ) : null}
          </div>
          {teams.map((team) => {
            const draft = drafts[team.teamId] ?? getDefaultDraft(team)
            const isExpanded = expandedBillingCardId === team.teamId
            const ready = isReady(draft)

            return (
              <div key={team.teamId} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {draft.teamName || "Unnamed team"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {draft.teamType || "Competitive cheer"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      Bills on {getBillDayLabel()}
                    </div>
                    {ready ? (
                      <Badge variant="success">ready</Badge>
                    ) : (
                      <Badge variant="warning">needs setup</Badge>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  size="lg"
                  variant={isExpanded ? "secondary" : "outline"}
                  className="mt-3 h-10 w-full justify-between"
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpandedBillingCardId((current) =>
                      current === team.teamId ? null : team.teamId
                    )
                  }
                >
                  {isExpanded ? "Hide Details" : "View Details"}
                  <ChevronDown
                    className={
                      isExpanded
                        ? "rotate-180 transition-transform"
                        : "transition-transform"
                    }
                  />
                </Button>
                {isExpanded ? (
                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                      Team
                      <Input
                        value={draft.teamName}
                        onChange={(event) =>
                          setDraft(team.teamId, {
                            teamName: event.target.value,
                          })
                        }
                        className="h-10"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                      Type
                      <Input
                        value={draft.teamType}
                        onChange={(event) =>
                          setDraft(team.teamId, {
                            teamType: event.target.value,
                          })
                        }
                        placeholder="Level, division, or team type"
                        className="h-10"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                      Bill Day
                      <select
                        value={draft.billingDay}
                        onChange={(event) =>
                          setDraft(team.teamId, {
                            billingDay: event.target.value,
                          })
                        }
                        className="h-10 w-full rounded-lg border border-input bg-background px-2 text-base"
                      >
                        <option value="1/15">1st & 15th</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                      Stripe Price
                      <Input
                        value={draft.stripePriceId}
                        onChange={(event) =>
                          setDraft(team.teamId, {
                            stripePriceId: event.target.value,
                          })
                        }
                        placeholder="price_..."
                        className="h-10"
                      />
                    </label>
                    <Button
                      type="button"
                      size="lg"
                      disabled={busyId === team.teamId}
                      onClick={() => saveTeam(team)}
                    >
                      <Save />
                      {busyId === team.teamId ? "Saving" : "Save"}
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
        <div className="hidden rounded-md border md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Bill Day</TableHead>
                <TableHead>Stripe Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Save</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <Input
                    value={newTeamDraft.teamName}
                    onChange={(event) =>
                      setNewTeamDraft((current) => ({
                        ...current,
                        teamName: event.target.value,
                      }))
                    }
                    placeholder="New cheer team"
                    className="min-w-48"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={newTeamDraft.teamType}
                    onChange={(event) =>
                      setNewTeamDraft((current) => ({
                        ...current,
                        teamType: event.target.value,
                      }))
                    }
                    placeholder="Team type"
                    className="min-w-40"
                  />
                </TableCell>
                <TableCell>
                  <select
                    value={newTeamDraft.billingDay}
                    onChange={(event) =>
                      setNewTeamDraft((current) => ({
                        ...current,
                        billingDay: String(event.target.value),
                      }))
                    }
                    className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                  >
                    <option value="1/15">1st & 15th</option>
                  </select>
                </TableCell>
                <TableCell>
                  <Input
                    value={newTeamDraft.stripePriceId}
                    onChange={(event) =>
                      setNewTeamDraft((current) => ({
                        ...current,
                        stripePriceId: event.target.value,
                      }))
                    }
                    placeholder="price_..."
                    className="min-w-48"
                  />
                </TableCell>
                <TableCell>
                  <Badge variant="outline">new</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyId === "new-cheer-team"}
                      onClick={() => saveTeam(null)}
                    >
                      <Save />
                      {busyId === "new-cheer-team" ? "Saving" : "Add"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              {teams.map((team) => {
                const draft = drafts[team.teamId] ?? getDefaultDraft(team)
                const ready = isReady(draft)

                return (
                  <TableRow key={team.teamId}>
                    <TableCell>
                      <Input
                        value={draft.teamName}
                        onChange={(event) =>
                          setDraft(team.teamId, {
                            teamName: event.target.value,
                          })
                        }
                        className="min-w-48"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={draft.teamType}
                        onChange={(event) =>
                          setDraft(team.teamId, {
                            teamType: event.target.value,
                          })
                        }
                        placeholder="Team type"
                        className="min-w-40"
                      />
                    </TableCell>
                    <TableCell>
                      <select
                        value={draft.billingDay}
                        onChange={(event) =>
                          setDraft(team.teamId, {
                            billingDay: String(event.target.value),
                          })
                        }
                        className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                      >
                        <option value="1/15">1st & 15th</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={draft.stripePriceId}
                        onChange={(event) =>
                          setDraft(team.teamId, {
                            stripePriceId: event.target.value,
                          })
                        }
                        placeholder="price_..."
                        className="min-w-48"
                      />
                    </TableCell>
                    <TableCell>
                      {ready ? (
                        <Badge variant="success">ready</Badge>
                      ) : (
                        <Badge variant="warning">needs setup</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          disabled={busyId === team.teamId}
                          onClick={() => saveTeam(team)}
                        >
                          <Save />
                          {busyId === team.teamId ? "Saving" : "Save"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
