import { AlertCircle, CheckCircle2, CreditCard, ListChecks } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { OperationsActionItem } from "@/lib/account/types"

const icons = {
  "Review queue": ListChecks,
  "Ready to bill": CreditCard,
  "Payment attention": AlertCircle,
  "Class billing setup": CheckCircle2,
}

const toneClassName = {
  default: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  danger: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  success:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
}

export function OperationsSummary({
  actionItems,
}: {
  actionItems: OperationsActionItem[]
}) {
  return (
    <section className="grid w-auto grid-cols-2 gap-4 lg:grid-cols-4 mb-4 px-2">
      {actionItems.map((item) => {
        const Icon = icons[item.label as keyof typeof icons] ?? AlertCircle

        return (
          <Card key={item.label} className="bg-white dark:bg-black">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-sm text-zinc-500 dark:text-zinc-400">
                {item.label}
              </CardTitle>
              <div className={`rounded-lg p-2 ${toneClassName[item.tone]}`}>
                <Icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                {item.value}
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {item.detail}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}
