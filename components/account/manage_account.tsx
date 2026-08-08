"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Pencil } from "lucide-react"

import { updateOwnParentProfile } from "@/app/actions/parents"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ManageAccountCard({
  phone,
  address,
  city,
  state,
  zip_code,
}: {
  phone?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(event.currentTarget)

    try {
      const result = await updateOwnParentProfile({
        phone: String(form.get("phone") ?? ""),
        address: String(form.get("address") ?? ""),
        city: String(form.get("city") ?? ""),
        state: String(form.get("state") ?? ""),
        zipCode: String(form.get("zip_code") ?? ""),
      })

      if (!result.ok) {
        setError(result.message)
        return
      }

      setOpen(false)
      router.refresh()
    } catch {
      setError("Profile could not be updated. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" aria-label="Edit family profile">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Manage Account</DialogTitle>
            <DialogDescription>Update your account information below.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="my-6 max-h-[50vh] overflow-y-auto no-scrollbar">
            <Field>
              <Label htmlFor="profile-phone">Phone</Label>
              <Input id="profile-phone" name="phone" defaultValue={phone ?? ""} />
            </Field>
            <Field>
              <Label htmlFor="profile-address">Address</Label>
              <Input id="profile-address" name="address" defaultValue={address ?? ""} />
            </Field>
            <Field>
              <Label htmlFor="profile-city">City</Label>
              <Input id="profile-city" name="city" defaultValue={city ?? ""} />
            </Field>
            <Field>
              <Label htmlFor="profile-state">State</Label>
              <Input id="profile-state" name="state" maxLength={2} defaultValue={state ?? ""} />
            </Field>
            <Field>
              <Label htmlFor="profile-zip">Zip Code</Label>
              <Input id="profile-zip" name="zip_code" maxLength={10} defaultValue={zip_code ?? ""} />
            </Field>
          </FieldGroup>
          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving" : "Update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
