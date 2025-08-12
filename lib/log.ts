// lib/log.ts

function getTimestamp() {
  return new Date().toISOString();
}

export function logInfo(route: string, ...args: any[]) {
  console.info(`[${getTimestamp()}][${route}]`, ...args);
}

export function logError(route: string, ...args: any[]) {
  console.error(`[${getTimestamp()}][${route}]`, ...args);
}
