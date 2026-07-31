"use client"

import * as React from "react"
import { Pencil, Save } from "lucide-react"
import { useRouter } from "next/navigation"

import { updateCoachTimeClockEntry } from "@/app/actions/time-clock"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"
import type { CoachTimeClockEntry } from "@/lib/account/types"

type PunchDraft = {
  clockInAt: string
  clockOutAt: string
  clockInNote: string
  clockOutNote: string
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0")
}

function toLocalDateTimeInput(value: string | null) {
  if (!value) {
    return ""
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join("-") +
    `T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`
}

function toIsoDateTime(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const date = new Date(trimmed)

  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function getDraftFromEntry(entry: CoachTimeClockEntry): PunchDraft {
  return {
    clockInAt: toLocalDateTimeInput(entry.clockInAt),
    clockOutAt: toLocalDateTimeInput(entry.clockOutAt),
    clockInNote: entry.clockInNote ?? "",
    clockOutNote: entry.clockOutNote ?? "",
  }
}

export function isPendingTimeClockStatus(status: string) {
  return status.trim().toLowerCase() === "pending"
}

export function TimeClockEntryEditDialog({
  entry,
  status = entry.status,
  disabled = false,
  iconOnly = false,
  onSaved,
}: {
  entry: CoachTimeClockEntry
  status?: string
  disabled?: boolean
  iconOnly?: boolean
  onSaved?: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<PunchDraft>(() =>
    getDraftFromEntry(entry)
  )
  const [saving, setSaving] = React.useState(false)
  const canEdit = isPendingTimeClockStatus(status)
  const router = useRouter()
  const { toast } = useToast()
  const id = React.useId()

  function updateDraft(field: keyof PunchDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setOpen(false)
      return
    }

    if (canEdit && !disabled) {
      setDraft(getDraftFromEntry(entry))
      setOpen(true)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (disabled || !canEdit) {
      toast({
        title: "Punch locked",
        description: "Only pending time punches can be edited.",
        variant: "error",
      })
      return
    }

    const clockInAt = toIsoDateTime(draft.clockInAt)
    const clockOutAt = draft.clockOutAt.trim()
      ? toIsoDateTime(draft.clockOutAt)
      : null

    if (!clockInAt) {
      toast({
        title: "Punch not saved",
        description: "Enter a valid clock-in time.",
        variant: "error",
      })
      return
    }

    if (draft.clockOutAt.trim() && !clockOutAt) {
      toast({
        title: "Punch not saved",
        description: "Enter a valid clock-out time.",
        variant: "error",
      })
      return
    }

    if (clockOutAt && Date.parse(clockOutAt) < Date.parse(clockInAt)) {
      toast({
        title: "Punch not saved",
        description: "Clock-out time cannot be before clock-in time.",
        variant: "error",
      })
      return
    }

    setSaving(true)

    try {
      const result = await updateCoachTimeClockEntry({
        entryId: entry.entryId,
        clockInAt,
        clockOutAt,
        clockInNote: draft.clockInNote,
        clockOutNote: draft.clockOutNote,
      })

      if (!result.ok) {
        toast({
          title: "Punch not saved",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: "Punch saved",
        description: result.message,
        variant: "success",
      })
      setOpen(false)
      onSaved?.()
      router.refresh()
    } catch (error) {
      toast({
        title: "Punch not saved",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size={iconOnly ? "icon-sm" : "sm"}
          variant="outline"
          disabled={disabled || !canEdit}
          title={canEdit ? "Edit punch" : "Punch is locked"}
        >
          <Pencil />
          <span className={iconOnly ? "sr-only" : undefined}>Edit</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit Punch</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-clock-in`}>Clock In</Label>
              <Input
                id={`${id}-clock-in`}
                type="datetime-local"
                step={60}
                value={draft.clockInAt}
                onChange={(event) =>
                  updateDraft("clockInAt", event.target.value)
                }
                disabled={saving}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-clock-out`}>Clock Out</Label>
              <Input
                id={`${id}-clock-out`}
                type="datetime-local"
                step={60}
                value={draft.clockOutAt}
                onChange={(event) =>
                  updateDraft("clockOutAt", event.target.value)
                }
                disabled={saving}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-clock-in-note`}>Clock-In Note</Label>
              <Input
                id={`${id}-clock-in-note`}
                value={draft.clockInNote}
                onChange={(event) =>
                  updateDraft("clockInNote", event.target.value)
                }
                disabled={saving}
                maxLength={500}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-clock-out-note`}>Clock-Out Note</Label>
              <Input
                id={`${id}-clock-out-note`}
                value={draft.clockOutNote}
                onChange={(event) =>
                  updateDraft("clockOutNote", event.target.value)
                }
                disabled={saving}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving || !canEdit}>
              <Save />
              {saving ? "Saving" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
