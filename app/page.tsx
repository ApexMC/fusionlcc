import Image from "next/image";
import Link from "next/link";
import { Sparkles, Users, Trophy, HeartHandshake } from "lucide-react";
import ClassCard from "@/components/classes/class_card";

const highlights = [
  {
    icon: Sparkles,
    title: "Classes For Every Age",
    description:
      "From our youngest Me + 1 athletes to advanced tumblers, we have a class built for every age and skill level.",
  },
  {
    icon: Trophy,
    title: "Competitive Cheer",
    description:
      "Our competitive teams train athletes to compete at the highest level while building lifelong confidence and teamwork.",
  },
  {
    icon: Users,
    title: "Experienced Coaching",
    description:
      "Our coaching staff brings years of gymnastics and cheer experience, focused on safe and steady skill progression.",
  },
  {
    icon: HeartHandshake,
    title: "A Supportive Community",
    description:
      "We're more than a gym — we're a team. Families are welcomed into a supportive, encouraging environment.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-100 dark:bg-zinc-900 font-sans">
      {/* Hero */}
      <section className="relative flex w-full flex-col items-center overflow-hidden px-6 py-24 text-center sm:py-32">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-purple-500/10 via-transparent to-transparent dark:from-purple-500/10" />
        <Image
          src="/images/logos/limitless_logo.png"
          alt="Limitless Cheer & Gymnastics logo"
          width={120}
          height={120}
          className="mb-6"
          priority
        />
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          Welcome to Limitless<br/>Cheer & Gymnastics!
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          A premier cheerleading and gymnastics gym located in the heart of Tell City,
          building confidence, strength, and skill in every athlete.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Link href="/classes" className="rounded-full border border-zinc-300 px-6 py-3 bg-purple-600 font-bold text-zinc-100 transition hover:bg-purple-500 dark:border-zinc-700 dark:hover:bg-purple-800">
            View Classes
          </Link>
          <Link
            href="/contact"
            className="rounded-full border border-zinc-300 px-6 py-3 font-bold text-zinc-800 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Contact Us
          </Link>
        </div>
      </section>

      {/* Highlights */}
      <section className="w-full max-w-6xl px-6 py-16 sm:px-16">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col items-center gap-3 rounded-lg bg-white p-6 text-center shadow-md transition-shadow hover:shadow-lg dark:bg-zinc-800"
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
                <Icon className="size-6" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {title}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Competitive Cheer */}
      <section className="relative w-full overflow-hidden px-6 py-16 sm:px-16">
        <Image
          src="/images/landing_header.png"
          alt="Competitive cheer athlete performing a jump in the gym"
          fill
          priority
          aria-hidden="true"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/45" />

        <div className="relative z-10">
          <h2 className="text-center text-3xl font-bold text-white">
            Competitive Cheer
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-white/90">
            Tryouts for competitive cheer teams are currently closed. Circumstances may change and exceptions may be made, so please contact us directly or view our standard tumbling / gymnastics classes.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/competitive-cheer"
              className="inline-block rounded bg-purple-500 px-5 py-2.5 font-semibold text-white hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Classes */}
      <section className="w-full max-w-5xl px-6 py-16 sm:px-16">
        <h2 className="text-center text-3xl font-bold text-zinc-800 dark:text-zinc-200">
          Featured Classes
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-zinc-600 dark:text-zinc-400">
          A sample of what we offer — visit our classes page for the full schedule and pricing.
        </p>
        <div className="mt-12 grid grid-cols-1 gap-12">
          <ClassCard
            imageSrc="/images/classes/class_1.png"
            imageAlt="Me + 1 class"
            className="Me + 1 (2yr)"
            slug="me-1-2yr"
            price={48}
            duration={30}
            description="Designed for our youngest athletes, this class introduces basic movement, coordination, and tumbling skills in a fun supportive environment."
            imagePosition="left"
          />
          <ClassCard
            imageSrc="/images/classes/class_4.png"
            imageAlt="Beginner tumbling class"
            className="Beginner / Level 1"
            slug="beginner-level-1"
            price={59}
            duration={55}
            description="Ideal for athletes beginning their tumbling journey. This class focuses on developing strength, flexibility, body control, and proper technique."
            imagePosition="right"
          />
        </div>
        <div className="mt-12 flex justify-center">
          <Link
            href="/classes"
            className="inline-block rounded font-semibold text-white bg-purple-500 px-5 py-2.5 hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-300"
          >
            See All Classes
          </Link>
        </div>
      </section>

      {/* Call To Action */}
      <section className="w-full bg-linear-to-r from-purple-700 to-purple-500 py-8 text-center text-white">
        <h2 className="text-3xl font-bold">Ready to get started?</h2>
        <p className="mx-auto mt-3 max-w-xl px-6 text-purple-100">
          Reach out to our team with any questions, or register today to join the Limitless family.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/classes"
            className="rounded-full bg-white px-6 py-3 font-bold text-purple-700 transition hover:bg-purple-100"
          >
            Register Now
          </Link>
          <Link
            href="/contact"
            className="rounded-full border border-white px-6 py-3 font-bold text-white transition hover:bg-white/10"
          >
            Contact Us
          </Link>
        </div>
      </section>
    </div>
  );
}
