"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, FormEvent, useEffect } from "react";
import createClient from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes"
import US_STATES from "@/utils/us_states";
import { useToast } from "@/components/ui/toast";
import { SmartSelect } from "@/components/ui/smart-select";
import { TriangleAlert } from "lucide-react";

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  const national = digits.startsWith("1") ? digits.slice(1, 11) : digits.slice(0, 10);

  if (!national) return "";
  if (national.length < 4) return `+1 (${national}`;
  if (national.length < 7) return `+1 (${national.slice(0, 3)}) ${national.slice(3)}`;
  return `+1 (${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
}

export default function SignInPage() {
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneInput(e.target.value));
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { toast } = useToast()

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", "/login");

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: callbackUrl.toString(),
          data: {
            full_name: firstName + " " + lastName,
            first_name: firstName,
            last_name: lastName,
            phone: phone.replace(/[^0-9+]/g, ''),
            address: address,
            city: city,
            state: state,
            zip_code: zipCode,
          },
        },
      });

      if (error) throw error;

      setError("Check your email to confirm your account!");
    } catch (err: any) {
      setError(err.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
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
        />

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => {
              setActiveTab("signin");
              setError("");
              setPassword("");
              setConfirmPassword("");
            }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === "signin"
                ? "border-b-2 border-purple-600 text-purple-600"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("signup");
              setError("");
              setPassword("");
              setConfirmPassword("");
            }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === "signup"
                ? "border-b-2 border-purple-600 text-purple-600"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Sign In Form */}
        {activeTab === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-5">
            <h1 className="text-3xl text-center font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Sign In
            </h1>
            <p className="mt-3 text-center text-zinc-600 dark:text-zinc-400">
              Welcome to Limitless Cheer!
            </p>

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Password
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </div>

              <div className="text-center">
                <Link href="/forgot-password" className="text-sm text-purple-600 hover:underline">
                  Forgot Password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Signing In..." : "Sign In"}
              </button>
            </div>
          </form>
        )}

        {activeTab === "signup" && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200 text-center">
          <TriangleAlert className="inline-block mr-2 size-4 text-amber-800 dark:text-amber-200" />
          Currently, you must confirm your email on the same device you register on.
        </div>
)}
        {/* Sign Up Form */}
        {activeTab === "signup" && (
          <form onSubmit={handleSignUp} className="space-y-5">
            <h1 className="text-3xl text-center font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Sign Up
            </h1>
            <p className="mt-3 text-center text-zinc-600 dark:text-zinc-400">
              Join Limitless Cheer Co. today!
            </p>

            {error && (
              <div className={`rounded-lg p-3 text-sm ${
                error.includes("Check your email") 
                  ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                  : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
              }`}>
                {error}
              </div>
            )}

            <div className="space-y-5">
              <div className="flex flex-col md:flex-row gap-4">
                <div>
                  <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    First Name
                  </label>
                  <input
                    name="firstName"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    Last Name
                  </label>
                  <input
                    name="lastName"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </div>
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
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
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
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="mt-2 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                </div>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
                <div>
                    <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        State
                    </label>
                    <SmartSelect
                        name="state"
                        required
                        value={state}
                        onValueChange={setState}
                        options={[
                            { value: "", label: "Choose a state" },
                            ...US_STATES,
                        ]}
                        searchPlaceholder="Search states..."
                        className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        Zip Code
                    </label>
                    <input
                        name="zipCode"
                        required
                        type="text"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
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
              <div>
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Phone
                </label>
                <input
                  name="phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="+1 (555) 123-4567"
                  inputMode="tel"
                  className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Password
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Confirm Password
                </label>
                <input
                  name="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-2 mb-6 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Signing Up..." : "Sign Up"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
