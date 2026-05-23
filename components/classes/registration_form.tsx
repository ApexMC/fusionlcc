"use client";

import US_STATES from "@/utils/us_states";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";

export default function RegistrationForm() {
  const [status, setStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");

    const form = e.currentTarget;
    const formData = new FormData(form);

    const payload = {
      parentName: String(formData.get("parentName") || ""),
      childName: String(formData.get("childName") || ""),
      childDOB: String(formData.get("childDOB") || ""),
      email: String(formData.get("email") || ""),
      phoneNumber: String(formData.get("phoneNumber") || ""),
      address: String(formData.get("address") + ", " + formData.get("city") + ", " + formData.get("state") + " " + formData.get("zipCode") || ""),
      requestedClass: String(formData.get("requestedClass") || ""),
    };

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data?.error || "Failed to send message.");

      setStatus("success");
      setMessage("Thanks! Your registration has been submitted.");
      form.reset();
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
          alt="Contact"
          width={125}
          height={125}
          className="mx-auto"
        />
        <div className="grid gap-5 md:grid-cols-2">
        <div>
            <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Parent / Guardian Name
            </label>
            <input
            name="parentName"
            required
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
            />
        </div>

        <div>
            <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Child Name
            </label>
            <input
            name="childName"
            required
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
            />
        </div>
        </div>

        <div>
        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Childs Date of Birth
        </label>
        <input
            name="childDOB"
            type="date"
            required
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
        />
        </div>

        <div>
        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Phone Number
        </label>
        <input
            name="phoneNumber"
            required
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
        />
        </div>

        <div>
        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Email Address
        </label>
        <input
            name="email"
            required
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
        />
        </div>

        <div>
        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Requested Class
        </label>
            <select 
                className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                name="requestedClass"
            >
                <option value="Me + 1 (2yr)">Me + 1 (2yr)</option>
                <option value="Me + 1 (3-4yr)">Me + 1 (3-4yr)</option>
                <option value="Preschool">Preschool</option>
                <option value="Beginner / Level 1">Beginner / Level 1</option>
                <option value="Advanced Beginner / Level 1.5">Advanced Beginner / Level 1.5</option>
                <option value="Intermediate / Level 2">Intermediate / Level 2</option>
                <option value="Advanced / Level 3">Advanced / Level 3</option>
                <option value="Elite / Level 4">Elite / Level 4</option>
            </select>
        </div>

        <div className="mt-10 mb-8 mx-auto flex justify-center" aria-hidden="true">
            <div className="h-1.5 w-sm rounded-full bg-linear-to-r from-purple-600 to-purple-600" />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
            <div>
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    Home Address
                </label>
                <textarea
                    name="address"
                    required
                    rows={1}
                    className="mt-2 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                />
            </div>
            <div>
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    City
                </label>
                <textarea
                    name="city"
                    required
                    rows={1}
                    className="mt-2 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                />
            </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
            <div>
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    State
                </label>
                <select 
                    name="state"
                    required
                    className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50">
                    <option value="">Choose a state</option>

                    {US_STATES.map((state) => (
                        <option key={state.value} value={state.value}>
                        {state.label}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    Zip Code
                </label>
                <input
                    name="zipCode"
                    required
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={10}
                    className="mt-2 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                />
            </div>
            <div>
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    Country
                </label>
                <input
                    name="country"
                    readOnly
                    value="United States"
                    type="text"
                    className="mt-2 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                />
            </div>
        </div>

        <button
          type="submit"
          disabled={status === "sending"}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-60 dark:text-white dark:hover:bg-purple-700"
          >
          {status === "sending" ? "Sending..." : "Register"}
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
    </form>
  );
}