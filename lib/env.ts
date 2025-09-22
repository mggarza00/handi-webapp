const requiredVars = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
} as const;

const missing = Object.entries(requiredVars)
  .filter(([, value]) => value == null || value === "")
  .map(([key]) => key);

if (missing.length > 0) {
  const message = `[env] Missing required environment variables: ${missing.join(", ")}`;
  console.error(message);
  if (process.env.NODE_ENV !== "production") {
    throw new Error(message);
  }
}

type RequiredEnv = {
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

const safeEnv = Object.freeze(
  Object.fromEntries(
    Object.entries(requiredVars).map(([key, value]) => [key, value ?? ""]),
  ),
) as RequiredEnv;

export const env = {
  appUrl: safeEnv.NEXT_PUBLIC_APP_URL,
  supabaseUrl: safeEnv.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: safeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: safeEnv.SUPABASE_SERVICE_ROLE_KEY,
} as const;
