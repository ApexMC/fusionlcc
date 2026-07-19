"use client"

import * as React from "react"
import { ChevronDown, Save } from "lucide-react"
import { useRouter } from "next/navigation"

import { updateClassBillingConfig } from "@/app/actions/enrollments"
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
import type { ClassBillingRecord } from "@/lib/account/types"

type Draft = {
  className: string
  classType: string
  programType: string
  billingDay: number
  stripePriceId: string
}

function getDefaultDraft(classRecord: ClassBillingRecord): Draft {
  return {
    className: classRecord.className,
    classType: classRecord.classType ?? "",
    programType: classRecord.programType ?? "gymnastics",
    billingDay:
      classRecord.billingDay === 1 || classRecord.billingDay === 15
        ? classRecord.billingDay
        : classRecord.programType === "competitive_cheer"
          ? 1
          : 15,
    stripePriceId: classRecord.stripePriceId ?? "",
  }
}

function getBlankDraft(): Draft {
  return {
    className: "",
    classType: "",
    programType: "gymnastics",
    billingDay: 15,
    stripePriceId: "",
  }
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
  const [newClassDraft, setNewClassDraft] =
    React.useState<Draft>(getBlankDraft)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [expandedBillingCardId, setExpandedBillingCardId] =
    React.useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  function setDraft(classId: string, draft: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [classId]: {
        ...(current[classId] ?? {
          className: "",
          classType: "",
          programType: "gymnastics",
          billingDay: 15,
          stripePriceId: "",
        }),
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
        setExpandedBillingCardId(null)
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

  const isNewClassExpanded = expandedBillingCardId === "new-class"

  return (
    <Card className="w-full bg-white dark:bg-black">
      <CardHeader>
        <CardTitle>Program Billing</CardTitle>
      </CardHeader>
      <CardContent className="max-h-[min(42rem,75svh)] min-h-0 overflow-y-auto overscroll-contain pr-3 [scrollbar-gutter:stable]">
        <div className="space-y-3 md:hidden">
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">Add Class</div>
                <div className="text-xs text-muted-foreground">
                  Create billing settings for a new program.
                </div>
              </div>
              <Badge variant="outline">new</Badge>
            </div>
            <Button
              type="button"
              size="lg"
              variant={isNewClassExpanded ? "secondary" : "outline"}
              className="mt-3 h-10 w-full justify-between"
              aria-expanded={isNewClassExpanded}
              onClick={() =>
                setExpandedBillingCardId((current) =>
                  current === "new-class" ? null : "new-class"
                )
              }
            >
              {isNewClassExpanded ? "Hide Details" : "View Details"}
              <ChevronDown
                className={
                  isNewClassExpanded
                    ? "rotate-180 transition-transform"
                    : "transition-transform"
                }
              />
            </Button>
            {isNewClassExpanded ? (
              <div className="mt-3 grid gap-3">
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Class
                  <Input
                    value={newClassDraft.className}
                    onChange={(event) =>
                      setNewClassDraft((current) => ({
                        ...current,
                        className: event.target.value,
                      }))
                    }
                    placeholder="New class name"
                    className="h-10"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Type
                  <Input
                    value={newClassDraft.classType}
                    onChange={(event) =>
                      setNewClassDraft((current) => ({
                        ...current,
                        classType: event.target.value,
                      }))
                    }
                    placeholder="Class type"
                    className="h-10"
                  />
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                    Program
                    <select
                      value={newClassDraft.programType}
                      onChange={(event) => {
                        const programType = event.target.value
                        setNewClassDraft((current) => ({
                          ...current,
                          programType,
                          billingDay:
                            programType === "competitive_cheer" ? 1 : 15,
                        }))
                      }}
                      className="h-10 w-full rounded-lg border border-input bg-background px-2 text-base"
                    >
                      <option value="gymnastics">Gymnastics</option>
                      <option value="competitive_cheer">
                        Competitive cheer
                      </option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                    Bill Day
                    <select
                      value={newClassDraft.billingDay}
                      onChange={(event) =>
                        setNewClassDraft((current) => ({
                          ...current,
                          billingDay: Number(event.target.value),
                        }))
                      }
                      className="h-10 w-full rounded-lg border border-input bg-background px-2 text-base"
                    >
                      <option value={1}>1st</option>
                      <option value={15}>15th</option>
                    </select>
                  </label>
                </div>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Stripe Price
                  <Input
                    value={newClassDraft.stripePriceId}
                    onChange={(event) =>
                      setNewClassDraft((current) => ({
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
                  disabled={busyId === "new-class"}
                  onClick={() => saveClass(null)}
                >
                  <Save />
                  {busyId === "new-class" ? "Saving" : "Add Class"}
                </Button>
              </div>
            ) : null}
          </div>
          {classes.map((classRecord) => {
            const draft =
              drafts[classRecord.classId] ?? getDefaultDraft(classRecord)
            const isExpanded =
              expandedBillingCardId === classRecord.classId
            const ready =
              Boolean(draft.className) &&
              Boolean(draft.programType) &&
              Boolean(draft.billingDay) &&
              Boolean(draft.stripePriceId)

            return (
              <div key={classRecord.classId} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {draft.className || "Unnamed class"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {draft.programType.replace(/_/g, " ")}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">Bills on {draft.billingDay}th</div>
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
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        Program
                        <select
                          value={draft.programType}
                          onChange={(event) => {
                            const programType = event.target.value
                            setDraft(classRecord.classId, {
                              programType,
                              billingDay:
                                programType === "competitive_cheer" ? 1 : 15,
                            })
                          }}
                          className="h-10 w-full rounded-lg border border-input bg-background px-2 text-base"
                        >
                          <option value="gymnastics">Gymnastics</option>
                          <option value="competitive_cheer">
                            Competitive cheer
                          </option>
                        </select>
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
                    </div>
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
              <TableHead>Program</TableHead>
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
                  value={newClassDraft.className}
                  onChange={(event) =>
                    setNewClassDraft((current) => ({
                      ...current,
                      className: event.target.value,
                    }))
                  }
                  placeholder="New class name"
                  className="min-w-48"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={newClassDraft.classType}
                  onChange={(event) =>
                    setNewClassDraft((current) => ({
                      ...current,
                      classType: event.target.value,
                    }))
                  }
                  placeholder="Class type"
                  className="min-w-40"
                />
              </TableCell>
              <TableCell>
                <select
                  value={newClassDraft.programType}
                  onChange={(event) => {
                    const programType = event.target.value
                    setNewClassDraft((current) => ({
                      ...current,
                      programType,
                      billingDay:
                        programType === "competitive_cheer" ? 1 : 15,
                    }))
                  }}
                  className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                >
                  <option value="gymnastics">Gymnastics</option>
                  <option value="competitive_cheer">Competitive cheer</option>
                </select>
              </TableCell>
              <TableCell>
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
              </TableCell>
              <TableCell>
                <Input
                  value={newClassDraft.stripePriceId}
                  onChange={(event) =>
                    setNewClassDraft((current) => ({
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
                    disabled={busyId === "new-class"}
                    onClick={() => saveClass(null)}
                  >
                    <Save />
                    {busyId === "new-class" ? "Saving" : "Add"}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
            {classes.map((classRecord) => {
              const draft =
                drafts[classRecord.classId] ?? getDefaultDraft(classRecord)
              const ready =
                Boolean(draft.className) &&
                Boolean(draft.programType) &&
                Boolean(draft.billingDay) &&
                Boolean(draft.stripePriceId)

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
                    <select
                      value={draft.programType}
                      onChange={(event) => {
                        const programType = event.target.value
                        setDraft(classRecord.classId, {
                          programType,
                          billingDay:
                            programType === "competitive_cheer" ? 1 : 15,
                        })
                      }}
                      className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                    >
                      <option value="gymnastics">Gymnastics</option>
                      <option value="competitive_cheer">
                        Competitive cheer
                      </option>
                    </select>
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
                        disabled={
                          busyId === classRecord.classId
                        }
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
  )
}
