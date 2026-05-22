import Image from "next/image";

interface ClassCardProps {
  imageSrc: string;
  imageAlt: string;
  className: string;
  description: string;
  imagePosition?: "left" | "right";
}

const ClassCard = ({
  imageSrc,
  imageAlt,
  className,
  description,
  imagePosition = "left",
}: ClassCardProps) => {
  const isImageLeft = imagePosition === "left";

  return (
    <div
      className={`flex flex-col ${
        isImageLeft ? "md:flex-row" : "md:flex-row-reverse"
      } gap-6 p-6 bg-white dark:bg-zinc-800 rounded-lg shadow-md hover:shadow-lg transition-shadow`}
    >
      {/* Image Section */}
      <div className="relative w-full md:w-1/4 h-32 md:h-auto rounded-lg overflow-hidden shrink-0">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          className="object-cover"
        />
      </div>

      {/* Content Section */}
      <div className="flex flex-col justify-center flex-1">
        <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">
          {className}
        </h3>
        <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
};

export default ClassCard;
