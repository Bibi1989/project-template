async function fetchBackendHealth(): Promise<{
  ok: boolean;
  body?: Record<string, unknown>;
  error?: string;
}> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
  try {
    const res = await fetch(`${base}/health`, { cache: "no-store" });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true, body: (await res.json()) as Record<string, unknown> };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown fetch error",
    };
  }
}

export default async function HomePage() {
  const health = await fetchBackendHealth();

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "min(12vw, 6rem) 1.5rem",
      }}
    >
      <p
        style={{
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontSize: "0.75rem",
          color: "#7eb8c9",
          marginBottom: "1rem",
        }}
      >
        Turnkey Platform
      </p>
      <h1
        style={{
          fontSize: "clamp(2.4rem, 6vw, 3.6rem)",
          lineHeight: 1.05,
          fontWeight: 650,
          margin: "0 0 1rem",
        }}
      >
        Decoupled multi-tenant on GKE
      </h1>
      <p style={{ color: "#a8b8c2", fontSize: "1.125rem", maxWidth: "36ch" }}>
        Next.js frontend and FastAPI backend behind NGINX Ingress, provisioned
        with Terraform on Google Cloud.
      </p>

      <section
        style={{
          marginTop: "2.5rem",
          paddingTop: "1.5rem",
          borderTop: "1px solid rgba(126, 184, 201, 0.25)",
        }}
      >
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>
          Backend health (`/api/health`)
        </h2>
        <pre
          style={{
            margin: 0,
            padding: "1rem 1.15rem",
            background: "rgba(8, 14, 20, 0.75)",
            border: "1px solid rgba(126, 184, 201, 0.2)",
            overflow: "auto",
            fontSize: "0.85rem",
            lineHeight: 1.5,
          }}
        >
          {JSON.stringify(health, null, 2)}
        </pre>
      </section>
    </main>
  );
}
