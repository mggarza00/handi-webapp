import { cookies } from "next/headers";

export function getTestRole():
  | "guest"
  | "client"
  | "professional"
  | "admin"
  | null {
  const allowed =
    process.env.NODE_ENV !== "production" || process.env.CI === "true";
  if (!allowed) return null;
  const c = cookies().get("handee_role")?.value as string | undefined;
  if (c === "client" || c === "professional" || c === "admin" || c === "guest")
    return c;
  return null;
}
