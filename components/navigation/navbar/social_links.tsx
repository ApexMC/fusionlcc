"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";

const SocialLinks = () => {
  const [width, setWidth] = useState(0);

  const updateWidth = () => {
    const newWidth = window.innerWidth;
    setWidth(newWidth);
  };

  useEffect(() => {
    window.addEventListener("resize", updateWidth);
    updateWidth();
  }, []);

  return (
    <div className="flex gap-4">
      <Link href="https://www.facebook.com/fusioncheerpride/" target="_blank">
        <Image
          src="/images/logos/facebook_logo.png"
          alt="Facebook"
          width={width < 1024 ? "25" : "30"}
          height={width < 1024 ? "25" : "30"}
        />
      </Link>
      <Link href="https://www.tiktok.com/@limitlesscheerco" target="_blank">
        <Image
          src="/images/logos/tiktok_logo.png"
          alt="TikTok"
          width={width < 1024 ? "25" : "30"}
          height={width < 1024 ? "25" : "30"}
        />
      </Link>
    </div>
    );
};

export default SocialLinks;