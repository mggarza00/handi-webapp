"use client";

import { useEffect } from "react";

import {
  getRenderDiagnosticMode,
  isRenderDiagnosticModeEnabled,
} from "@/lib/renderDiagnostics";

let hasLogged = false;

export default function RenderDiagnosticLogger() {
  useEffect(() => {
    if (!isRenderDiagnosticModeEnabled() || hasLogged) return;
    hasLogged = true;
    console.info(`[render-diagnostic] mode=${getRenderDiagnosticMode()}`);
  }, []);

  return null;
}
