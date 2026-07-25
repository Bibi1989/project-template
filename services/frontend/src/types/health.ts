import { z } from "zod";

/** FastAPI `/health` payload shape. */
export const ApiHealthSchema = z.object({
  status: z.string(),
  environment: z.string(),
  service: z.string(),
});

export type ApiHealth = z.infer<typeof ApiHealthSchema>;

export const BackendHealthSchema = z.object({
  ok: z.boolean(),
  body: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
});

export type BackendHealth = z.infer<typeof BackendHealthSchema>;

export const DatabaseHealthSchema = z.object({
  status: z.enum(["OK", "ERROR"]),
  latency: z.number().optional(),
  database: z.enum(["connected", "disconnected"]),
  version: z.string().optional(),
  environment: z.string().optional(),
  timestamp: z.string(),
  error: z.unknown().optional(),
});

export type DatabaseHealth = z.infer<typeof DatabaseHealthSchema>;
