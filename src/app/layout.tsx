import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: `Air's Gallery Challenge`,
  description:
    "A performance-first rebuild of Air's gallery view — a virtualized, justified wall of images and videos with drag-and-drop, rubber-band selection, search, and sort.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://api.air.inc" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://air-prod.imgix.net" />
      </head>
      <body className={`${inter.className} bg-neutral-100`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
