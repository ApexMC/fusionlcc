"use client";

import US_STATES from "@/utils/us_states";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import createClient from "@/lib/supabase/client";

export default function RegistrationForm({ classId, requestedClass }: { classId?: number; requestedClass?: string }) {
  const classOptions = [
  { id: 1, label: "Me + 1 (2yr)" },
  { id: 2, label: "Me + 1 (3-4yr)" },
  { id: 3, label: "Preschool" },
  { id: 4, label: "Beginner / Level 1" },
  { id: 5, label: "Adv. Beginner / Level 1.5" },
  { id: 6, label: "Intermediate / Level 2" },
  { id: 7, label: "Advanced / Level 3" },
  { id: 8, label: "Elite / Level 4" },
];
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [athletes, setAthletes] = useState<Array<{ athlete_id: string; first_name: string; last_name: string }>>([]);
  const [parent, setParent] = useState<any>(null);
  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setMounted(true);
    
    async function fetchData() {
      const supabase = await createClient();
      const { data: claims } = await supabase.auth.getClaims();
      const uid = claims?.claims.sub;
      setUserId(uid);

      if (uid) {
        const { data: athletesData } = await supabase
          .from("Athletes")
          .select("athlete_id, first_name, last_name")
          .eq("user_id", uid);
        
        const { data: parentData } = await supabase
          .from("Parents")
          .select("parent_id, first_name, last_name, phone, email, address, city, state, zip_code")
          .eq("user_id", uid)
          .single();

        setAthletes(athletesData || []);
        setParent(parentData);
      }
    }

    fetchData();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");

    const register = e.currentTarget;
    const registerData = new FormData(register);
    const supabase = await createClient();

    try {
      // Get athlete_id from selected athlete name
      const selectedAthleteName = String(registerData.get("childName") || "");
      const selectedAthlete = athletes.find(
        (a) => `${a.first_name} ${a.last_name}` === selectedAthleteName
      );

      // Insert enrollment record
      const { error: dbError } = await supabase
        .from("Enrollments")
        .insert([{
          athlete_id: selectedAthlete?.athlete_id,
          class_id: classId,
          status: "pending",
        }]);

      if (dbError) throw new Error("Failed to save enrollment: " + dbError.message);

      // Send confirmation email
      const emailPayload = {
        email: parent?.email || "",
        subject: `LCC New Athlete Registration: ${selectedAthleteName}`,
        message: [
          `Parent Name: ${parent?.first_name} ${parent?.last_name}`,
          `Child Name: ${selectedAthleteName}`,
          `Requested Class: ${requestedClass || ""}`,
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
      register.reset();

    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message || "Something went wrong. Please try again.");
    }
  }

  return (
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
        <div className="grid gap-5 md:grid-cols-2">
            <div>
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    Athlete Name
                </label>
                <select
                    name="childName"
                    required
                    className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                >
                {athletes?.map((athlete) => (
                    <option key={athlete.athlete_id} value={athlete.first_name + " " + athlete.last_name}>
                    {athlete.first_name} {athlete.last_name}
                    </option>
                ))}
                </select>
            </div>

            <div>
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    Requested Class
                </label>
                <select 
                    className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                    name="requestedClass"
                    defaultValue={classId ? classId - 1 : ""}
                >
                    {classOptions.map((option, index) => (
                        <option key={option.id} value={index}>
                        {option.label}
                        </option>
                    ))}
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
  );
}