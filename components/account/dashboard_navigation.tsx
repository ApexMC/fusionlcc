import type { LucideIcon } from "lucide-react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type DashboardNavItem = {
  title: string
  description: string
  href: string
  icon: LucideIcon
  detail?: string
  badge?: string
  tone?: "default" | "warning" | "danger" | "success"
}

export type DashboardStat = {
  label: string
  value: string
  detail?: string
  href?: string
  tone?: "default" | "warning" | "danger" | "success"
}

const toneBadgeVariant = {
  default: "outline",
  warning: "warning",
  danger: "destructive",
  success: "success",
} as const

const tonePanelClassName = {
  default: "border-border bg-card",
  warning: "border-amber-300/60 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/20",
  danger: "border-red-300/60 bg-red-50/70 dark:border-red-900 dark:bg-red-950/20",
  success:
    "border-emerald-300/60 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20",
}

export function AccountDashboardFrame({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-100 font-sans dark:bg-zinc-900">
      <main className="flex min-h-[50vh] w-full flex-1 flex-col items-center bg-zinc-100 px-4 py-10 dark:bg-zinc-900 sm:px-8 lg:py-12">
        <div className={cn("flex w-full max-w-7xl flex-col gap-6", className)}>
          {children}
        </div>
      </main>
    </div>
  )
}

export function DashboardHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}

export function AccountSectionHeader({
  title,
  description,
  icon: Icon,
  backHref = "/account",
  backLabel = "Account",
  actions,
}: {
  title: string
  description: string
  icon: LucideIcon
  backHref?: string
  backLabel?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          <Icon className="size-6" />
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <Button asChild variant="outline">
          <Link href={backHref}>
            <ArrowLeft />
            {backLabel}
          </Link>
        </Button>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function DashboardStatGrid({ stats }: { stats: DashboardStat[] }) {
  if (!stats.length) {
    return null
  }

  return (
    <section
      aria-label="Dashboard snapshot"
      className="grid grid-cols-2 gap-3 xl:grid-cols-4"
    >
      {stats.map((stat) => {
        const panel = (
          <div
            className={cn(
              "h-full rounded-lg border p-4",
              stat.href &&
                "transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md",
              tonePanelClassName[stat.tone ?? "default"]
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm text-muted-foreground">{stat.label}</div>
              {stat.href ? (
                <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              ) : null}
            </div>
            <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {stat.value}
            </div>
            {stat.detail ? (
              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                {stat.detail}
              </div>
            ) : null}
          </div>
        )

        return stat.href ? (
          <Link
            key={stat.label}
            href={stat.href}
            className="group block rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {panel}
          </Link>
        ) : (
          <div key={stat.label}>{panel}</div>
        )
      })}
    </section>
  )
}

export function DashboardLinkGrid({
  items,
  className,
}: {
  items: DashboardNavItem[]
  className?: string
}) {
  return (
    <section
      aria-label="Dashboard pages"
      className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4", className)}
    >
      {items.map((item) => {
        const Icon = item.icon
        const tone = item.tone ?? "default"

        return (
          <Link
            key={item.href}
            href={item.href}
            className="group block rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card
              className={cn(
                "h-full rounded-lg bg-white transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md dark:bg-black",
                tonePanelClassName[tone]
              )}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="rounded-lg border bg-background p-2 text-foreground shadow-sm">
                  <Icon className="size-5" />
                </div>
                <ArrowRight className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <div>
                  <CardTitle className="text-lg font-semibold">
                    {item.title}
                  </CardTitle>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                  {item.badge ? (
                    <Badge variant={toneBadgeVariant[tone]}>{item.badge}</Badge>
                  ) : null}
                  {item.detail ? (
                    <span className="text-xs text-muted-foreground">
                      {item.detail}
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </section>
  )
}
