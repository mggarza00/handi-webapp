import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { z } from "zod";


import { notifyAgreementUpdated } from "@/lib/notifications";
import type { Database } from "@/types/supabase";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
} as const;

const BodySchema = z.object({
  actor: z.enum(["pro", "client"]),
});

type AgreementsTable = Database["public"]["Tables"]["agreements"];
type AgreementRow = AgreementsTable["Row"];
type AgreementUpdate = AgreementsTable["Update"];
type RequestRow = Database["public"]["Tables"]["requests"]["Row"];
type Actor = z.infer<typeof BodySchema>["actor"];
type WaitingFor = "cliente" | "profesional" | null;

export type ServiceCompletionOptions = {
  method: "POST" | "PUT";
  operation: "complete" | "confirm";
};

const BLOCKED_STATUSES = new Set<AgreementRow["status"] | null>([
  "cancelled",
  "disputed",
]);

const NEEDS_PROGRESS_STATUSES = new Set<AgreementRow["status"] | null>([
  null,
  "negotiating",
  "accepted",
]);

function computeWaitingFor(row: AgreementRow): WaitingFor {
  if (row.status === "completed") {
    return null;
  }

  const proConfirmed = Boolean(row.completed_by_pro);
  const clientConfirmed = Boolean(row.completed_by_client);

  if (proConfirmed && clientConfirmed) {
    return null;
  }

  if (proConfirmed && !clientConfirmed) {
    return "cliente";
  }

  if (!proConfirmed && clientConfirmed) {
    return "profesional";
  }

  return "cliente";
}

function buildSuccessMessage(params: {
  actor: Actor;
  waitingFor: WaitingFor;
  alreadyConfirmed: boolean;
  status: AgreementRow["status"];
  operation: ServiceCompletionOptions["operation"];
}): string {
  if (params.status === "completed") {
    return "Servicio finalizado por ambas partes. Pago liberado al profesional.";
  }

  if (params.alreadyConfirmed) {
    return params.actor === "pro"
      ? "Ya habías confirmado este servicio."
      : "Ya registramos tu confirmación.";
  }

  if (params.waitingFor === "cliente") {
    return "Esperando confirmación del cliente.";
  }

  if (params.waitingFor === "profesional") {
    return "Esperando confirmación del profesional.";
  }

  return params.operation === "confirm"
    ? "Confirmación registrada."
    : "Actualización registrada.";
}

export async function handleServiceCompletion(
  req: NextRequest,
  context: { params: { id: string } },
  options: ServiceCompletionOptions,
) {
  try {
    const idParse = z.string().uuid().safeParse(context.params?.id ?? "");
    if (!idParse.success) {
      return NextResponse.json(
        { ok: false, error: "INVALID_ID" },
        { status: 400, headers: JSON_HEADERS },
      );
    }

    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { ok: false, error: "UNSUPPORTED_MEDIA_TYPE" },
        { status: 415, headers: JSON_HEADERS },
      );
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "INVALID_JSON" },
        { status: 400, headers: JSON_HEADERS },
      );
    }

    const bodyParse = BodySchema.safeParse(payload);
    if (!bodyParse.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "VALIDATION_ERROR",
          detail: bodyParse.error.issues,
        },
        { status: 400, headers: JSON_HEADERS },
      );
    }

    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth?.user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401, headers: JSON_HEADERS },
      );
    }

    const { data: agreement, error: agreementError } = await supabase
      .from("agreements")
      .select(
        "id, request_id, professional_id, amount, status, completed_by_pro, completed_by_client, completed_at, created_at, updated_at",
      )
      .eq("id", idParse.data)
      .maybeSingle();

    if (agreementError) {
      return NextResponse.json(
        { ok: false, error: "DB_ERROR", detail: agreementError.message },
        { status: 500, headers: JSON_HEADERS },
      );
    }

    if (!agreement) {
      return NextResponse.json(
        { ok: false, error: "SERVICE_NOT_FOUND" },
        { status: 404, headers: JSON_HEADERS },
      );
    }

    if (BLOCKED_STATUSES.has(agreement.status)) {
      return NextResponse.json(
        { ok: false, error: "STATUS_BLOCKED" },
        { status: 409, headers: JSON_HEADERS },
      );
    }

    const actor = bodyParse.data.actor;
    const userId = auth.user.id;

    if (actor === "pro") {
      if (userId !== agreement.professional_id) {
        return NextResponse.json(
          { ok: false, error: "FORBIDDEN" },
          { status: 403, headers: JSON_HEADERS },
        );
      }
    } else {
      if (!agreement.request_id) {
        return NextResponse.json(
          { ok: false, error: "REQUEST_NOT_LINKED" },
          { status: 422, headers: JSON_HEADERS },
        );
      }

      const { data: request, error: requestError } = await supabase
        .from("requests")
        .select("id, created_by")
        .eq("id", agreement.request_id)
        .maybeSingle();

      if (requestError) {
        return NextResponse.json(
          { ok: false, error: "DB_ERROR", detail: requestError.message },
          { status: 500, headers: JSON_HEADERS },
        );
      }

      const requestRow = request as RequestRow | null;
      if (!requestRow || requestRow.created_by !== userId) {
        return NextResponse.json(
          { ok: false, error: "FORBIDDEN" },
          { status: 403, headers: JSON_HEADERS },
        );
      }
    }

    const alreadyConfirmed =
      actor === "pro"
        ? Boolean(agreement.completed_by_pro)
        : Boolean(agreement.completed_by_client);

    const nextCompletedByPro =
      actor === "pro" ? true : Boolean(agreement.completed_by_pro);
    const nextCompletedByClient =
      actor === "client" ? true : Boolean(agreement.completed_by_client);
    const bothConfirmed = nextCompletedByPro && nextCompletedByClient;

    const update: AgreementUpdate = {};

    if (!alreadyConfirmed) {
      if (actor === "pro") {
        update.completed_by_pro = true;
      } else {
        update.completed_by_client = true;
      }
    }

    if (bothConfirmed) {
      if (agreement.status !== "completed") {
        update.status = "completed";
      }
      if (!agreement.completed_at) {
        update.completed_at = new Date().toISOString();
      }
    } else if (!alreadyConfirmed && NEEDS_PROGRESS_STATUSES.has(agreement.status)) {
      update.status = "in_progress";
    }

    let updatedAgreement = agreement;

    if (Object.keys(update).length > 0) {
      const { data: updated, error: updateError } = await supabase
        .from("agreements")
        .update(update)
        .eq("id", agreement.id)
        .select(
          "id, request_id, professional_id, amount, status, completed_by_pro, completed_by_client, completed_at, created_at, updated_at",
        )
        .maybeSingle();

      if (updateError) {
        return NextResponse.json(
          { ok: false, error: "UPDATE_FAILED", detail: updateError.message },
          { status: 500, headers: JSON_HEADERS },
        );
      }

      const updatedRow = updated as AgreementRow | null;
      if (!updatedRow) {
        return NextResponse.json(
          { ok: false, error: "UPDATE_NOT_FOUND" },
          { status: 500, headers: JSON_HEADERS },
        );
      }

      updatedAgreement = updatedRow;

      if (update.status !== undefined && update.status !== agreement.status && update.status) {
        try {
          await notifyAgreementUpdated({
            agreement_id: updatedAgreement.id,
            status: update.status,
          });
        } catch {
          // Ignoramos errores de notificación para no bloquear la respuesta.
        }
      }
    }

    const waitingFor = computeWaitingFor(updatedAgreement);
    const message = buildSuccessMessage({
      actor,
      waitingFor,
      alreadyConfirmed,
      status: updatedAgreement.status,
      operation: options.operation,
    });

    return NextResponse.json(
      {
        ok: true,
        agreement: updatedAgreement,
        waitingFor,
        message,
        actor,
        alreadyConfirmed,
        operation: options.operation,
        method: options.method,
      },
      { status: 200, headers: JSON_HEADERS },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail },
      { status: 500, headers: JSON_HEADERS },
    );
  }
}
