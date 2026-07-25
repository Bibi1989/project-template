import { db } from "@/lib/db";
import type { DatabaseHealth } from "@/types/health";

/** Probe Postgres connectivity for the local Next.js health route. */
export async function checkDatabase(): Promise<DatabaseHealth> {
  const startedAt = Date.now();
  const timestamp = new Date().toISOString();

  try {
    const client = await db.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }

    return {
      status: "OK",
      latency: Date.now() - startedAt,
      database: "connected",
      version: process.env.npm_package_version,
      environment: process.env.NODE_ENV,
      timestamp,
    };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : undefined;

    // ECONNREFUSED = Postgres not running locally; keep the log short
    if (code === "ECONNREFUSED") {
      console.warn(
        "Database unreachable (ECONNREFUSED). Is Postgres running on DATABASE_URL?",
      );
    } else {
      console.error("Error connecting to database", error);
    }

    return {
      status: "ERROR",
      database: "disconnected",
      timestamp,
      error: code ?? "unknown",
    };
  }
}
