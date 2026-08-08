import TeamCard from "@/components/team/team_card";
import { team } from "@/components/team/team";

export default function Staff() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-zinc-900 relative z-0">
      <main className="relative w-full max-w-5xl px-6 py-16 z-0">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Staff
        </h1>

        <p className="mt-3 text-center max-w-xl mx-auto text-zinc-600 dark:text-zinc-400">
          Meet our team, here to guide our athletes to success, confidence, and growth on and off the mat.
        </p>

            <div className="text-center mt-20 mb-10 font-bold text-3xl text-zinc-900 dark:text-zinc-50">
              <div className="mt-10 grid grid-cols-2 gap-6 md:gap-16 sm:grid-cols-3 lg:grid-cols-3 relative z-0">
                {team.map((member, i) => {
                  const offsetClass = i % 3 === 1 ? "sm:translate-y-12" : "";
                  return (
                    <TeamCard
                      key={member.name}
                      member={member}
                      offsetClass={offsetClass}
                    />
                  );
                })}
              </div>
            </div>
      </main>
    </div>
  );
}
