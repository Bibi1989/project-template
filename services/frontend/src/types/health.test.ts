import { describe, expect, it } from "vitest";

import { ApiHealthSchema, BackendHealthSchema } from "@/types/health";

describe("ApiHealthSchema", () => {
  it("parses a valid FastAPI health payload", () => {
    const parsed = ApiHealthSchema.parse({
      status: "ok",
      environment: "development",
      service: "template-api",
    });
    expect(parsed.status).toBe("ok");
  });

  it("rejects missing fields", () => {
    expect(() => ApiHealthSchema.parse({ status: "ok" })).toThrow();
  });
});

describe("BackendHealthSchema", () => {
  it("accepts ok with optional body", () => {
    const parsed = BackendHealthSchema.parse({
      ok: true,
      body: { status: "ok" },
    });
    expect(parsed.ok).toBe(true);
  });
});
