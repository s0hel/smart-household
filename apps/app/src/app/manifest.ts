import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Household",
    short_name: "Household",
    description: "The shared operating system for your family.",
    start_url: "/",
    display: "standalone",
    background_color: "#FCFBF7",
    theme_color: "#15305A",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
