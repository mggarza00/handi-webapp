import { z } from "zod";

export const RequestCreateSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  city: z.string().min(2).max(80),
  category: z.string().min(2).max(80),
  subcategories: z.array(z.string()).max(6).default([]),
  budget: z.number().positive().max(1_000_000).optional(),
  required_at: z.string().optional(), // ISO (YYYY-MM-DD) o vacío
  attachments: z
    .array(z.object({ url: z.string().url(), mime: z.string(), size: z.number().max(5_000_000) }))
    .max(5)
    .optional(),
});

export type RequestCreateInput = z.infer<typeof RequestCreateSchema>;
