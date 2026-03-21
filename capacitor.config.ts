const serverUrl =
  process.env.CAPACITOR_SERVER_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://handi.mx";

const allowNavigation = (() => {
  try {
    const host = new URL(serverUrl).host;
    const extras = ["handi.mx", "www.handi.mx"];
    return Array.from(new Set([host, ...extras]));
  } catch {
    return ["handi.mx", "www.handi.mx"];
  }
})();

const config = {
  appId: "com.handi.webapp",
  appName: "Handi",
  webDir: "public",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    allowNavigation,
  },
};

export default config;
