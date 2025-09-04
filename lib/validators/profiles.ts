import { z } from "zod";

// Estructuras de categorías/subcategorías: objetos { name } o strings
const NamedItem = z.object({ name: z.string().min(1).max(80) });
const NamedInput = z.union([z.string().min(1).max(80), NamedItem]);

export const ProfileUpsertSchema = z.object({
  full_name: z.string().min(2).max(120).optional(),
  avatar_url: z.string().url().optional(),
  headline: z.string().min(2).max(120).optional(),
  bio: z.string().min(2).max(2000).optional(),
  years_experience: z.number().int().min(0).max(80).optional(),
  city: z.string().min(2).max(120).optional(),
  cities: z.array(z.string().min(1).max(120)).max(20).optional(),
  categories: z
    .array(NamedInput)
    .max(20)
    .optional()
    .transform((arr) => arr?.map((x) => (typeof x === "string" ? { name: x } : x)) ?? undefined),
  subcategories: z
    .array(NamedInput)
    .max(50)
    .optional()
    .transform((arr) => arr?.map((x) => (typeof x === "string" ? { name: x } : x)) ?? undefined),
});

export type ProfileUpsertInput = z.infer<typeof ProfileUpsertSchema>;

