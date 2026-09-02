import { useEffect, useState } from "react";
import { Link } from "../router";
import { useProducts } from "../context/store";
import ProductCard, { Stars } from "../components/ProductCard";
import ViewToggle, { type ProductView } from "../components/ViewToggle";
import { setMeta } from "../lib/seo";
import { categoryArt } from "../lib/categoryArt";

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
  const [view, setView] = useState<ProductView>("grid");
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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Nothing to rank here yet</h1>
          <p className="text-sm text-slate-500 mb-6">
            We only publish buying guides once we can recommend at least three in-stock picks.
          </p>
          <Link to={`/category/${id}`} className="btn-primary px-6 py-3">
            Browse the full category
          </Link>
        </main>
      );

    const year = new Date().getFullYear();
    return (
      <main id="main-content" className="pt-[120px] md:pt-44 max-w-7xl mx-auto px-6 pb-16">
        {/* breadcrumb */}
        <nav className="text-xs text-slate-400 mb-3">
          <Link to="/" className="hover:text-teal-700">Home</Link>
          <span className="mx-1.5">/</span>
          <Link to="/shop" className="hover:text-teal-700">Shop</Link>
          <span className="mx-1.5">/</span>
          <Link to={`/category/${bandData.categoryId}`} className="hover:text-teal-700">{bandData.categoryName}</Link>
          <span className="mx-1.5">/</span>
          <span className="text-slate-600 font-medium">{bandData.bandLabel}</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
          {bandData.categoryName} {bandData.bandLabel} in Pakistan
          <span className="text-teal-700"> — Top {bandData.total} ({year})</span>
        </h1>
        <p className="text-sm md:text-base text-slate-500 leading-relaxed mt-2 max-w-3xl">{bandData.intro}</p>

        <ol className="mt-8 space-y-5">
          {bandData.items.map((it) => (
            <li key={it.id}>
              <div className="flex items-start gap-4 surface rounded-2xl p-4 hover:shadow-lg transition">
                <span className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                  it.rank <= 3 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                }`}>{it.rank}</span>
                <img src={it.image} alt={it.name} width={112} height={112}
                  loading="lazy"
                  className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl object-cover ring-1 ring-slate-200 shrink-0" />
                <div className="min-w-0 flex-1">
                  <Link to={`/product/${it.id}`} className="font-bold text-slate-900 hover:text-teal-700 line-clamp-1">
                    {it.name}
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Stars rating={it.rating} />
                    <span className="text-xs text-slate-400">{it.reviews} reviews</span>
                  </div>
                  <p className="text-xs font-semibold text-teal-700 mt-1">{it.why}</p>
                  <p className="text-sm text-slate-400 mt-1 hidden sm:block line-clamp-2">{it.description}</p>
                  <p className="mt-1.5 font-bold text-slate-900">
                    Rs {it.price.toLocaleString("en-PK")}
                    {it.compareAt && <span className="ml-2 text-xs text-slate-400 line-through font-medium">Rs {it.compareAt.toLocaleString("en-PK")}</span>}
                  </p>
                </div>
                <Link
                  to={`/product/${it.id}`}
                  className="shrink-0 self-center px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
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
            <h2 className="text-lg font-bold text-slate-900 mb-3">Other budgets in {bandData.categoryName}</h2>
            <div className="flex flex-wrap gap-2">
              <Link to={`/category/${bandData.categoryId}`}
                className="px-4 py-2 rounded-full bg-white ring-1 ring-slate-200 text-sm font-medium text-slate-600 hover:text-teal-700 transition">
                All {bandData.categoryName}
              </Link>
              {bandData.siblings.map((s) => (
                <Link key={s.url} to={s.url}
                  className="px-4 py-2 rounded-full bg-white ring-1 ring-slate-200 text-sm font-medium text-slate-600 hover:text-teal-700 transition">
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
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Category not found</h1>
        <Link to="/shop" className="btn-primary px-6 py-3">
          Browse all products
        </Link>
      </main>
    );

  return (
    <main id="main-content" className="pt-20 md:pt-32 pb-16">
      {/* ---- department banner — a clear "you are here in Audio / Wearables…" cue ---- */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 text-white">
        <div aria-hidden="true" className="xp-pattern absolute inset-0 opacity-60" />
        <div aria-hidden="true" className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
        <div aria-hidden="true" className="absolute -left-10 bottom-0 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-6 py-10 md:py-14">
          {/* breadcrumb */}
          <nav className="mb-4 flex items-center gap-1.5 text-xs text-slate-400">
            <Link to="/" className="transition-colors hover:text-white">Home</Link>
            <span aria-hidden="true">/</span>
            <Link to="/shop" className="transition-colors hover:text-white">Shop</Link>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-teal-300">{cat?.name ?? "…"}</span>
          </nav>

          <div className="flex flex-wrap items-center gap-8">
            <div className="min-w-0 flex-1">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-200">Department</span>
              </p>
              <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
                {cat ? cat.name : "\u00A0"}
              </h1>
              {cat?.description && (
                <p className="mt-3 max-w-2xl text-sm md:text-base leading-relaxed text-slate-300">{cat.description}</p>
              )}
              {!loading && (
                <p className="mt-4 text-sm font-semibold text-slate-300">
                  {items.length} product{items.length === 1 ? "" : "s"}
                  {items.some((p) => p.stock > 0) && (
                    <span className="text-teal-300"> · in stock · COD available</span>
                  )}
                </p>
              )}
            </div>

            {/* category logo on a light chip so it stays legible on the dark band */}
            <div className="hidden sm:block">
              <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-white/20 md:h-40 md:w-40">
                {cat && categoryArt(cat) ? (
                  <img
                    src={categoryArt(cat) as string}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-6xl">{cat?.icon || "🗂"}</span>
                )}
              </div>
            </div>
          </div>

          {/* jump to other departments */}
          <div className="mt-7 flex flex-wrap gap-2">
            {categories.map((c) => {
              const active = c.id === id;
              return (
                <Link
                  key={c.id}
                  to={`/category/${c.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-2 rounded-full py-2 pl-2 pr-4 text-sm font-semibold transition-all ${
                    active
                      ? "bg-teal-500 text-white shadow-sm"
                      : "bg-white/10 text-slate-200 ring-1 ring-white/15 hover:bg-white/20"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-white/90">
                    {categoryArt(c) ? (
                      <img src={categoryArt(c) as string} alt="" loading="lazy" className="h-full w-full object-contain p-0.5" />
                    ) : (
                      <span className="text-sm leading-none">{c.icon || "🗂"}</span>
                    )}
                  </span>
                  {c.name}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 mt-8 md:mt-10">

      {/* related buying guide */}
      {hubGuide && (
        <Link
          to={`/guides/${hubGuide.slug}`}
          className="block rounded-2xl border border-teal-100 bg-teal-50/60 p-4 mb-8 hover:border-teal-300 transition"
        >
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.28em] text-teal-600 mb-1">New to {cat?.name}?</p>
          <p className="text-sm font-semibold text-slate-800">{hubGuide.title} →</p>
        </Link>
      )}

      {/* budget guides (programmatic pages, only live ones are linked) */}
      {hubBands.length > 0 && (
        <section className="mb-10 rounded-2xl border border-teal-100 bg-teal-50/60 p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-2">Shopping by budget?</h2>
          <p className="text-xs text-slate-500 mb-3">
            Ranked guides built from what's actually selling this week.
          </p>
          <div className="flex flex-wrap gap-2">
            {hubBands.map((b) => (
              <Link key={b.url} to={b.url}
                className="px-4 py-2 rounded-lg bg-white border border-teal-200 text-sm font-semibold text-teal-700 hover:bg-slate-900 hover:text-white transition">
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
        <>
          <div className="flex items-center justify-end mb-3">
            <ViewToggle view={view} onChange={setView} />
          </div>
          {view === "list" ? (
            <div className="flex flex-col gap-3">
              {items.map((p) => (
                <ProductCard key={p.id} product={p} view="list" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="surface-muted rounded-2xl p-10 text-center text-slate-500 text-sm">
          Nothing here yet — new stock lands weekly.
          {" "}Check back soon or browse <Link to="/shop" className="font-bold text-teal-700 hover:underline">all products</Link>.
        </div>
      )}

      </div>
    </main>
  );
}
