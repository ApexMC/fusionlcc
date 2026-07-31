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
        <p className="mt-4 mb-12 max-w-2xl text-center text-zinc-600 dark:text-zinc-400">
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
