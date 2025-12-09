import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function isValidHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

type NoopResult = Promise<{ data: null; error: null }>;

type NoopQuery = {
  select: () => NoopResult;
  insert: () => NoopResult;
  update: () => NoopResult;
  upsert: () => NoopResult;
  delete: () => NoopResult;
  single: () => NoopResult;
  maybeSingle: () => NoopResult;
  range: () => NoopQuery;
  eq: () => NoopQuery;
  neq: () => NoopQuery;
  in: () => NoopQuery;
  lt: () => NoopQuery;
  lte: () => NoopQuery;
  gt: () => NoopQuery;
  gte: () => NoopQuery;
  is: () => NoopQuery;
  order: () => NoopQuery;
  limit: () => NoopQuery;
};

function createNoopClient(): SupabaseClient {
  const noop: () => NoopResult = async () => ({ data: null, error: null });
  const authNoop: () => NoopResult = async () => ({ data: null, error: null });

  const query: NoopQuery = {
    select: noop,
    insert: noop,
    update: noop,
    upsert: noop,
    delete: noop,
    single: noop,
    maybeSingle: noop,
    range: () => query,
    eq: () => query,
    neq: () => query,
    in: () => query,
    lt: () => query,
    lte: () => query,
    gt: () => query,
    gte: () => query,
    is: () => query,
    order: () => query,
    limit: () => query,
  };

  const storageBucket = {
    upload: noop,
    remove: noop,
    download: noop,
    getPublicUrl: (_path?: string) => ({
      data: { publicUrl: "" },
      error: null,
    }),
  };

  return {
    from: () => query,
    storage: { from: () => storageBucket },
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signInWithPassword: authNoop,
      signOut: authNoop,
    },
  } as unknown as SupabaseClient;
}

export const supabase: SupabaseClient =
  isValidHttpUrl(url) && !!anonKey
    ? createClient(url, anonKey)
    : createNoopClient();

export default supabase;
