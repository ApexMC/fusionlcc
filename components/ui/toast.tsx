"use client"

import * as React from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ToastVariant = "success" | "error" | "info"

type Toast = {
  id: number
  title: string
  description?: string
  variant: ToastVariant
}

type ToastInput = Omit<Toast, "id">

const ToastContext = React.createContext<{
  toast: (input: ToastInput) => void
} | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const toast = React.useCallback((input: ToastInput) => {
    const id = Date.now()
    setToasts((current) => [...current, { ...input, id }])
    window.setTimeout(() => dismiss(id), 4500)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed right-4 bottom-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              "rounded-xl border bg-background p-3 text-sm shadow-lg",
              item.variant === "success" &&
                "border-emerald-500/30 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50",
              item.variant === "error" &&
                "border-red-500/30 bg-red-50 text-red-950 dark:bg-red-950 dark:text-red-50"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{item.title}</p>
                {item.description ? (
                  <p className="mt-1 text-muted-foreground">
                    {item.description}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
              >
                <X />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)

  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }

  return context
}
