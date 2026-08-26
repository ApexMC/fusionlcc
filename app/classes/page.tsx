import { CalendarDays } from "lucide-react"
import Link from "next/link"

import ClassCard from "@/components/classes/class_card"
import { getPublicClasses } from "@/lib/classes/data"

export default async function ClassSchedules() {
  const classes = await getPublicClasses()

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-100 font-sans dark:bg-zinc-900">
      <main className="flex min-h-[50vh] w-full flex-1 flex-col items-center justify-center bg-zinc-100 px-8 py-16 dark:bg-zinc-900 md:px-16">
        <h1 className="mx-auto text-center text-4xl font-bold text-zinc-800 dark:text-zinc-200">
          Classes
        </h1>
        <Link
          href="/classes/calendar"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-600/20 transition-all hover:-translate-y-0.5 hover:bg-purple-700 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-purple-500 dark:hover:bg-purple-400"
        >
          <CalendarDays className="size-4" aria-hidden="true" />
          View Calendar
        </Link>
        <p className="mt-6 mb-12 max-w-2xl text-center text-zinc-600 dark:text-zinc-400">
          <span className="text-orange-400">Placement Note:</span> Athletes may
          be evaluated by our coaching staff to ensure placement in the class
          that best suits their current skill level and supports safe,
          successful progression.
        </p>

        {classes.length ? (
          <div className="mb-16 grid grid-cols-1 gap-12 lg:grid-cols-2">
            {classes.map((classRecord, index) => (
              <ClassCard
                key={classRecord.classId}
                imageSrc={classRecord.imageSrc}
                imageAlt={classRecord.imageAlt}
                className={classRecord.className}
                slug={classRecord.slug}
                price={classRecord.price}
                duration={classRecord.durationMinutes}
                description={classRecord.description}
                scheduleSummary={classRecord.scheduleSummary}
                imagePosition={index % 2 === 0 ? "left" : "right"}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            No classes are available right now.
          </div>
        )}
      </main>
    </div>
  )
}
