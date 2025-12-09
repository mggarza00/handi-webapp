import type { BotGenderResult } from "./name-gender-bot";
import { analyzeNameGender } from "./name-gender-bot";

export type GreetingPreference = "bienvenido" | "bienvenida" | "neutral";

export function inferGreetingPreferenceFromName(firstName: string): GreetingPreference {
  const result: BotGenderResult = analyzeNameGender(firstName);

  if (!firstName || result.gender === "unknown" || result.confidence < 0.8) {
    return "neutral";
  }

  if (result.gender === "female") return "bienvenida";
  if (result.gender === "male") return "bienvenido";

  return "neutral";
}

export function buildGreetingText(pref: GreetingPreference, firstName: string): string {
  const safeName = firstName?.trim() || "Usuario";

  switch (pref) {
    case "bienvenida":
      return `Bienvenida ${safeName}`;
    case "bienvenido":
      return `Bienvenido ${safeName}`;
    default:
      return `Hola ${safeName}`;
  }
}
