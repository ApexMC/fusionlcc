"use client"

import * as React from "react"
import { Save } from "lucide-react"
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

  return (
    <Card className="w-full bg-white dark:bg-black">
      <CardHeader>
        <CardTitle>Class Billing Setup</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-125 overflow-auto rounded-md border">
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
