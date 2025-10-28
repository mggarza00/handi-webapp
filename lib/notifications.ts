import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { sendEmail } from "@/lib/email";
import {
  applicationCreatedHtml,
  applicationUpdatedHtml,
  agreementCreatedHtml,
  agreementUpdatedHtml,
  messageReceivedHtml,
  proApplicationAcceptedHtml,
  proApplicationRejectedHtml,
} from "@/lib/email-templates";

type DB = unknown;

function getAdmin(): SupabaseClient<DB> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  if (!url || !service) return null;
  return createClient<DB>(url, service);
}

export async function notifyProApplicationDecision(params: {
  user_id: string;
  status: "accepted" | "rejected";
}) {
  const email = await getUserEmail(params.user_id);
  if (!email) return;
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const linkUrl = `${base}/profiles/${params.user_id}`;
  const subject =
    params.status === "accepted"
      ? "¡Bienvenido a Handi como profesional"
      : "Resultado de tu solicitud en Handi";
  const imageUrl = `${base}/images/imagen_correo_sol_aceptada.png`;
  const html =
    params.status === "accepted"
      ? proApplicationAcceptedHtml({ linkUrl, imageUrl })
      : proApplicationRejectedHtml({ linkUrl });
  await sendEmail({ to: email, subject, html });
}

async function getUserEmail(userId: string): Promise<string | null> {
  const admin = getAdmin();
  if (!admin) return null;
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) return null;
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

export async function notifyApplicationCreated(params: {
  request_id: string;
  professional_id: string;
}) {
  const admin = getAdmin();
  if (!admin) return;
  const { request_id } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: req } = await (admin as any)
    .from("requests")
    .select("created_by, title")
    .eq("id", request_id)
    .single();

  const clientId = (
    req as unknown as { created_by?: string } | null | undefined
  )?.created_by;
  if (!clientId) return;
  const email = await getUserEmail(clientId);
  if (!email) return;

  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const linkUrl = `${base}/requests/${request_id}`;
  const reqTitle = (req as unknown as { title?: string } | null | undefined)
    ?.title;
  const subject = "Nueva postulación a tu solicitud";
  const html = applicationCreatedHtml({ requestTitle: reqTitle, linkUrl });
  await sendEmail({ to: email, subject, html });
}

export async function notifyAdminApplicationCreated(params: {
  request_id: string;
  professional_id: string;
}) {
  const admin = getAdmin();
  if (!admin) return;
  const { request_id, professional_id } = params;
  // Obtener info básica
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: req } = await (admin as any)
    .from("requests")
    .select("title, created_by")
    .eq("id", request_id)
    .single();
  const adminTo =
    process.env.HANDEE_ADMIN_EMAIL ||
    process.env.MAIL_DEFAULT_TO ||
    "hola@handi.mx";
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const linkUrl = `${base}/requests/${request_id}`;
  const subject = `Nueva postulación recibida`;
  const reqTitle =
    (req as unknown as { title?: string } | null | undefined)?.title ??
    request_id;
  const html = `
    <h1>Nueva postulación</h1>
    <p>Se registró una nueva postulación a la solicitud <strong>${reqTitle}</strong>.</p>
    <p><a class="btn" href="${linkUrl}">Abrir solicitud</a></p>
    <p class="muted">Pro: ${professional_id}</p>
  `;
  await sendEmail({ to: adminTo, subject, html });
}

export async function notifyApplicationUpdated(params: {
  application_id: string;
  status: string;
}) {
  const admin = getAdmin();
  if (!admin) return;
  const { application_id, status } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: app } = await (admin as any)
    .from("applications")
    .select("professional_id, request_id")
    .eq("id", application_id)
    .single();

  const proId = (
    app as unknown as { professional_id?: string } | null | undefined
  )?.professional_id;
  const reqId = (app as unknown as { request_id?: string } | null | undefined)
    ?.request_id;
  if (!proId || !reqId) return;
  const proEmail = await getUserEmail(proId);
  if (!proEmail) return;

  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const linkUrl = `${base}/requests/${reqId}`;
  const subject = `Tu postulación cambió a: ${status}`;
  const html = applicationUpdatedHtml({ requestId: reqId, status, linkUrl });
  await sendEmail({ to: proEmail, subject, html });
}

export async function notifyAgreementCreated(params: {
  request_id: string;
  professional_id: string;
  agreement_id: string;
}) {
  const admin = getAdmin();
  if (!admin) return;
  const { request_id, professional_id, agreement_id } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: req } = await (admin as any)
    .from("requests")
    .select("created_by, title")
    .eq("id", request_id)
    .single();

  const clientId = (
    req as unknown as { created_by?: string } | null | undefined
  )?.created_by;
  const proEmail = await getUserEmail(professional_id);
  const clientEmail = clientId ? await getUserEmail(clientId) : null;

  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const linkUrl = `${base}/requests/${request_id}`;
  const reqTitle =
    (req as unknown as { title?: string } | null | undefined)?.title ??
    request_id;
  const subject = `Nuevo acuerdo #${agreement_id.slice(0, 8)}`;
  const html = agreementCreatedHtml({
    requestTitle: reqTitle,
    agreementIdShort: agreement_id.slice(0, 8),
    linkUrl,
  });
  if (clientEmail) await sendEmail({ to: clientEmail, subject, html });
  if (proEmail) await sendEmail({ to: proEmail, subject, html });
}

export async function notifyAgreementUpdated(params: {
  agreement_id: string;
  status: string;
}) {
  const admin = getAdmin();
  if (!admin) return;
  const { agreement_id, status } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agr } = await (admin as any)
    .from("agreements")
    .select("request_id, professional_id")
    .eq("id", agreement_id)
    .single();
  if (!agr) return;

  const reqId = (agr as unknown as { request_id?: string } | null | undefined)
    ?.request_id;
  const proId = (
    agr as unknown as { professional_id?: string } | null | undefined
  )?.professional_id;
  if (!reqId) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: req } = await (admin as any)
    .from("requests")
    .select("created_by, title")
    .eq("id", reqId)
    .single();

  const clientId = (
    req as unknown as { created_by?: string } | null | undefined
  )?.created_by;
  const clientEmail = clientId ? await getUserEmail(clientId) : null;
  const proEmail = proId ? await getUserEmail(proId) : null;

  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const linkUrl = `${base}/requests/${reqId}`;
  const reqTitle =
    (req as unknown as { title?: string } | null | undefined)?.title ?? reqId;
  const subject = `Acuerdo actualizado: ${status}`;
  const html = agreementUpdatedHtml({
    requestTitle: reqTitle,
    agreementIdShort: agreement_id.slice(0, 8),
    status,
    linkUrl,
  });
  if (clientEmail) await sendEmail({ to: clientEmail, subject, html });
  if (proEmail) await sendEmail({ to: proEmail, subject, html });
}

export async function notifyMessageReceived(params: {
  request_id: string;
  to_user_id: string;
  text: string;
}) {
  const admin = getAdmin();
  if (!admin) return;
  const { request_id, to_user_id, text } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: req } = await (admin as any)
    .from("requests")
    .select("title")
    .eq("id", request_id)
    .single();

  const email = await getUserEmail(to_user_id);
  if (!email) return;

  const preview = text.length > 120 ? `${text.slice(0, 117)}...` : text;
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const linkUrl = `${base}/requests/${request_id}`;
  const reqTitle =
    (req as unknown as { title?: string } | null | undefined)?.title ??
    request_id;
  const subject = `Nuevo mensaje en tu solicitud`;
  const html = messageReceivedHtml({
    requestTitle: reqTitle,
    preview,
    linkUrl,
  });
  await sendEmail({ to: email, subject, html });
}
