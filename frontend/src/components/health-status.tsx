import { getBackendHealth } from "@/services/health/queries/get-backend-health";

export async function HealthStatus() {
  const health = await getBackendHealth();

  return (
    <section className="mt-8 space-y-2 text-muted">
      <p>
        Backend health:{" "}
        <span className={health.ok ? "text-accent" : "text-red-400"}>
          {health.ok ? "OK" : "ERROR"}
        </span>
      </p>
      {health.error ? <p>Backend error: {health.error}</p> : null}
      {health.body ? (
        <pre className="overflow-x-auto rounded-lg border border-accent/20 bg-black/40 p-4 text-sm text-ink">
          {JSON.stringify(health.body, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}
