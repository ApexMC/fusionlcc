import Image from "next/image"
import Link from "next/link"

export default function SocialLinks() {
  return (
    <div className="flex gap-4">
      <Link
        href="https://www.facebook.com/fusioncheerpride/"
        target="_blank"
        rel="noreferrer"
        aria-label="Limitless Cheer on Facebook"
      >
        <Image
          src="/images/logos/facebook_logo.png"
          alt=""
          width={30}
          height={30}
          className="size-[25px] lg:size-[30px]"
        />
      </Link>
      <Link
        href="https://www.tiktok.com/@limitlesscheerco"
        target="_blank"
        rel="noreferrer"
        aria-label="Limitless Cheer on TikTok"
      >
        <Image
          src="/images/logos/tiktok_logo.png"
          alt=""
          width={30}
          height={30}
          className="size-[25px] lg:size-[30px]"
        />
      </Link>
    </div>
  )
}
