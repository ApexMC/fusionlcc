"use client"

import * as React from "react"
import { MoreHorizontal } from "lucide-react"

import { deleteParent, updateParent } from "@/app/actions/parents"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"
import type { Parent } from "@/components/account/parents/columns"

type DialogMode = "view" | "edit" | "delete" | null

function valueText(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Not set"
  }

  return String(value)
}

function balanceText(value: Parent["balance"]) {
  if (typeof value === "number") {
    return value.toFixed(2)
  }

  return value?.replace("$", "") ?? ""
}

export function ParentActions({ parent }: { parent: Parent }) {
  const [mode, setMode] = React.useState<DialogMode>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const { toast } = useToast()

  async function submitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(event.currentTarget)

    try {
      const result = await updateParent({
        parentId: String(parent.parent_id),
        firstName: String(form.get("first_name") ?? ""),
        lastName: String(form.get("last_name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        address: String(form.get("address") ?? ""),
        city: String(form.get("city") ?? ""),
        state: String(form.get("state") ?? ""),
        zipCode: String(form.get("zip_code") ?? ""),
        balance: String(form.get("balance") ?? ""),
      })

      if (!result.ok) {
        setError(result.message)
        toast({
          title: "Parent update failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: "Parent updated",
        description: result.message,
        variant: "success",
      })
      setMode(null)
      window.location.reload()
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Please try again."
      setError(message)
      toast({
        title: "Parent update failed",
        description: message,
        variant: "error",
      })
    } finally {
      setLoading(false)
    }
  }

  async function submitDelete() {
    setLoading(true)
    setError(null)

    try {
      const result = await deleteParent(String(parent.parent_id))

      if (!result.ok) {
        setError(result.message)
        toast({
          title: "Parent delete failed",
          description: result.message,
          variant: "error",
        })
        return
      }

      toast({
        title: "Parent deleted",
        description: result.message,
        variant: "success",
      })
      setMode(null)
      window.location.reload()
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Please try again."
      setError(message)
      toast({
        title: "Parent delete failed",
        description: message,
        variant: "error",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setMode("view")}>
            View information
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMode("edit")}>
            Edit parent
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setMode("delete")}>
            Delete parent
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={mode === "view"} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {valueText(parent.first_name)} {valueText(parent.last_name)}
            </DialogTitle>
            <DialogDescription>Parent account information</DialogDescription>
          </DialogHeader>
          <dl className="grid gap-3 text-sm">
            {[
              ["Parent ID", parent.parent_id],
              ["User ID", parent.user_id],
              ["Email", parent.email],
              ["Phone", parent.phone],
              ["Balance", parent.balance],
              ["Address", parent.address],
              ["City", parent.city],
              ["State", parent.state],
              ["Zip", parent.zip_code],
              ["Stripe customer", parent.stripe_customer_id],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right">{valueText(value)}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === "edit"} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submitEdit}>
            <DialogHeader>
              <DialogTitle>Edit Parent</DialogTitle>
              <DialogDescription>
                Update contact, address, and account balance.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="my-6 max-h-[55vh] overflow-y-auto">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field>
                  <Label htmlFor={`first_name-${parent.parent_id}`}>
                    First name
                  </Label>
                  <Input
                    id={`first_name-${parent.parent_id}`}
                    name="first_name"
                    defaultValue={parent.first_name ?? ""}
                  />
                </Field>
                <Field>
                  <Label htmlFor={`last_name-${parent.parent_id}`}>
                    Last name
                  </Label>
                  <Input
                    id={`last_name-${parent.parent_id}`}
                    name="last_name"
                    defaultValue={parent.last_name ?? ""}
                  />
                </Field>
              </div>
              <Field>
                <Label htmlFor={`email-${parent.parent_id}`}>Email</Label>
                <Input
                  id={`email-${parent.parent_id}`}
                  name="email"
                  defaultValue={parent.email ?? ""}
                />
              </Field>
              <Field>
                <Label htmlFor={`phone-${parent.parent_id}`}>Phone</Label>
                <Input
                  id={`phone-${parent.parent_id}`}
                  name="phone"
                  defaultValue={parent.phone ?? ""}
                />
              </Field>
              <Field>
                <Label htmlFor={`balance-${parent.parent_id}`}>Balance</Label>
                <Input
                  id={`balance-${parent.parent_id}`}
                  name="balance"
                  defaultValue={balanceText(parent.balance)}
                />
              </Field>
              <Field>
                <Label htmlFor={`address-${parent.parent_id}`}>Address</Label>
                <Input
                  id={`address-${parent.parent_id}`}
                  name="address"
                  defaultValue={parent.address ?? ""}
                />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field>
                  <Label htmlFor={`city-${parent.parent_id}`}>City</Label>
                  <Input
                    id={`city-${parent.parent_id}`}
                    name="city"
                    defaultValue={parent.city ?? ""}
                  />
                </Field>
                <Field>
                  <Label htmlFor={`state-${parent.parent_id}`}>State</Label>
                  <Input
                    id={`state-${parent.parent_id}`}
                    name="state"
                    defaultValue={parent.state ?? ""}
                  />
                </Field>
                <Field>
                  <Label htmlFor={`zip_code-${parent.parent_id}`}>Zip</Label>
                  <Input
                    id={`zip_code-${parent.parent_id}`}
                    name="zip_code"
                    defaultValue={parent.zip_code ?? ""}
                  />
                </Field>
              </div>
            </FieldGroup>
            {error ? <div className="mb-3 text-sm text-red-600">{error}</div> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMode(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === "delete"} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Parent</DialogTitle>
            <DialogDescription>
              Delete {valueText(parent.first_name)} {valueText(parent.last_name)}
              {" "}from customer accounts. Existing athlete or enrollment links may prevent deletion.
            </DialogDescription>
          </DialogHeader>
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={loading}
              onClick={submitDelete}
            >
              {loading ? "Deleting" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
