import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { EnrollmentMetric } from "@/lib/account/types"

export function AdminMetrics({ metrics }: { metrics: EnrollmentMetric[] }) {
  return (
    <section className="grid w-auto grid-cols-2 gap-4 lg:grid-cols-4 mb-4 px-2">
      {metrics.map((metric) => (
        <Card key={metric.label} className="bg-white dark:bg-black">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500 dark:text-zinc-400">
              {metric.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              {metric.value}
            </div>
            {metric.detail ? (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {metric.detail}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
