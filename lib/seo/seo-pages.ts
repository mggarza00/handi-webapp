import {
  getSeoCityBySlug,
  getSeoServiceBySlug,
} from "@/lib/seo/local-landings";

export type SeoFaqItem = {
  question: string;
  answer: string;
};

export type SeoProblemPage = {
  slug: string;
  title: string;
  keyword: string;
  service: string;
  city: string;
  intent: "problema";
  description: string;
  problemSummary: string;
  possibleCauses: string[];
  handiApproach: string[];
  faq: SeoFaqItem[];
  linkLabel: string;
};

export type SeoPricePage = {
  slug: string;
  title: string;
  keyword: string;
  service: string;
  city: string;
  intent: "precio";
  description: string;
  priceRangeLabel: string;
  priceVariables: string[];
  whatIncludes: string[];
  faq: SeoFaqItem[];
  linkLabel: string;
};

export type SeoJobPage = {
  slug: string;
  title: string;
  keyword: string;
  service: string;
  city: string;
  audience: "pro";
  description: string;
  howItWorks: string[];
  profileTips: string[];
  faq: SeoFaqItem[];
  linkLabel: string;
};

export const SEO_PROBLEM_PAGES: SeoProblemPage[] = [
  {
    slug: "fuga-de-agua-monterrey",
    title: "Fuga de agua en Monterrey",
    keyword: "fuga de agua Monterrey",
    service: "plomero",
    city: "monterrey",
    intent: "problema",
    description:
      "Detecta que puede causar una fuga de agua en Monterrey y solicita ayuda en Handi para recibir profesionales compatibles y acordar por chat.",
    problemSummary:
      "Una fuga de agua puede escalar rapido en costo y dano si no se atiende a tiempo. En Handi puedes levantar tu solicitud con fotos, zona y horario para recibir opciones compatibles.",
    possibleCauses: [
      "Empaques o llaves desgastadas en cocina y bano.",
      "Tuberias con fisuras por presion o antiguedad.",
      "Conexiones flojas en tinaco, lavabo o sanitario.",
    ],
    handiApproach: [
      "Describe donde esta la fuga y agrega fotos claras.",
      "Recibe respuestas de profesionales compatibles con tu zona.",
      "Aclara alcance por chat y cierra el acuerdo dentro de Handi.",
    ],
    faq: [
      {
        question: "Que debo incluir al pedir ayuda por fuga de agua?",
        answer:
          "Ubicacion exacta de la fuga, fotos del punto afectado y horario disponible para visita.",
      },
      {
        question: "Puedo solicitar atencion el mismo dia?",
        answer:
          "Depende de disponibilidad por zona y horario, pero una solicitud clara suele acelerar respuesta.",
      },
    ],
    linkLabel: "Fuga de agua en Monterrey",
  },
  {
    slug: "no-tengo-luz-casa",
    title: "No tengo luz en casa: que hacer",
    keyword: "no tengo luz en casa",
    service: "electricista",
    city: "monterrey",
    intent: "problema",
    description:
      "Si no tienes luz en casa, solicita un electricista en Handi y conecta con profesionales compatibles para revisar la falla con contexto real.",
    problemSummary:
      "Perder la energia en casa puede ser desde un ajuste simple hasta una falla mayor. Con Handi puedes explicar lo que ocurre y avanzar por chat antes de la visita.",
    possibleCauses: [
      "Pastilla disparada o sobrecarga en circuito.",
      "Falla puntual en contactos o cableado interior.",
      "Problemas en centro de carga o conexiones principales.",
    ],
    handiApproach: [
      "Comparte cuando inicio la falla y que zonas de la casa afecta.",
      "Agrega fotos del tablero o evidencia si es seguro hacerlo.",
      "Habla con profesionales compatibles y acuerda visita.",
    ],
    faq: [
      {
        question: "Es necesario mandar fotos del tablero?",
        answer:
          "Ayuda mucho para diagnostico inicial, siempre que puedas hacerlo de forma segura.",
      },
      {
        question: "Puedo pedir revision y reparacion en la misma solicitud?",
        answer:
          "Si, conviene describir ambas necesidades para recibir opciones mas precisas.",
      },
    ],
    linkLabel: "No tengo luz en casa",
  },
  {
    slug: "drenaje-tapado",
    title: "Drenaje tapado en casa",
    keyword: "drenaje tapado",
    service: "plomero",
    city: "monterrey",
    intent: "problema",
    description:
      "Si tienes drenaje tapado en casa, solicita apoyo en Handi para recibir opciones compatibles y coordinar solucion por chat.",
    problemSummary:
      "Un drenaje tapado puede causar malos olores, retorno de agua y afectaciones en bano o cocina. Levanta tu solicitud en Handi para atenderlo con contexto claro.",
    possibleCauses: [
      "Acumulacion de residuos en tuberia principal.",
      "Obstrucciones por grasa, cabello o sarro.",
      "Pendiente deficiente o tramos antiguos en instalacion.",
    ],
    handiApproach: [
      "Indica si el problema es en cocina, regadera o sanitario.",
      "Aclara desde cuando sucede y frecuencia del taponamiento.",
      "Recibe opciones de atencion y cierra acuerdo por chat.",
    ],
    faq: [
      {
        question: "Que informacion acelera la respuesta?",
        answer:
          "Zona, tipo de salida afectada y evidencia de retorno de agua u olor.",
      },
      {
        question: "Handi atiende casos recurrentes?",
        answer:
          "Si, puedes mencionar historial del problema para mejorar diagnostico.",
      },
    ],
    linkLabel: "Drenaje tapado en casa",
  },
  {
    slug: "mantenimiento-electrico-casa",
    title: "Mantenimiento electrico para casa",
    keyword: "mantenimiento electrico casa",
    service: "electricista",
    city: "monterrey",
    intent: "problema",
    description:
      "Programa mantenimiento electrico para casa en Handi y recibe profesionales compatibles para revisar y corregir puntos criticos.",
    problemSummary:
      "El mantenimiento electrico preventivo reduce riesgos y mejora estabilidad. En Handi puedes solicitar revision por zonas y acordar alcance por chat.",
    possibleCauses: [
      "Instalaciones antiguas con desgaste acumulado.",
      "Contacto flojo en apagadores o tomas de corriente.",
      "Distribucion de carga sin balance adecuado.",
    ],
    handiApproach: [
      "Define si buscas revision general o por area especifica.",
      "Comparte sintomas y prioridades del hogar.",
      "Coordina visita con profesionales compatibles.",
    ],
    faq: [
      {
        question: "Cada cuanto conviene pedir mantenimiento electrico?",
        answer:
          "Depende del uso y antiguedad, pero una revision periodica ayuda a prevenir fallas.",
      },
      {
        question: "Puedo incluir cambios de contactos o luminarias?",
        answer:
          "Si, agrega esas tareas en la solicitud para que el alcance quede claro.",
      },
    ],
    linkLabel: "Mantenimiento electrico en casa",
  },
  {
    slug: "limpieza-profunda-casa",
    title: "Limpieza profunda de casa",
    keyword: "limpieza profunda casa",
    service: "limpieza",
    city: "monterrey",
    intent: "problema",
    description:
      "Solicita limpieza profunda para casa en Handi y recibe opciones compatibles segun tipo de espacio, alcance y horario.",
    problemSummary:
      "Cuando necesitas limpieza profunda, detallar prioridades hace toda la diferencia. Handi te permite solicitar con contexto y acordar por chat.",
    possibleCauses: [
      "Acumulacion de suciedad en cocina y banos.",
      "Cambio de inquilino, mudanza o preparacion de evento.",
      "Falta de mantenimiento periodico en zonas clave.",
    ],
    handiApproach: [
      "Indica metros aproximados y areas prioritarias.",
      "Aclara si necesitas insumos o equipo especial.",
      "Compara opciones compatibles y confirma el acuerdo.",
    ],
    faq: [
      {
        question: "Que incluye una solicitud de limpieza profunda?",
        answer:
          "Puedes incluir cocina, banos, recamaras y detalles como ventanas o pisos segun necesidad.",
      },
      {
        question: "Puedo pedir limpieza unica o recurrente?",
        answer:
          "Si, en la solicitud puedes indicar si es puntual o recurrente.",
      },
    ],
    linkLabel: "Limpieza profunda de casa",
  },
  {
    slug: "humedad-en-paredes-monterrey",
    title: "Humedad en paredes en Monterrey",
    keyword: "humedad en paredes Monterrey",
    service: "plomero",
    city: "monterrey",
    intent: "problema",
    description:
      "Si detectas humedad en paredes en Monterrey, solicita revision en Handi para encontrar profesionales compatibles y atender origen del problema.",
    problemSummary:
      "La humedad en paredes puede venir de filtraciones, fugas internas o condensacion. En Handi puedes explicar sintomas y avanzar por chat con opciones compatibles.",
    possibleCauses: [
      "Fuga en tuberia oculta dentro de muro.",
      "Filtracion por techo o area exterior.",
      "Ventilacion insuficiente y condensacion constante.",
    ],
    handiApproach: [
      "Comparte donde aparece la humedad y desde cuando.",
      "Adjunta fotos y zonas cercanas con instalaciones de agua.",
      "Acorda inspeccion y solucion con profesionales compatibles.",
    ],
    faq: [
      {
        question: "Handi ayuda a revisar causa y no solo el acabado?",
        answer:
          "Si, puedes solicitar revision de origen para evitar que el problema regrese.",
      },
      {
        question: "Conviene incluir fotos del dano?",
        answer:
          "Si, acelera el entendimiento del caso y el alcance del trabajo.",
      },
    ],
    linkLabel: "Humedad en paredes en Monterrey",
  },
  {
    slug: "puerta-no-cierra-bien",
    title: "Puerta que no cierra bien",
    keyword: "puerta no cierra bien",
    service: "carpintero",
    city: "monterrey",
    intent: "problema",
    description:
      "Si una puerta no cierra bien, solicita apoyo en Handi para conectar con carpinteros compatibles y resolver ajustes de forma clara.",
    problemSummary:
      "Puertas desajustadas afectan seguridad, ruido y uso diario. En Handi puedes explicar sintomas y acordar el trabajo por chat.",
    possibleCauses: [
      "Bisagras flojas o desgaste por uso continuo.",
      "Marco desnivelado o deformacion por humedad.",
      "Ajuste incorrecto en chapa o cerradura.",
    ],
    handiApproach: [
      "Describe el tipo de puerta y falla principal.",
      "Incluye fotos del marco, bisagras y punto de cierre.",
      "Recibe opciones compatibles y define alcance por chat.",
    ],
    faq: [
      {
        question: "Se puede corregir sin cambiar toda la puerta?",
        answer:
          "En muchos casos si, depende del estado del marco y del dano acumulado.",
      },
      {
        question: "Que datos ayudan para cotizar mejor?",
        answer:
          "Material de la puerta, sintomas de falla y fotos de zonas afectadas.",
      },
    ],
    linkLabel: "Puerta no cierra bien",
  },
];

export const SEO_PRICE_PAGES: SeoPricePage[] = [
  {
    slug: "cuanto-cobra-plomero-monterrey",
    title: "Cuanto cobra un plomero en Monterrey",
    keyword: "cuanto cobra plomero Monterrey",
    service: "plomero",
    city: "monterrey",
    intent: "precio",
    description:
      "Conoce rangos de precio para plomeria en Monterrey y solicita en Handi para recibir opciones reales segun tu caso.",
    priceRangeLabel: "$600 - $2,800 MXN en trabajos residenciales comunes",
    priceVariables: [
      "Tipo de problema y nivel de urgencia.",
      "Materiales y refacciones necesarias.",
      "Acceso al area y complejidad de la instalacion.",
    ],
    whatIncludes: [
      "Diagnostico inicial del problema.",
      "Mano de obra segun alcance acordado.",
      "Ajustes o pruebas de funcionamiento al finalizar.",
    ],
    faq: [
      {
        question: "Como recibir una cotizacion mas precisa?",
        answer:
          "Agrega fotos, zona, horario y detalle del problema para reducir incertidumbre.",
      },
      {
        question: "El precio incluye materiales?",
        answer:
          "Depende del acuerdo. En chat puedes definir que incluye la cotizacion.",
      },
    ],
    linkLabel: "Cuanto cobra un plomero en Monterrey",
  },
  {
    slug: "precio-electricista-monterrey",
    title: "Precio de electricista en Monterrey",
    keyword: "precio electricista Monterrey",
    service: "electricista",
    city: "monterrey",
    intent: "precio",
    description:
      "Revisa rangos de precio para electricista en Monterrey y solicita tu caso en Handi para recibir opciones compatibles.",
    priceRangeLabel: "$700 - $3,200 MXN en servicios residenciales frecuentes",
    priceVariables: [
      "Tipo de falla electrica y nivel de riesgo.",
      "Cantidad de puntos a revisar o instalar.",
      "Necesidad de reemplazo de componentes.",
    ],
    whatIncludes: [
      "Revision inicial de seguridad y diagnostico.",
      "Correccion de falla o instalacion acordada.",
      "Pruebas basicas de funcionamiento.",
    ],
    faq: [
      {
        question: "Sube el precio si es urgencia?",
        answer:
          "Puede variar segun horario y disponibilidad. Aclaralo desde el inicio en tu solicitud.",
      },
      {
        question: "Conviene incluir fotos del tablero?",
        answer: "Si, ayuda a estimar alcance y mejora precision de respuesta.",
      },
    ],
    linkLabel: "Precio electricista en Monterrey",
  },
  {
    slug: "costo-limpieza-casa",
    title: "Costo de limpieza de casa",
    keyword: "costo limpieza casa",
    service: "limpieza",
    city: "monterrey",
    intent: "precio",
    description:
      "Entiende rangos de costo para limpieza de casa y solicita en Handi para recibir opciones segun tamano y alcance real.",
    priceRangeLabel: "$650 - $2,600 MXN segun tipo de limpieza y superficie",
    priceVariables: [
      "Metros aproximados y distribucion del hogar.",
      "Si es limpieza general, profunda o post remodelacion.",
      "Frecuencia del servicio y materiales requeridos.",
    ],
    whatIncludes: [
      "Aseo de areas acordadas en solicitud.",
      "Tiempo estimado conforme al alcance.",
      "Ajustes puntuales definidos por chat.",
    ],
    faq: [
      {
        question: "Es mas barato si es recurrente?",
        answer:
          "Puede haber ajustes segun frecuencia. Lo mejor es definirlo en el chat antes de cerrar acuerdo.",
      },
      {
        question: "Que incluye una limpieza profunda?",
        answer:
          "Depende del alcance; se recomienda listar areas y prioridades desde la solicitud.",
      },
    ],
    linkLabel: "Costo de limpieza de casa",
  },
  {
    slug: "precio-carpintero-monterrey",
    title: "Precio de carpintero en Monterrey",
    keyword: "precio carpintero Monterrey",
    service: "carpintero",
    city: "monterrey",
    intent: "precio",
    description:
      "Consulta rangos de precio para carpinteria en Monterrey y solicita tu trabajo en Handi para recibir alternativas compatibles.",
    priceRangeLabel: "$800 - $4,500 MXN segun tipo de ajuste o reparacion",
    priceVariables: [
      "Tipo de mueble o puerta a intervenir.",
      "Si requiere reparacion, ajuste o fabricacion parcial.",
      "Materiales y acabados requeridos.",
    ],
    whatIncludes: [
      "Revision del dano o ajuste necesario.",
      "Mano de obra acorde al alcance definido.",
      "Ajustes finales y validacion de funcionamiento.",
    ],
    faq: [
      {
        question: "Puedo cotizar con fotos?",
        answer:
          "Si, fotos del mueble o puerta ayudan a estimar tiempo y materiales.",
      },
      {
        question: "Se puede incluir mas de una tarea?",
        answer:
          "Si, conviene listar cada tarea en la solicitud para recibir propuestas completas.",
      },
    ],
    linkLabel: "Precio carpintero en Monterrey",
  },
  {
    slug: "cuanto-cobra-jardinero-monterrey",
    title: "Cuanto cobra un jardinero en Monterrey",
    keyword: "cuanto cobra jardinero Monterrey",
    service: "jardinero",
    city: "monterrey",
    intent: "precio",
    description:
      "Conoce rangos de precio para jardineria en Monterrey y solicita en Handi para recibir opciones segun tamano y necesidades de tu jardin.",
    priceRangeLabel: "$700 - $3,600 MXN por visita segun alcance de jardineria",
    priceVariables: [
      "Tamano del jardin y estado actual de vegetacion.",
      "Si incluye poda, limpieza, retiro o mantenimiento.",
      "Frecuencia del servicio y herramientas requeridas.",
    ],
    whatIncludes: [
      "Trabajo en areas verdes definidas en solicitud.",
      "Poda y limpieza conforme al alcance acordado.",
      "Recomendaciones basicas de mantenimiento.",
    ],
    faq: [
      {
        question: "Conviene especificar metros o fotos?",
        answer:
          "Si, eso mejora la precision y evita diferencias de alcance al momento de acordar.",
      },
      {
        question: "Se puede contratar mantenimiento recurrente?",
        answer:
          "Si, puedes acordar periodicidad desde el chat con el profesional.",
      },
    ],
    linkLabel: "Cuanto cobra un jardinero en Monterrey",
  },
];

export const SEO_JOB_PAGES: SeoJobPage[] = [
  {
    slug: "trabajos-plomero-monterrey",
    title: "Trabajos de plomero en Monterrey con Handi",
    keyword: "trabajos plomero Monterrey",
    service: "plomero",
    city: "monterrey",
    audience: "pro",
    description:
      "Conoce como recibir solicitudes de plomeria en Monterrey a traves de Handi y convertir mas oportunidades con buen perfil y respuesta rapida.",
    howItWorks: [
      "Activa tu perfil profesional y completa tu informacion de servicio.",
      "Recibe solicitudes compatibles con tu especialidad y zona.",
      "Responde por chat con alcance claro para cerrar acuerdos.",
    ],
    profileTips: [
      "Usa descripcion precisa de servicios y zonas que atiendes.",
      "Manten tiempos de respuesta consistentes.",
      "Aclara condiciones del trabajo antes de confirmar.",
    ],
    faq: [
      {
        question: "Como empiezo a recibir solicitudes de plomeria?",
        answer:
          "Completa tu registro profesional, valida tu perfil y mantente activo en tus zonas de atencion.",
      },
      {
        question: "Que mejora la conversion en Handi?",
        answer:
          "Responder con claridad, definir alcance y mantener seguimiento profesional en chat.",
      },
    ],
    linkLabel: "Trabajos de plomero en Monterrey",
  },
  {
    slug: "trabajos-electricista-monterrey",
    title: "Trabajos de electricista en Monterrey con Handi",
    keyword: "trabajos electricista Monterrey",
    service: "electricista",
    city: "monterrey",
    audience: "pro",
    description:
      "Descubre como obtener solicitudes de electricista en Monterrey dentro de Handi y organizar mejor tu flujo de trabajo.",
    howItWorks: [
      "Configura tu perfil con servicios electricos que dominas.",
      "Recibe solicitudes compatibles con tu experiencia y zona.",
      "Coordina alcance y agenda por chat para cerrar acuerdo.",
    ],
    profileTips: [
      "Detalla instalaciones y fallas que atiendes.",
      "Comparte disponibilidad real por horarios.",
      "Manten comunicacion puntual con cada cliente.",
    ],
    faq: [
      {
        question: "Handi envia solicitudes segun mi especialidad?",
        answer:
          "Si, el enfoque es compatibilidad entre necesidad del cliente y tipo de servicio del profesional.",
      },
      {
        question: "Que debo cuidar al responder una solicitud?",
        answer:
          "Alcance, condiciones, tiempos y materiales para evitar malentendidos al cerrar acuerdo.",
      },
    ],
    linkLabel: "Trabajos de electricista en Monterrey",
  },
  {
    slug: "trabajos-limpieza-hogar-monterrey",
    title: "Trabajos de limpieza de hogar en Monterrey",
    keyword: "trabajos limpieza hogar Monterrey",
    service: "limpieza",
    city: "monterrey",
    audience: "pro",
    description:
      "Aprende como recibir solicitudes de limpieza de hogar en Monterrey por medio de Handi y mejorar continuidad de trabajo.",
    howItWorks: [
      "Completa tu perfil con tipo de limpiezas y zonas activas.",
      "Recibe solicitudes compatibles segun alcance y horario.",
      "Confirma condiciones por chat y acuerda servicio.",
    ],
    profileTips: [
      "Aclara si manejas limpieza profunda, general o recurrente.",
      "Responde con tiempos estimados realistas.",
      "Define claramente que incluye tu servicio.",
    ],
    faq: [
      {
        question: "Puedo recibir solicitudes recurrentes?",
        answer:
          "Si, hay clientes que buscan frecuencia semanal o quincenal y lo acuerdan por chat.",
      },
      {
        question: "Que hace mas competitivo mi perfil?",
        answer:
          "Descripcion clara, buena comunicacion y cumplimiento del alcance acordado.",
      },
    ],
    linkLabel: "Trabajos de limpieza en Monterrey",
  },
];

export function getSeoProblemBySlug(slug: string) {
  return SEO_PROBLEM_PAGES.find((page) => page.slug === slug) ?? null;
}

export function getSeoPriceBySlug(slug: string) {
  return SEO_PRICE_PAGES.find((page) => page.slug === slug) ?? null;
}

export function getSeoJobBySlug(slug: string) {
  return SEO_JOB_PAGES.find((page) => page.slug === slug) ?? null;
}

export function getSeoServiceCityLabels(serviceSlug: string, citySlug: string) {
  const service = getSeoServiceBySlug(serviceSlug);
  const city = getSeoCityBySlug(citySlug);
  return {
    serviceName: service?.name || "Servicio para hogar",
    serviceKeyword: service?.keyword || "servicio para hogar",
    cityName: city?.name || "tu ciudad",
  };
}

type FaqContext = {
  cityName: string;
  serviceName: string;
  serviceKeyword: string;
};

type FaqTemplate = {
  question: (ctx: FaqContext) => string;
  answer: (ctx: FaqContext) => string;
};

type ValueBlock = {
  title: string;
  intro: string;
  items: string[];
};

function hashBySlug(slug: string) {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickItemsBySeed<T>(items: T[], count: number, seed: number): T[] {
  if (!items.length || count <= 0) return [];
  const start = seed % items.length;
  const selected: T[] = [];
  for (let i = 0; i < items.length && selected.length < count; i += 1) {
    selected.push(items[(start + i) % items.length] as T);
  }
  return selected;
}

const PROBLEM_FAQ_POOL: FaqTemplate[] = [
  {
    question: ({ serviceKeyword }) =>
      `Cuando conviene pedir ${serviceKeyword} con urgencia?`,
    answer: ({ cityName }) =>
      `Si hay riesgo de dano mayor o seguridad, levanta la solicitud de inmediato y agrega tu zona en ${cityName} para priorizar respuesta.`,
  },
  {
    question: ({ serviceKeyword }) =>
      `Cuanto tarda recibir opciones para ${serviceKeyword}?`,
    answer: () =>
      "Depende de horario y cobertura activa, pero una solicitud detallada suele acelerar respuestas.",
  },
  {
    question: () => "Que pasa si dejo este problema para despues?",
    answer: () =>
      "Muchos casos escalan en costo y alcance. Solicitar a tiempo te ayuda a resolver con mejor contexto.",
  },
  {
    question: () => "Que informacion mejora la calidad de la cotizacion?",
    answer: () =>
      "Fotos claras, ubicacion, horario y descripcion puntual del problema reducen dudas y retrabajo.",
  },
  {
    question: ({ cityName }) =>
      `Debo incluir colonia o zona dentro de ${cityName}?`,
    answer: () =>
      "Si, la zona influye en disponibilidad y tiempos de respuesta del profesional.",
  },
  {
    question: ({ serviceKeyword }) =>
      `Puedo pedir varios trabajos de ${serviceKeyword} en una sola solicitud?`,
    answer: () =>
      "Si, siempre que listes cada punto para definir alcance y evitar diferencias al acordar.",
  },
  {
    question: () => "Es mejor mandar fotos o solo texto?",
    answer: () =>
      "Lo ideal es ambos. Las fotos dan contexto tecnico y el texto aclara sintomas y prioridad.",
  },
  {
    question: () => "Como evito cotizaciones incompletas?",
    answer: () =>
      "Define alcance, urgencia, horario y condiciones del sitio desde el inicio.",
  },
  {
    question: ({ cityName }) =>
      `Hay diferencia entre solicitar en distintas zonas de ${cityName}?`,
    answer: () =>
      "Si, puede cambiar la velocidad de respuesta segun cobertura y horario.",
  },
  {
    question: () => "Puedo aclarar dudas antes de cerrar acuerdo?",
    answer: () =>
      "Si. El chat en Handi te permite validar condiciones y alcance antes de confirmar.",
  },
];

const PRICE_FAQ_POOL: FaqTemplate[] = [
  {
    question: () => "Por que cambian tanto los rangos de precio?",
    answer: () =>
      "El costo depende del alcance real, materiales y dificultad del trabajo.",
  },
  {
    question: () => "Como obtener una referencia mas cercana al costo final?",
    answer: () =>
      "Incluye fotos, zona y detalle tecnico para reducir incertidumbre en la cotizacion.",
  },
  {
    question: () => "El precio ya incluye materiales?",
    answer: () =>
      "Puede variar segun cada acuerdo. Conviene confirmar ese punto en el chat.",
  },
  {
    question: () => "Cuando sube el precio en un servicio residencial?",
    answer: () =>
      "Cuando hay urgencia, acceso complicado o tareas adicionales no consideradas al inicio.",
  },
  {
    question: () => "Puedo comparar mas de una opcion antes de decidir?",
    answer: () =>
      "Si, ese es el objetivo: comparar propuestas compatibles antes de cerrar.",
  },
  {
    question: () => "Conviene describir alcance aunque solo busque precio?",
    answer: () =>
      "Si, entre mas claro el alcance, mas util y accionable sera la respuesta.",
  },
  {
    question: () => "Que errores disparan costos innecesarios?",
    answer: () =>
      "Solicitudes ambiguas, falta de fotos y no detallar prioridades del trabajo.",
  },
  {
    question: () =>
      "Hay diferencia entre visita diagnostico y trabajo completo?",
    answer: () =>
      "Si, algunos casos requieren diagnostico previo para definir costo final.",
  },
  {
    question: () => "Como bajar variacion entre cotizaciones?",
    answer: () =>
      "Comparte exactamente el mismo contexto con cada opcion para evaluar sobre la misma base.",
  },
  {
    question: () => "Se puede negociar alcance para ajustar presupuesto?",
    answer: () =>
      "Si, en chat puedes priorizar tareas y acordar etapas del servicio.",
  },
];

const JOB_FAQ_POOL: FaqTemplate[] = [
  {
    question: () => "Como empiezo a recibir solicitudes en Handi?",
    answer: () =>
      "Completa tu perfil profesional, define servicios y mantente activo en zonas de cobertura.",
  },
  {
    question: () => "Que mejora mi tasa de respuesta?",
    answer: () =>
      "Contestar rapido, con alcance claro y condiciones bien definidas.",
  },
  {
    question: () => "Como destacar frente a otros profesionales?",
    answer: () =>
      "Perfil completo, mensajes precisos y seguimiento consistente en el chat.",
  },
  {
    question: () => "Debo especializar mi perfil o ofrecer de todo?",
    answer: () =>
      "Un perfil enfocado suele conectar mejor con solicitudes compatibles.",
  },
  {
    question: () => "Que errores hacen perder oportunidades?",
    answer: () =>
      "Responder tarde, no aclarar alcance y dejar dudas sin resolver.",
  },
  {
    question: () => "Como manejar mejor las expectativas del cliente?",
    answer: () =>
      "Define alcance, tiempos y condiciones desde el primer intercambio.",
  },
  {
    question: () => "Conviene definir zonas de atencion concretas?",
    answer: () =>
      "Si, eso mejora compatibilidad y evita solicitudes fuera de tu operacion real.",
  },
  {
    question: () => "Que tipo de mensaje convierte mejor?",
    answer: () => "Uno corto, tecnico y claro sobre lo que si puedes resolver.",
  },
  {
    question: () => "Puedo usar el chat para cerrar condiciones finales?",
    answer: () =>
      "Si, el chat es el canal para alinear alcance y acuerdo antes de confirmar.",
  },
  {
    question: () => "Que hacer si llega una solicitud incompleta?",
    answer: () =>
      "Pide datos faltantes con preguntas concretas para evaluar correctamente el trabajo.",
  },
];

const PROBLEM_OPENINGS = [
  ({ serviceKeyword, cityName }: FaqContext) =>
    `Si tienes un problema de ${serviceKeyword} en ${cityName}, actuar pronto reduce riesgos y te ayuda a resolver con mejor costo.`,
  ({ serviceKeyword, cityName }: FaqContext) =>
    `Un caso de ${serviceKeyword} en ${cityName} suele escalar cuando no se define bien el alcance desde el inicio.`,
  ({ serviceKeyword, cityName }: FaqContext) =>
    `Ignorar un problema de ${serviceKeyword} en ${cityName} puede convertir una reparacion puntual en una intervencion mayor.`,
];

const PRICE_OPENINGS = [
  ({ serviceKeyword, cityName }: FaqContext) =>
    `El precio de ${serviceKeyword} en ${cityName} cambia segun alcance real, materiales y urgencia.`,
  ({ serviceKeyword, cityName }: FaqContext) =>
    `Comparar costos de ${serviceKeyword} en ${cityName} solo sirve si todas las opciones parten del mismo contexto.`,
  ({ serviceKeyword, cityName }: FaqContext) =>
    `Antes de cerrar, conviene entender que variables impactan el costo de ${serviceKeyword} en ${cityName}.`,
];

const JOB_OPENINGS = [
  ({ serviceKeyword, cityName }: FaqContext) =>
    `Si buscas mas oportunidades de ${serviceKeyword} en ${cityName}, tu perfil y velocidad de respuesta hacen la diferencia.`,
  ({ serviceKeyword, cityName }: FaqContext) =>
    `Para convertir solicitudes de ${serviceKeyword} en ${cityName} en ingresos reales, necesitas un flujo claro de respuesta y acuerdo.`,
  ({ serviceKeyword, cityName }: FaqContext) =>
    `Crecer como profesional de ${serviceKeyword} en ${cityName} depende de enfoque, consistencia y claridad en cada conversacion.`,
];

const PROBLEM_VALUE_BLOCKS = [
  ({ serviceKeyword }: FaqContext): ValueBlock => ({
    title: "Senales de alerta",
    intro: `Si detectas estos sintomas en un caso de ${serviceKeyword}, conviene actuar sin esperar.`,
    items: [
      "El problema aparece con mayor frecuencia o intensidad.",
      "Ya hay afectacion visible en otras areas del hogar.",
      "El dano comienza a impactar seguridad o uso diario.",
    ],
  }),
  ({ serviceKeyword }: FaqContext): ValueBlock => ({
    title: "Errores comunes al solicitar ayuda",
    intro: `Evita estos errores al pedir ${serviceKeyword} para recibir opciones mas utiles.`,
    items: [
      "Describir el problema de forma demasiado general.",
      "No incluir fotos o referencias de ubicacion.",
      "Omitir urgencia, horarios o condiciones de acceso.",
    ],
  }),
  ({ serviceKeyword }: FaqContext): ValueBlock => ({
    title: "Cuando actuar con urgencia",
    intro: `Estos escenarios de ${serviceKeyword} suelen requerir atencion prioritaria.`,
    items: [
      "Existe riesgo de dano progresivo en poco tiempo.",
      "Se compromete seguridad o funcionamiento basico en casa.",
      "El problema afecta varias zonas al mismo tiempo.",
    ],
  }),
];

const PRICE_VALUE_BLOCKS = [
  ({ serviceKeyword }: FaqContext): ValueBlock => ({
    title: "Factores que pueden encarecer el servicio",
    intro: `En ${serviceKeyword}, estos factores suelen mover el costo al alza.`,
    items: [
      "Urgencia fuera de horario habitual.",
      "Falta de informacion para estimar alcance desde el inicio.",
      "Necesidad de materiales o ajustes no contemplados.",
    ],
  }),
  ({ serviceKeyword }: FaqContext): ValueBlock => ({
    title: "Como pagar menos sin bajar calidad",
    intro: `Para optimizar costo en ${serviceKeyword}, conviene preparar mejor la solicitud.`,
    items: [
      "Comparte fotos claras y medidas aproximadas cuando aplique.",
      "Prioriza tareas por impacto para acordar por etapas.",
      "Alinea alcance exacto antes de confirmar la visita.",
    ],
  }),
  ({ serviceKeyword }: FaqContext): ValueBlock => ({
    title: "Antes de aceptar una cotizacion",
    intro: `En solicitudes de ${serviceKeyword}, revisa estos puntos para decidir mejor.`,
    items: [
      "Que incluye y que no incluye el costo.",
      "Si contempla materiales, mano de obra y tiempos.",
      "Condiciones que podrian ajustar el total acordado.",
    ],
  }),
];

const JOB_VALUE_BLOCKS = [
  ({ serviceKeyword }: FaqContext): ValueBlock => ({
    title: "Como destacar en solicitudes compatibles",
    intro: `Si ofreces ${serviceKeyword}, estos ajustes elevan tu conversion.`,
    items: [
      "Responder con alcance concreto y sin ambiguedad.",
      "Mantener disponibilidad real por zona y horario.",
      "Cerrar cada conversacion con siguiente paso claro.",
    ],
  }),
  ({ serviceKeyword }: FaqContext): ValueBlock => ({
    title: "Errores comunes que frenan tu crecimiento",
    intro: `Evita estos patrones al gestionar solicitudes de ${serviceKeyword}.`,
    items: [
      "Responder tarde o con mensajes genericos.",
      "No validar condiciones antes de acordar.",
      "Prometer alcance sin confirmar detalles clave.",
    ],
  }),
  ({ serviceKeyword }: FaqContext): ValueBlock => ({
    title: "Acciones para crecer de forma sostenida",
    intro: `Para escalar trabajo en ${serviceKeyword}, la consistencia operativa es clave.`,
    items: [
      "Actualiza perfil y especialidades con frecuencia.",
      "Mejora tiempos de seguimiento en chat.",
      "Documenta condiciones para reducir retrabajo.",
    ],
  }),
];

export function getProblemOpeningBySlug(slug: string, ctx: FaqContext) {
  return (
    PROBLEM_OPENINGS[hashBySlug(slug) % PROBLEM_OPENINGS.length]?.(ctx) || ""
  );
}

export function getPriceOpeningBySlug(slug: string, ctx: FaqContext) {
  return PRICE_OPENINGS[hashBySlug(slug) % PRICE_OPENINGS.length]?.(ctx) || "";
}

export function getJobOpeningBySlug(slug: string, ctx: FaqContext) {
  return JOB_OPENINGS[hashBySlug(slug) % JOB_OPENINGS.length]?.(ctx) || "";
}

export function getProblemFaqBySlug(slug: string, ctx: FaqContext, count = 4) {
  return pickItemsBySeed(PROBLEM_FAQ_POOL, count, hashBySlug(slug)).map(
    (item) => ({
      question: item.question(ctx),
      answer: item.answer(ctx),
    }),
  );
}

export function getPriceFaqBySlug(slug: string, ctx: FaqContext, count = 4) {
  return pickItemsBySeed(PRICE_FAQ_POOL, count, hashBySlug(slug)).map(
    (item) => ({
      question: item.question(ctx),
      answer: item.answer(ctx),
    }),
  );
}

export function getJobFaqBySlug(slug: string, ctx: FaqContext, count = 4) {
  return pickItemsBySeed(JOB_FAQ_POOL, count, hashBySlug(slug)).map((item) => ({
    question: item.question(ctx),
    answer: item.answer(ctx),
  }));
}

export function getProblemValueBlockBySlug(slug: string, ctx: FaqContext) {
  return (
    PROBLEM_VALUE_BLOCKS[hashBySlug(slug) % PROBLEM_VALUE_BLOCKS.length]?.(
      ctx,
    ) || {
      title: "Puntos clave",
      intro: "",
      items: [],
    }
  );
}

export function getPriceValueBlockBySlug(slug: string, ctx: FaqContext) {
  return (
    PRICE_VALUE_BLOCKS[hashBySlug(slug) % PRICE_VALUE_BLOCKS.length]?.(ctx) || {
      title: "Puntos clave",
      intro: "",
      items: [],
    }
  );
}

export function getJobValueBlockBySlug(slug: string, ctx: FaqContext) {
  return (
    JOB_VALUE_BLOCKS[hashBySlug(slug) % JOB_VALUE_BLOCKS.length]?.(ctx) || {
      title: "Puntos clave",
      intro: "",
      items: [],
    }
  );
}

export function getRelatedProblemPages(
  currentSlug: string,
  service: string,
  city: string,
  count = 2,
) {
  return SEO_PROBLEM_PAGES.filter(
    (item) =>
      item.slug !== currentSlug &&
      (item.service === service || item.city === city),
  ).slice(0, count);
}

export function getRelatedPricePages(
  currentSlug: string,
  service: string,
  city: string,
  count = 1,
) {
  return SEO_PRICE_PAGES.filter(
    (item) =>
      item.slug !== currentSlug &&
      (item.service === service || item.city === city),
  ).slice(0, count);
}

export function getRelatedJobPages(currentSlug: string, count = 2) {
  return SEO_JOB_PAGES.filter((item) => item.slug !== currentSlug).slice(
    0,
    count,
  );
}
