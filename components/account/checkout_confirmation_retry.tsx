"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

export function CheckoutConfirmationRetry() {
  const router = useRouter()
  const [attempts, setAttempts] = useState(0)
  const [isPending, startTransition] = useTransition()
  const retryLimit = 6

  useEffect(() => {
    if (attempts >= retryLimit || isPending) {
      return
    }

    const timer = window.setTimeout(() => {
      setAttempts((count) => count + 1)
      startTransition(() => router.refresh())
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [attempts, isPending, router])

  return (
    <p className="text-center text-sm text-muted-foreground" role="status">
      {attempts >= retryLimit && !isPending
        ? "Confirmation is taking longer than expected. You can check again or view your account."
        : "This page will check again automatically."}
    </p>
  )
}
