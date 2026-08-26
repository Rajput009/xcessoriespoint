import { useEffect, useState } from "react";
import { Link } from "../router";
import { useProducts } from "../context/store";
import ProductCard from "../components/ProductCard";
import { setMeta } from "../lib/seo";

interface GuideSection {
  heading: string;
  body: string;
}
interface Guide {
  slug: string;
  title: string;
  tldr: string;
  sections: GuideSection[];
  relatedCategory: string;
  relatedBand: string;
  updatedAt: string;
}

/** AEO/GEO buying guides — direct-answer TL;DR for featured snippets and AI
 *  citations, then depth, then a conversion path into the catalog. */
export default function GuidePage({ slug }: { slug: string }) {
  const { products, categories } = useProducts();
  const [guide, setGuide] = useState<Guide | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [allGuides, setAllGuides] = useState<{ slug: string; title: string }[]>([]);

  useEffect(() => {
    let dead = false;
    setState("loading");
    fetch(`/api/guides/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error("missing");
        return r.json();
      })
      .then((g: Guide) => {
        if (dead) return;
        setGuide(g);
        setState("ok");
        const base = location.origin;
        setMeta({
          title: `${g.title} — XccessoriesPoint`,
          description: g.tldr.slice(0, 160),
          image: "/img/hero-1.png",
          url: `/guides/${slug}`,
          type: "article",
          jsonLd: [
            {
              "@context": "https://schema.org",
              "@type": "Article",
              headline: g.title,
              description: g.tldr,
              dateModified: g.updatedAt ? `${String(g.updatedAt).replace(" ", "T")}Z` : undefined,
              author: { "@type": "Organization", name: "XccessoriesPoint" },
            },
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: base + "/" },
                { "@type": "ListItem", position: 2, name: "Buying Guides", item: base + "/guides/" },
                { "@type": "ListItem", position: 3, name: g.title, item: `${base}/guides/${slug}` },
              ],
            },
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: g.title,
                  acceptedAnswer: { "@type": "Answer", text: g.tldr },
                },
                ...g.sections.map((s) => ({
                  "@type": "Question",
                  name: s.heading,
                  acceptedAnswer: { "@type": "Answer", text: s.body },
                })),
              ],
            },
          ],
        });
      })
      .catch(() => !dead && setState("missing"));
    fetch("/api/guides")
      .then((r) => r.json())
      .then((gs) => !dead && setAllGuides(gs))
      .catch(() => {});
    window.scrollTo({ top: 0 });
    return () => { dead = true; };
  }, [slug]);

  if (state === "loading")
    return (
      <main id="main-content" className="pt-[120px] md:pt-44 max-w-3xl mx-auto px-6 pb-16">
        <div className="h-9 w-2/3 bg-slate-100 rounded animate-pulse mb-6" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse mb-4" />
        ))}
      </main>
    );

  if (state === "missing" || !guide)
    return (
      <main id="main-content" className="pt-40 pb-20 px-6 max-w-7xl mx-auto text-center">
        <h1 className="text-3xl font-black text-slate-900 mb-2">Guide not found</h1>
        <Link to="/" className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700">
          Back to the store
        </Link>
      </main>
    );

  const cat = categories.find((c) => c.id === guide.relatedCategory);
  const related = guide.relatedCategory ? products.filter((p) => p.category === guide.relatedCategory && p.stock > 0).slice(0, 4) : [];
  const others = allGuides.filter((g) => g.slug !== slug).slice(0, 4);

  return (
    <main id="main-content" className="pt-[120px] md:pt-44 max-w-3xl mx-auto px-6 pb-16">
      {/* breadcrumb */}
      <nav className="text-xs text-slate-400 mb-4">
        <Link to="/" className="hover:text-emerald-600">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-slate-600 font-medium">Buying Guides</span>
      </nav>

      <h1 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight">{guide.title}</h1>

      {/* TL;DR — the direct answer (snippet & AI-citation target) */}
      <div className="mt-5 rounded-2xl border-l-4 border-emerald-500 bg-emerald-50/70 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-1">Quick answer</p>
        <p className="text-sm md:text-base text-slate-700 leading-relaxed">{guide.tldr}</p>
      </div>

      <div className="mt-8 space-y-6">
        {guide.sections.map((s) => (
          <section key={s.heading} className="surface rounded-2xl p-5">
            <h2 className="font-bold text-slate-900 mb-1.5">{s.heading}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
          </section>
        ))}
      </div>

      {/* conversion path */}
      {(cat || guide.relatedBand) && (
        <div className="mt-10 rounded-2xl bg-slate-900 p-6 text-white">
          <p className="font-bold">Ready to pick one?</p>
          <p className="text-sm text-slate-300 mt-1 mb-4">
            Shop {cat?.name ?? "the range"} with COD nationwide, free shipping over Rs 5,000.
          </p>
          <div className="flex flex-wrap gap-2">
            {cat && (
              <Link to={`/category/${cat.id}`} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">
                Browse {cat.name} →
              </Link>
            )}
            {guide.relatedBand && cat && (
              <Link to={`/category/${cat.id}/${guide.relatedBand}`} className="px-5 py-2.5 rounded-xl border border-slate-600 text-sm font-bold hover:border-emerald-500 hover:text-emerald-400 transition">
                See ranked picks by budget →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* related products */}
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-black text-slate-900 mb-4">Popular in this guide</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* sibling guides */}
      {others.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-black text-slate-900 mb-3">More buying guides</h2>
          <div className="flex flex-wrap gap-2">
            {others.map((g) => (
              <Link key={g.slug} to={`/guides/${g.slug}`}
                className="px-4 py-2 rounded-full surface-muted text-sm font-medium text-slate-600 hover:text-emerald-700 transition">
                {g.title}
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
