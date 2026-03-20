export type SeoService = {
  slug: string;
  name: string;
  keyword: string;
  shortDescription: string;
  adCopy: string;
  benefits: string[];
  commonIssues: string[];
};

export type SeoCity = {
  slug: string;
  name: string;
  stateName: string;
  zones: string[];
};

export type ServiceCityCombination = {
  serviceSlug: string;
  citySlug: string;
  priority: number;
};

export type LocalLandingEditorial = {
  responseTime: string;
  trustSignals: string[];
  processSteps: string[];
  localSummary: string;
  faq: Array<{ question: string; answer: string }>;
};

export const SEO_SERVICES: SeoService[] = [
  {
    slug: "plomero",
    name: "Plomero",
    keyword: "plomero",
    shortDescription:
      "Atencion para fugas, instalaciones y mantenimiento de tuberias en casa.",
    adCopy:
      "Solicita plomero a domicilio con profesionales verificados en Handi.",
    benefits: [
      "Respuesta rapida para problemas urgentes de agua.",
      "Perfiles verificados con experiencia en instalaciones y mantenimiento.",
      "Proceso claro para comparar opciones antes de contratar.",
    ],
    commonIssues: [
      "Fugas en llaves, lavabo o sanitario.",
      "Baja presion de agua en cocina o bano.",
      "Destape de drenaje y mantenimiento preventivo.",
    ],
  },
  {
    slug: "electricista",
    name: "Electricista",
    keyword: "electricista",
    shortDescription:
      "Diagnostico de fallas electricas, instalaciones y mantenimiento residencial.",
    adCopy:
      "Encuentra electricista en Monterrey y San Pedro con perfiles confiables.",
    benefits: [
      "Ayuda para fallas, apagones y puntos electricos en casa.",
      "Comparacion de opciones con informacion de experiencia y servicio.",
      "Coordinacion simple desde una sola plataforma.",
    ],
    commonIssues: [
      "Pastillas que se botan o variaciones de voltaje.",
      "Instalacion de contactos, apagadores o luminarias.",
      "Revision de cableado para mejorar seguridad en casa.",
    ],
  },
  {
    slug: "jardinero",
    name: "Jardinero",
    keyword: "jardinero",
    shortDescription:
      "Mantenimiento de jardines residenciales, poda y cuidado de areas verdes.",
    adCopy:
      "Encuentra jardinero a domicilio para mantener tu casa en buenas condiciones.",
    benefits: [
      "Servicio para mantenimiento regular o trabajos puntuales.",
      "Opciones para jardines pequenos, medianos y espacios comunes.",
      "Coordinacion por zona para mejorar tiempos de atencion.",
    ],
    commonIssues: [
      "Poda de arboles, arbustos y cesped descuidado.",
      "Control de maleza y limpieza de patios.",
      "Ajustes de riego y mejora de apariencia del jardin.",
    ],
  },
  {
    slug: "carpintero",
    name: "Carpintero",
    keyword: "carpintero",
    shortDescription:
      "Reparacion, ajuste e instalacion de elementos de madera para hogar.",
    adCopy:
      "Solicita carpintero en Monterrey para muebles, puertas y ajustes en casa.",
    benefits: [
      "Apoyo para reparaciones pequenas o trabajos de mejora.",
      "Perfiles con experiencia en muebles, puertas y acabados.",
      "Comparacion de alternativas segun alcance y presupuesto.",
    ],
    commonIssues: [
      "Puertas que no cierran bien o requieren ajuste.",
      "Reparacion de muebles y estructuras de madera.",
      "Instalacion de repisas y soluciones funcionales para el hogar.",
    ],
  },
  {
    slug: "limpieza",
    name: "Limpieza de hogar",
    keyword: "limpieza",
    shortDescription:
      "Limpieza general, profunda y apoyo por evento para vivienda.",
    adCopy:
      "Encuentra servicios de limpieza en Monterrey con profesionales de confianza.",
    benefits: [
      "Opciones para limpieza recurrente o de una sola ocasion.",
      "Apoyo para depa, casa y preparacion de espacios antes o despues de eventos.",
      "Proceso simple para describir tu necesidad y recibir propuestas.",
    ],
    commonIssues: [
      "Limpieza profunda de cocina y banos.",
      "Limpieza despues de mudanza o remodelacion.",
      "Mantenimiento semanal para mantener la casa en orden.",
    ],
  },
  {
    slug: "mozo",
    name: "Mozo",
    keyword: "mozo",
    shortDescription:
      "Apoyo para tareas generales de casa, acomodo y actividades de asistencia.",
    adCopy:
      "Solicita mozo en Monterrey para apoyo practico en tareas del hogar.",
    benefits: [
      "Soporte flexible para tareas puntuales o por jornada.",
      "Ideal para apoyo de carga ligera, acomodo y actividades generales.",
      "Flujo rapido para solicitar ayuda segun tu zona.",
    ],
    commonIssues: [
      "Apoyo para mover y acomodar objetos en casa.",
      "Tareas generales de mantenimiento y orden.",
      "Asistencia para actividades operativas del hogar.",
    ],
  },
];

export const SEO_CITIES: SeoCity[] = [
  {
    slug: "monterrey",
    name: "Monterrey",
    stateName: "Nuevo Leon",
    zones: [
      "Cumbres",
      "Contry",
      "Mitras",
      "Obispado",
      "Tecnologico",
      "Centro de Monterrey",
    ],
  },
  {
    slug: "san-pedro-garza-garcia",
    name: "San Pedro Garza Garcia",
    stateName: "Nuevo Leon",
    zones: [
      "Del Valle",
      "San Agustin",
      "Valle Oriente",
      "Fuentes del Valle",
      "Lomas del Valle",
      "Casco de San Pedro",
    ],
  },
];

const SERVICE_SLUG_ALIASES: Record<string, string> = {
  plomeria: "plomero",
  electricidad: "electricista",
  "limpieza-hogar": "limpieza",
};

const CITY_SLUG_ALIASES: Record<string, string> = {
  "san-pedro": "san-pedro-garza-garcia",
};

export const ACTIVE_SERVICE_CITY_COMBINATIONS: ServiceCityCombination[] = [
  { serviceSlug: "plomero", citySlug: "monterrey", priority: 10 },
  { serviceSlug: "plomero", citySlug: "san-pedro-garza-garcia", priority: 10 },
  { serviceSlug: "electricista", citySlug: "monterrey", priority: 10 },
  {
    serviceSlug: "electricista",
    citySlug: "san-pedro-garza-garcia",
    priority: 10,
  },
  { serviceSlug: "jardinero", citySlug: "monterrey", priority: 9 },
  { serviceSlug: "carpintero", citySlug: "monterrey", priority: 9 },
  { serviceSlug: "limpieza", citySlug: "monterrey", priority: 9 },
  { serviceSlug: "mozo", citySlug: "monterrey", priority: 8 },
  { serviceSlug: "limpieza", citySlug: "san-pedro-garza-garcia", priority: 8 },
  {
    serviceSlug: "carpintero",
    citySlug: "san-pedro-garza-garcia",
    priority: 8,
  },
];

const LOCAL_LANDING_EDITORIAL: Record<string, LocalLandingEditorial> = {
  "plomero:monterrey": {
    responseTime:
      "Respuesta habitual en 1 a 3 horas en zonas con cobertura alta.",
    trustSignals: [
      "Perfiles verificados con historial de trabajos en hogar.",
      "Comparacion de opciones antes de decidir.",
      "Flujo con registro de mensajes y detalle del alcance.",
    ],
    processSteps: [
      "Comparte el problema exacto (fuga, destape, instalacion) y tu colonia.",
      "Recibe opciones de profesionales disponibles en Monterrey.",
      "Elige la mejor alternativa y coordina horario de visita.",
    ],
    localSummary:
      "En Monterrey, las solicitudes de plomeria suelen concentrarse en fugas y destapes en zonas residenciales con alta rotacion diaria.",
    faq: [
      {
        question:
          "Que datos ayudan a cotizar plomeria mas rapido en Monterrey?",
        answer:
          "Incluye fotos del problema, tipo de instalacion afectada, colonia y horario disponible para acelerar diagnostico y respuesta.",
      },
      {
        question: "Puedo solicitar apoyo para emergencia de fuga?",
        answer:
          "Si. Indica que es urgente en la descripcion y agrega referencias claras de acceso para priorizar la atencion.",
      },
      {
        question: "Que tipo de trabajos de plomeria se atienden?",
        answer:
          "Se atienden fugas, destapes, cambios de llaves, ajustes de sanitarios e instalaciones residenciales comunes.",
      },
    ],
  },
  "plomero:san-pedro-garza-garcia": {
    responseTime:
      "Respuesta habitual en 1 a 4 horas segun horario y zona de San Pedro.",
    trustSignals: [
      "Profesionales con experiencia en servicios residenciales de detalle.",
      "Seguimiento del servicio desde la solicitud inicial.",
      "Comparacion transparente de alternativas disponibles.",
    ],
    processSteps: [
      "Describe tu necesidad y agrega referencias de colonia en San Pedro.",
      "Compara opciones de plomero con base en experiencia y disponibilidad.",
      "Coordina visita con alcance y horario definidos desde el inicio.",
    ],
    localSummary:
      "En San Pedro Garza Garcia, la demanda de plomeria suele requerir coordinacion puntual por fraccionamiento y horario de acceso.",
    faq: [
      {
        question: "Como mejorar tiempos de atencion en San Pedro?",
        answer:
          "Agrega colonia exacta, tipo de acceso y franja horaria disponible para facilitar la planeacion de visita.",
      },
      {
        question: "Puedo solicitar ajuste e instalacion en una misma visita?",
        answer:
          "Si, cuando el alcance este bien descrito. Conviene listar cada tarea para recibir propuestas mas precisas.",
      },
      {
        question: "Que problemas se atienden con mayor frecuencia?",
        answer:
          "Fugas en banos y cocina, cambios de accesorios y mantenimiento preventivo en lineas de agua.",
      },
    ],
  },
  "electricista:monterrey": {
    responseTime:
      "Respuesta habitual en 2 a 4 horas para diagnostico inicial en Monterrey.",
    trustSignals: [
      "Perfiles con experiencia en instalaciones y fallas residenciales.",
      "Comparacion de alternativas antes de contratar.",
      "Registro de alcance y seguimiento del trabajo solicitado.",
    ],
    processSteps: [
      "Describe la falla (apagones, contactos, protecciones) y zona.",
      "Recibe opciones de electricista disponibles en Monterrey.",
      "Elige propuesta y agenda visita con alcance confirmado.",
    ],
    localSummary:
      "En Monterrey, las solicitudes de electricista se enfocan en fallas de seguridad, ajustes de carga e instalaciones interiores.",
    faq: [
      {
        question: "Que debo incluir para solicitar electricista en Monterrey?",
        answer:
          "Tipo de falla, area afectada, si hay riesgo inmediato y fotos del tablero o punto de instalacion cuando sea posible.",
      },
      {
        question: "Atienden instalaciones nuevas y reparaciones?",
        answer:
          "Si. Puedes solicitar desde cambios de contactos hasta revisiones de linea e instalacion de luminarias.",
      },
      {
        question: "Cuanto tarda una visita de diagnostico?",
        answer:
          "Depende de la zona y horario, pero un diagnostico inicial suele programarse el mismo dia en cobertura alta.",
      },
    ],
  },
  "electricista:san-pedro-garza-garcia": {
    responseTime:
      "Respuesta habitual en 2 a 5 horas, segun colonia y disponibilidad del horario.",
    trustSignals: [
      "Opciones verificadas para trabajos electricos residenciales.",
      "Comparacion de propuestas por alcance y disponibilidad.",
      "Seguimiento del servicio hasta la coordinacion final.",
    ],
    processSteps: [
      "Comparte la falla y agrega referencias de acceso en San Pedro.",
      "Revisa opciones de electricista para tu horario objetivo.",
      "Confirma alcance, visita y condiciones antes de contratar.",
    ],
    localSummary:
      "En San Pedro, los servicios electricos suelen requerir coordinacion cuidadosa por horario y tipo de instalacion residencial.",
    faq: [
      {
        question: "Que tipo de fallas electricas se atienden en San Pedro?",
        answer:
          "Se atienden variaciones de voltaje, protecciones que se disparan, contactos con falla e instalaciones domesticas.",
      },
      {
        question: "Puedo solicitar instalacion y revision en una sola visita?",
        answer:
          "Si, si indicas desde el inicio todas las tareas y areas involucradas para una cotizacion mas realista.",
      },
      {
        question: "Como acelerar la atencion del servicio?",
        answer:
          "Indica colonia, horario preferido, tipo de falla y evidencia visual para facilitar la asignacion.",
      },
    ],
  },
  "limpieza:monterrey": {
    responseTime:
      "Respuesta habitual en 2 a 6 horas para servicios programados en Monterrey.",
    trustSignals: [
      "Perfiles con historial de servicios en limpieza residencial.",
      "Proceso claro para detallar alcance y frecuencia.",
      "Comparacion de opciones antes de confirmar contratacion.",
    ],
    processSteps: [
      "Define si necesitas limpieza general, profunda o por evento.",
      "Comparte metros aproximados, zonas prioritarias y horario.",
      "Compara opciones y agenda el servicio segun disponibilidad.",
    ],
    localSummary:
      "En Monterrey, la limpieza de hogar suele solicitarse para mantenimiento semanal, mudanzas y preparacion de espacios.",
    faq: [
      {
        question: "Que datos ayudan a cotizar limpieza en Monterrey?",
        answer:
          "Tipo de limpieza, tamano del espacio, numero de banos y zonas prioritarias para recibir opciones mejor ajustadas.",
      },
      {
        question: "Puedo pedir limpieza puntual y recurrente?",
        answer:
          "Si. Puedes solicitar una visita unica o plantear una frecuencia semanal/quincenal en la solicitud.",
      },
      {
        question: "Se puede incluir limpieza post remodelacion?",
        answer:
          "Si, siempre que se especifique en la descripcion para definir alcance, tiempos y condiciones del servicio.",
      },
    ],
  },
};

export function getSeoServiceBySlug(slug: string) {
  const canonicalSlug = SERVICE_SLUG_ALIASES[slug] || slug;
  return SEO_SERVICES.find((service) => service.slug === canonicalSlug) ?? null;
}

export function getSeoCityBySlug(slug: string) {
  const canonicalSlug = CITY_SLUG_ALIASES[slug] || slug;
  return SEO_CITIES.find((city) => city.slug === canonicalSlug) ?? null;
}

export function getCitiesForService(serviceSlug: string): SeoCity[] {
  const citySlugs = new Set(
    ACTIVE_SERVICE_CITY_COMBINATIONS.filter(
      (item) => item.serviceSlug === serviceSlug,
    ).map((item) => item.citySlug),
  );
  return SEO_CITIES.filter((city) => citySlugs.has(city.slug));
}

export function getServicesForCity(citySlug: string): SeoService[] {
  const serviceSlugs = new Set(
    ACTIVE_SERVICE_CITY_COMBINATIONS.filter(
      (item) => item.citySlug === citySlug,
    ).map((item) => item.serviceSlug),
  );
  return SEO_SERVICES.filter((service) => serviceSlugs.has(service.slug));
}

export function isActiveServiceCity(
  serviceSlug: string,
  citySlug: string,
): boolean {
  return ACTIVE_SERVICE_CITY_COMBINATIONS.some(
    (item) => item.serviceSlug === serviceSlug && item.citySlug === citySlug,
  );
}

export function getLocalLandingEditorial(
  serviceSlug: string,
  citySlug: string,
): LocalLandingEditorial | null {
  return LOCAL_LANDING_EDITORIAL[`${serviceSlug}:${citySlug}`] ?? null;
}
