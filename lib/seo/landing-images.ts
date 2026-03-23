export const LANDING_IMAGES = {
  service: {
    plomero: "/images/categorias/5a6694378bef11f001ade7c91f1cf8da7c9d7841.jpg",
    electricista:
      "/images/categorias/95085306ab706f190822e51f78fa9f3529cea89a.jpg",
    jardinero:
      "/images/categorias/d5b96eb75b875984d2a552f894fa740f2b7dbf05.jpg",
    limpieza: "/images/categorias/d277916b04bca1b5ec4a60333c4a392ec183a6c8.jpg",
    carpintero:
      "/images/categorias/e2353803bb30ee20b055e207675e02812887f633.jpg",
    mozo: "/images/categorias/12789he1bud129d1b8d189892bnd91b9wq89d.jpg",
    mozoAlt: "/images/categorias/293h23892382djhn289hd298h2dh89h289.jpg",
  },
  city: "/images/categorias/4b710bb738de5edb7ea6dcd8055f88a3fe2b88e7.jpg",
  platform: "/images/categorias/{15CD87DB-B60F-4967-8CD1-F0F47770F3E1}.png",
  fallback: "/images/categorias/95085306ab706f190822e51f78fa9f3529cea89a.jpg",
} as const;

export function getServiceLandingImage(serviceSlug: string): string {
  return (
    LANDING_IMAGES.service[
      serviceSlug as keyof typeof LANDING_IMAGES.service
    ] || LANDING_IMAGES.fallback
  );
}
