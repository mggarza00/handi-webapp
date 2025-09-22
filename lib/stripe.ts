import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Falta STRIPE_SECRET_KEY");
  // Usar apiVersion por defecto del SDK en runtime
  _stripe = new Stripe(key);
  return _stripe;
}
