"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";

const Logo = () => {
  //update the size of the logo when the size of the screen changes
  const [width, setWidth] = useState(0);

  const updateWidth = () => {
    const newWidth = window.innerWidth;
    setWidth(newWidth);
  };

  useEffect(() => {
    window.addEventListener("resize", updateWidth);
    updateWidth();
  }, []);

  // change between the logo and the button when the user scrolls
  const [showButton, setShowButton] = useState(false);

  const changeNavButton = () => {
    if (window.scrollY >= 400 && window.innerWidth < 800) {
      setShowButton(true);
    } else {
      setShowButton(false);
    }
  };

  useEffect(() => {
    window.addEventListener("scroll", changeNavButton);
  }, []);

  return (
    <>
      <Link href="/" style={{ display: showButton ? "none" : "block" }}>
        <Image
          src="https://faz3a5hyuexckfo1.private.blob.vercel-storage.com/logos/limitless_logo.png?vercel-blob-delegation=eyJzdG9yZUlkIjoic3RvcmVfZkF6M2E1SHlVRVhjS2ZPMSIsIm93bmVySWQiOiJ0ZWFtX1RZT1VTOXg2SVVkcXhJWGUxeXhPNUx2TCIsInBhdGhuYW1lIjoiKiIsIm9wZXJhdGlvbnMiOlsiZ2V0IiwiaGVhZCJdLCJ2YWxpZFVudGlsIjoxNzc5Mjc0OTMxMjIwLCJpYXQiOjE3NzkyMzE3MzEyNjl9.ZYOZuRkltz9yj2Y2ZyhrgR4k1yVD-p4pN6-SUS9GY2A&vercel-blob-signature=_2RT3cIJjwFiT_Bxo5dT9fKzke0727RGsk2fHA_wroI"
          alt="Logo"
          width={width < 1024 ? "75" : "75"}
          height={width < 1024 ? "75" : "75"}
          className="relative"
        />
      </Link>
      <div
        style={{
          display: showButton ? "block" : "none",
        }}
      >
      </div>
    </>
  );
};

export default Logo;