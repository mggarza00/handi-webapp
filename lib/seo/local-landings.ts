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
