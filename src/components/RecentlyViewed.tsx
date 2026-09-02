import { useProducts } from "../context/store";
import { useRouter } from "../router";
import ProductCard from "./ProductCard";
import { Kicker } from "./brand";

/** "Pick up where you left off" — driven by localStorage (functional storage, no consent needed). */
export default function RecentlyViewed({ excludeId }: { excludeId?: number }) {
  const { products } = useProducts();
  const { path } = useRouter();
  let ids: number[] = [];
  try {
    ids = JSON.parse(localStorage.getItem("xp_recent") || "[]");
  } catch { /* ignore */ }
  const list = ids
    .filter((id) => id !== excludeId)
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 4);
  if (list.length < 2) return null;
  return (
    <section className="max-w-7xl mx-auto px-2.5 sm:px-6 py-10" key={path}>
      <Kicker>Pick up where you left off</Kicker>
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Recently Viewed</h2>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
        {list.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
