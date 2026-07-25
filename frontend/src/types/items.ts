import { z } from "zod";

export const ItemSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
});

export type Item = z.infer<typeof ItemSchema>;
