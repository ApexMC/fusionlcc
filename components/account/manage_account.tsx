"use client"

import { Field, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button";
import createClient from "@/lib/supabase/client"
import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { Pencil } from "lucide-react";

export default function ManageAccountCard({
    phone
    ,address
    ,city
    ,state
    ,zip_code
    }: 
    {phone?: string
    ,address?: string
    ,city?: string
    ,state?: string
    ,zip_code?: string}
    ) {
    const supabase = createClient()
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const form = new FormData(e.currentTarget)
        try {
            const { error: updateError } = await supabase.auth.updateUser({
                data: {
                    phone: form.get("phone")?.toString() ?? "",
                    address: form.get("address")?.toString() ?? "",
                    city: form.get("city")?.toString() ?? "",
                    state: form.get("state")?.toString() ?? "",
                    zip_code: form.get("zip_code")?.toString() ?? "",
                }
            });

            if (updateError) throw updateError

            setOpen(false)
            router.refresh()
        } catch (error) {
            setError(error instanceof Error ? error.message : "Account could not be updated.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => {
            if (!loading) {
                setOpen(nextOpen)
                setError(null)
            }
        }}>
            <DialogTrigger asChild>
                <Button className="bg-transparent hover:bg-zinc-300 text-white font-bold" type="button" variant="outline"><Pencil className="w-4 h-4 text-zinc-500 dark:text-zinc-400" /></Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
                <form onSubmit={handleSubmit}>
                <DialogHeader>
                    <DialogTitle>Manage Account</DialogTitle>
                    <DialogDescription>
                    Update your account information below.
                    </DialogDescription>
                </DialogHeader>
                <FieldGroup className="mb-6 no-scrollbar max-h-[50vh] overflow-y-auto mt-6">
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
                {error && <div role="alert" className="text-sm text-red-600 mb-2">{error}</div>}
                <DialogFooter>
                    <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={loading}>Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={loading}>
                        {loading ? "Loading..." : "Update"}
                    </Button>
                </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
