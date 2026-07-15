import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  X,
  CheckCircle2,
  ClipboardList,
  HeartHandshake,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

const teams = [
  {
    name: "Venom",
    level: "Senior Level 2",
    description:
      "A driven senior team for athletes ready to sharpen Level 2 tumbling, stunts, jumps, and performance quality in a competitive team setting.",
    accent: "from-purple-500 to-fuchsia-500",
  },
  {
    name: "Shimmer Storm",
    level: "Youth Level 1",
    description:
      "A youth team focused on strong Level 1 fundamentals, clean technique, confident motions, and learning how to perform together.",
    accent: "from-sky-400 to-purple-500",
  },
  {
    name: "Surge",
    level: "Prep Level 1",
    description:
      "A prep team for athletes building their first competitive cheer foundation with a team-first environment and steady skill progression.",
    accent: "from-orange-400 to-pink-500",
  },
];

const programHighlights = [
  {
    icon: Trophy,
    title: "Competition-Ready Training",
    description:
      "Athletes work toward clean routines, confident performance, and consistent execution across motions, jumps, tumbling, stunts, and dance.",
  },
  {
    icon: Users,
    title: "Team Placement With Purpose",
    description:
      "Coaches consider age, skill level, maturity, and team needs so every athlete has a path that supports growth.",
  },
  {
    icon: HeartHandshake,
    title: "Confident Team Culture",
    description:
      "We expect effort, accountability, and encouragement, because strong teams are built on trust as much as talent.",
  },
];

const seasonSteps = [
  "Attend an evaluation or placement conversation.",
  "Receive a team recommendation from the coaching staff.",
  "Train weekly on routine skills, strength, flexibility, and performance.",
  "Represent Limitless with sportsmanship and strong team commitment.",
];

const expectations = [
  "A positive attitude and willingness to be coached",
  "Consistent practice attendance",
  "Commitment to team goals and performance standards",
  "Family communication as registration details are finalized",
];

export default function CompetitiveCheer() {
  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50">
      <section className="relative flex min-h-[76svh] w-full items-center overflow-hidden px-6 py-20 sm:px-10 lg:px-16">
        <Image
          src="/images/landing_header.png"
          alt="Competitive cheer athlete performing a jump in the gym"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-linear-to-r from-zinc-950/90 via-zinc-950/65 to-zinc-950/20" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-zinc-100 dark:from-zinc-950" />

        <div className="relative z-0 mx-auto flex w-full max-w-6xl flex-col gap-8">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
              <Sparkles className="size-4 text-orange-300" />
              Limitless Cheer & Gymnastics
            </div>
            <h1 className="text-5xl font-bold leading-[1.02] text-white sm:text-6xl lg:text-7xl">
              Competitive Cheer
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-100 sm:text-xl">
              Build the skills, confidence, and team discipline to step onto the
              mat ready to perform. Our competitive cheer program gives athletes
              a focused path from placement to routine-ready training.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#teams"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-purple-500 px-6 py-3 font-bold text-white transition hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                Meet the Teams
                <ArrowRight className="size-4" />
              </a>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 px-6 py-3 font-bold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
              >
                Ask a Question
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full px-6 pb-20 pt-12 sm:px-10 lg:px-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-3">
          {programHighlights.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="rounded-lg bg-white p-6 shadow-md transition-shadow hover:shadow-lg dark:bg-zinc-900"
            >
              <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300">
                <Icon className="size-6" />
              </div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                {title}
              </h2>
              <p className="mt-3 leading-7 text-zinc-600 dark:text-zinc-300">
                {description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="teams" className="w-full scroll-mt-20 bg-white px-6 py-10 dark:bg-zinc-900 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase text-purple-600 dark:text-purple-300">
              2026 Teams
            </p>
            <h2 className="mt-3 text-4xl font-bold text-zinc-900 dark:text-zinc-50">
              A team for each competitive path
            </h2>
            <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
              Each team has its own level and commitment profile, with coaching
              built around safe progression, clean technique, and performance
              confidence.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {teams.map((team) => (
              <article
                key={team.name}
                className="group overflow-hidden rounded-lg bg-zinc-100 shadow-md transition hover:-translate-y-1 hover:shadow-xl dark:bg-zinc-800"
              >
                <div className={`h-2 bg-linear-to-r ${team.accent}`} />
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                        {team.name}
                      </h3>
                      <p className="mt-2 inline-flex rounded-full bg-zinc-900 px-3 py-1 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                        {team.level}
                      </p>
                    </div>
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-purple-600 shadow-sm dark:bg-zinc-900 dark:text-purple-300">
                      <Trophy className="size-5" />
                    </div>
                  </div>
                  <p className="mt-6 leading-7 text-zinc-600 dark:text-zinc-300">
                    {team.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/*<section className="w-full px-6 py-20 sm:px-10 lg:px-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-zinc-200 shadow-xl dark:bg-zinc-800 sm:aspect-[16/11] lg:aspect-[4/5]">
            <Image
              src="/images/classes/class_7.png"
              alt="Cheer athletes practicing tumbling passes"
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover"
            />
          </div>

          <div>
            <p className="text-sm font-bold uppercase text-orange-500">
              What to Expect
            </p>
            <h2 className="mt-3 text-4xl font-bold text-zinc-900 dark:text-zinc-50">
              A clear path from placement to performance
            </h2>
            <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
              Competitive cheer works best when athletes and families know what
              the season asks of them. We keep the path straightforward while
              leaving room for each athlete to grow.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {seasonSteps.map((step, index) => (
                <div
                  key={step}
                  className="flex gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-purple-600 text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <p className="leading-7 text-zinc-700 dark:text-zinc-300">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      */}

      <section className="w-full bg-zinc-100 dark:bg-zinc-950 px-6 py-20 text-black dark:text-white sm:px-10 lg:px-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-start">
          <div>
            <p className="text-sm font-bold uppercase text-purple-400 dark:text-purple-300">
              Athlete Expectations
            </p>
            <h2 className="mt-3 text-4xl font-bold">
              Competitive cheer takes commitment
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-700 dark:text-zinc-300">
              Our coaches will help athletes learn the skills. Athletes bring
              effort, focus, consistency, and a willingness to support the team.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {expectations.map((expectation) => (
              <div
                key={expectation}
                className="flex items-start gap-3 rounded-lg border border-white/10 bg-white dark:bg-white/5 p-4"
              >
                <CheckCircle2 className="mt-1 size-5 shrink-0 text-orange-300" />
                <p className="leading-7 text-zinc-700 dark:text-zinc-100">{expectation}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full px-6 py-20 sm:px-10 lg:px-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-900 sm:p-8 lg:grid-cols-[1fr_0.8fr] lg:p-10">
          <div>
            <div className="mb-5 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-red-500/15 px-3 py-1 text-sm font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-200">
                <X className="size-4" />
                Tryouts currently closed
              </span>
            </div>
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Interested in joining a team?
            </h2>
            <p className="mt-4 max-w-2xl leading-8 text-zinc-600 dark:text-zinc-300">
              Tryouts for competitive cheer teams are currently closed. Circumstances may change and exceptions may be made, so please contact us directly or view our standard tumbling / gymnastics classes.
            </p>
          </div>

          <div className="flex flex-col justify-center gap-3 sm:flex-row lg:flex-col">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-purple-500 px-6 py-3 font-bold text-white transition hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              Contact Us
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/classes"
              className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-6 py-3 font-bold text-zinc-900 transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              View Tumbling Classes
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
