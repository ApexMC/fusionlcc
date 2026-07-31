import Link from "next/link";
import Image from "next/image";

interface ClassCardProps {
  imageSrc: string;
  imageAlt: string;
  className: string;
  slug: string;
  price?: number | null;
  duration?: number | null;
  description?: string | null;
  scheduleSummary?: string | null;
  imagePosition?: "left" | "right";
}

const ClassCard = ({
  imageSrc,
  imageAlt,
  className,
  price,
  duration,
  description,
  scheduleSummary,
  slug,
  imagePosition = "left",
}: ClassCardProps) => {
  const isImageLeft = imagePosition === "left";

  return (
    <div className={`flex flex-col ${isImageLeft ? "md:flex-row" : "md:flex-row-reverse"} gap-6 p-6 bg-white dark:bg-zinc-800 rounded-lg shadow-md hover:shadow-lg transition-shadow`}>
      {/* Image Section */}
      <div className="relative w-full md:w-1/4 h-32 md:h-auto rounded-lg overflow-hidden shrink-0">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          sizes="100%"
          className="object-cover"
        />
      </div>

      {/* Content Section */}
      <div className="flex flex-col justify-center items-center flex-1">
        <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {className}
        </h3>

        <span className="text-md mb-2 text-center font-semibold text-zinc-900 dark:text-zinc-400">
          {duration ? `${duration} mins` : "Schedule varies"}
          {scheduleSummary ? " • Active weekly schedule" : null}
        </span>

        <div className="inline-block bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white text-md font-semibold px-2 py-1 rounded mb-4">
          {price ? `$${price} / mo` : "Contact for pricing"}
        </div>

        <p className="text-zinc-700 dark:text-zinc-300 text-center leading-relaxed mb-6">
          {description}
        </p>

        <div className="flex flex-row gap-8">
          <Link
            href={`/classes/${slug}/schedule`}
            className="inline-block font-semibold text-md px-3 py-1.5 bg-zinc-900 dark:bg-zinc-200 text-white dark:text-zinc-900 rounded hover:bg-zinc-800 dark:hover:bg-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-300">
            View Schedule
          </Link>
          <Link
            href={`/classes/${slug}/register`}
            className="inline-block font-semibold text-md px-3 py-1.5 bg-purple-500 text-white rounded hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-300">
            Register
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ClassCard;
