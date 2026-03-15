import type { SupabaseClient } from "@supabase/supabase-js";

import { sendEmail } from "@/lib/email";
import {
  dedupeEmails,
  getAdminProfileEmails,
  getConfiguredAdminEmails,
} from "@/lib/profile-change-notify";
import type { Database } from "@/types/supabase";

type AdminRow = { id: string; email: string | null; full_name: string | null };

type AdminNotification = {
  type: string;
  title: string;
  body: string;
  link: string;
};

export async function getAdminUsers(
  admin: SupabaseClient<Database>,
): Promise<AdminRow[]> {
  try {
    const { data } = await admin
      .from("profiles")
      .select("id, email, full_name")
      .or("role.eq.admin,is_admin.eq.true");
    const rows = Array.isArray(data) ? (data as AdminRow[]) : [];
    return rows.filter((row) => row?.id);
  } catch {
    return [];
  }
}

export async function notifyAdminsInApp(
  admin: SupabaseClient<Database>,
  payload: AdminNotification,
) {
  const admins = await getAdminUsers(admin);
  if (!admins.length) return;
  const rows = admins.map((row) => ({
    user_id: row.id,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    link: payload.link,
  }));
  try {
    await admin
      .from("user_notifications")
      .insert(
        rows as Database["public"]["Tables"]["user_notifications"]["Insert"][],
      );
  } catch {
    /* ignore */
  }
}

export async function notifyAdminsEmail(args: {
  subject: string;
  html: string;
  text?: string;
}) {
  const configured = getConfiguredAdminEmails();
  const profileEmails = await getAdminProfileEmails();
  const emails = dedupeEmails([...configured, ...profileEmails]);
  if (!emails.length) return;
  await sendEmail({
    to: emails,
    subject: args.subject,
    html: args.html,
    text: args.text,
  }).catch(() => null);
}
