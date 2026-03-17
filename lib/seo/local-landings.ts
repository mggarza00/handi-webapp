export type SeoService = {
  slug: string;
  name: string;
  shortDescription: string;
  adCopy: string;
};

export type SeoCity = {
  slug: string;
  name: string;
  stateName: string;
};

export type ServiceCityCombination = {
  serviceSlug: string;
  citySlug: string;
  priority: number;
};

export const SEO_SERVICES: SeoService[] = [
  {
    slug: "plomeria",
    name: "Plomeria",
    shortDescription:
      "Reparacion de fugas, instalaciones y mantenimiento de tuberias para hogar.",
    adCopy: "Cotiza servicios de plomeria con profesionales verificados.",
  },
  {
    slug: "electricidad",
    name: "Electricidad",
    shortDescription:
      "Instalaciones electricas, diagnostico de fallas y reparaciones residenciales.",
    adCopy: "Encuentra electricistas confiables para tu casa.",
  },
  {
    slug: "limpieza-hogar",
    name: "Limpieza de hogar",
    shortDescription:
      "Limpieza general, profunda y por evento con expertos de confianza.",
    adCopy: "Solicita limpieza de hogar en minutos desde Handi.",
  },
  {
    slug: "pintura",
    name: "Pintura",
    shortDescription:
      "Pintura interior y exterior con acabados profesionales para espacios residenciales.",
    adCopy: "Renueva tus espacios con servicios de pintura a domicilio.",
  },
  {
    slug: "reparaciones-generales",
    name: "Reparaciones generales",
    shortDescription:
      "Soluciones de mantenimiento para arreglos del hogar y mejoras menores.",
    adCopy: "Resuelve reparaciones del hogar con tecnicos verificados.",
  },
];

export const SEO_CITIES: SeoCity[] = [
  { slug: "monterrey", name: "Monterrey", stateName: "Nuevo Leon" },
  {
    slug: "san-pedro-garza-garcia",
    name: "San Pedro Garza Garcia",
    stateName: "Nuevo Leon",
  },
  { slug: "guadalupe", name: "Guadalupe", stateName: "Nuevo Leon" },
];

export const ACTIVE_SERVICE_CITY_COMBINATIONS: ServiceCityCombination[] = [
  { serviceSlug: "plomeria", citySlug: "monterrey", priority: 10 },
  { serviceSlug: "electricidad", citySlug: "monterrey", priority: 10 },
  { serviceSlug: "limpieza-hogar", citySlug: "monterrey", priority: 9 },
  { serviceSlug: "plomeria", citySlug: "san-pedro-garza-garcia", priority: 8 },
  {
    serviceSlug: "reparaciones-generales",
    citySlug: "san-pedro-garza-garcia",
    priority: 8,
  },
  { serviceSlug: "pintura", citySlug: "guadalupe", priority: 7 },
  { serviceSlug: "electricidad", citySlug: "guadalupe", priority: 7 },
];

export function getSeoServiceBySlug(slug: string) {
  return SEO_SERVICES.find((service) => service.slug === slug) ?? null;
}

export function getSeoCityBySlug(slug: string) {
  return SEO_CITIES.find((city) => city.slug === slug) ?? null;
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
