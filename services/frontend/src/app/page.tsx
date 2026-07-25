import Link from "next/link";

import { DatabaseStatus } from "@/components/database-status";
import { HealthStatus } from "@/components/health-status";
import { ItemsList } from "@/components/items-list";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-10 flex items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Template
        </h1>
        <Link
          href="/blog"
          className="text-sm text-accent underline-offset-4 hover:underline"
        >
          Setup guide →
        </Link>
      </div>
      <p className="mb-8 text-muted">
        My Template for a new project — status widgets below. Full walkthrough:{" "}
        <Link href="/blog" className="text-accent hover:underline">
          From zero to running
        </Link>
        .
      </p>
      <div className="space-y-2 border border-line bg-surface-2/50 p-4 font-mono text-sm text-muted">
        <p className="text-ink">Environments</p>
        <p>NODE_ENV: {process.env.NODE_ENV}</p>
        <p>DATABASE_URL: {process.env.DATABASE_URL}</p>
        <p>BACKEND_URL: {process.env.BACKEND_URL}</p>
        <p>NEXT_PUBLIC_APP_URL: {process.env.NEXT_PUBLIC_APP_URL}</p>
        <p>NEXT_PUBLIC_API_BASE_URL: {process.env.NEXT_PUBLIC_API_BASE_URL}</p>
      </div>
      <div className="mt-8 space-y-6">
        <DatabaseStatus />
        <HealthStatus />
        <ItemsList />
      </div>
    </main>
  );
}
