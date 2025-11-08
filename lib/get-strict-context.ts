import * as React from "react";

export function getStrictContext<T>(name = "Context") {
  const Ctx = React.createContext<T | undefined>(undefined);
  function useStrictContext() {
    const value = React.useContext(Ctx);
    if (value === undefined) {
      throw new Error(`${name} not found in component tree`);
    }
    return value as T;
  }
  return [Ctx.Provider, useStrictContext] as const;
}

