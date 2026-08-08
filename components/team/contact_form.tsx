"use client";

import { useState } from "react";
import Image from "next/image";

export default function ContactForm() {
  const [status, setStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(a: React.FormEvent<HTMLFormElement>) {
    a.preventDefault();
    setStatus("sending");
    setMessage("");

    const form = a.currentTarget;
    const formData = new FormData(form);

    const name = String(formData.get("name") ?? "")
    const email = String(formData.get("email") ?? "")
    const subject = String(formData.get("subject") ?? "")
    const body = String(formData.get("message") ?? "")
    const payload = {
      email,
      subject: `LCC Contact Form: ${subject}`,
      message: `Name: ${name}\nEmail: ${email}\n\nMessage: ${body}`,
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data?.error || "Failed to send message.");

      setStatus("success");
      setMessage("Thanks! Your message has been sent.");
      form.reset();
    } catch (err: unknown) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
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
            Name
            </label>
            <input
            name="name"
            required
            maxLength={100}
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
            />
        </div>

        <div>
            <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Email
            </label>
            <input
            name="email"
            type="email"
            required
            maxLength={254}
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
            />
        </div>
        </div>

        <div>
        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Subject
        </label>
        <input
            name="subject"
            required
            maxLength={100}
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
        />
        </div>

        <div>
        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Message
        </label>
        <textarea
            name="message"
            required
            minLength={10}
            maxLength={3500}
            rows={6}
            className="mt-2 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
        />
        </div>

        <button
          type="submit"
          disabled={status === "sending"}
          className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-600 disabled:opacity-60 dark:text-white dark:hover:bg-purple-700"
          >
          {status === "sending" ? "Sending..." : "Send message"}
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
