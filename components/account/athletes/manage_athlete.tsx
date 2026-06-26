"use client"

import { Field, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

export default function ManageAthleteCard({
    icon
    ,userId
    ,athleteId
    ,first_name
    ,last_name
    ,phone
    ,dob
    ,shirt_size
    }: 
    {icon: React.ReactNode
    ,userId: string
    ,athleteId?: number
    ,first_name?: string
    ,last_name?: string
    ,phone?: string
    ,dob?: string
    ,shirt_size?: string}
    ) {
    const supabase = createClient()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [shirtSize, setShirtSize] = useState<string | undefined>(shirt_size)
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
    const shirt_size = shirtSize ?? ""
    const user_id = userId

    const { data, error } = athleteId ? await supabase
      .from("Athletes")
      .upsert([{
        athlete_id: athleteId ?? undefined
        ,first_name
        ,last_name
        ,phone
        ,dob
        ,shirt_size
        ,user_id 
      }])
      :
        await supabase
        .from("Athletes")
        .insert([{
          first_name
          ,last_name
          ,phone
          ,dob
          ,shirt_size
          ,user_id 
        }])

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
                <Button className={athleteId ? "bg-transparent hover:bg-zinc-300 text-white font-bold" : "bg-purple-500 dark:bg-purple-500 dark:hover:bg-purple-600 hover:bg-purple-600 text-white font-bold"} type="button" variant="outline">{icon}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
                <form onSubmit={handleSubmit}>
                <DialogHeader>
                    <DialogTitle>
                        {athleteId ? "Edit Athlete" : "Add Athlete"}
                    </DialogTitle>
                    <DialogDescription>
                    {athleteId ? null : "Add a new athlete to your account. You are only billed for athletes currently enrolled in classes or cheer."}
                    </DialogDescription>
                </DialogHeader>
                <FieldGroup className="mb-6 no-scrollbar max-h-[50vh] overflow-y-auto mt-6">
                    <Field>
                    <Label htmlFor="first-name-1">First Name</Label>
                    <Input id="first-name-1" name="first_name" defaultValue={first_name ?? ""} placeholder="Jane"/>
                    </Field>
                    <Field>
                    <Label htmlFor="last-name-1">Last Name</Label>
                    <Input id="last-name-1" name="last_name" defaultValue={last_name ?? ""} placeholder="Doe"/>
                    </Field>
                    <Field>
                    <Label htmlFor="phone-1">Phone</Label>
                    <Input id="phone-1" name="phone" defaultValue={phone ?? ""} placeholder="(123) 456-7890"/>
                    </Field>
                    <Field>
                    <Label htmlFor="dob-1">Date of Birth</Label>
                    <Input id="dob-1" name="dob" type="date" defaultValue={dob ?? ""} placeholder="MM/DD/YYYY"/>
                    </Field>
                    <Field>
                    <Label htmlFor="shirt-1">Shirt Size</Label>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">{shirtSize ?? "Select Size"}</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuGroup>
                                <DropdownMenuItem onClick={() => setShirtSize("S")}>S</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setShirtSize("M")}>M</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setShirtSize("L")}>L</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setShirtSize("XL")}>XL</DropdownMenuItem>
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    </Field>
                </FieldGroup>
                {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
                <DialogFooter>
                    <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={loading}>
                        {loading ? "Loading..." : athleteId ? "Update" : "Add"}
                    </Button>
                </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}