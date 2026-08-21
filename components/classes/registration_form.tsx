"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import createClient from "@/lib/supabase/client";
import { requestEnrollment } from "@/app/actions/enrollments";
import ManageAthleteCard from "@/components/account/athletes/manage_athlete";

const ADD_ATHLETE_VALUE = "__add_athlete__";

type Parent = {
  parent_id: string | number;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
}

type ScheduleOption = {
  scheduleId: string;
  classId: string | null;
  className: string;
  scheduleLabel: string;
}

type ClassOption = {
  classId: string;
  className: string;
}

export default function RegistrationForm({
  classId,
  classes,
}: {
  classId?: string;
  classes: ClassOption[];
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [athletes, setAthletes] = useState<Array<{ athlete_id: string; first_name: string; last_name: string }>>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState("");
  const [userId, setUserId] = useState("");
  const [addAthleteOpen, setAddAthleteOpen] = useState(false);
  const [parent, setParent] = useState<Parent | null>(null);
  const [scheduleOptions, setScheduleOptions] = useState<ScheduleOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classId ?? classes[0]?.classId ?? ""
  );
  const [selectedScheduleId, setSelectedScheduleId] = useState("");

  const selectedClassSchedules = scheduleOptions.filter(
    (option) => option.classId === String(selectedClassId)
  );

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: claims } = await supabase.auth.getClaims();
      const uid = claims?.claims.sub;

      if (uid) {
        setUserId(uid);
        const { data: athletesData } = await supabase
          .from("Athletes")
          .select("athlete_id, first_name, last_name")
          .eq("user_id", uid);
        
        const { data: parentData } = await supabase
          .from("Parents")
          .select("parent_id, first_name, last_name, phone, email, address, city, state, zip_code")
          .eq("user_id", uid)
          .single();

        const nextAthletes = (athletesData || []).map((athlete) => ({
          ...athlete,
          athlete_id: String(athlete.athlete_id),
        }));

        setAthletes(nextAthletes);
        setSelectedAthleteId((currentAthleteId) =>
          nextAthletes.some(
            (athlete) => athlete.athlete_id === currentAthleteId
          )
            ? currentAthleteId
            : nextAthletes[0]?.athlete_id ?? ""
        );
        setParent(parentData);
      }

      const scheduleResponse = await fetch("/api/class-schedules");
      const options = (await scheduleResponse.json().catch(() => [])) as
        | ScheduleOption[]
        | { error?: string };

      if (!scheduleResponse.ok || !Array.isArray(options)) {
        throw new Error(
          Array.isArray(options)
            ? "Class times could not be loaded."
            : options.error ?? "Class times could not be loaded."
        );
      }

      const initialClassId = classId ?? classes[0]?.classId ?? "";
      const initialOption = options.find(
        (option) => option.classId === initialClassId
      );

      setScheduleOptions(options);
      setSelectedClassId(initialClassId);
      setSelectedScheduleId(initialOption?.scheduleId ?? "");
    }

    fetchData().catch((error) => {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Class times could not be loaded."
      );
    });
  }, [classId, classes]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");

    try {
      const selectedClass = classes.find(
        (option) => option.classId === selectedClassId
      );
      const selectedSchedule = scheduleOptions.find(
        (option) => option.scheduleId === selectedScheduleId
      );
      const selectedAthlete = athletes.find(
        (athlete) => athlete.athlete_id === selectedAthleteId
      );

      if (!selectedAthlete || !selectedClass || !selectedSchedule) {
        throw new Error("Please choose an athlete, class, and class time.");
      }

      const selectedAthleteName = `${selectedAthlete.first_name} ${selectedAthlete.last_name}`;

      const enrollmentResult = await requestEnrollment({
        athleteId: String(selectedAthlete.athlete_id),
        classId: selectedClass.classId,
        scheduleId: selectedSchedule.scheduleId,
      });

      if (!enrollmentResult.ok) {
        throw new Error(enrollmentResult.message);
      }

      // Send confirmation email
      const emailPayload = {
        email: parent?.email || "",
        subject: `LCC New Athlete Registration: ${selectedAthleteName}`,
        message: [
          `Parent Name: ${parent?.first_name} ${parent?.last_name}`,
          `Athlete Name: ${selectedAthleteName}`,
          `Requested Class: ${selectedClass.className}`,
          `Selected Time: ${selectedSchedule.scheduleLabel}`,
          ``,
          `Address: ${parent?.address}, ${parent?.city}, ${parent?.state} ${parent?.zip_code}`,
          `Phone Number: ${parent?.phone}`,
          `Email: ${parent?.email}`,
        ].join("\n"),
      };

      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailPayload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to send email.");

      setStatus("success");
      setMessage("Thanks! Your registration has been submitted.");

    } catch (err: unknown) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <>
    <form
        onSubmit={onSubmit}
        className="mt-10 space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <Image
          src="/images/logos/limitless_logo.png"
          alt="Register"
          width={125}
          height={125}
          className="mx-auto"
        />
        <div className="mt-4 mb-8 mx-auto flex justify-center" aria-hidden="true">
            <div className="h-1.5 w-sm rounded-full bg-linear-to-r from-purple-600 to-purple-600" />
        </div>
        <div className="grid gap-5 md:grid-cols-3">
            <div>
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    Athlete Name
                </label>
                <select
                    name="childName"
                    value={selectedAthleteId}
                    onChange={(event) => {
                      if (event.target.value === ADD_ATHLETE_VALUE) {
                        setAddAthleteOpen(true);
                        return;
                      }

                      setSelectedAthleteId(event.target.value);
                    }}
                    required
                    className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                >
                <option value="" disabled>Select athlete</option>
                {athletes?.map((athlete) => (
                    <option key={athlete.athlete_id} value={athlete.athlete_id}>
                    {athlete.first_name} {athlete.last_name}
                    </option>
                ))}
                <option value={ADD_ATHLETE_VALUE}>+ Add Athlete</option>
                </select>
            </div>

            <div>
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    Requested Class
                </label>
                <select 
                    className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                    name="requestedClass"
                    onChange={(e) => {
                        const nextClassId = e.target.value;
                        const nextSchedule = scheduleOptions.find(
                            (option) => option.classId === nextClassId
                        );

                        setSelectedClassId(nextClassId);
                        setSelectedScheduleId(nextSchedule?.scheduleId ?? "");
                    }}
                    value={selectedClassId}
                    required
                >
                    {classes.length ? (
                      classes.map((option) => (
                        <option key={option.classId} value={option.classId}>
                            {option.className}
                        </option>
                      ))
                    ) : (
                      <option value="">No classes available</option>
                    )}
                </select>
            </div>

            <div>
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    Selected Time
                </label>
                <select
                    className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                    name="selectedTime"
                    onChange={(e) => setSelectedScheduleId(e.target.value)}
                    value={selectedScheduleId}
                    required
                    disabled={!selectedClassSchedules.length}
                >
                    {selectedClassSchedules.length ? (
                        selectedClassSchedules.map((option) => (
                            <option key={option.scheduleId} value={option.scheduleId}>
                                {option.scheduleLabel}
                            </option>
                        ))
                    ) : (
                        <option value="">No times available</option>
                    )}
                </select>
            </div>
        </div>

        <div className="flex flex-col gap-3 items-center justify-center">
            <button
                type="submit"
                disabled={status === "sending"}
                className="mt-4 inline-flex items-center justify-center mx-auto rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-60 dark:text-white dark:hover:bg-purple-700"
                >
                {status === "sending" ? "Sending..." : "Request Enrollment"}
            </button>

            {message ? (
            <p
                className={`text-sm ${
                status === "success"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : status === "error"
                    ? "text-red-600 dark:text-red-400"
                    : "text-zinc-600 dark:text-zinc-400"
                }`}
            >
                {message}
            </p>
            ) : null}
        </div>
    </form>
    {userId ? (
      <ManageAthleteCard
        userId={userId}
        parentId={parent?.parent_id}
        icon="+ Add Athlete"
        open={addAthleteOpen}
        onOpenChange={setAddAthleteOpen}
        showTrigger={false}
      />
    ) : null}
    </>
  );
}
