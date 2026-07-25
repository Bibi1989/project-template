import { getBackendBaseUrl } from "@/services/health/clients/backend";
import type { BackendHealth } from "@/types/health";

/** Fetch FastAPI / GKE backend health (RSC-safe). */
export async function getBackendHealth(): Promise<BackendHealth> {
  const base = getBackendBaseUrl();

  try {
    const res = await fetch(`${base}/health`, { cache: "no-store" });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return {
      ok: true,
      body: (await res.json()) as Record<string, unknown>,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown fetch error",
    };
  }
}
