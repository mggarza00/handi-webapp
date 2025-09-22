import Image from "next/image";

export default function ImagesTestPage() {
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold mb-4">Images Test</h1>
      <Image src="/vercel.svg" alt="Demo" width={200} height={200} priority />
      <p className="mt-4 text-sm text-muted-foreground">
        Ejemplo usando next/image (LCP optimizado).
      </p>
    </main>
  );
}
