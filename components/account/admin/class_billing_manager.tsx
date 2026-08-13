"use client"

import * as React from "react"
import { ChevronDown, Plus, Save } from "lucide-react"
import { useRouter } from "next/navigation"

import { updateClassBillingConfig } from "@/app/actions/enrollments"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/toast"
import type { ClassBillingRecord } from "@/lib/account/types"

type Draft = {
  className: string
  classType: string
  classDescription: string
  programType: string
  billingDay: number
  stripePriceId: string
}

function getDefaultDraft(classRecord: ClassBillingRecord): Draft {
  return {
    className: classRecord.className,
    classType: classRecord.classType ?? "",
    classDescription: classRecord.classDescription ?? "",
    programType: classRecord.programType ?? "gymnastics",
    billingDay: classRecord.billingDay ?? 15,
    stripePriceId: classRecord.stripePriceId ?? "",
  }
}

function getBlankDraft(): Draft {
  return {
    className: "",
    classType: "",
    classDescription: "",
    programType: "gymnastics",
    billingDay: 15,
    stripePriceId: "",
  }
}

function isReady(draft: Draft) {
  return Boolean(draft.className && draft.billingDay && draft.stripePriceId)
}

export function ClassBillingManager({
  classes,
}: {
  classes: ClassBillingRecord[]
}) {
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      classes.map((classRecord) => [
        classRecord.classId,
        getDefaultDraft(classRecord),
      ])
    )
  )
  const [newClassDraft, setNewClassDraft] = React.useState<Draft>(getBlankDraft)
  const [addDialogOpen, setAddDialogOpen] = React.useState(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [expandedBillingCardId, setExpandedBillingCardId] =
    React.useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  function setDraft(classId: string, draft: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [classId]: {
        ...(current[classId] ?? getBlankDraft()),
        ...draft,
      },
    }))
  }

  async function saveClass(classRecord: ClassBillingRecord | null) {
    const draft = classRecord
      ? drafts[classRecord.classId] ?? getDefaultDraft(classRecord)
      : newClassDraft

    if (!draft.className.trim()) {
      toast({
        title: "Class name required",
        description: "Add a class name before saving.",
        variant: "error",
      })
      return
    }

    const busyKey = classRecord?.classId ?? "new-class"
    setBusyId(busyKey)

    try {
      const result = await updateClassBillingConfig({
        classId: classRecord?.classId,
        className: draft.className,
        classType: draft.classType,
        classDescription: draft.classDescription,
        programType: draft.programType,
        billingDay: draft.billingDay,
        stripePriceId: draft.stripePriceId,
      })

      if (!result.ok) {
        toast({
          title: "Billing update failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: "Class billing updated",
        description: result.message,
        variant: "success",
      })
      if (!classRecord) {
        setNewClassDraft(getBlankDraft())
        setAddDialogOpen(false)
      }
      router.refresh()
    } catch (error) {
      toast({
        title: "Billing update failed",
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
    void saveClass(null)
  }

  const addButton = (
    <Button type="button" size="sm" onClick={() => setAddDialogOpen(true)}>
      <Plus />
      Add Class
    </Button>
  )

  return (
    <>
      <Card className="w-full bg-white dark:bg-black">
        <CardHeader>
          <CardTitle>Program Billing</CardTitle>
          <CardAction className="md:hidden">{addButton}</CardAction>
        </CardHeader>
        <CardContent className="max-h-[min(55rem,55svh)] min-h-0 overflow-y-auto overscroll-contain pr-3 [scrollbar-gutter:stable]">
          <div className="space-y-3 md:hidden">
            {classes.map((classRecord) => {
              const draft =
                drafts[classRecord.classId] ?? getDefaultDraft(classRecord)
              const isExpanded =
                expandedBillingCardId === classRecord.classId

              return (
                <div key={classRecord.classId} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {draft.className || "Unnamed class"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {draft.classDescription || draft.classType || "No description"}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className="text-right">Bills on {draft.billingDay}th</div>
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
                        current === classRecord.classId
                          ? null
                          : classRecord.classId
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
                        Class
                        <Input
                          value={draft.className}
                          onChange={(event) =>
                            setDraft(classRecord.classId, {
                              className: event.target.value,
                            })
                          }
                          className="h-10"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        Type
                        <Input
                          value={draft.classType}
                          onChange={(event) =>
                            setDraft(classRecord.classId, {
                              classType: event.target.value,
                            })
                          }
                          placeholder="Class type"
                          className="h-10"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        Description
                        <textarea
                          value={draft.classDescription}
                          onChange={(event) =>
                            setDraft(classRecord.classId, {
                              classDescription: event.target.value,
                            })
                          }
                          rows={3}
                          placeholder="Class description"
                          className="min-h-20 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        Bill Day
                        <select
                          value={draft.billingDay}
                          onChange={(event) =>
                            setDraft(classRecord.classId, {
                              billingDay: Number(event.target.value),
                            })
                          }
                          className="h-10 w-full rounded-lg border border-input bg-background px-2 text-base"
                        >
                          <option value={1}>1st</option>
                          <option value={15}>15th</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        Stripe Price
                        <Input
                          value={draft.stripePriceId}
                          onChange={(event) =>
                            setDraft(classRecord.classId, {
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
                        disabled={busyId === classRecord.classId}
                        onClick={() => saveClass(classRecord)}
                      >
                        <Save />
                        {busyId === classRecord.classId ? "Saving" : "Save"}
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
                  <TableHead>Class</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Bill Day</TableHead>
                  <TableHead>Stripe Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">{addButton}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((classRecord) => {
                  const draft =
                    drafts[classRecord.classId] ?? getDefaultDraft(classRecord)

                  return (
                    <TableRow key={classRecord.classId}>
                      <TableCell>
                        <Input
                          value={draft.className}
                          onChange={(event) =>
                            setDraft(classRecord.classId, {
                              className: event.target.value,
                            })
                          }
                          className="min-w-48"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={draft.classType}
                          onChange={(event) =>
                            setDraft(classRecord.classId, {
                              classType: event.target.value,
                            })
                          }
                          placeholder="Class type"
                          className="min-w-40"
                        />
                      </TableCell>
                      <TableCell>
                        <textarea
                          value={draft.classDescription}
                          onChange={(event) =>
                            setDraft(classRecord.classId, {
                              classDescription: event.target.value,
                            })
                          }
                          rows={1}
                          placeholder="Class description"
                          className="h-8 min-h-8 min-w-64 resize-y rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          value={draft.billingDay}
                          onChange={(event) =>
                            setDraft(classRecord.classId, {
                              billingDay: Number(event.target.value),
                            })
                          }
                          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                        >
                          <option value={1}>1st</option>
                          <option value={15}>15th</option>
                        </select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={draft.stripePriceId}
                          onChange={(event) =>
                            setDraft(classRecord.classId, {
                              stripePriceId: event.target.value,
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
                            disabled={busyId === classRecord.classId}
                            onClick={() => saveClass(classRecord)}
                          >
                            <Save />
                            {busyId === classRecord.classId ? "Saving" : "Save"}
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
              <DialogTitle>Add Class Billing</DialogTitle>
              <DialogDescription>
                Create billing settings for a new class.
              </DialogDescription>
            </DialogHeader>
            <div className="my-6 grid gap-4">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Class</span>
                <Input
                  value={newClassDraft.className}
                  onChange={(event) =>
                    setNewClassDraft((current) => ({
                      ...current,
                      className: event.target.value,
                    }))
                  }
                  placeholder="New class name"
                  autoFocus
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Type</span>
                <Input
                  value={newClassDraft.classType}
                  onChange={(event) =>
                    setNewClassDraft((current) => ({
                      ...current,
                      classType: event.target.value,
                    }))
                  }
                  placeholder="Class type"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Description</span>
                <textarea
                  value={newClassDraft.classDescription}
                  onChange={(event) =>
                    setNewClassDraft((current) => ({
                      ...current,
                      classDescription: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Describe this class"
                  className="min-h-24 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Bill Day</span>
                <select
                  value={newClassDraft.billingDay}
                  onChange={(event) =>
                    setNewClassDraft((current) => ({
                      ...current,
                      billingDay: Number(event.target.value),
                    }))
                  }
                  className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                >
                  <option value={1}>1st</option>
                  <option value={15}>15th</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Stripe Price</span>
                <Input
                  value={newClassDraft.stripePriceId}
                  onChange={(event) =>
                    setNewClassDraft((current) => ({
                      ...current,
                      stripePriceId: event.target.value,
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
              <Button type="submit" disabled={busyId === "new-class"}>
                <Plus />
                {busyId === "new-class" ? "Adding" : "Add Class"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
