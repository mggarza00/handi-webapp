import type Stripe from 'stripe';

// Lazy Stripe loader to avoid build-time ESM/CJS evaluation in API routes
export async function getStripe(): Promise<Stripe | null> {
  const key = process.env.STRIPE_SECRET_KEY as string | undefined;
  if (!key) return null;
  const mod = await import('stripe');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiVersion = '2024-06-20' as any;
  return new mod.default(key, { apiVersion });
}

