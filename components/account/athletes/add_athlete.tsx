"use client"

import { Field, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Button } from "@/components/ui/button";

export default function AddAthleteCard() {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button className="bg-purple-500 hover:bg-purple-600 text-white font-bold" type="button" variant="outline">+</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
                <form>
                <DialogHeader>
                    <DialogTitle>Add Athlete</DialogTitle>
                    <DialogDescription>
                    Add a new athlete to your account. You are only billed for athletes currently enrolled in classes or cheer.
                    </DialogDescription>
                </DialogHeader>
                <FieldGroup className="mb-4 no-scrollbar max-h-[50vh] overflow-y-auto mt-4">
                    <Field>
                    <Label htmlFor="name-1">Name</Label>
                    <Input id="name-1" name="name" defaultValue="Jane Doe" />
                    </Field>
                    <Field>
                    <Label htmlFor="email-1">Email</Label>
                    <Input id="email-1" name="email" defaultValue="jane.doe@example.com" />
                    </Field>
                    <Field>
                    <Label htmlFor="phone-1">Phone</Label>
                    <Input id="phone-1" name="phone" defaultValue="(123) 456-7890" />
                    </Field>
                    <Field>
                    <Label htmlFor="dob-1">Date of Birth</Label>
                    <Input id="dob-1" name="dob" defaultValue="01/01/2026" />
                    </Field>
                    <Field>
                    <Label htmlFor="shirt-1">Shirt Size</Label>
                    <Input id="shirt-1" name="shirt" defaultValue="M" />
                    </Field>
                </FieldGroup>
                <DialogFooter>
                    <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit">Add</Button>
                </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}