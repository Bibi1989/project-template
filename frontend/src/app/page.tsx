import { DatabaseStatus } from "@/components/database-status";
import { HealthStatus } from "@/components/health-status";
import { ItemsList } from "@/components/items-list";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        My Template for a new project
      </h1>
      <div>
        <h1>Environments</h1>
        <p>NODE_ENV: {process.env.NODE_ENV}</p>
        <p>DATABASE_URL: {process.env.DATABASE_URL}</p>
        <p>BACKEND_URL: {process.env.BACKEND_URL}</p>
        <p>NEXT_PUBLIC_APP_URL: {process.env.NEXT_PUBLIC_APP_URL}</p>
        <p>NEXT_PUBLIC_API_BASE_URL: {process.env.NEXT_PUBLIC_API_BASE_URL}</p>
      </div>
      <DatabaseStatus />
      <HealthStatus />
      <ItemsList />
    </main>
  );
}
