"use client"

import {
  ColumnDef,
  flexRender,
  ColumnFiltersState,
  getFilteredRowModel,
  getCoreRowModel,
  SortingState,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import * as React from "react"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import AddParentCard from "@/components/account/parents/add_parent"
import { Card } from "@/components/ui/card"
import { MobileDataTable } from "@/components/account/parents/mobile-data-table"

interface DataTableProps<TData, TValue> {
  title: string
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  getRowId?: (row: TData) => string
  renderExpandedRow?: (row: TData) => React.ReactNode
}

export function DataTable<TData, TValue>({
  title,
  columns,
  data,
  getRowId,
  renderExpandedRow,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [expandedRowId, setExpandedRowId] = React.useState<string | null>(null)
  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
    getCoreRowModel: getCoreRowModel(),
  })

  function shouldIgnoreRowClick(event: React.MouseEvent<HTMLTableRowElement>) {
    const target = event.target

    return (
      target instanceof HTMLElement &&
      Boolean(target.closest("button,a,input,select,textarea,[role='menuitem']"))
    )
  }

  return (
    <div className="w-full flex flex-col items-start">
      <Card className="w-full bg-white p-4 dark:bg-black">
        <h1 className="text-2xl font-bold">
          {title}
        </h1>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Filter by last name..."
              value={(table.getColumn("last_name")?.getFilterValue() as string) ?? ""}
              onChange={(event) =>
                table.getColumn("last_name")?.setFilterValue(event.target.value)
              }
              className="sm:max-w-sm"
            />
            {table.getRowModel().rows?.length ? (
              <p className="text-sm text-muted-foreground">
                {table.getFilteredRowModel().rows.length} of{" "}
                {table.getCoreRowModel().rows.length} results
              </p>
            ) : null}
          </div>
          <AddParentCard />
        </div>
        <div className="md:hidden">
          <MobileDataTable
            rows={table.getRowModel().rows}
            getRowId={getRowId}
            expandedRowId={expandedRowId}
            onExpandedRowIdChange={setExpandedRowId}
            renderExpandedRow={renderExpandedRow}
          />
        </div>
        <div className="hidden max-h-[30rem] overflow-y-auto rounded-md border md:block">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => {
                  const rowId = getRowId?.(row.original) ?? row.id
                  const isExpanded = expandedRowId === rowId
                  const expandedContent = renderExpandedRow?.(row.original)

                  return (
                    <React.Fragment key={row.id}>
                      <TableRow
                        aria-expanded={
                          renderExpandedRow ? isExpanded : undefined
                        }
                        className={
                          renderExpandedRow ? "cursor-pointer" : undefined
                        }
                        data-state={row.getIsSelected() && "selected"}
                        onClick={(event) => {
                          if (!renderExpandedRow || shouldIgnoreRowClick(event)) {
                            return
                          }

                          setExpandedRowId((current) =>
                            current === rowId ? null : rowId
                          )
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                      {isExpanded && expandedContent ? (
                        <TableRow>
                          <TableCell
                            colSpan={row.getVisibleCells().length}
                            className="whitespace-normal bg-muted/30 p-4"
                          >
                            {expandedContent}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
    </Card>
    </div>
  )
}
