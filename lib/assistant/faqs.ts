import type { FAQItem } from "@/types/assistant";

// Minimal local knowledge base for RAG. Keep answers concise and actionable.
export const FAQS: FAQItem[] = [
  {
    id: "crear-solicitud",
    category: "Clientes",
    question: "¿Cómo creo una solicitud?",
    answer:
      "Ve a /requests/new, completa título, descripción y ciudad. Puedes adjuntar imágenes (máx. 5MB cada una). Al enviar, la solicitud queda visible para profesionales según reglas de visibilidad del sistema.",
    url: "/help#crear-solicitud",
    keywords: ["crear", "solicitud", "publicar", "request", "nuevo"],
  },
  {
    id: "postularse",
    category: "Profesionales",
    question: "¿Cómo me postulo a un trabajo?",
    answer:
      "Abre la solicitud en /requests/:id y usa el botón ‘Postularse’. Luego puedes darle seguimiento desde /applied.",
    url: "/help#postularse",
    keywords: ["postularse", "aplicarse", "applied", "trabajo"],
  },
  {
    id: "chat-candado",
    category: "General",
    question: "¿Cómo funciona el chat con candado?",
    answer:
      "Por seguridad, el chat bloquea compartir emails, teléfonos, URLs o direcciones. Si detectamos esos datos, el mensaje no se envía.",
    url: "/help#chat-candado",
    keywords: ["chat", "candado", "bloqueo", "seguridad"],
  },
  {
    id: "pagos-fee",
    category: "Pagos",
    question: "Pagos y fee de $50 MXN",
    answer:
      "Al aceptar un acuerdo, el cliente puede pagar el fee de $50 MXN en la sección de Acuerdos. El pago desbloquea los datos de contacto del profesional y se procesa con Stripe Checkout.",
    url: "/help#pagos-fee",
    keywords: ["pago", "fee", "50", "stripe", "checkout", "acuerdos"],
  },
  {
    id: "cerrar-acuerdo",
    category: "General",
    question: "¿Cómo completo un acuerdo y cierro mi solicitud?",
    answer:
      "Después de pagar el fee y avanzar el trabajo, marca el acuerdo como ‘En progreso’ y luego ‘Completado’. La solicitud cambia de estado según el flujo (active → in_process → completed).",
    url: "/help#cerrar-acuerdo",
    keywords: ["acuerdo", "cerrar", "completar", "estado", "flujo"],
  },
  {
    id: "perfiles-galeria",
    category: "Cuenta",
    question: "Perfiles y galería",
    answer:
      "Configura tu perfil en /profile/setup (nombre, ciudad, bio, avatar) y sube tu galería de trabajos. Tu perfil público está en /profiles/:id.",
    url: "/help#perfiles-galeria",
    keywords: ["perfil", "galería", "profile", "setup", "avatar"],
  },
  {
    id: "seguridad-privacidad",
    category: "General",
    question: "Seguridad y privacidad",
    answer:
      "Evita compartir datos sensibles en el chat. Consulta el aviso de privacidad en /privacy.",
    url: "/help#seguridad-privacidad",
    keywords: ["seguridad", "privacidad", "datos", "privacy"],
  },
];

