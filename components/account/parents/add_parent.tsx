"use client"

import { Field, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button";
import { useState } from "react"
import { createParent } from "@/app/actions/parents"
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
import { useToast } from "@/components/ui/toast"
import { Plus } from "lucide-react";

export default function AddParentCard({
    first_name
    ,last_name
    ,email
    ,phone
    ,address
    ,city
    ,state
    ,zip_code
    }: 
    {first_name?: string
    ,last_name?: string
    ,email?: string
    ,phone?: string
    ,address?: string
    ,city?: string
    ,state?: string
    ,zip_code?: string}
    ) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { toast } = useToast()

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const form = new FormData(e.currentTarget)
        const first_name = form.get("first_name")?.toString() ?? ""
        const last_name = form.get("last_name")?.toString() ?? ""
        const email = form.get("email")?.toString() ?? ""
        const phone = form.get("phone")?.toString() ?? ""
        const address = form.get("address")?.toString() ?? ""
        const city = form.get("city")?.toString() ?? ""
        const state = form.get("state")?.toString() ?? ""
        const zip_code = form.get("zip_code")?.toString() ?? ""

        try {
            const result = await createParent({
                firstName: first_name,
                lastName: last_name,
                phone,
                email,
                address,
                city,
                state,
                zipCode: zip_code,
            })

            if (!result.ok) {
                setError(result.message)
                toast({
                    title: "Parent create failed",
                    description: result.message,
                    variant: "error",
                })
                return
            }

            toast({
                title: "Parent created",
                description: result.message,
                variant: "success",
            })
        } catch (caughtError) {
            const message =
                caughtError instanceof Error ? caughtError.message : "Please try again."
            setError(message)
            toast({
                title: "Parent create failed",
                description: message,
                variant: "error",
            })
            return
        } finally {
            setLoading(false)
        }
        setOpen(false)
        window.location.reload()
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-transparent hover:bg-zinc-300 text-white font-bold" type="button" variant="outline"><Plus className="w-4 h-4 text-zinc-500 dark:text-zinc-400" /></Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
                <form onSubmit={handleSubmit}>
                <DialogHeader>
                    <DialogTitle>Add Parent</DialogTitle>
                    <DialogDescription>
                    Add a new parent.
                    </DialogDescription>
                </DialogHeader>
                <FieldGroup className="mb-6 no-scrollbar max-h-[50vh] overflow-y-auto mt-6">
                    <Field>
                        <Label htmlFor="first_name-1">First Name</Label>
                        <Input id="first_name-1" name="first_name" defaultValue={first_name ?? ""} placeholder="First Name"/>
                    </Field>
                    <Field>
                        <Label htmlFor="last_name-1">Last Name</Label>
                        <Input id="last_name-1" name="last_name" defaultValue={last_name ?? ""} placeholder="Last Name"/>
                    </Field>
                    <Field>
                        <Label htmlFor="email-1">Email</Label>
                        <Input id="email-1" name="email" defaultValue={email ?? ""} placeholder="Email"/>
                    </Field>
                    <Field>
                        <Label htmlFor="phone-1">Phone</Label>
                        <Input id="phone-1" name="phone" defaultValue={phone ?? ""} placeholder="(123) 456-7890"/>
                    </Field>
                    <Field>
                        <Label htmlFor="address-1">Address</Label>
                        <Input id="address-1" name="address" defaultValue={address ?? ""} placeholder="123 Main St"/>
                    </Field>
                    <Field>
                        <Label htmlFor="city-1">City</Label>
                        <Input id="city-1" name="city" defaultValue={city ?? ""} placeholder="City"/>
                    </Field>
                    <Field>
                        <Label htmlFor="state-1">State</Label>
                        <Input id="state-1" name="state" defaultValue={state ?? ""} placeholder="State"/>
                    </Field>
                    <Field>
                        <Label htmlFor="zip_code-1">Zip Code</Label>
                        <Input id="zip_code-1" name="zip_code" defaultValue={zip_code ?? ""} placeholder="Zip Code"/>
                    </Field>
                </FieldGroup>
                {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
                <DialogFooter>
                    <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={loading}>
                        {loading ? "Loading..." : "Add Parent"}
                    </Button>
                </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
