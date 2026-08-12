"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import createClient from "@/lib/supabase/client";

type RecoveryStatus = "checking" | "ready" | "invalid" | "complete";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<RecoveryStatus>("checking");

  useEffect(() => {
    let active = true;

    const verifyRecoverySession = async () => {
      const hasInvalidLink =
        new URLSearchParams(window.location.search).get("error") ===
        "invalid_link";

      if (hasInvalidLink) {
        if (active) setStatus("invalid");
        return;
      }

      const { data, error: userError } = await supabase.auth.getUser();
      if (active) {
        setStatus(data.user && !userError ? "ready" : "invalid");
      }
    };

    void verifyRecoverySession();

    return () => {
      active = false;
    };
  }, [supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
    } else {
      setPassword("");
      setConfirmPassword("");
      setStatus("complete");
    }

    setLoading(false);
  };

  return (
    <section className="mx-auto max-w-2xl px-6 py-16">
      <div className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <Image
          src="/images/logos/limitless_logo.png"
          alt="Limitless Logo"
          width={125}
          height={125}
          className="mx-auto"
          priority
        />

        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Choose a new password
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Enter and confirm the new password for your account.
          </p>
        </div>

        {status === "checking" && (
          <p role="status" className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            Verifying your reset link...
          </p>
        )}

        {status === "invalid" && (
          <div className="space-y-5">
            <div
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
            >
              This password reset link is invalid or has expired. Request a new
              link to try again.
            </div>
            <Link
              href="/forgot-password"
              className="block w-full rounded-lg bg-purple-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2"
            >
              Request a new link
            </Link>
          </div>
        )}

        {status === "ready" && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
              >
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="new-password"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                New password
              </label>
              <input
                id="new-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-new-password"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Confirm new password
              </label>
              <input
                id="confirm-new-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        )}

        {status === "complete" && (
          <div className="space-y-5">
            <div
              role="status"
              className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400"
            >
              Your password has been updated successfully.
            </div>
            <Link
              href="/account"
              className="block w-full rounded-lg bg-purple-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2"
            >
              Continue to your account
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
