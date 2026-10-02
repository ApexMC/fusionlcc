import Image from "next/image";
import limitlessLogo from "@/public/images/logos/limitless_logo.png";
import Link from "next/link";

const Logo = () => {
  return (
    <Link href="/" className="block">
      <Image
        src={limitlessLogo}
        alt="Logo"
        loading="eager"
        width={85}
        className="h-auto relative"
      />
    </Link>
  );
};

export default Logo;
