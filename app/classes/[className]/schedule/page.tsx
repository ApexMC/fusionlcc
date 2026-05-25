import { getClassSchedule } from "@/components/classes/class_schedules"
import { notFound } from "next/navigation";
import { Card, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"  


export default async function ClassSchedule({
  params,
}: {
  params: Promise<{className : string }>;
}) {
  const { className } = await params;
  console.log("className:", className);
  const classSchedule = getClassSchedule(className);
  if (!classSchedule) return notFound();

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-100 dark:bg-zinc-900 font-sans">
      <main className="flex min-h-[50vh] flex-1 w-full flex-col items-center py-16 px-8 md:px-16 justify-center bg-zinc-100 dark:bg-zinc-900">
        <h1 className="text-4xl font-bold text-zinc-800 dark:text-zinc-200 text-center mx-auto">
          {classSchedule.name}<br />Weekly Schedule
        </h1>
        <p className=" max-w-2xl text-center text-zinc-600 dark:text-zinc-400 mt-4 mb-12">
          Find the best time to join us!
        </p>
        <Card className="mb-8 px-4 max-w-4xl w-full">
          <CardDescription className="text-center text-zinc-600 dark:text-zinc-400 px-2 py-2">
            <div className="flex flex-row gap-2 jusify-center items-center">
              Status:
              <div className="inline-flex gap-1 items-center rounded-full bg-green-100 px-2 pt-0.5 text-green-800 text-sm font-semibold">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Status: Current">
                  <title>Current</title>
                  <circle cx="6" cy="6" r="5" fill="#22C55E" />
                </svg>
                Current — Updated 2026.05.23
              </div>  
            </div>
          </CardDescription>
          <Table className="w-full mx-auto max-w-4xl px-4">
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">Sunday</TableHead>
                <TableHead className="text-center">Monday</TableHead>
                <TableHead className="text-center">Tuesday</TableHead>
                <TableHead className="text-center">Wednesday</TableHead>
                <TableHead className="text-center">Thursday</TableHead>
                <TableHead className="text-center">Friday</TableHead>
                <TableHead className="text-center">Saturday</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="text-center">
                <TableCell>{classSchedule.schedule[0]?.sunday[0] || "—"}</TableCell>
                <TableCell>{classSchedule.schedule[0]?.monday[0] || "—"}</TableCell>
                <TableCell>{classSchedule.schedule[0]?.tuesday[0] || "—"}</TableCell>
                <TableCell>{classSchedule.schedule[0]?.wednesday[0] || "—"}</TableCell>
                <TableCell>{classSchedule.schedule[0]?.thursday[0] || "—"}</TableCell>
                <TableCell>{classSchedule.schedule[0]?.friday[0] || "—"}</TableCell>
                <TableCell>{classSchedule.schedule[0]?.saturday[0] || "—"}</TableCell>
              </TableRow>
              {classSchedule.schedule[0]?.sunday[1]
              || classSchedule.schedule[0]?.monday[1]
              || classSchedule.schedule[0]?.tuesday[1]
              || classSchedule.schedule[0]?.wednesday[1]
              || classSchedule.schedule[0]?.thursday[1]
              || classSchedule.schedule[0]?.friday[1]
              || classSchedule.schedule[0]?.saturday[1] ? (
                <TableRow className="text-center">
                  <TableCell>{classSchedule.schedule[0]?.sunday[1] || "—"}</TableCell>
                  <TableCell>{classSchedule.schedule[0]?.monday[1] || "—"}</TableCell>
                  <TableCell>{classSchedule.schedule[0]?.tuesday[1] || "—"}</TableCell>
                  <TableCell>{classSchedule.schedule[0]?.wednesday[1] || "—"}</TableCell>
                  <TableCell>{classSchedule.schedule[0]?.thursday[1] || "—"}</TableCell>
                  <TableCell>{classSchedule.schedule[0]?.friday[1] || "—"}</TableCell>
                  <TableCell>{classSchedule.schedule[0]?.saturday[1] || "—"}</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </Card>
      </main>
    </div>
  );
}