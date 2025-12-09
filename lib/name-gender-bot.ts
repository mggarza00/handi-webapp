export type BotGender = "male" | "female" | "unknown";

export type BotGenderResult = {
  gender: BotGender;
  confidence: number; // 0 a 1
};

const AMBIGUOUS_NAMES = [
  "jay",
  "alex",
  "cris",
  "criss",
  "andrea",
  "guadalupe",
  "mar",
  "sam",
  "sami",
  "pat",
  "paty",
  "patty",
  "angel",
  "ángel",
];

const endsWith = (value: string, suffix: string) => value.endsWith(suffix);

export function analyzeNameGender(firstName: string): BotGenderResult {
  if (!firstName) return { gender: "unknown", confidence: 0 };

  const normalized = firstName.trim().toLowerCase();
  if (!normalized) return { gender: "unknown", confidence: 0 };

  if (AMBIGUOUS_NAMES.includes(normalized)) {
    return { gender: "unknown", confidence: 0.5 };
  }

  if (endsWith(normalized, "a")) {
    return { gender: "female", confidence: 0.9 };
  }

  if (endsWith(normalized, "o")) {
    return { gender: "male", confidence: 0.9 };
  }

  const lastChar = normalized.slice(-1);
  if (/[bcdfghjklmnpqrstvwxyz]/.test(lastChar)) {
    return { gender: "male", confidence: 0.9 };
  }

  return { gender: "unknown", confidence: 0.4 };
}
