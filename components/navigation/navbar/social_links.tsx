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
          src="https://faz3a5hyuexckfo1.private.blob.vercel-storage.com/logos/facebook_logo.png?vercel-blob-delegation=eyJzdG9yZUlkIjoic3RvcmVfZkF6M2E1SHlVRVhjS2ZPMSIsIm93bmVySWQiOiJ0ZWFtX1RZT1VTOXg2SVVkcXhJWGUxeXhPNUx2TCIsInBhdGhuYW1lIjoiKiIsIm9wZXJhdGlvbnMiOlsiZ2V0IiwiaGVhZCJdLCJ2YWxpZFVudGlsIjoxNzc5Mjg0OTI0NDE0LCJpYXQiOjE3NzkyNDE3MjQ0NjV9.uLhwKXro4Iu5vGVRCaAbRPPHS_w_dV5SOl3-bS4uH0M&vercel-blob-signature=2R2AwviTwWS9Tlq835flFHStQlw8CejrnwbUJDnkn8M"
          alt="Facebook"
          width={width < 1024 ? "25" : "30"}
          height={width < 1024 ? "25" : "30"}
        />
      </Link>
      <Link href="https://www.tiktok.com/@limitlesscheerco" target="_blank">
        <Image
          src="https://faz3a5hyuexckfo1.private.blob.vercel-storage.com/logos/tiktok_logo.png?vercel-blob-delegation=eyJzdG9yZUlkIjoic3RvcmVfZkF6M2E1SHlVRVhjS2ZPMSIsIm93bmVySWQiOiJ0ZWFtX1RZT1VTOXg2SVVkcXhJWGUxeXhPNUx2TCIsInBhdGhuYW1lIjoiKiIsIm9wZXJhdGlvbnMiOlsiZ2V0IiwiaGVhZCJdLCJ2YWxpZFVudGlsIjoxNzc5Mjg1MDUwNjIyLCJpYXQiOjE3NzkyNDE4NTA2ODh9.8J7YPMatnz0hC4s6ALIxJIRGghjvG-UnIh6hiWf03vs&vercel-blob-signature=a5BwXsKCyuVVE7Kys4GMCvsY5wJnOSnnFlJZhlCAW78"
          alt="TikTok"
          width={width < 1024 ? "25" : "30"}
          height={width < 1024 ? "25" : "30"}
        />
      </Link>
    </div>
    );
};

export default SocialLinks;