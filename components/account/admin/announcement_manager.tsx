"use client"

import * as React from "react"
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import {
  deleteAnnouncement,
  saveAnnouncement,
} from "@/app/actions/announcements"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"
import type { Announcement } from "@/lib/announcements"

const maximumAnnouncementLength = 500

function formatCreatedAt(value: string | null) {
  if (!value) {
    return "Date unavailable"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function AnnouncementTextarea({
  id,
  value,
  onChange,
  autoFocus,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Message</Label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maximumAnnouncementLength}
        rows={3}
        autoFocus={autoFocus}
        required
        placeholder="Share a schedule update, registration reminder, or gym news…"
        className="min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
      />
      <p className="text-right text-xs text-muted-foreground">
        {value.length.toLocaleString()} / {maximumAnnouncementLength}
      </p>
    </div>
  )
}

export function AnnouncementManager({
  announcements,
}: {
  announcements: Announcement[]
}) {
  const [newAnnouncementText, setNewAnnouncementText] = React.useState("")
  const [announcementToEdit, setAnnouncementToEdit] =
    React.useState<Announcement | null>(null)
  const [editText, setEditText] = React.useState("")
  const [announcementToDelete, setAnnouncementToDelete] =
    React.useState<Announcement | null>(null)
  const [isCreating, setIsCreating] = React.useState(false)
  const [isSavingEdit, setIsSavingEdit] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  async function publishAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsCreating(true)

    try {
      const result = await saveAnnouncement({
        announcementText: newAnnouncementText,
      })

      if (!result.ok) {
        toast({
          title: "Announcement was not published",
          description: result.message,
          variant: "error",
        })
        return
      }

      setNewAnnouncementText("")
      toast({
        title: "Announcement published",
        description: "It is now included in the site-wide rotation.",
        variant: "success",
      })
      router.refresh()
    } catch (error) {
      toast({
        title: "Announcement was not published",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setIsCreating(false)
    }
  }

  function openEditDialog(announcement: Announcement) {
    setAnnouncementToEdit(announcement)
    setEditText(announcement.announcementText)
  }

  async function updateAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!announcementToEdit) {
      return
    }

    setIsSavingEdit(true)

    try {
      const result = await saveAnnouncement({
        announcementId: announcementToEdit.announcementId,
        announcementText: editText,
      })

      if (!result.ok) {
        toast({
          title: "Announcement was not updated",
          description: result.message,
          variant: "error",
        })
        return
      }

      setAnnouncementToEdit(null)
      toast({
        title: "Announcement updated",
        description: "The banner now uses the revised message.",
        variant: "success",
      })
      router.refresh()
    } catch (error) {
      toast({
        title: "Announcement was not updated",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function confirmDelete() {
    if (!announcementToDelete) {
      return
    }

    setDeletingId(announcementToDelete.announcementId)

    try {
      const result = await deleteAnnouncement(
        announcementToDelete.announcementId
      )

      if (!result.ok) {
        toast({
          title: "Announcement was not deleted",
          description: result.message,
          variant: "error",
        })
        return
      }

      setAnnouncementToDelete(null)
      toast({
        title: "Announcement deleted",
        description: "It has been removed from the site-wide rotation.",
        variant: "success",
      })
      router.refresh()
    } catch (error) {
      toast({
        title: "Announcement was not deleted",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card className="w-full bg-white dark:bg-black">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Banner Messages</CardTitle>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Every message below appears in the announcement bar, oldest first.
          </p>
        </div>
        <div className="rounded-lg border bg-background p-2 text-foreground shadow-sm">
          <Megaphone className="size-5" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          onSubmit={publishAnnouncement}
          className="grid gap-3 rounded-lg border bg-muted/40 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Add an announcement</h2>
              <p className="text-xs text-muted-foreground">
                New messages join the end of the rotation.
              </p>
            </div>
            <Badge variant="outline">
              {announcements.length.toLocaleString()} active
            </Badge>
          </div>
          <AnnouncementTextarea
            id="new-announcement"
            value={newAnnouncementText}
            onChange={setNewAnnouncementText}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isCreating || !newAnnouncementText.trim()}
            >
              <Plus />
              {isCreating ? "Publishing…" : "Publish announcement"}
            </Button>
          </div>
        </form>

        {announcements.length ? (
          <div className="space-y-3">
            {announcements.map((announcement, index) => (
              <article
                key={announcement.announcementId}
                className="rounded-lg border bg-background p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="wrap-break-word text-sm font-medium leading-6">
                      {announcement.announcementText}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Added {formatCreatedAt(announcement.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Edit announcement"
                      onClick={() => openEditDialog(announcement)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete announcement"
                      onClick={() => setAnnouncementToDelete(announcement)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Megaphone className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 font-medium">The announcement bar is hidden</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Publish the first message to show it across the site.
            </p>
          </div>
        )}
      </CardContent>

      <Dialog
        open={Boolean(announcementToEdit)}
        onOpenChange={(open) => !open && setAnnouncementToEdit(null)}
      >
        <DialogContent>
          <form onSubmit={updateAnnouncement} className="contents">
            <DialogHeader>
              <DialogTitle>Edit announcement</DialogTitle>
              <DialogDescription>
                Changes appear in the banner as soon as you save.
              </DialogDescription>
            </DialogHeader>
            <AnnouncementTextarea
              id="edit-announcement"
              value={editText}
              onChange={setEditText}
              autoFocus
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAnnouncementToEdit(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingEdit || !editText.trim()}
              >
                {isSavingEdit ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(announcementToDelete)}
        onOpenChange={(open) => !open && setAnnouncementToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete announcement?</DialogTitle>
            <DialogDescription>
              This removes the message from the site-wide rotation immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-3 text-sm leading-6">
            {announcementToDelete?.announcementText}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAnnouncementToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                !announcementToDelete ||
                deletingId === announcementToDelete.announcementId
              }
              onClick={confirmDelete}
            >
              {announcementToDelete &&
              deletingId === announcementToDelete.announcementId
                ? "Deleting…"
                : "Delete announcement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
