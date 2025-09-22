"use client";
import * as React from "react";
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes";

/** Wrapper tipado para evitar 'children unknown' y rest types inválidos */
export default function ThemeProvider({
  children,
  ...props
}: ThemeProviderProps & { children: React.ReactNode }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
