"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, Label, Pie, PieChart, XAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { ChartDatum, TrendDatum } from "@/lib/account/types"

const statusConfig = {
  value: {
    label: "Enrollments",
  },
} satisfies ChartConfig

const trendConfig = {
  enrollments: {
    label: "Enrollments",
    color: "#7c3aed",
  },
} satisfies ChartConfig

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-52 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {label}
    </div>
  )
}

export function AdminCharts({
  statusBreakdown,
  monthlyTrend,
}: {
  statusBreakdown: ChartDatum[]
  monthlyTrend: TrendDatum[]
}) {
  const totalEnrollments = React.useMemo(
    () => statusBreakdown.reduce((total, item) => total + item.value, 0),
    [statusBreakdown]
  )

  return (
    <section className="grid w-full grid-cols-1 gap-4 xl:grid-cols-2">
      <Card className="bg-white dark:bg-black">
        <CardHeader>
          <CardTitle>Enrollment Status</CardTitle>
          <CardDescription>Current enrollment breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          {statusBreakdown.length ? (
            <ChartContainer
              config={statusConfig}
              className="mx-auto aspect-square max-h-64"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel nameKey="label" />}
                />
                <Pie
                  data={statusBreakdown}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={58}
                  strokeWidth={6}
                >
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy}
                              className="fill-foreground text-3xl font-bold"
                            >
                              {totalEnrollments.toLocaleString()}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 18}
                              className="fill-muted-foreground text-xs"
                            >
                              enrollments
                            </tspan>
                          </text>
                        )
                      }
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
          ) : (
            <EmptyChart label="No enrollments yet" />
          )}
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-black">
        <CardHeader>
          <CardTitle>Enrollment Trend</CardTitle>
          <CardDescription>Requests created over the last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyTrend.some((item) => item.enrollments > 0) ? (
            <ChartContainer config={trendConfig} className="h-64 w-full">
              <BarChart data={monthlyTrend}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={8}
                  axisLine={false}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Bar
                  dataKey="enrollments"
                  fill="var(--color-enrollments)"
                  radius={6}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <EmptyChart label="Apply the migration and collect enrollment timestamps to show trends" />
          )}
        </CardContent>
      </Card>
    </section>
  )
}
