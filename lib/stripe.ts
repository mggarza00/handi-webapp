import type Stripe from "stripe";

export type StripeMode = "live" | "test";

function getStripeKeyForMode(mode: StripeMode): string | undefined {
  if (mode === "test") {
    return process.env.STRIPE_SECRET_KEY_TEST || undefined;
  }
  return (
    process.env.STRIPE_SECRET_KEY_LIVE ||
    process.env.STRIPE_SECRET_KEY ||
    undefined
  );
}

export function getPublishableKeyForMode(mode: StripeMode): string | null {
  if (mode === "test") {
    return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST || null;
  }
  return (
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
    null
  );
}

// Lazy Stripe loader to avoid build-time ESM/CJS evaluation in API routes
export async function getStripe(): Promise<Stripe | null> {
  const key = process.env.STRIPE_SECRET_KEY as string | undefined;
  if (!key) return null;
  const mod = await import("stripe");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiVersion = "2024-06-20" as any;
  return new mod.default(key, { apiVersion });
}

export async function getStripeForMode(
  mode: StripeMode,
): Promise<Stripe | null> {
  const key = getStripeKeyForMode(mode);
  if (!key) return null;
  const mod = await import("stripe");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiVersion = "2024-06-20" as any;
  return new mod.default(key, { apiVersion });
}
