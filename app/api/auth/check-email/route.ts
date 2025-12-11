import { NextResponse } from "next/server";

import { getAdminSupabase } from "@/lib/supabase/server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST(req: Request) {
  try {
    const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!svcKey) {
      return NextResponse.json({ exists: false }, { headers: JSONH });
    }

    const { email } = (await req.json().catch(() => ({}))) as {
      email?: string;
    };
    const normalizedEmail = (email || "").trim().toLowerCase();
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ exists: false }, { headers: JSONH });
    }

    const supabase = getAdminSupabase();
    const adminApi = supabase.auth.admin as unknown as {
      getUserByEmail?: (emailParam: string) => Promise<{
        data?: { user?: unknown };
        error?: { message?: string };
      }>;
      listUsers?: (params?: { page?: number; perPage?: number }) => Promise<{
        data?: { users?: Array<{ email?: string | null }> };
        error?: { message?: string };
      }>;
    };

    if (typeof adminApi.getUserByEmail === "function") {
      const { data, error } = await adminApi.getUserByEmail(normalizedEmail);
      if (error)
        return NextResponse.json({ exists: false }, { headers: JSONH });
      return NextResponse.json(
        { exists: Boolean(data?.user) },
        { headers: JSONH },
      );
    }

    // Fallback: list users and match by email (best-effort, small page)
    const { data, error } = (await adminApi.listUsers?.({
      page: 1,
      perPage: 200,
    })) || { data: null, error: null };
    if (error) return NextResponse.json({ exists: false }, { headers: JSONH });
    const match =
      data?.users?.some(
        (u) => (u.email || "").toLowerCase() === normalizedEmail,
      ) ?? false;
    return NextResponse.json({ exists: match }, { headers: JSONH });
  } catch {
    return NextResponse.json({ exists: false }, { headers: JSONH });
  }
}

export const dynamic = "force-dynamic";
