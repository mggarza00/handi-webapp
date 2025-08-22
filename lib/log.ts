// lib/log.ts

function getTimestamp() {
  return new Date().toISOString();
}

export function logInfo(route: string, ...args: unknown[]) {
  console.info(`[${getTimestamp()}][${route}]`, ...args);
}

export function logError(route: string, ...args: unknown[]) {
  console.error(`[${getTimestamp()}][${route}]`, ...args);
}
