const RENDER_DIAGNOSTIC_MODES = [
  "no-global-visual-defer",
  "no-home-visual-defer",
  "no-floating-widgets",
  "no-visual-defer",
] as const;

export type RenderDiagnosticMode =
  | (typeof RENDER_DIAGNOSTIC_MODES)[number]
  | "";

function normalizeMode(value: string | undefined): RenderDiagnosticMode {
  const trimmed = (value || "").trim();
  return (RENDER_DIAGNOSTIC_MODES as readonly string[]).includes(trimmed)
    ? (trimmed as RenderDiagnosticMode)
    : "";
}

export function getRenderDiagnosticMode(): RenderDiagnosticMode {
  return normalizeMode(process.env.NEXT_PUBLIC_RENDER_DIAGNOSTIC_MODE);
}

export function isRenderDiagnosticModeEnabled(): boolean {
  return getRenderDiagnosticMode() !== "";
}

export function shouldBypassGlobalVisualDefer(): boolean {
  const mode = getRenderDiagnosticMode();
  return mode === "no-global-visual-defer" || mode === "no-visual-defer";
}

export function shouldBypassHomeVisualDefer(): boolean {
  const mode = getRenderDiagnosticMode();
  return mode === "no-home-visual-defer" || mode === "no-visual-defer";
}

export function shouldDisableFloatingWidgets(): boolean {
  const mode = getRenderDiagnosticMode();
  return mode === "no-floating-widgets" || mode === "no-visual-defer";
}
