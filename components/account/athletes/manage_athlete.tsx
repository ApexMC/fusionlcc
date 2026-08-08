"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { saveOwnAthlete } from "@/app/actions/athletes"
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

const shirtSizes = ["YS", "YM", "YL", "YXL", "S", "M", "L", "XL", "2XL"]
const genderOptions = ["Female", "Male", "Other", "Prefer not to say"]

export default function ManageAthleteCard({
  icon,
  athleteId,
  first_name,
  last_name,
  phone,
  dob,
  shirt_size,
  gender,
}: {
  icon: React.ReactNode
  athleteId?: number
  first_name?: string
  last_name?: string
  phone?: string
  dob?: string
  shirt_size?: string
  gender?: string
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
      const result = await saveOwnAthlete({
        athleteId: athleteId ? String(athleteId) : null,
        firstName: String(form.get("first_name") ?? ""),
        lastName: String(form.get("last_name") ?? ""),
        phone: String(form.get("phone") ?? ""),
        dob: String(form.get("dob") ?? ""),
        shirtSize: String(form.get("shirt_size") ?? ""),
        gender: String(form.get("gender") ?? ""),
      })

      if (!result.ok) {
        setError(result.message)
        return
      }

      setOpen(false)
      router.refresh()
    } catch {
      setError("Athlete could not be saved. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className={athleteId ? undefined : "bg-purple-500 text-white hover:bg-purple-600"}
          type="button"
          variant={athleteId ? "outline" : "default"}
          aria-label={athleteId ? "Edit athlete" : undefined}
        >
          {icon}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{athleteId ? "Edit Athlete" : "Add Athlete"}</DialogTitle>
            <DialogDescription>
              {athleteId
                ? "Update this athlete's information."
                : "Add an athlete to your family account."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="my-6 max-h-[70vh] overflow-y-auto no-scrollbar">
            <Field>
              <Label htmlFor={`athlete-first-${athleteId ?? "new"}`}>First Name</Label>
              <Input
                id={`athlete-first-${athleteId ?? "new"}`}
                name="first_name"
                required
                maxLength={100}
                defaultValue={first_name ?? ""}
              />
            </Field>
            <Field>
              <Label htmlFor={`athlete-last-${athleteId ?? "new"}`}>Last Name</Label>
              <Input
                id={`athlete-last-${athleteId ?? "new"}`}
                name="last_name"
                required
                maxLength={100}
                defaultValue={last_name ?? ""}
              />
            </Field>
            <Field>
              <Label htmlFor={`athlete-gender-${athleteId ?? "new"}`}>Gender</Label>
              <select
                id={`athlete-gender-${athleteId ?? "new"}`}
                name="gender"
                defaultValue={gender ?? ""}
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">Select gender</option>
                {genderOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </Field>
            <Field>
              <Label htmlFor={`athlete-phone-${athleteId ?? "new"}`}>Phone</Label>
              <Input
                id={`athlete-phone-${athleteId ?? "new"}`}
                name="phone"
                type="tel"
                maxLength={30}
                defaultValue={phone ?? ""}
              />
            </Field>
            <Field>
              <Label htmlFor={`athlete-dob-${athleteId ?? "new"}`}>Date of Birth</Label>
              <Input
                id={`athlete-dob-${athleteId ?? "new"}`}
                name="dob"
                type="date"
                defaultValue={dob ?? ""}
              />
            </Field>
            <Field>
              <Label htmlFor={`athlete-shirt-${athleteId ?? "new"}`}>Shirt Size</Label>
              <select
                id={`athlete-shirt-${athleteId ?? "new"}`}
                name="shirt_size"
                defaultValue={shirt_size ?? ""}
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">Select size</option>
                {shirtSizes.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </Field>
          </FieldGroup>
          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving" : athleteId ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
