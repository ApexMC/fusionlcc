"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import {
  BadgeDollarSign,
  CalendarDays,
  CircleAlert,
  CircleCheckBig,
  CircleOff,
  ClipboardList,
  Clock3,
  Download,
  FileArchive,
  Search,
  UserRound,
  UsersRound,
} from "lucide-react"

import { SummaryCard } from "@/components/account/summary_card"
import { AdminCharts } from "@/components/account/admin/admin_charts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { AdminReportingData } from "@/lib/account/types"
import {
  buildReportingExports,
  type ReportingExport,
  type ReportIcon,
} from "@/lib/account/reporting_exports"
import {
  buildSubscriptionAuditRecords,
  coverageLabels,
  serializeCsv,
  type CsvRow,
  type CoverageState,
} from "@/lib/account/reporting"

type CoverageFilter = "all" | CoverageState

const reportIcons: Record<ReportIcon, LucideIcon> = {
  financial: BadgeDollarSign,
  customers: UserRound,
  enrollments: ClipboardList,
  athletes: UsersRound,
  schedules: CalendarDays,
  timeClock: Clock3,
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function downloadCsv(filename: string, rows: CsvRow[]) {
  if (!rows.length) {
    return
  }

  const csv = serializeCsv(rows)

  triggerDownload(
    filename,
    new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" })
  )
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function ExportCard({ report }: { report: ReportingExport }) {
  const Icon = reportIcons[report.icon]

  return (
    <Card size="sm" className="bg-white dark:bg-black">
      <CardHeader>
        <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <CardTitle>{report.title}</CardTitle>
        <CardDescription>{report.description}</CardDescription>
        <CardAction>
          <Badge variant="outline">
            {report.unavailableReason ? "Unavailable" : `${report.rows.length.toLocaleString()} rows`}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {report.unavailableReason ? (
          <p className="mb-2 text-xs text-muted-foreground">{report.unavailableReason}</p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={Boolean(report.unavailableReason) || !report.rows.length}
          onClick={() => downloadCsv(report.filename, report.rows)}
        >
          <Download />
          Export CSV
        </Button>
      </CardContent>
    </Card>
  )
}

export function AdminReporting({ data }: { data: AdminReportingData }) {
  const [coverageFilter, setCoverageFilter] =
    React.useState<CoverageFilter>("all")
  const [query, setQuery] = React.useState("")

  const auditRecords = React.useMemo(
    () => buildSubscriptionAuditRecords(data),
    [data]
  )
  const subscriptionRows = React.useMemo(
    () => auditRecords.map((record) => record.exportRow),
    [auditRecords]
  )

  const coverageCounts = React.useMemo(() => {
    const counts: Record<CoverageState, number> = {
      subscribed: 0,
      "payment-not-required": 0,
      attention: 0,
      "not-subscribed": 0,
      unknown: 0,
    }

    for (const record of auditRecords) {
      counts[record.coverageState] += 1
    }

    return counts
  }, [auditRecords])

  const filteredAuditRecords = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return auditRecords.filter((record) => {
      if (coverageFilter !== "all" && record.coverageState !== coverageFilter) {
        return false
      }

      const row = record.exportRow
      return !normalizedQuery || [row.Parent, row.Athlete, row.Offering, row["Parent email"]]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    })
  }, [coverageFilter, query, auditRecords])

  const reports = React.useMemo(
    () => buildReportingExports(data, subscriptionRows),
    [data, subscriptionRows]
  )

  const totalBalance = data.reportingParents.reduce(
    (total, parent) => total + (parent.balance ?? 0),
    0
  )

  function downloadCompleteArchive() {
    const date = new Date().toISOString().slice(0, 10)
    triggerDownload(
      `reporting-archive-${date}.json`,
      new Blob(
        [JSON.stringify({ schemaVersion: 1, dataAsOf: data.reportingGeneratedAt, exportedAt: new Date().toISOString(), data }, null, 2)],
        { type: "application/json;charset=utf-8" }
      )
    )
  }

  const filters: Array<{
    value: CoverageFilter
    label: string
    count: number
  }> = [
    { value: "all", label: "All", count: subscriptionRows.length },
    {
      value: "subscribed",
      label: "Subscribed",
      count: coverageCounts.subscribed,
    },
    {
      value: "payment-not-required",
      label: coverageLabels["payment-not-required"],
      count: coverageCounts["payment-not-required"],
    },
    {
      value: "not-subscribed",
      label: "Not subscribed",
      count: coverageCounts["not-subscribed"],
    },
    {
      value: "attention",
      label: "Needs attention",
      count: coverageCounts.attention,
    },
    { value: "unknown", label: coverageLabels.unknown, count: coverageCounts.unknown },
  ]

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="analytics-title">
        <div>
          <h2 id="analytics-title" className="text-xl font-semibold">
            Enrollment analytics
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track enrollment activity, status health, and program demand.
          </p>
        </div>
        <AdminCharts
          statusBreakdown={data.statusBreakdown}
          enrollmentTrend={data.enrollmentTrend}
          programBreakdown={data.programBreakdown}
        />
      </section>

      <section className="space-y-4" aria-labelledby="financial-overview-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="financial-overview-title" className="text-xl font-semibold">
              Financial overview
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Subscription coverage and customer balances across every program.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={downloadCompleteArchive}>
            <FileArchive />
            Export complete archive
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <SummaryCard
            icon={CircleCheckBig}
            label="Subscribed"
            value={coverageCounts.subscribed.toLocaleString()}
            detail="Active or trialing enrollments"
          />
          <SummaryCard
            icon={CircleOff}
            label="Not subscribed"
            value={coverageCounts["not-subscribed"].toLocaleString()}
            detail="No current subscription"
          />
          <SummaryCard
            icon={CircleAlert}
            label="Needs attention"
            value={coverageCounts.attention.toLocaleString()}
            detail="Subscription or payment problems"
          />
          <SummaryCard
            icon={BadgeDollarSign}
            label="Customer balances"
            value={formatMoney(totalBalance)}
            detail={data.metrics.monthlyRecurringRevenue.available
              ? `Est. MRR: $${data.metrics.monthlyRecurringRevenue.value}`
              : "Est. MRR: unavailable"}
          />
        </div>
      </section>

      <Card className="bg-white dark:bg-black">
        <CardHeader className="border-b">
          <CardTitle>Subscription audit</CardTitle>
          <CardDescription>
            Find who is subscribed, whose payment is not required, and which records need a billing follow-up.
          </CardDescription>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!filteredAuditRecords.length}
              onClick={() =>
                downloadCsv("filtered-subscription-audit.csv", filteredAuditRecords.map((record) => record.exportRow))
              }
            >
              <Download />
              Export view
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {coverageCounts.unknown > 0 ? (
            <p className="rounded-lg border border-amber-300/60 bg-amber-50/70 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/20">
              {coverageCounts.unknown.toLocaleString()} enrollment records have unavailable or unverified billing information. Their subscription coverage is shown as Unknown.
            </p>
          ) : null}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  size="sm"
                  variant={coverageFilter === filter.value ? "secondary" : "outline"}
                  aria-pressed={coverageFilter === filter.value}
                  onClick={() => setCoverageFilter(filter.value)}
                >
                  {filter.label}
                  <span className="text-muted-foreground">{filter.count}</span>
                </Button>
              ))}
            </div>
            <label className="relative block w-full lg:max-w-sm">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="sr-only">Search subscriptions</span>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search parent, athlete, or program"
                className="pl-8"
              />
            </label>
          </div>

          <div className="max-h-[32rem] overflow-auto rounded-lg border">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-muted/95 text-xs text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Parent</th>
                  <th className="px-3 py-2.5 font-medium">Athlete</th>
                  <th className="px-3 py-2.5 font-medium">Program</th>
                  <th className="px-3 py-2.5 font-medium">Enrollment</th>
                  <th className="px-3 py-2.5 font-medium">Subscription</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAuditRecords.map((record) => {
                  const row = record.exportRow
                  const stateLabel = coverageLabels[record.coverageState]
                  const paymentNotRequired = record.coverageState === "payment-not-required"
                  const statusDetail = paymentNotRequired ? null : Array.from(new Set(
                    [row["Subscription status"], row["Payment status"]]
                      .map((status) => status.trim().toLowerCase().replaceAll("_", " "))
                      .filter(Boolean)
                  )).join(" · ") || "No status"
                  const badgeVariant =
                    record.coverageState === "subscribed" || paymentNotRequired
                      ? "success"
                      : record.coverageState === "attention"
                        ? "warning"
                        : "outline"

                  return (
                    <tr
                      key={record.key}
                      className="align-top"
                    >
                      <td className="px-3 py-3">
                        <div className="font-medium">{row.Parent}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {row["Parent email"] || "No email"}
                        </div>
                      </td>
                      <td className="px-3 py-3">{row.Athlete}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{row.Offering}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {row["Program type"]}
                        </div>
                      </td>
                      <td className="px-3 py-3 capitalize">
                        {row["Enrollment status"]}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={badgeVariant}>{stateLabel}</Badge>
                        {statusDetail ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {statusDetail}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
                {!filteredAuditRecords.length ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      No subscription records match this view.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4" aria-labelledby="exports-title">
        <div>
          <h2 id="exports-title" className="text-xl font-semibold">
            Export center
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Download focused CSV files for finance, customers, programs, and operations.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reports.map((report) => (
            <ExportCard key={report.title} report={report} />
          ))}
        </div>
      </section>

    </div>
  )
}
