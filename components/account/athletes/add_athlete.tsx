"use client"

import { Field, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button";
import createClient from "@/lib/supabase/client"
import { useState } from "react"
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

export default function AddAthleteCard({userId}: {userId: string}) {
    const supabase = createClient()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const first_name = form.get("first_name")?.toString() ?? ""
    const last_name = form.get("last_name")?.toString() ?? ""
    const phone = form.get("phone")?.toString() ?? ""
    const dob = form.get("dob")?.toString() ?? ""
    const shirt_size = form.get("shirt")?.toString() ?? ""
    const user_id = userId

    const { data, error } = await supabase
      .from("Athletes")
      .insert([{ first_name, last_name, phone, dob, shirt_size, user_id }])

    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }

    // close dialog and refresh current route so lists update
    setOpen(false)
    window.location.reload()
  }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button className="bg-purple-500 dark:bg-purple-500 dark:hover:bg-purple-600 hover:bg-purple-600 text-white font-bold" type="button" variant="outline">+</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
                <form onSubmit={handleSubmit}>
                <DialogHeader>
                    <DialogTitle>Add Athlete</DialogTitle>
                    <DialogDescription>
                    Add a new athlete to your account. You are only billed for athletes currently enrolled in classes or cheer.
                    </DialogDescription>
                </DialogHeader>
                <FieldGroup className="mb-6 no-scrollbar max-h-[50vh] overflow-y-auto mt-6">
                    <Field>
                    <Label htmlFor="first-name-1">First Name</Label>
                    <Input id="first-name-1" name="first_name" defaultValue="" placeholder="Jane"/>
                    </Field>
                    <Field>
                    <Label htmlFor="last-name-1">Last Name</Label>
                    <Input id="last-name-1" name="last_name" defaultValue="" placeholder="Doe"/>
                    </Field>
                    <Field>
                    <Label htmlFor="phone-1">Phone</Label>
                    <Input id="phone-1" name="phone" defaultValue="" placeholder="(123) 456-7890"/>
                    </Field>
                    <Field>
                    <Label htmlFor="dob-1">Date of Birth</Label>
                    <Input id="dob-1" name="dob" defaultValue="" placeholder="MM/DD/YYYY"/>
                    </Field>
                    <Field>
                    <Label htmlFor="shirt-1">Shirt Size</Label>
                    <Input id="shirt-1" name="shirt" defaultValue="" placeholder="M" />
                    </Field>
                </FieldGroup>
                {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
                <DialogFooter>
                    <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={loading}>
                        {loading ? "Adding…" : "Add"}
                    </Button>
                </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}