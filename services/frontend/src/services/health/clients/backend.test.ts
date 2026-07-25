import { afterEach, describe, expect, it } from "vitest";

import { getBackendBaseUrl } from "./backend";

describe("getBackendBaseUrl", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it("prefers BACKEND_URL and strips trailing slash", () => {
    process.env = {
      ...env,
      BACKEND_URL: "http://127.0.0.1:8000/",
      NEXT_PUBLIC_API_BASE_URL: "/api",
    };
    expect(getBackendBaseUrl()).toBe("http://127.0.0.1:8000");
  });

  it("uses absolute NEXT_PUBLIC_API_BASE_URL when BACKEND_URL is unset", () => {
    process.env = {
      ...env,
      BACKEND_URL: undefined,
      NEXT_PUBLIC_API_BASE_URL: "https://api.example.com/v1/",
    };
    expect(getBackendBaseUrl()).toBe("https://api.example.com/v1");
  });

  it("resolves relative API base against app origin", () => {
    process.env = {
      ...env,
      BACKEND_URL: undefined,
      NEXT_PUBLIC_API_BASE_URL: "/api",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    };
    expect(getBackendBaseUrl()).toBe("http://localhost:3000/api");
  });
});
