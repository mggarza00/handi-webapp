import Link from "next/link";

const routes: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/design-check", label: "Design Check" },
];

export const dynamic = "force-static";

export default function DesignCheckPage() {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Design Review Links</h1>
      <p className="text-sm text-muted-foreground">
        Collection of key pages for visual, a11y and perf checks.
      </p>
      <ul className="list-disc pl-5 space-y-2">
        {routes.map((r) => (
          <li key={r.href}>
            <Link href={r.href} className="text-blue-600 hover:underline">
              {r.label} <span className="text-gray-500">({r.href})</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">
        Add more routes here as the surface grows.
      </p>
    </main>
  );
}

