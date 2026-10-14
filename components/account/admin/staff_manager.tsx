"use client"

import { useState, type FormEvent } from "react"
import { Trash2, UserRoundPlus } from "lucide-react"
import { useRouter } from "next/navigation"

import { createStaffAccount, deleteCoachAccount } from "@/app/actions/staff"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/toast"
import { formatPhoneNumber } from "@/functions/shared_functions"
import type { CoachAccount } from "@/lib/account/staff"

export function StaffManager({ accounts }: { accounts: CoachAccount[] }) {
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountToDelete, setAccountToDelete] = useState<CoachAccount | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    setIsCreating(true)
    setError(null)

    try {
      const result = await createStaffAccount({
        firstName: values.get("firstName")?.toString() ?? "",
        lastName: values.get("lastName")?.toString() ?? "",
        email: values.get("email")?.toString() ?? "",
        phone: values.get("phone")?.toString() ?? "",
        password: values.get("password")?.toString() ?? "",
      })

      if (!result.ok) {
        setError(result.message)
        return
      }

      form.reset()
      toast({ title: "Staff account created", description: result.message, variant: "success" })
      router.refresh()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Please try again.")
    } finally {
      setIsCreating(false)
    }
  }

  async function handleDelete() {
    if (!accountToDelete || isDeleting) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      const result = await deleteCoachAccount(accountToDelete.userId)

      if (!result.ok) {
        setDeleteError(result.message)
        return
      }

      setAccountToDelete(null)
      toast({ title: "Coach account deleted", description: result.message, variant: "success" })
      router.refresh()
    } catch (caughtError) {
      setDeleteError(caughtError instanceof Error ? caughtError.message : "Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Card className="bg-white dark:bg-black">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRoundPlus className="size-5" />
            Create staff account
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            New staff accounts receive coach access and can sign in immediately.
            No confirmation email is sent. Share the initial password with the
            staff member.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <fieldset disabled={isCreating} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="grid gap-2">
                  <Label htmlFor="staff-first-name">First name</Label>
                  <Input id="staff-first-name" name="firstName" autoComplete="off" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="staff-last-name">Last name</Label>
                  <Input id="staff-last-name" name="lastName" autoComplete="off" required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="staff-email">Email</Label>
                <Input id="staff-email" name="email" type="email" autoComplete="off" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="staff-phone">Phone (optional)</Label>
                <Input id="staff-phone" name="phone" type="tel" autoComplete="off" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="staff-password">Initial password</Label>
                <Input
                  id="staff-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  aria-describedby="staff-password-help"
                  required
                />
                <p id="staff-password-help" className="text-xs text-muted-foreground">
                  Use at least 8 characters. Staff can change their password using
                  the password reset link on the sign-in page.
                </p>
              </div>
              {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" disabled={isCreating} className="w-full">
                {isCreating ? "Creating account…" : "Create staff account"}
              </Button>
            </fieldset>
          </form>
        </CardContent>
      </Card>

      <Card className="min-w-0 bg-white dark:bg-black">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Coach accounts</CardTitle>
          <Badge variant="outline">{accounts.length.toLocaleString()} accounts</Badge>
        </CardHeader>
        <CardContent>
          {accounts.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.userId}>
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell>{account.email ?? "—"}</TableCell>
                    <TableCell>{account.phone ? formatPhoneNumber(account.phone) : "—"}</TableCell>
                    <TableCell><Badge variant="outline">Coach</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={!account.canDelete || isDeleting}
                        aria-label={`Delete ${account.name}'s account`}
                        title={!account.canDelete ? "Owner/admin accounts and your own account cannot be deleted here." : undefined}
                        onClick={() => {
                          setDeleteError(null)
                          setAccountToDelete(account)
                        }}
                      >
                        <Trash2 />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No coach accounts yet. Create a staff account to add your first coach.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(accountToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setAccountToDelete(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent showCloseButton={!isDeleting}>
          <DialogHeader>
            <DialogTitle>Delete coach account?</DialogTitle>
            <DialogDescription>
              This permanently deletes the entire account for {accountToDelete?.name}
              {accountToDelete?.email ? ` (${accountToDelete.email})` : ""}.
              They will no longer be able to sign in. Associated account data may
              also be removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError ? <p role="alert" className="text-sm text-destructive">{deleteError}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => {
                setAccountToDelete(null)
                setDeleteError(null)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting || !accountToDelete}
              onClick={handleDelete}
            >
              {isDeleting ? "Deleting account…" : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
