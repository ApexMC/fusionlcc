import { Users } from "lucide-react"

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type DiscountClass = {
  classId: string
  className: string
  price: number | null
}

type MultiAthleteDiscountTableProps = {
  classes: DiscountClass[]
}

function formatMonthlyPrice(price: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
  }).format(price)
}

export default function MultiAthleteDiscountTable({
  classes,
}: MultiAthleteDiscountTableProps) {
  return (
    <section
      aria-labelledby="multi-athlete-discounts"
      className="w-full max-w-5xl"
    >
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 ring-1 ring-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:ring-purple-400/20">
          <Users className="size-6" aria-hidden="true" />
        </div>
        <h2
          id="multi-athlete-discounts"
          className="scroll-mt-24 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
        >
          Multi-Athlete Discounts
        </h2>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          The more athletes you enroll, the more your family saves. Rates below
          show the monthly price for each enrollment as it is added.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-xl shadow-zinc-950/5 dark:border-white/10 dark:bg-zinc-800 dark:shadow-black/20">
        <Table className="min-w-210">
          <TableCaption className="sr-only">
            Monthly class pricing for one, two, and three or more athletes,
            plus free gymnastics classes for cheer athletes
          </TableCaption>
          <TableHeader>
            <TableRow className="border-zinc-200 bg-zinc-950 hover:bg-zinc-950 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-zinc-950">
              <TableHead className="h-20 w-[34%] px-6 text-xs font-bold tracking-[0.16em] text-zinc-300 uppercase">
                Class
              </TableHead>
              <TableHead className="h-20 px-5 text-center text-white">
                <span className="block text-base font-bold">1 Athlete</span>
                <span className="mt-1 block text-xs font-medium text-zinc-400">
                  Base rate
                </span>
              </TableHead>
              <TableHead className="h-20 px-5 text-center text-white">
                <span className="block text-base font-bold">2 Athletes</span>
                <span className="mt-1 block text-xs font-medium text-purple-300">
                  Save $10/mo
                </span>
              </TableHead>
              <TableHead className="h-20 px-5 text-center text-white">
                <span className="block text-base font-bold">3+ Athletes</span>
                <span className="mt-1 block text-xs font-medium text-purple-400">
                  Flat $15/mo
                </span>
              </TableHead>
              <TableHead className="h-20 bg-linear-to-r from-purple-600 to-purple-800 px-5 text-center text-white dark:bg-purple-600">
                <span className="block text-base font-bold">
                  Cheer Athletes
                </span>
                <span className="mt-1 block text-xs font-medium text-purple-100">
                  Gymnastics perk
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((classRecord) => {
              const secondEnrollmentPrice =
                classRecord.price === null
                  ? null
                  : Math.max(classRecord.price - 10, 0)

              return (
                <TableRow
                  key={classRecord.classId}
                  className="border-zinc-200/80 hover:bg-purple-50/60 dark:border-white/10 dark:hover:bg-purple-500/5"
                >
                  <TableCell className="px-6 py-5">
                    <span className="block font-bold text-zinc-900 dark:text-zinc-100">
                      {classRecord.className === 'Advanced Beginner / Level 2' ? 'Adv. Beginner / Level 2' : classRecord.className}
                    </span>
                  </TableCell>
                  <TableCell className="px-5 py-5 text-center">
                    <span className="block text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {classRecord.price === null
                        ? "Base price"
                        : formatMonthlyPrice(classRecord.price)}
                    </span>
                    <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                      1st enrollment
                    </span>
                  </TableCell>
                  <TableCell className="px-5 py-5 text-center">
                    <span className="block text-lg font-bold text-purple-400 dark:text-purple-300">
                      {secondEnrollmentPrice === null
                        ? "$10 off"
                        : formatMonthlyPrice(secondEnrollmentPrice)}
                    </span>
                    <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                      2nd enrollment
                    </span>
                  </TableCell>
                  <TableCell className=" px-5 py-5 text-center">
                    <span className="inline-flex items-center gap-1.5 text-lg font-bold text-purple-500 dark:text-purple-400">
                      $15
                    </span>
                    <span className="mt-1 block text-xs text-purple-700/70 dark:text-purple-200/70">
                      Each additional
                    </span>
                  </TableCell>
                  <TableCell className="bg-purple-50 px-5 py-5 text-center dark:bg-purple-500/10">
                    <span className="block text-lg font-bold text-purple-700 dark:text-purple-300">
                      Free
                    </span>
                    <span className="mt-1 block text-xs text-purple-700/70 dark:text-purple-200/70">
                      With cheer enrollment
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        <div className="border-t border-zinc-200 bg-zinc-50 px-6 py-4 text-center text-sm leading-relaxed text-zinc-600 dark:border-white/10 dark:bg-zinc-900/50 dark:text-zinc-400">
          The first enrollment is billed at the regular class rate. The second
          is $10 less, and every enrollment from the third onward is $15 per
          month.
        </div>
      </div>
    </section>
  )
}
