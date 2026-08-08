import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Limitless Cheer & Gymnastics",
    short_name: "Limitless Cheer",
    description:
      "Cheerleading and gymnastics classes in Tell City, Indiana.",
    start_url: "/",
    display: "standalone",
    background_color: "#18181b",
    theme_color: "#7c3aed",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  }
}
