import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Turnkey Platform",
  description: "Decoupled multi-tenant GCP / GKE boilerplate",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          fontFamily:
            '"IBM Plex Sans", "Segoe UI", system-ui, -apple-system, sans-serif',
          background:
            "radial-gradient(1200px 600px at 10% -10%, #1a3a4a 0%, transparent 55%), radial-gradient(900px 500px at 100% 0%, #2d1f14 0%, transparent 50%), #0b1218",
          color: "#e8eef2",
        }}
      >
        {children}
      </body>
    </html>
  );
}
