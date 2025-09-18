// Deno 2: sin --unstable global. Usa flags granulares solo si realmente ocupas APIs inestables.
import { join } from "https://deno.land/std@0.224.0/path/join.ts";

if (import.meta.main) {
  const main = async () => {
    console.log("Deno OK. join:", join("a", "b", "c"));
    console.log("Deno OK  hello from scripts/deno/hello.ts");
    const text = await Deno.readTextFile("./README.md").catch(() => "(sin README.md)");
    console.log("Len README:", text.length);
  };

  await main();
}
