"use client"

import { flexRender, type Row } from "@tanstack/react-table"
import * as React from "react"
import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"

type MobileDataTableProps<TData> = {
  rows: Row<TData>[]
  getRowId?: (row: TData) => string
  expandedRowId: string | null
  onExpandedRowIdChange: React.Dispatch<React.SetStateAction<string | null>>
  renderExpandedRow?: (row: TData) => React.ReactNode
}

function getRecordValue<TData>(row: TData, key: string) {
  if (typeof row !== "object" || row === null) {
    return null
  }

  return (row as Record<string, unknown>)[key]
}

function getDisplayText(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return ""
  }

  return String(value)
}

function getMobileRowTitle<TData>(row: TData) {
  const firstName = getDisplayText(getRecordValue(row, "first_name"))
  const lastName = getDisplayText(getRecordValue(row, "last_name"))
  const name = [firstName, lastName].filter(Boolean).join(" ")

  if (name) {
    return name
  }

  const id =
    getDisplayText(getRecordValue(row, "parent_id")) ||
    getDisplayText(getRecordValue(row, "athlete_id")) ||
    getDisplayText(getRecordValue(row, "id"))

  return id ? `Record #${id}` : "Record"
}

function getMobileRowSubtitle<TData>(row: TData) {
  const phone = getDisplayText(getRecordValue(row, "phone"))

  if (phone) {
    return `Phone: ${phone}`
  }

  const athleteId = getDisplayText(getRecordValue(row, "athlete_id"))

  if (athleteId) {
    return `Athlete #${athleteId}`
  }

  return getDisplayText(getRecordValue(row, "email"))
}

function getMobileColumnLabel(columnId: string) {
  return columnId
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function MobileDataTable<TData>({
  rows,
  getRowId,
  expandedRowId,
  onExpandedRowIdChange,
  renderExpandedRow,
}: MobileDataTableProps<TData>) {
  return (
    <CardContent className="max-h-[min(38rem,65svh)] min-h-0 overflow-y-auto overscroll-contain pr-3 scrollbar-gutter:stable">
      <div className="space-y-3 pr-1">
        {rows.length ? (
          rows.map((row) => {
            const rowId = getRowId?.(row.original) ?? row.id
            const isExpanded = expandedRowId === rowId
            const expandedContent = renderExpandedRow?.(row.original)
            const visibleCells = row.getVisibleCells()
            const actionCell = visibleCells.find(
              (cell) => cell.column.id === "actions"
            )
            const detailCells = visibleCells.filter(
              (cell) =>
                !["actions", "first_name", "last_name"].includes(
                  cell.column.id
                )
            )
            const hasDetailPanel =
              detailCells.length > 0 || Boolean(expandedContent)

            return (
              <div key={row.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {getMobileRowTitle(row.original)}
                    </div>
                    {getMobileRowSubtitle(row.original) ? (
                      <div className="truncate text-xs text-muted-foreground">
                        {getMobileRowSubtitle(row.original)}
                      </div>
                    ) : null}
                  </div>
                  {actionCell ? (
                    <div className="shrink-0">
                      {flexRender(
                        actionCell.column.columnDef.cell,
                        actionCell.getContext()
                      )}
                    </div>
                  ) : null}
                </div>
                {hasDetailPanel ? (
                  <>
                    <Button
                      type="button"
                      size="lg"
                      variant={isExpanded ? "secondary" : "outline"}
                      className="mt-3 h-10 w-full justify-between"
                      aria-expanded={isExpanded}
                      onClick={() =>
                        onExpandedRowIdChange((current) =>
                          current === rowId ? null : rowId
                        )
                      }
                    >
                      {isExpanded ? "Hide Details" : "View Details"}
                      <ChevronDown
                        className={
                          isExpanded
                            ? "rotate-180 transition-transform"
                            : "transition-transform"
                        }
                      />
                    </Button>
                    {isExpanded ? (
                      <div className="mt-3 space-y-3">
                        {detailCells.length ? (
                          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                            {detailCells.map((cell) => (
                              <div
                                key={cell.id}
                                className={
                                  ["address", "email"].includes(
                                    cell.column.id
                                  )
                                    ? "sm:col-span-2"
                                    : undefined
                                }
                              >
                                <div className="text-xs font-medium text-muted-foreground">
                                  {getMobileColumnLabel(cell.column.id)}
                                </div>
                                <div className="min-w-0 break-words">
                                  {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext()
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {expandedContent ? (
                          <div className="rounded-lg bg-muted/30 p-3">
                            {expandedContent}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            )
          })
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No results.
          </div>
        )}
      </div>
    </CardContent>
  )
}
