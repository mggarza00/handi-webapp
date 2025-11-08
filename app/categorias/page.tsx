import Link from "next/link";
import categoriesRaw from "@/data/categories.json";

type Subcategory = { id?: string; name?: string; description?: string; icon?: string };
type Category = { id?: string; name?: string; subcategories?: Subcategory[] };

const categories = categoriesRaw as unknown as ReadonlyArray<Category>;

export default function CategoriasPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Categorías y subcategorías</h1>
      <p className="mt-1 text-sm text-slate-600">
        Explora las categorías y subcategorías disponibles en Handi.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {categories.map((cat) => (
          <div key={cat.id ?? cat.name} className="rounded-xl border bg-white p-4">
            <h2 className="text-lg font-medium">{cat.name}</h2>
            {cat.subcategories && cat.subcategories.length > 0 ? (
              <ul className="mt-2 grid grid-cols-1 gap-1 text-sm text-slate-700">
                {cat.subcategories.map((sc) => (
                  <li key={sc.id ?? sc.name} className="flex items-center gap-2">
                    <span>{sc.name}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-8 text-sm text-slate-600">
        ¿No encuentras lo que buscas? 
        <Link className="underline" href="/search">Busca profesionales</Link> o
        <span> </span>
        <Link className="underline" href="/pro-apply">ofrece tus servicios</Link>.
      </div>
    </div>
  );
}

