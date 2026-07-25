/**
 * Backend HTTP base URL for server-side fetches (RSC / route handlers).
 *
 * Node `fetch` requires an absolute URL — relative paths like `/api` throw
 * "Failed to parse URL". Prefer BACKEND_URL (FastAPI). Fall back to resolving
 * NEXT_PUBLIC_API_BASE_URL against the app origin when it is relative.
 */
export function getBackendBaseUrl(): string {
  const explicit = process.env.BACKEND_URL?.replace(/\/$/, "");
  if (explicit) {
    return explicit;
  }

  const publicBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
  if (/^https?:\/\//i.test(publicBase)) {
    return publicBase.replace(/\/$/, "");
  }

  const origin = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    `http://127.0.0.1:${process.env.PORT ?? "3000"}`
  ).replace(/\/$/, "");

  const path = publicBase.startsWith("/") ? publicBase : `/${publicBase}`;
  return `${origin}${path.replace(/\/$/, "")}`;
}
