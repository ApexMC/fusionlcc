import Image from "next/image";
import Link from "next/link";

const SocialLinks = () => {
  return (
    <div className="flex gap-4">
      <Link href="https://www.facebook.com/fusioncheerpride/" target="_blank">
        <Image
          src="/images/logos/facebook_logo.png"
          alt="Facebook"
          width={30}
          height={30}
          className="size-[25px] lg:size-[30px]"
        />
      </Link>
      <Link href="https://www.tiktok.com/@limitlesscheerco" target="_blank">
        <Image
          src="/images/logos/tiktok_logo.png"
          alt="TikTok"
          width={30}
          height={30}
          className="size-[25px] lg:size-[30px]"
        />
      </Link>
    </div>
  );
};

export default SocialLinks;
