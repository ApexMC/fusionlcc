"use client";
import Image from "next/image";
import Link from "next/link";

function TeamCard({
  member,
  offsetClass,
}: {
  member: {
    name: string;
    title: string;
    img: string;
    slug: string;
  };
  offsetClass?: string;
}) {
  return (
    <Link
      href={`/staff/${member.slug}`}
      onClick={() => window.scrollTo({ top: 0, behavior: "auto" })}
      className={`group block cursor-pointer relative p-4 isolate ${offsetClass ?? ""}`}>
      {/* Underglow gradient */}
      <span className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-r from-pink-300 via-pink-200 to-pink-300 opacity-0 blur-2xl transition-all duration-300 group-hover:opacity-60 will-change-transform" style={{ transform: 'translateZ(0)' }} />

      <div className="relative z-10 overflow-hidden rounded-2xl bg-white shadow-sm ring-2 ring-zinc-200 transition-all duration-300 hover:shadow-md dark:bg-black dark:ring-zinc-900">
        {/* Image */}
        <div className="relative aspect-4/5 overflow-hidden">
          <Image
            src={member.img}
            alt={`${member.name} headshot`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-black/60 to-transparent" />
        </div>

        {/* Basic Info */}
        <div className="p-4">
          <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {member.name}
          </div>
          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {member.title}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default TeamCard;