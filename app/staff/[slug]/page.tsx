import Image from "next/image";
import { notFound } from "next/navigation";
import { getTeamMember } from "@/components/team/team";

export default async function TeamMemberPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const member = getTeamMember(slug);
  if (!member) return notFound();

  return (
    <div className="min-h-[75vh]] bg-zinc-50 dark:bg-zinc-900 relative z-0">
      <main className="mx-auto w-full max-w-4xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-[240px_1fr]">
          <div>
            <div className="relative aspect-4/5 overflow-hidden rounded-2xl ring-1 ring-zinc-200 dark:ring-zinc-800">
              <Image
                src={member.img}
                alt={`${member.name} headshot`}
                fill
                className="h-auto w-full object-cover"
                priority
              />
            </div>
          </div>
          
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {member.name}
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">{member.title}</p>

            <p className="mt-6 leading-7 text-zinc-700 dark:text-zinc-300">
              {member.bio}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}