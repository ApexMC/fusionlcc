"use client"

import * as React from "react"
import { BadgeCheck, FileSignature } from "lucide-react"

import { signCheerContract } from "@/app/actions/cheer-enrollments"
import { CheerContractContent } from "@/components/account/cheer_contract_content"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"
import type { CheerEnrollmentDisplayRecord } from "@/lib/account/types"

export function CheerContractDialog({
  enrollment,
  open,
  onOpenChange,
  onSigned,
}: {
  enrollment: CheerEnrollmentDisplayRecord
  open: boolean
  onOpenChange: (open: boolean) => void
  onSigned: (enrollmentId: string) => void
}) {
  const [signature, setSignature] = React.useState("")
  const [acknowledged, setAcknowledged] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const { toast } = useToast()

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSignature("")
      setAcknowledged(false)
      setError(null)
    }

    onOpenChange(nextOpen)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const result = await signCheerContract({
        enrollmentId: enrollment.enrollmentId,
        signature,
      })

      if (!result.ok) {
        setError(result.message)
        return
      }

      onSigned(enrollment.enrollmentId)
      toast({
        title: "Cheer contract signed",
        description: result.message,
        variant: "success",
      })
      handleOpenChange(false)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Please try again."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="grid h-[min(82vh,52rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:top-[calc(50%+2rem)] sm:max-w-5xl">
        <DialogHeader className="px-5 py-4 pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-lg">
              2026-2027 Cheer Season Contract
            </DialogTitle>
            {enrollment.contractSigned ? (
              <Badge className="gap-2" variant="success">
                <BadgeCheck /> 
                Signed
              </Badge>
            ) : null}
          </div>
          <DialogDescription>
            Review the complete contract for {enrollment.athleteName} and {" "}
            {enrollment.teamName}. Scroll to the acknowledgement at the bottom
            before signing.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto border-y bg-background px-3 py-4 sm:px-5">
          <CheerContractContent />
        </div>

        {enrollment.contractSigned ? (
          <div className="flex items-center justify-between gap-3 bg-muted/50 px-5 py-4">
            <p className="flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-300">
              <BadgeCheck className="size-4" /> This contract has been signed.
            </p>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form className="bg-muted/50 px-5 py-4" onSubmit={handleSubmit}>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="space-y-2">
                <Label htmlFor={`cheer-signature-${enrollment.enrollmentId}`}>
                  Parent/Guardian signature
                </Label>
                <Input
                  id={`cheer-signature-${enrollment.enrollmentId}`}
                  name="signature"
                  autoComplete="name"
                  value={signature}
                  onChange={(event) => setSignature(event.target.value)}
                  placeholder={`Type ${enrollment.parentName}`}
                  disabled={submitting}
                  className="h-10 bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  Type your full name exactly as it appears on your account.
                </p>
              </div>
              <Button
                type="submit"
                disabled={!signature.trim() || !acknowledged || submitting}
                className="lg:mb-6"
              >
                <FileSignature />
                {submitting ? "Signing" : "Sign contract"}
              </Button>
            </div>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                disabled={submitting}
                className="mt-1 size-4 rounded border-input accent-green-800"
              />
              <span>
                I have read this contract and agree to the Contract
                Acknowledgement above. I understand that typing my name and
                selecting Sign contract constitutes my electronic signature.
              </span>
            </label>
            {error ? (
              <p className="mt-3 text-sm font-medium text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
