import { useEffect, useState } from "react";
import { Link } from "../router";
import { useProducts } from "../context/store";
import ProductCard, { Stars } from "../components/ProductCard";
import { setMeta } from "../lib/seo";

interface BandData {
  categoryId: string;
  categoryName: string;
  bandId: string;
  bandLabel: string;
  intro: string;
  total: number;
  items: {
    id: number; name: string; image: string; price: number; compareAt: number | null;
    rating: number; reviews: number; stock: number; soldThisWeek: number;
    rank: number; why: string; description?: string;
  }[];
  siblings: { categoryId: string; bandId: string; bandLabel: string; url: string }[];
}

/** SEO landing pages — category hubs (/category/:id) and programmatic
 *  price-band curation spokes (/category/:id/:band). Spoke rankings come from
 *  real weekly sales server-side; pages only exist where they add unique value. */
export default function CategoryPage({ id, band }: { id: string; band?: string }) {
  const { products, categories, loading } = useProducts();
  const cat = categories.find((c) => c.id === id);
  const items = products.filter((p) => p.category === id);
  const [bandData, setBandData] = useState<BandData | null>(null);
  const [bandState, setBandState] = useState<"loading" | "live" | "empty">("loading");
  const [hubBands, setHubBands] = useState<{ bandLabel: string; url: string }[]>([]);
  const [hubGuide, setHubGuide] = useState<{ slug: string; title: string } | null>(null);

  /* ---- spoke mode ---- */
  useEffect(() => {
    if (!band) return;
    let dead = false;
    setBandState("loading");
    fetch(`/api/categories/${id}/bands/${band}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("not live");
        const d: BandData = await r.json();
        if (dead) return;
        setBandData(d);
        setBandState("live");
        const year = new Date().getFullYear();
        setMeta({
          title: `${d.categoryName} ${d.bandLabel} in Pakistan (${year}) — Top ${d.total} Ranked | XccessoriesPoint`,
          description: `Compare the ${d.total} best ${d.categoryName.toLowerCase()} in this budget, ranked by real weekly sales and buyer reviews. COD across Pakistan, free shipping over Rs 5,000.`,
          image: d.items[0]?.image || "/img/hero-1.png",
          url: `/category/${id}/${band}`,
          jsonLd: [
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: location.origin + "/" },
                { "@type": "ListItem", position: 2, name: d.categoryName, item: `${location.origin}/category/${id}` },
                { "@type": "ListItem", position: 3, name: d.bandLabel, item: `${location.origin}/category/${id}/${band}` },
              ],
            },
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: `${d.categoryName} ${d.bandLabel} in Pakistan`,
              numberOfItems: d.total,
              itemListElement: d.items.map((it) => ({
                "@type": "ListItem",
                position: it.rank,
                url: `${location.origin}/product/${it.id}`,
                name: it.name,
              })),
            },
          ],
        });
      })
      .catch(() => !dead && setBandState("empty"));
    return () => { dead = true; };
  }, [id, band]);

  /* ---- hub mode ---- */
  useEffect(() => {
    if (band || !cat) return;
    fetch(`/api/categories/${id}/bands`)
      .then((r) => (r.ok ? r.json() : []))
      .then((b) => setHubBands(b))
      .catch(() => {});
    fetch("/api/guides")
      .then((r) => r.json())
      .then((gs) => setHubGuide(gs.find((g: { relatedCategory: string }) => g.relatedCategory === id) ?? null))
      .catch(() => {});
  }, [id, band, cat?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- meta for hub mode ---- */
  useEffect(() => {
    if (!cat || band) return;
    const base = location.origin;
    const title = `${cat.name} Online in Pakistan — COD Nationwide | XccessoriesPoint`;
    const description =
      cat.description?.slice(0, 160) ||
      `Buy ${cat.name.toLowerCase()} online in Pakistan with cash on delivery and 7-day returns.`;
    setMeta({
      title,
      description,
      image: cat.image || "/img/hero-1.png",
      url: `/category/${cat.id}`,
      type: "website",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: base + "/" },
            { "@type": "ListItem", position: 2, name: "Shop", item: base + "/shop" },
            { "@type": "ListItem", position: 3, name: cat.name, item: `${base}/category/${cat.id}` },
          ],
        },
        {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: cat.name,
          numberOfItems: items.length,
          itemListElement: items.slice(0, 25).map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${base}/product/${p.id}`,
            name: p.name,
          })),
        },
      ],
    });
  }, [cat?.id, cat?.description, items.length, band]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ================= spoke render ================= */
  if (band) {
    if (bandState === "loading")
      return (
        <main id="main-content" className="pt-[120px] md:pt-44 max-w-7xl mx-auto px-6 pb-16">
          <div className="h-8 w-72 bg-slate-100 rounded animate-pulse mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="surface-muted rounded-2xl aspect-[3/4] animate-pulse" />
            ))}
          </div>
        </main>
      );

    if (bandState === "empty" || !bandData)
      return (
        <main id="main-content" className="pt-40 pb-20 px-6 max-w-7xl mx-auto text-center">
          <h1 className="text-3xl font-black text-slate-900 mb-2">Nothing to rank here yet</h1>
          <p className="text-sm text-slate-500 mb-6">
            We only publish buying guides once we can recommend at least three in-stock picks.
          </p>
          <Link to={`/category/${id}`} className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">
            Browse the full category
          </Link>
        </main>
      );

    const year = new Date().getFullYear();
    return (
      <main id="main-content" className="pt-[120px] md:pt-44 max-w-7xl mx-auto px-6 pb-16">
        {/* breadcrumb */}
        <nav className="text-xs text-slate-400 mb-3">
          <Link to="/" className="hover:text-blue-600">Home</Link>
          <span className="mx-1.5">/</span>
          <Link to="/shop" className="hover:text-blue-600">Shop</Link>
          <span className="mx-1.5">/</span>
          <Link to={`/category/${bandData.categoryId}`} className="hover:text-blue-600">{bandData.categoryName}</Link>
          <span className="mx-1.5">/</span>
          <span className="text-slate-600 font-medium">{bandData.bandLabel}</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-black text-slate-900">
          {bandData.categoryName} {bandData.bandLabel} in Pakistan
          <span className="text-blue-600"> — Top {bandData.total} ({year})</span>
        </h1>
        <p className="text-sm md:text-base text-slate-500 leading-relaxed mt-2 max-w-3xl">{bandData.intro}</p>

        <ol className="mt-8 space-y-5">
          {bandData.items.map((it) => (
            <li key={it.id}>
              <div className="flex items-start gap-4 surface rounded-2xl p-4 hover:shadow-lg transition">
                <span className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm ${
                  it.rank <= 3 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                }`}>{it.rank}</span>
                <img src={it.image} alt={it.name} width={112} height={112}
                  loading="lazy"
                  className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl object-cover ring-1 ring-slate-200 shrink-0" />
                <div className="min-w-0 flex-1">
                  <Link to={`/product/${it.id}`} className="font-bold text-slate-900 hover:text-blue-700 line-clamp-1">
                    {it.name}
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Stars rating={it.rating} />
                    <span className="text-xs text-slate-400">{it.reviews} reviews</span>
                  </div>
                  <p className="text-xs font-semibold text-blue-700 mt-1">{it.why}</p>
                  <p className="text-sm text-slate-400 mt-1 hidden sm:block line-clamp-2">{it.description}</p>
                  <p className="mt-1.5 font-black text-slate-900">
                    Rs {it.price.toLocaleString("en-PK")}
                    {it.compareAt && <span className="ml-2 text-xs text-slate-400 line-through font-medium">Rs {it.compareAt.toLocaleString("en-PK")}</span>}
                  </p>
                </div>
                <Link
                  to={`/product/${it.id}`}
                  className="shrink-0 self-center px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
                >
                  View
                </Link>
              </div>
            </li>
          ))}
        </ol>

        {/* sibling bands */}
        {bandData.siblings.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-black text-slate-900 mb-3">Other budgets in {bandData.categoryName}</h2>
            <div className="flex flex-wrap gap-2">
              <Link to={`/category/${bandData.categoryId}`}
                className="px-4 py-2 rounded-lg surface-muted text-sm font-medium text-slate-600 hover:text-blue-700 transition">
                All {bandData.categoryName}
              </Link>
              {bandData.siblings.map((s) => (
                <Link key={s.url} to={s.url}
                  className="px-4 py-2 rounded-lg surface-muted text-sm font-medium text-slate-600 hover:text-blue-700 transition">
                  {s.bandLabel}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    );
  }

  /* ================= hub render ================= */
  if (!loading && !cat)
    return (
      <main id="main-content" className="pt-40 pb-20 px-6 max-w-7xl mx-auto text-center">
        <h1 className="text-3xl font-black text-slate-900 mb-2">Category not found</h1>
        <Link to="/shop" className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">
          Browse all products
        </Link>
      </main>
    );

  return (
    <main id="main-content" className="pt-[120px] md:pt-44 max-w-7xl mx-auto px-6 pb-16">
      {/* breadcrumb */}
      <nav className="text-xs text-slate-400 mb-3">
        <Link to="/" className="hover:text-blue-600">Home</Link>
        <span className="mx-1.5">/</span>
        <Link to="/shop" className="hover:text-blue-600">Shop</Link>
        <span className="mx-1.5">/</span>
        <span className="text-slate-600 font-medium">{cat?.name ?? "…"}</span>
      </nav>

      <h1 className="text-3xl md:text-4xl font-black text-slate-900">
        {cat ? cat.name : "\u00A0"}
        <span className="text-blue-600"> in Pakistan</span>
      </h1>
      {cat?.description && (
        <p className="text-sm md:text-base text-slate-500 leading-relaxed mt-2 mb-4 max-w-3xl">{cat.description}</p>
      )}
      {!loading && (
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-6">
          {items.length} product{items.length === 1 ? "" : "s"}
          {items.some((p) => p.stock > 0) && " · in stock · COD available"}
        </p>
      )}

      {/* related buying guide */}
      {hubGuide && (
        <Link
          to={`/guides/${hubGuide.slug}`}
          className="block rounded-2xl border border-blue-100 bg-blue-50/60 p-4 mb-8 hover:border-blue-300 transition"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700 mb-0.5">📖 New to {cat?.name}?</p>
          <p className="text-sm font-semibold text-slate-800">{hubGuide.title} →</p>
        </Link>
      )}

      {/* budget guides (programmatic pages, only live ones are linked) */}
      {hubBands.length > 0 && (
        <section className="mb-10 rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
          <h2 className="text-sm font-black text-slate-900 mb-2">Shopping by budget?</h2>
          <p className="text-xs text-slate-500 mb-3">
            Ranked guides built from what's actually selling this week.
          </p>
          <div className="flex flex-wrap gap-2">
            {hubBands.map((b) => (
              <Link key={b.url} to={b.url}
                className="px-4 py-2 rounded-lg bg-white border border-blue-200 text-sm font-semibold text-blue-700 hover:bg-blue-600 hover:text-white transition">
                {b.bandLabel}
              </Link>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="surface-muted rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-square bg-slate-100" />
              <div className="p-4 space-y-2.5">
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="h-4 bg-slate-100 rounded w-4/5" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="surface-muted rounded-2xl p-10 text-center text-slate-500 text-sm">
          Nothing here yet — new stock lands weekly.
          {" "}Check back soon or browse <Link to="/shop" className="font-bold text-blue-600 hover:underline">all products</Link>.
        </div>
      )}

      {/* sibling categories — internal linking between topical clusters */}
      <section className="mt-14">
        <h2 className="text-lg font-black text-slate-900 mb-3">Explore other categories</h2>
        <div className="flex flex-wrap gap-2">
          {categories.filter((c) => c.id !== id).map((c) => (
            <Link
              key={c.id}
              to={`/category/${c.id}`}
              className="px-4 py-2 rounded-lg surface-muted text-sm font-medium text-slate-600 hover:text-blue-700 transition"
            >
              {c.icon} {c.name}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
