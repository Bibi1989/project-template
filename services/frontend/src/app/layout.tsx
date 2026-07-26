import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Sans, IBM_Plex_Mono, Syne } from "next/font/google";

import "./globals.css";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Template — fullstack & DevOps",
  description:
    "FastAPI + Next.js on Kubernetes, with Helm, Terraform/Pulumi, and GitHub Actions CI/CD",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${plex.variable} ${mono.variable} ${syne.variable}`}>
      <body className="min-h-screen bg-surface font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
