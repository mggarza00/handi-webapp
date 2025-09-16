export const CITIES = [
  "Monterrey",
  "Guadalupe",
  "San Nicolás",
  "Apodaca",
  "Escobedo",
  "Santa Catarina",
  "García",
  "San Pedro Garza García",
] as const;

export type City = (typeof CITIES)[number];
