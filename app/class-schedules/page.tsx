import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function ClassSchedules() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-100 dark:bg-zinc-900 font-sans">
      <main className="flex min-h-[50vh] flex-1 w-full max-w-3xl flex-col items-center py-32 px-16 justify-center bg-zinc-100 dark:bg-zinc-900">
        <h1 className="text-4xl font-bold text-zinc-800 dark:text-zinc-200">
          Class Schedules
        </h1>

        <Table className="mt-12">
          <TableCaption>Normal pricing per month</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-50">Class</TableHead>
              <TableHead className="w-25">Duration</TableHead>
              <TableHead className="text-right">Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Mommy & Me</TableCell>
              <TableCell>30 min</TableCell>
              <TableCell className="text-right">$30.00</TableCell>
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Ninja</TableCell>
              <TableCell>30 min</TableCell>
              <TableCell className="text-right">$40.00</TableCell>
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Pre-School</TableCell>
              <TableCell>45 min</TableCell>
              <TableCell className="text-right">$45.00</TableCell>
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Beginners</TableCell>
              <TableCell>1 Hr</TableCell>
              <TableCell className="text-right">$53.00</TableCell>
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Intermediates</TableCell>
              <TableCell>1 Hr</TableCell>
              <TableCell className="text-right">$58.00</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </main>
    </div>
  );
}