import type { AssistantAction, AssistantIntentId } from "@/types/assistant";

type ApplicableRole = "client" | "pro" | "any";

type IntentDefinition = {
  id: AssistantIntentId;
  role: ApplicableRole;
  triggers: string[];
  response: string;
  actions: AssistantAction[];
  escalateToSupport?: boolean;
};

export type CanonicalIntentMatch = {
  id: AssistantIntentId;
  response: string;
  actions: AssistantAction[];
  escalateToSupport: boolean;
  confidence: number;
};

const SUPPORT_WHATSAPP = "https://wa.me/528130878691";
const SUPPORT_MAIL = "mailto:soporte@handi.mx";

const appAction = (label: string, href: string): AssistantAction => ({
  type: "app_link",
  label,
  href,
});

const waAction = (label = "Abrir WhatsApp"): AssistantAction => ({
  type: "whatsapp",
  label,
  href: SUPPORT_WHATSAPP,
});

const mailAction = (label = "Escribir por correo"): AssistantAction => ({
  type: "mailto",
  label,
  href: SUPPORT_MAIL,
});

const INTENTS: IntentDefinition[] = [
  {
    id: "create_request",
    role: "any",
    triggers: [
      "como hago una solicitud",
      "crear solicitud",
      "nueva solicitud",
      "publicar servicio",
      "pedir servicio",
    ],
    response:
      "Puedes crearla desde el botón Nueva solicitud. Completa el servicio, ubicación y detalles, y luego envíala para que te contacten profesionales.",
    actions: [
      appAction("Ir a nueva solicitud", "/requests/new"),
      appAction("Ver ayuda", "/help"),
      waAction("Contactar soporte"),
    ],
  },
  {
    id: "apply_to_job",
    role: "pro",
    triggers: [
      "como me postulo",
      "postularme",
      "aplicar a un trabajo",
      "como aplico",
      "como postular",
    ],
    response:
      "Para postularte, abre una solicitud disponible y usa la opción Postularme. Después puedes dar seguimiento desde tus postulaciones.",
    actions: [
      appAction("Ver solicitudes", "/requests/explore"),
      appAction("Ver postulaciones", "/applied"),
      appAction("Ver ayuda", "/help"),
    ],
  },
  {
    id: "contact_support",
    role: "any",
    triggers: [
      "hablar con soporte",
      "contactar soporte",
      "soporte handi",
      "ayuda de handi",
    ],
    response:
      "Te ayudo a hablar con soporte de Handi. Si es urgente o hay un problema operativo, lo más rápido es WhatsApp.",
    actions: [waAction(), appAction("Ver ayuda", "/help"), mailAction()],
    escalateToSupport: true,
  },
  {
    id: "open_messages",
    role: "any",
    triggers: [
      "abrir mensajes",
      "como hablo con el cliente",
      "abrir chat",
      "donde esta el chat",
      "quiero hablar con el cliente",
    ],
    response:
      "Puedes continuar la conversación desde Mensajes. Ahí verás tus chats activos y el historial del servicio.",
    actions: [
      appAction("Abrir mensajes", "/mensajes"),
      appAction("Ver ayuda", "/help"),
    ],
  },
  {
    id: "chat_locked",
    role: "any",
    triggers: [
      "no puedo enviar mensajes",
      "aparece candado",
      "chat bloqueado",
      "mensaje bloqueado",
      "candado en chat",
    ],
    response:
      "El bloqueo de chat suele activarse por seguridad cuando detecta datos sensibles. Reintenta con un mensaje sin teléfonos, correos ni enlaces, y debería enviarse.",
    actions: [
      appAction("Abrir mensajes", "/mensajes"),
      appAction("Ver ayuda", "/help"),
      waAction(),
    ],
  },
  {
    id: "client_not_responding",
    role: "pro",
    triggers: [
      "cliente no responde",
      "no me responde el cliente",
      "confirmar servicio",
      "confirmar horario",
    ],
    response:
      "Abre el chat del servicio y pide confirmar o reprogramar el horario. Si no hay respuesta, contacta soporte para seguimiento.",
    actions: [
      appAction("Abrir mensajes", "/mensajes"),
      waAction("Escalar a soporte"),
    ],
  },
  {
    id: "view_completed_jobs",
    role: "pro",
    triggers: [
      "trabajos realizados",
      "historial de trabajos",
      "ver servicios terminados",
      "ver completados",
    ],
    response:
      "Tu historial de trabajos está en Trabajos realizados. Ahí puedes revisar servicios finalizados y su estado.",
    actions: [
      appAction("Ver trabajos realizados", "/applied"),
      appAction("Ver perfil", "/profile/setup"),
    ],
  },
  {
    id: "upload_evidence",
    role: "pro",
    triggers: [
      "subir evidencia",
      "subir fotos",
      "evidencia del trabajo",
      "como agrego fotos",
    ],
    response:
      "Puedes subir evidencia desde el flujo del servicio al finalizar o desde el chat del servicio. Asegúrate de adjuntar fotos claras del trabajo.",
    actions: [
      appAction("Abrir mensajes", "/mensajes"),
      appAction("Ver trabajos realizados", "/applied"),
      waAction(),
    ],
  },
  {
    id: "payments_receipt",
    role: "any",
    triggers: [
      "comprobante de pago",
      "recibo de pago",
      "stripe",
      "pago no aparece",
      "comprobante",
    ],
    response:
      "El comprobante se muestra dentro del chat del servicio cuando el pago se confirma. Si no aparece, te conviene reportarlo a soporte para revisión del pago.",
    actions: [
      appAction("Abrir mensajes", "/mensajes"),
      waAction("Reportar pago"),
      appAction("Ver ayuda", "/help"),
    ],
    escalateToSupport: true,
  },
  {
    id: "reschedule_confirm_time",
    role: "any",
    triggers: [
      "reprogramar servicio",
      "cambiar horario",
      "reagendar",
      "reprogramar",
      "confirmar o reprogramar",
    ],
    response:
      "Para reprogramar, confirma en el chat una nueva fecha y horario con la otra parte. Deja el acuerdo por escrito en el chat para evitar confusiones.",
    actions: [
      appAction("Abrir mensajes", "/mensajes"),
      waAction("Necesito soporte"),
    ],
  },
  {
    id: "service_problem",
    role: "any",
    triggers: [
      "problema con el servicio",
      "salio mal el trabajo",
      "incidente en el servicio",
      "tuve un problema",
    ],
    response:
      "Lamento el problema con el servicio. Te recomiendo dejar evidencia en el chat y contactar a soporte de Handi para que lo revisen cuanto antes.",
    actions: [
      appAction("Abrir mensajes", "/mensajes"),
      waAction("Contactar soporte"),
    ],
    escalateToSupport: true,
  },
  {
    id: "missing_requests",
    role: "any",
    triggers: [
      "no veo mis solicitudes",
      "no aparecen mis solicitudes",
      "mis solicitudes no salen",
      "solicitudes desaparecieron",
    ],
    response:
      "Primero revisa filtros y estado de tus solicitudes en tu panel. Si siguen sin aparecer, soporte puede revisar tu cuenta y estatus.",
    actions: [
      appAction("Ver solicitudes", "/requests"),
      appAction("Ver ayuda", "/help"),
      waAction(),
    ],
    escalateToSupport: true,
  },
  {
    id: "cannot_apply",
    role: "pro",
    triggers: [
      "no puedo aplicar",
      "no puedo postularme",
      "no me deja postular",
      "problema para postularme",
    ],
    response:
      "Si no te deja postularte, revisa que tu perfil profesional esté completo y actualizado. Si el bloqueo continúa, soporte te ayuda a validarlo.",
    actions: [
      appAction("Ir a mi perfil", "/profile/setup"),
      appAction("Ver solicitudes", "/requests/explore"),
      waAction(),
    ],
    escalateToSupport: true,
  },
  {
    id: "technical_issue",
    role: "any",
    triggers: [
      "la app no funciona",
      "error tecnico",
      "no carga",
      "se traba",
      "falla la app",
      "bug",
    ],
    response:
      "Parece un problema técnico. Intenta actualizar la página y volver a intentarlo. Si persiste, repórtalo por WhatsApp para atención rápida.",
    actions: [
      appAction("Ver ayuda", "/help"),
      waAction("Reportar problema técnico"),
    ],
    escalateToSupport: true,
  },
];

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function scoreTrigger(query: string, trigger: string): number {
  if (!query || !trigger) return 0;
  if (query.includes(trigger)) return 1;
  const words = trigger.split(" ").filter(Boolean);
  if (!words.length) return 0;
  const hits = words.reduce(
    (acc, word) => (query.includes(word) ? acc + 1 : acc),
    0,
  );
  return hits / words.length;
}

export function matchCanonicalIntent(
  rawQuery: string,
  role?: "client" | "pro" | null,
): CanonicalIntentMatch | null {
  const query = normalize(rawQuery || "");
  if (!query) return null;
  let best: (IntentDefinition & { confidence: number }) | null = null;

  for (const intent of INTENTS) {
    if (intent.role !== "any" && role && intent.role !== role) continue;
    let confidence = 0;
    for (const trigger of intent.triggers) {
      confidence = Math.max(
        confidence,
        scoreTrigger(query, normalize(trigger)),
      );
    }
    if (confidence >= 0.74 && (!best || confidence > best.confidence)) {
      best = { ...intent, confidence };
    }
  }

  if (!best) return null;
  return {
    id: best.id,
    response: best.response,
    actions: best.actions,
    escalateToSupport: Boolean(best.escalateToSupport),
    confidence: best.confidence,
  };
}

export function supportFallbackResponse(): {
  response: string;
  actions: AssistantAction[];
} {
  return {
    response:
      "No quiero darte una indicación imprecisa. Te recomiendo contactar a soporte de Handi por WhatsApp para ayudarte rápido.",
    actions: [waAction(), appAction("Ver ayuda", "/help")],
  };
}

export const ASSISTANT_SAFE_APP_LINKS = new Set<string>([
  "/help",
  "/requests/new",
  "/requests",
  "/requests/explore",
  "/mensajes",
  "/applied",
  "/profile/setup",
  "/pro/apply",
]);
