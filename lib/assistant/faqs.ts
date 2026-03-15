import type { FAQItem } from "@/types/assistant";

export const FAQS: FAQItem[] = [
  {
    id: "crear-solicitud",
    category: "Clientes",
    question: "¿Cómo hago una solicitud de servicio?",
    answer:
      "Puedes crearla desde Nueva solicitud. Completa los datos del servicio y envíala para recibir propuestas.",
    url: "/help",
    keywords: ["crear solicitud", "nueva solicitud", "pedir servicio", "publicar servicio"],
  },
  {
    id: "postularse",
    category: "Profesionales",
    question: "¿Cómo me postulo a un trabajo?",
    answer:
      "Abre una solicitud disponible y usa la opción para postularte. Después revisa el seguimiento en tus postulaciones.",
    url: "/help",
    keywords: ["postularme", "aplicar", "trabajo", "solicitudes"],
  },
  {
    id: "chat-candado",
    category: "General",
    question: "No puedo enviar mensajes y aparece candado",
    answer:
      "El chat puede bloquear mensajes con datos sensibles por seguridad. Reintenta con un mensaje sin teléfonos, correos o enlaces.",
    url: "/help",
    keywords: ["candado", "chat bloqueado", "no puedo enviar mensajes", "mensaje bloqueado"],
  },
  {
    id: "cliente-no-responde",
    category: "Profesionales",
    question: "El cliente no responde",
    answer:
      "Abre el chat del servicio y solicita confirmar o reprogramar el horario. Si continúa sin responder, escala con soporte.",
    url: "/help",
    keywords: ["cliente no responde", "confirmar horario", "reprogramar"],
  },
  {
    id: "trabajos-realizados",
    category: "Profesionales",
    question: "¿Cómo veo mis trabajos realizados?",
    answer:
      "Revisa la sección Trabajos realizados para ver tu historial de servicios finalizados.",
    url: "/help",
    keywords: ["trabajos realizados", "historial", "servicios terminados", "applied"],
  },
  {
    id: "evidencia-fotos",
    category: "Profesionales",
    question: "¿Cómo subo evidencia o fotos?",
    answer:
      "Puedes subir evidencia desde el flujo del servicio o en el chat relacionado. Adjunta fotos claras y completas.",
    url: "/help",
    keywords: ["subir evidencia", "subir fotos", "evidencia del trabajo"],
  },
  {
    id: "pagos-comprobante",
    category: "Pagos",
    question: "¿Cómo consigo mi comprobante de pago?",
    answer:
      "El comprobante aparece en el chat del servicio cuando el pago se confirma. Si no aparece, soporte puede revisarlo.",
    url: "/help",
    keywords: ["comprobante", "recibo", "pago", "stripe"],
  },
  {
    id: "problema-servicio",
    category: "General",
    question: "Tengo un problema con el servicio",
    answer:
      "Documenta lo ocurrido en el chat y contacta soporte de Handi para seguimiento.",
    url: "/help",
    keywords: ["problema con el servicio", "incidente", "salió mal"],
  },
  {
    id: "soporte",
    category: "General",
    question: "Quiero hablar con soporte",
    answer:
      "La vía más rápida es soporte por WhatsApp. También puedes consultar ayuda para guías rápidas.",
    url: "/help",
    keywords: ["soporte", "ayuda", "contactar soporte", "whatsapp"],
  },
  {
    id: "problema-tecnico",
    category: "General",
    question: "La app no funciona",
    answer:
      "Intenta actualizar la página y repetir la acción. Si persiste, repórtalo por WhatsApp para soporte técnico.",
    url: "/help",
    keywords: ["error técnico", "falla app", "no carga", "bug"],
  },
];
