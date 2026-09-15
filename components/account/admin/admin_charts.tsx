"use client"

import * as React from "react"
import {
  Activity,
  CircleCheckBig,
  Clock3,
  UsersRound,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type {
  ChartDatum,
  ProgramEnrollmentDatum,
  TrendDatum,
} from "@/lib/account/types"

const enrollmentConfig = {
  classes: {
    label: "Classes",
    color: "#7c3aed",
  },
  cheer: {
    label: "Cheer",
    color: "#f97316",
  },
} satisfies ChartConfig

const statusConfig = {
  value: {
    label: "Enrollments",
  },
  pending: {
    label: "Pending",
    color: "#f59e0b",
  },
  approved: {
    label: "Approved",
    color: "#7c3aed",
  },
  active: {
    label: "Active",
    color: "#16a34a",
  },
  denied: {
    label: "Denied",
    color: "#dc2626",
  },
  canceled: {
    label: "Canceled",
    color: "#64748b",
  },
} satisfies ChartConfig

const programConfig = {
  pending: {
    label: "Pending",
    color: "#f59e0b",
  },
  approved: {
    label: "Approved",
    color: "#7c3aed",
  },
  active: {
    label: "Active",
    color: "#16a34a",
  },
} satisfies ChartConfig

const rangeOptions = [
  { days: 7, label: "7D" },
  { days: 30, label: "30D" },
  { days: 90, label: "90D" },
] as const

type RangeDays = (typeof rangeOptions)[number]["days"]

function formatDate(value: string, includeYear = false) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
    timeZone: "UTC",
  })
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Activity
  label: string
  value: string
  detail: string
}) {
  return (
    <Card size="sm" className="bg-white dark:bg-black">
      <CardContent className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="rounded-lg bg-muted p-2 text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminCharts({
  statusBreakdown,
  enrollmentTrend,
  programBreakdown,
}: {
  statusBreakdown: ChartDatum[]
  enrollmentTrend: TrendDatum[]
  programBreakdown: ProgramEnrollmentDatum[]
}) {
  const [rangeDays, setRangeDays] = React.useState<RangeDays>(30)
  const filteredTrend = React.useMemo(
    () => enrollmentTrend.slice(-rangeDays),
    [enrollmentTrend, rangeDays]
  )
  const totalEnrollments = React.useMemo(
    () => statusBreakdown.reduce((total, item) => total + item.value, 0),
    [statusBreakdown]
  )
  const pendingEnrollments =
    statusBreakdown.find((item) => item.name === "pending")?.value ?? 0
  const approvedEnrollments =
    statusBreakdown.find((item) => item.name === "approved")?.value ?? 0
  const activeEnrollments =
    statusBreakdown.find((item) => item.name === "active")?.value ?? 0
  const selectedRangeTotal = React.useMemo(
    () =>
      filteredTrend.reduce(
        (total, item) => total + item.classes + item.cheer,
        0
      ),
    [filteredTrend]
  )
  const hasTrendData = enrollmentTrend.some(
    (item) => item.classes > 0 || item.cheer > 0
  )

  return (
    <section className="space-y-4" aria-label="Enrollment analytics">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard
          icon={UsersRound}
          label="Total records"
          value={totalEnrollments.toLocaleString()}
          detail="Class and cheer enrollments"
        />
        <SummaryCard
          icon={Clock3}
          label="Pending"
          value={pendingEnrollments.toLocaleString()}
          detail="Requests awaiting a decision"
        />
        <SummaryCard
          icon={CircleCheckBig}
          label="Approved"
          value={approvedEnrollments.toLocaleString()}
          detail="Approved and ready for enrollment"
        />
        <SummaryCard
          icon={Activity}
          label="Active"
          value={activeEnrollments.toLocaleString()}
          detail="Athletes currently enrolled"
        />
      </div>

      <Card className="bg-white dark:bg-black">
        <CardHeader className="border-b">
          <CardTitle>Enrollment Activity</CardTitle>
          <CardDescription>
            {selectedRangeTotal.toLocaleString()} new class and cheer requests in
            the last {rangeDays} days
          </CardDescription>
          <CardAction
            className="flex rounded-lg border bg-muted/40 p-0.5"
            aria-label="Enrollment chart range"
          >
            {rangeOptions.map((option) => (
              <Button
                key={option.days}
                type="button"
                size="sm"
                variant={rangeDays === option.days ? "secondary" : "ghost"}
                className="h-7 min-w-9 px-2 text-xs"
                aria-pressed={rangeDays === option.days}
                onClick={() => setRangeDays(option.days)}
              >
                {option.label}
              </Button>
            ))}
          </CardAction>
        </CardHeader>
        <CardContent>
          {hasTrendData ? (
            <ChartContainer
              config={enrollmentConfig}
              className="h-[300px] min-h-[300px] min-w-0 w-full"
            >
              <AreaChart
                accessibilityLayer
                data={filteredTrend}
                margin={{ left: 8, right: 8, top: 8 }}
              >
                <defs>
                  <linearGradient id="fillClasses" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-classes)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-classes)"
                      stopOpacity={0.08}
                    />
                  </linearGradient>
                  <linearGradient id="fillCheer" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-cheer)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-cheer)"
                      stopOpacity={0.08}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={28}
                  tickFormatter={(value) => formatDate(String(value))}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      indicator="line"
                      labelFormatter={(value) =>
                        formatDate(String(value), true)
                      }
                    />
                  }
                />
                <Area
                  dataKey="classes"
                  type="monotone"
                  fill="url(#fillClasses)"
                  stroke="var(--color-classes)"
                  strokeWidth={2}
                  stackId="enrollments"
                />
                <Area
                  dataKey="cheer"
                  type="monotone"
                  fill="url(#fillCheer)"
                  stroke="var(--color-cheer)"
                  strokeWidth={2}
                  stackId="enrollments"
                />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          ) : (
            <EmptyChart label="Enrollment activity will appear after requests have been created." />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="bg-white dark:bg-black">
          <CardHeader>
            <CardTitle>Enrollment Status</CardTitle>
            <CardDescription>
              Current health across class and cheer records
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statusBreakdown.length ? (
              <div className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(140px,0.75fr)] xl:grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_minmax(140px,0.75fr)]">
                <ChartContainer
                  config={statusConfig}
                  className="mx-auto aspect-square h-64 min-h-64 w-full max-w-64"
                >
                  <PieChart accessibilityLayer>
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent hideLabel nameKey="name" />
                      }
                    />
                    <Pie
                      data={statusBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      strokeWidth={5}
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
                                  y={(viewBox.cy || 0) + 20}
                                  className="fill-muted-foreground text-xs"
                                >
                                  total records
                                </tspan>
                              </text>
                            )
                          }
                        }}
                      />
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="space-y-2">
                  {statusBreakdown.map((status) => (
                    <div
                      key={status.name}
                      className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: status.fill }}
                          aria-hidden="true"
                        />
                        <span className="truncate text-sm text-muted-foreground">
                          {status.label}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-medium tabular-nums">
                        {status.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyChart label="No enrollments yet." />
            )}
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-black">
          <CardHeader>
            <CardTitle>Program Demand</CardTitle>
            <CardDescription>
              Top programs by pending, approved, and active enrollments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {programBreakdown.length ? (
              <ChartContainer
                config={programConfig}
                className="h-80 min-h-80 min-w-0 w-full"
              >
                <BarChart
                  accessibilityLayer
                  data={programBreakdown}
                  layout="vertical"
                  margin={{ left: 8, right: 12 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="program"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    width={180}
                    tickMargin={8}
                  />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        labelFormatter={(_, payload) => {
                          const item = payload?.[0]?.payload as
                            | ProgramEnrollmentDatum
                            | undefined
                          return item
                            ? `${item.program} · ${item.programType}`
                            : "Program"
                        }}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar
                    dataKey="pending"
                    stackId="program"
                    fill="var(--color-pending)"
                    radius={4}
                  />
                  <Bar
                    dataKey="approved"
                    stackId="program"
                    fill="var(--color-approved)"
                    radius={4}
                  />
                  <Bar
                    dataKey="active"
                    stackId="program"
                    fill="var(--color-active)"
                    radius={4}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyChart label="Program demand will appear when an enrollment is pending, approved, or active." />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
