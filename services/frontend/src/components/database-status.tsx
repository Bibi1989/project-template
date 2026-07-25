import { checkDatabase } from "@/services/health/queries/check-database";

export async function DatabaseStatus() {
  const database = await checkDatabase();

  return (
    <section className="mt-8 space-y-2 text-muted">
      <p>Database status: {database.status}</p>
      <p>Database latency: {database.latency}ms</p>
      <p>Database: {database.database}</p>
      <p>Database version: {database.version}</p>
      <p>Database environment: {database.environment}</p>
      <p>Database timestamp: {database.timestamp}</p>
    </section>
  );
}
