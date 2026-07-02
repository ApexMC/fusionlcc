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
import { Card } from "@/components/ui/card"
import AddParentCard from "@/components/account/parents/add_parent"

interface DataTableProps<TData, TValue> {
  title: string
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
}

export function DataTable<TData, TValue>({
  title,
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
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

  return (
    <div className="w-full flex flex-col items-start max-h-125">
      <Card className="w-full bg-white dark:bg-black p-4 flex flex-col">
        <h1 className="text-2xl font-bold">
          {title}
        </h1>
        <div className="flex flex-row gap-3 justify-between mb-2">
          <div className="flex flex-row gap-3 items-center">
            <Input
              placeholder="Filter by last name..."
              value={(table.getColumn("last_name")?.getFilterValue() as string) ?? ""}
              onChange={(event) =>
                table.getColumn("last_name")?.setFilterValue(event.target.value)
              }
              className="max-w-sm"
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
        <div className="flex-1 overflow-auto rounded-md border">
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
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
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