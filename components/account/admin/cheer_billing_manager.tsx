"use client"

import * as React from "react"
import { ChevronDown, Plus, Save } from "lucide-react"
import { useRouter } from "next/navigation"

import { updateCheerTeamBillingConfig } from "@/app/actions/cheer-billing"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { SmartSelect } from "@/components/ui/smart-select"
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
  teamDescription: string
  billingDay: string
  tuitionPriceId: string
  feePriceId: string
}

function getDefaultDraft(team: CheerBillingRecord): Draft {
  return {
    teamName: team.teamName,
    teamType: team.teamType ?? "",
    teamDescription: team.teamDescription ?? "",
    billingDay: team.billingDay ?? "1/15",
    tuitionPriceId: team.tuitionPriceId ?? "",
    feePriceId: team.feePriceId ?? "",
  }
}

function getBlankDraft(): Draft {
  return {
    teamName: "",
    teamType: "",
    teamDescription: "",
    billingDay: "1/15",
    tuitionPriceId: "",
    feePriceId: "",
  }
}

function isReady(draft: Draft) {
  return Boolean(
    draft.teamName &&
      draft.billingDay &&
      draft.tuitionPriceId &&
      draft.feePriceId
  )
}

export function CheerBillingManager({
  teams,
}: {
  teams: CheerBillingRecord[]
}) {
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>(() =>
    Object.fromEntries(teams.map((team) => [team.teamId, getDefaultDraft(team)]))
  )
  const [newTeamDraft, setNewTeamDraft] = React.useState<Draft>(getBlankDraft)
  const [addDialogOpen, setAddDialogOpen] = React.useState(false)
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
        teamDescription: draft.teamDescription,
        billingDay: draft.billingDay,
        tuitionPriceId: draft.tuitionPriceId,
        feePriceId: draft.feePriceId,
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
        setAddDialogOpen(false)
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

  function handleAddSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void saveTeam(null)
  }

  const addButton = (
    <Button type="button" size="sm" onClick={() => setAddDialogOpen(true)}>
      <Plus />
      Add Team
    </Button>
  )

  return (
    <>
      <Card className="w-full bg-white dark:bg-black">
        <CardHeader>
          <CardTitle>Cheer Billing</CardTitle>
          <CardAction className="md:hidden">{addButton}</CardAction>
        </CardHeader>
        <CardContent className="max-h-[min(55rem,55svh)] min-h-0 overflow-y-auto overscroll-contain pr-3 [scrollbar-gutter:stable]">
          <div className="space-y-3 md:hidden">
            {teams.map((team) => {
              const draft = drafts[team.teamId] ?? getDefaultDraft(team)
              const isExpanded = expandedBillingCardId === team.teamId

              return (
                <div key={team.teamId} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {draft.teamName || "Unnamed team"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {draft.teamDescription || draft.teamType || "No description"}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className="text-right">Bills on 1st &amp; 15th</div>
                      {isReady(draft) ? (
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
                        Description
                        <textarea
                          value={draft.teamDescription}
                          onChange={(event) =>
                            setDraft(team.teamId, {
                              teamDescription: event.target.value,
                            })
                          }
                          rows={3}
                          placeholder="Team description"
                          className="min-h-20 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        Bill Day
                        <SmartSelect
                          value={draft.billingDay}
                          onValueChange={(value) =>
                            setDraft(team.teamId, {
                              billingDay: value,
                            })
                          }
                          options={[{ value: "1/15", label: "1st & 15th" }]}
                          className="h-10 w-full rounded-lg border border-input bg-background px-2 text-base"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        Tuition Price
                        <Input
                          value={draft.tuitionPriceId}
                          onChange={(event) =>
                            setDraft(team.teamId, {
                              tuitionPriceId: event.target.value,
                            })
                          }
                          placeholder="price_..."
                          className="h-10"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        Fee Price
                        <Input
                          value={draft.feePriceId}
                          onChange={(event) =>
                            setDraft(team.teamId, {
                              feePriceId: event.target.value,
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
                  <TableHead>Description</TableHead>
                  <TableHead>Bill Day</TableHead>
                  <TableHead>Tuition Price</TableHead>
                  <TableHead>Fee Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">{addButton}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => {
                  const draft = drafts[team.teamId] ?? getDefaultDraft(team)

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
                        <textarea
                          value={draft.teamDescription}
                          onChange={(event) =>
                            setDraft(team.teamId, {
                              teamDescription: event.target.value,
                            })
                          }
                          rows={1}
                          placeholder="Team description"
                          className="h-8 min-h-8 min-w-64 resize-y rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        />
                      </TableCell>
                      <TableCell>
                        <SmartSelect
                          value={draft.billingDay}
                          onValueChange={(value) =>
                            setDraft(team.teamId, {
                              billingDay: value,
                            })
                          }
                          options={[{ value: "1/15", label: "1st & 15th" }]}
                          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={draft.tuitionPriceId}
                          onChange={(event) =>
                            setDraft(team.teamId, {
                              tuitionPriceId: event.target.value,
                            })
                          }
                          placeholder="price_..."
                          className="min-w-48"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={draft.feePriceId}
                          onChange={(event) =>
                            setDraft(team.teamId, {
                              feePriceId: event.target.value,
                            })
                          }
                          placeholder="price_..."
                          className="min-w-48"
                        />
                      </TableCell>
                      <TableCell>
                        {isReady(draft) ? (
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

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleAddSubmit}>
            <DialogHeader>
              <DialogTitle>Add Cheer Billing</DialogTitle>
              <DialogDescription>
                Create billing settings for a new cheer team.
              </DialogDescription>
            </DialogHeader>
            <div className="my-6 grid gap-4">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Team</span>
                <Input
                  value={newTeamDraft.teamName}
                  onChange={(event) =>
                    setNewTeamDraft((current) => ({
                      ...current,
                      teamName: event.target.value,
                    }))
                  }
                  placeholder="New cheer team"
                  autoFocus
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Type</span>
                <Input
                  value={newTeamDraft.teamType}
                  onChange={(event) =>
                    setNewTeamDraft((current) => ({
                      ...current,
                      teamType: event.target.value,
                    }))
                  }
                  placeholder="Level, division, or team type"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Description</span>
                <textarea
                  value={newTeamDraft.teamDescription}
                  onChange={(event) =>
                    setNewTeamDraft((current) => ({
                      ...current,
                      teamDescription: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Describe this team"
                  className="min-h-24 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Bill Day</span>
                <SmartSelect
                  value={newTeamDraft.billingDay}
                  onValueChange={(value) =>
                    setNewTeamDraft((current) => ({
                      ...current,
                      billingDay: value,
                    }))
                  }
                  options={[{ value: "1/15", label: "1st & 15th" }]}
                  className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Tuition Price</span>
                <Input
                  value={newTeamDraft.tuitionPriceId}
                  onChange={(event) =>
                    setNewTeamDraft((current) => ({
                      ...current,
                      tuitionPriceId: event.target.value,
                    }))
                  }
                  placeholder="price_..."
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Fee Price</span>
                <Input
                  value={newTeamDraft.feePriceId}
                  onChange={(event) =>
                    setNewTeamDraft((current) => ({
                      ...current,
                      feePriceId: event.target.value,
                    }))
                  }
                  placeholder="price_..."
                />
              </label>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={busyId === "new-cheer-team"}>
                <Plus />
                {busyId === "new-cheer-team" ? "Adding" : "Add Team"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
