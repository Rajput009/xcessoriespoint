import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "../router";
import { useAuth, useToast, authFetch, fmt } from "../context/store";
import type { Order } from "../types";

const SECTIONS = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "analytics", label: "Analytics", icon: "📈" },
  { id: "products", label: "Products", icon: "📦" },
  { id: "inventory", label: "Inventory", icon: "🏷" },
  { id: "orders", label: "Orders", icon: "🧾" },
  { id: "customers", label: "Customers", icon: "👥" },
  { id: "coupons", label: "Coupons", icon: "🏷️" },
  { id: "reviews", label: "Reviews", icon: "⭐" },
  { id: "returns", label: "Returns", icon: "↩️" },
  { id: "tickets", label: "Tickets", icon: "🎫" },
  { id: "notifications", label: "Notifications", icon: "🔔" },
  { id: "staff", label: "Staff & Roles", icon: "🛡️" },
  { id: "audit", label: "Audit Log", icon: "📜" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

const ORDER_STATUSES = [
  "Pending", "Confirmed", "Processing", "Packed", "Shipped", "Delivered",
  "Cancelled", "Failed", "Returned", "Refunded",
];
const RETURN_STATUSES = ["Requested", "Inspecting", "Approved", "Refunded", "Rejected"];
const TICKET_STATUSES = ["Open", "In Progress", "Resolved", "Closed"];

/* ---------- tiny helpers ---------- */
function pill(text: string, tone: "green" | "amber" | "red" | "slate") {
  const tones = {
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-600",
    slate: "bg-slate-100 text-slate-500",
  };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${tones[tone]}`}>
      {text}
    </span>
  );
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await authFetch(path, init);
  if (!r.ok) throw new Error((await r.json()).error || `Request failed (${r.status})`);
  return r.json();
}

/* ================= page ================= */
export default function AdminPage() {
  const { user, login, logout } = useAuth();
  const [section, setSection] = useState("dashboard");
  const isAdmin = !!user?.isAdmin;

  if (!isAdmin) return <AdminGate onLogin={login} loggedInNonAdmin={!!user} />;

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-16 lg:w-60 bg-slate-900 text-slate-300 flex flex-col shrink-0">
        <div className="p-4 lg:p-5 border-b border-slate-800">
          <Link to="/" className="font-black text-white text-sm lg:text-base">
            <span className="lg:hidden">XP</span>
            <span className="hidden lg:inline">
              Xccessories<span className="text-emerald-500">Point</span>
            </span>
          </Link>
          <p className="hidden lg:block text-[10px] uppercase tracking-widest text-slate-500 mt-1">
            Admin Console
          </p>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`w-full flex items-center gap-3 px-4 lg:px-5 py-2.5 text-sm transition ${
                section === s.id
                  ? "bg-emerald-600/15 text-emerald-400 border-r-2 border-emerald-500"
                  : "hover:bg-slate-800"
              }`}
            >
              <span>{s.icon}</span>
              <span className="hidden lg:inline">{s.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={logout} className="text-xs text-slate-400 hover:text-red-400">
            <span className="lg:hidden">⏻</span>
            <span className="hidden lg:inline">⏻ Sign out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 p-5 lg:p-8 overflow-x-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black text-slate-900 capitalize">{section}</h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:block text-slate-500">{user.email}</span>
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
              {user.name.charAt(0)}
            </div>
          </div>
        </div>

        {section === "dashboard" && <Dashboard />}
        {section === "analytics" && <AnalyticsSection />}
        {section === "products" && <ProductsSection />}
        {section === "inventory" && <InventorySection />}
        {section === "orders" && <OrdersSection />}
        {section === "customers" && <CustomersSection />}
        {section === "coupons" && <CouponsSection />}
        {section === "reviews" && <ReviewsSection />}
        {section === "returns" && <ReturnsSection />}
        {section === "tickets" && <TicketsSection />}
        {section === "notifications" && <NotificationsSection />}
        {section === "staff" && <StaffSection />}
        {section === "audit" && <AuditSection />}
        {section === "settings" && <SettingsSection />}
      </main>
    </div>
  );
}

/* ================= dashboard ================= */
interface Metrics {
  revenue: number; orderCount: number; customerCount: number; productCount: number;
  pendingReviews: number; openTickets: number; unreadNotifs: number; subscribers: number;
  lowStock: { id: number; name: string; stock: number }[];
  topProducts: { name: string; sold: number; revenue: number }[];
  recentOrders: Order[];
  statusBreakdown: { status: string; c: number }[];
}

function Dashboard() {
  const [m, setM] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Metrics>("/api/admin/metrics").then(setM).catch((e) => setError(e.message));
  }, []);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!m) return <p className="text-sm text-slate-500">Loading metrics…</p>;

  const cards: [string, string, string][] = [
    ["Revenue", fmt(m.revenue), "💰"],
    ["Orders", String(m.orderCount), "🧾"],
    ["Customers", String(m.customerCount), "👥"],
    ["Products", String(m.productCount), "📦"],
    ["Pending reviews", String(m.pendingReviews), "⭐"],
    ["Open tickets", String(m.openTickets), "🎫"],
    ["Unread alerts", String(m.unreadNotifs), "🔔"],
    ["Subscribers", String(m.subscribers), "📧"],
  ];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(([l, v, i]) => (
          <div key={l} className="bg-white rounded-2xl p-5 border border-slate-200">
            <p className="text-2xl mb-1">{i}</p>
            <p className="text-xl font-black text-slate-900">{v}</p>
            <p className="text-xs text-slate-500">{l}</p>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="font-bold text-slate-900 mb-3">Top products</p>
          {m.topProducts.length === 0 ? (
            <p className="text-sm text-slate-500">No sales yet.</p>
          ) : (
            m.topProducts.map((t) => (
              <div key={t.name} className="flex justify-between items-center py-2 border-b border-slate-50 text-sm">
                <span className="text-slate-700 truncate mr-3">{t.name}</span>
                <span className="text-slate-500 whitespace-nowrap">{t.sold} sold · {fmt(t.revenue)}</span>
              </div>
            ))
          )}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="font-bold text-slate-900 mb-3">Low stock ⚠️</p>
          {m.lowStock.length === 0 ? (
            <p className="text-sm text-slate-500">All products healthy.</p>
          ) : (
            m.lowStock.map((p) => (
              <div key={p.id} className="flex justify-between items-center py-2 border-b border-slate-50 text-sm">
                <span className="text-slate-700 truncate mr-3">{p.name}</span>
                {pill(`${p.stock} left`, p.stock <= 5 ? "red" : "amber")}
              </div>
            ))
          )}
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <p className="font-bold text-slate-900 mb-3">Latest orders</p>
        <OrdersTable orders={m.recentOrders} />
      </div>
    </>
  );
}

/* ================= products ================= */
interface AdminVariant {
  id: number; label: string; sku: string | null; priceDelta: number; stock: number; active: boolean;
  swatch?: string | null;
}
interface AdminProduct {
  id: number; name: string; category: string; price: number; stock: number;
  rating: number; image: string; active: boolean; variants?: AdminVariant[];
  imageRecords?: { id: number; url: string }[];
  compareAt?: number | null;
  badge?: string | null;
  description?: string;
  featured?: boolean;
  bestSeller?: boolean;
  newArrival?: boolean;
  dealOfDay?: boolean;
}
interface ProductFormState {
  name: string; category: string; price: string; compareAt: string; stock: string;
  image: string; badge: string; description: string;
  featured: boolean; bestSeller: boolean; newArrival: boolean; dealOfDay: boolean;
}
interface NewVariant {
  label: string; sku: string; priceDelta: number; stock: number; swatch: string;
}

function ProductsSection() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [vForm, setVForm] = useState({ label: "", sku: "", priceDelta: 0, stock: 0 });
  const [imgUrl, setImgUrl] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [nForm, setNForm] = useState<ProductFormState>({
    name: "", category: "", price: "", compareAt: "", stock: "",
    image: "/img/earbuds.jpg", badge: "", description: "",
    featured: false, bestSeller: false, newArrival: false, dealOfDay: false,
  });
  const [nVariants, setNVariants] = useState<NewVariant[]>([]);
  const [nVForm, setNVForm] = useState<NewVariant>({ label: "", sku: "", priceDelta: 0, stock: 0, swatch: "#10b981" });
  const [nGallery, setNGallery] = useState<string[]>([]);
  const [nGalleryInput, setNGalleryInput] = useState("");
  const [edit, setEdit] = useState<AdminProduct | null>(null);
  const [eForm, setEForm] = useState<ProductFormState>({ name: "", category: "", price: "", compareAt: "", stock: "", image: "", badge: "", description: "", featured: false, bestSeller: false, newArrival: false, dealOfDay: false });
  const [rowDrafts, setRowDrafts] = useState<Record<number, { price: string; stock: string }>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const { push } = useToast();
  const load = useCallback(() => {
    api<AdminProduct[]>("/api/products?includeInactive=1").then(setProducts).catch(() => {});
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    api<{ id: string; name: string }[]>("/api/categories")
      .then((c) => {
        setCategories(c);
        setNForm((f) => (f.category ? f : { ...f, category: c[0]?.id ?? "" }));
      })
      .catch(() => {});
  }, []);

  const updateVariant = async (id: number, patch: Partial<AdminVariant>) => {
    try {
      await api(`/api/variants/${id}`, { method: "PUT", body: JSON.stringify(patch) });
      push("Variant updated");
      load();
    } catch (e) {
      push(e instanceof Error ? e.message : "Failed", "error");
    }
  };
  const addVariant = async (productId: number) => {
    if (!vForm.label.trim()) return push("Variant label required", "error");
    try {
      await api(`/api/products/${productId}/variants`, { method: "POST", body: JSON.stringify(vForm) });
      push(`Variant "${vForm.label}" added`);
      setVForm({ label: "", sku: "", priceDelta: 0, stock: 0 });
      load();
    } catch (e) {
      push(e instanceof Error ? e.message : "Failed", "error");
    }
  };
  const deleteVariant = async (id: number) => {
    await api(`/api/variants/${id}`, { method: "DELETE" });
    push("Variant deactivated", "info");
    load();
  };
  const addImage = async (productId: number) => {
    if (!imgUrl.trim()) return push("Image URL required", "error");
    try {
      await api(`/api/products/${productId}/images`, { method: "POST", body: JSON.stringify({ url: imgUrl.trim() }) });
      push("Image added");
      setImgUrl("");
      load();
    } catch (e) {
      push(e instanceof Error ? e.message : "Failed", "error");
    }
  };
  const deleteImage = async (id: number) => {
    await api(`/api/images/${id}`, { method: "DELETE" });
    push("Image removed", "info");
    load();
  };
  const setCover = async (p: AdminProduct, url: string) => {
    try {
      await api(`/api/products/${p.id}`, { method: "PUT", body: JSON.stringify({ image: url }) });
      push("Cover image updated");
      load();
    } catch (e) {
      push(e instanceof Error ? e.message : "Failed to set cover", "error");
    }
  };

  const update = async (id: number, patch: Partial<AdminProduct>) => {
    try {
      await api(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(patch) });
      push("Product updated");
      load();
    } catch (e) {
      push(e instanceof Error ? e.message : "Update failed", "error");
    }
  };

  const saveRow = async (p: AdminProduct) => {
    const d = rowDrafts[p.id] ?? { price: String(p.price), stock: String(p.stock) };
    const price = parseInt(d.price, 10);
    const stock = parseInt(d.stock, 10);
    if (!price) return push("Price must be greater than 0", "error");
    setSavingId(p.id);
    try {
      await api(`/api/products/${p.id}`, { method: "PUT", body: JSON.stringify({ price, stock: Number.isNaN(stock) ? p.stock : Math.max(0, stock) }) });
      push("Product updated");
      setRowDrafts((r) => {
        const next = { ...r };
        delete next[p.id];
        return next;
      });
      load();
    } catch (e) {
      push(e instanceof Error ? e.message : "Update failed", "error");
    } finally {
      setSavingId(null);
    }
  };

  const productBody = (f: ProductFormState) => ({
    name: f.name.trim(),
    category: f.category,
    price: parseInt(f.price, 10),
    compareAt: f.compareAt ? parseInt(f.compareAt, 10) : null,
    stock: Math.max(0, parseInt(f.stock, 10) || 0),
    image: f.image.trim() || "/img/earbuds.jpg",
    badge: f.badge.trim() || null,
    description: f.description.trim(),
    featured: f.featured,
    bestSeller: f.bestSeller,
    newArrival: f.newArrival,
    dealOfDay: f.dealOfDay,
  });

  const createProduct = async (e: FormEvent) => {
    e.preventDefault();
    const price = parseInt(nForm.price, 10);
    if (!nForm.name.trim()) return push("Product name is required", "error");
    if (!nForm.category) return push("Category is required", "error");
    if (!price) return push("A price greater than 0 is required", "error");
    try {
      const created = await api<AdminProduct>("/api/products", { method: "POST", body: JSON.stringify(productBody(nForm)) });
      for (const v of nVariants) {
        try {
          await api(`/api/products/${created.id}/variants`, { method: "POST", body: JSON.stringify(v) });
        } catch (err) {
          push(`Variant "${v.label}" failed: ${err instanceof Error ? err.message : "error"}`, "error");
        }
      }
      for (const url of nGallery) {
        try {
          await api(`/api/products/${created.id}/images`, { method: "POST", body: JSON.stringify({ url }) });
        } catch (err) {
          push(`Image "${url}" failed: ${err instanceof Error ? err.message : "error"}`, "error");
        }
      }
      push(`Product "${created.name}" added`);
      setNForm({ name: "", category: categories[0]?.id ?? "", price: "", compareAt: "", stock: "", image: "/img/earbuds.jpg", badge: "", description: "", featured: false, bestSeller: false, newArrival: false, dealOfDay: false });
      setNVariants([]);
      setNVForm({ label: "", sku: "", priceDelta: 0, stock: 0, swatch: "#10b981" });
      setNGallery([]);
      setNGalleryInput("");
      setShowForm(false);
      load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to add product", "error");
    }
  };

  const openEdit = (p: AdminProduct) => {
    setEdit(p);
    setEForm({
      name: p.name,
      category: p.category,
      price: String(p.price),
      compareAt: p.compareAt != null ? String(p.compareAt) : "",
      stock: String(p.stock),
      image: p.image || "",
      badge: p.badge || "",
      description: p.description || "",
      featured: !!p.featured,
      bestSeller: !!p.bestSeller,
      newArrival: !!p.newArrival,
      dealOfDay: !!p.dealOfDay,
    });
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    const price = parseInt(eForm.price, 10);
    if (!eForm.name.trim()) return push("Product name is required", "error");
    if (!price) return push("A price greater than 0 is required", "error");
    try {
      await api(`/api/products/${edit.id}`, { method: "PUT", body: JSON.stringify(productBody(eForm)) });
      push("Product updated");
      setEdit(null);
      load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Update failed", "error");
    }
  };

  const deleteProduct = async (p: AdminProduct) => {
    if (!window.confirm(`Delete "${p.name}"?\n\nThis hides it from the store (recoverable soft delete).`)) return;
    try {
      await api(`/api/products/${p.id}`, { method: "DELETE" });
      push(`"${p.name}" hidden from store`, "info");
      load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  return (
    <>
      {showForm && (
        <form onSubmit={createProduct} className="bg-white rounded-2xl border border-slate-200 p-5 mb-5">
          <p className="font-bold text-slate-900 text-sm mb-4">Add product</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold uppercase text-slate-400">Name</label>
              <input value={nForm.name} onChange={(e) => setNForm({ ...nForm, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. AeroBuds Pro" required />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-slate-400">Category</label>
              <select value={nForm.category} onChange={(e) => setNForm({ ...nForm, category: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-slate-400">Price (Rs)</label>
              <input type="number" min="1" value={nForm.price} onChange={(e) => setNForm({ ...nForm, price: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="4999" required />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-slate-400">Compare-at (Rs)</label>
              <input type="number" min="0" value={nForm.compareAt} onChange={(e) => setNForm({ ...nForm, compareAt: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Optional" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-slate-400">Stock</label>
              <input type="number" min="0" value={nForm.stock} onChange={(e) => setNForm({ ...nForm, stock: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-slate-400">Image URL</label>
              <input value={nForm.image} onChange={(e) => setNForm({ ...nForm, image: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="/img/… or https://…" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-slate-400">Badge</label>
              <input value={nForm.badge} onChange={(e) => setNForm({ ...nForm, badge: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder='e.g. "-30%"' />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="text-xs font-bold uppercase text-slate-400">Description</label>
              <input value={nForm.description} onChange={(e) => setNForm({ ...nForm, description: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Short product description" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-5 flex-wrap">
            {(["featured", "bestSeller", "newArrival", "dealOfDay"] as const).map((k) => (
              <label key={k} className="inline-flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={nForm[k]} onChange={(e) => setNForm({ ...nForm, [k]: e.target.checked })}
                  className="h-4 w-4 accent-emerald-600" />
                {k === "bestSeller" ? "Best seller" : k === "newArrival" ? "New arrival" : k === "dealOfDay" ? "Deal of the day" : "Featured"}
              </label>
            ))}
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-bold uppercase text-slate-400 mb-2">Variants (optional)</p>
            {nVariants.length === 0 && <p className="text-xs text-slate-500 mb-2">No variants — this will be a simple product.</p>}
            <div className="space-y-1.5 mb-2">
              {nVariants.map((v, i) => (
                <div key={i} className="flex items-center gap-3 text-sm bg-slate-50 rounded-lg px-3 py-1.5">
                  {v.swatch && <span className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: v.swatch }} />}
                  <span className="font-semibold text-slate-900 w-40 truncate">{v.label}</span>
                  <span className="text-xs text-slate-400 w-24">{v.sku || "—"}</span>
                  <span className="text-xs text-slate-500">Δ {v.priceDelta} · stock {v.stock}</span>
                  <button type="button" onClick={() => setNVariants(nVariants.filter((_, j) => j !== i))}
                    className="ml-auto text-xs font-semibold text-red-500 hover:underline">Remove</button>
                </div>
              ))}
            </div>
            <div className="flex items-end gap-2 flex-wrap">
              <input placeholder="Label (e.g. Black)" value={nVForm.label}
                onChange={(e) => setNVForm({ ...nVForm, label: e.target.value })}
                className="w-36 rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
              <input placeholder="SKU" value={nVForm.sku}
                onChange={(e) => setNVForm({ ...nVForm, sku: e.target.value })}
                className="w-28 rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
              <label className="text-xs text-slate-500">Δ price
                <input type="number" value={nVForm.priceDelta}
                  onChange={(e) => setNVForm({ ...nVForm, priceDelta: +e.target.value })}
                  className="ml-1.5 w-20 rounded-md border border-slate-200 px-2 py-1 text-sm" />
              </label>
              <label className="text-xs text-slate-500">Stock
                <input type="number" value={nVForm.stock}
                  onChange={(e) => setNVForm({ ...nVForm, stock: +e.target.value })}
                  className="ml-1.5 w-20 rounded-md border border-slate-200 px-2 py-1 text-sm" />
              </label>
              <label className="text-xs text-slate-500 inline-flex items-center">Swatch
                <input type="color" value={nVForm.swatch}
                  onChange={(e) => setNVForm({ ...nVForm, swatch: e.target.value })}
                  className="ml-1.5 w-8 h-7 rounded border border-slate-200 cursor-pointer" />
              </label>
              <button type="button"
                onClick={() => {
                  if (!nVForm.label.trim()) return push("Variant label required", "error");
                  setNVariants([...nVariants, nVForm]);
                  setNVForm({ label: "", sku: "", priceDelta: 0, stock: 0, swatch: "#10b981" });
                }}
                className="px-3 py-1.5 rounded-md bg-violet-600 text-white text-xs font-bold hover:bg-violet-700">
                + Add variant
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">Product stock becomes the sum of its variants' stock.</p>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-bold uppercase text-slate-400 mb-2">Gallery images (optional) <span className="normal-case font-medium text-slate-400">(★ sets cover)</span></p>
            {nGallery.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {nGallery.map((url, i) => (
                  <div key={i} className="relative group/img">
                    <img src={url} alt="" className={`w-14 h-14 rounded-lg object-cover ${url === nForm.image ? "ring-2 ring-emerald-400" : ""}`} />
                    <button type="button"
                      onClick={() => setNForm({ ...nForm, image: url })}
                      disabled={url === nForm.image}
                      title={url === nForm.image ? "Current cover" : "Set as cover image"}
                      className={`absolute -top-1.5 -left-1.5 w-[18px] h-[18px] rounded-full text-[10px] font-bold transition ${
                        url === nForm.image
                          ? "bg-emerald-600 text-white"
                          : "bg-white text-slate-500 border border-slate-200 opacity-0 group-hover/img:opacity-100 hover:bg-emerald-50"
                      }`}
                      aria-label="Set as cover image">★</button>
                    <button type="button" onClick={() => setNGallery(nGallery.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold opacity-0 group-hover/img:opacity-100 transition"
                      aria-label="Remove image">✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input placeholder="/img/… or https://…" value={nGalleryInput}
                onChange={(e) => setNGalleryInput(e.target.value)}
                className="w-64 rounded-md border border-slate-200 px-2 py-1.5 text-xs" />
              <button type="button"
                onClick={() => {
                  const u = nGalleryInput.trim();
                  if (!u) return push("Image URL required", "error");
                  setNGallery([...nGallery, u]);
                  setNGalleryInput("");
                }}
                className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700">
                + Add image
              </button>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">
              + Create product
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-500 hover:bg-slate-100">
              Cancel
            </button>
          </div>
        </form>
      )}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center">
          <p className="font-bold text-slate-900 text-sm">{products.length} products</p>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
          >
            {showForm ? "✕ Close" : "+ Add product"}
          </button>
        </div>
      <table className="w-full text-sm min-w-[680px]">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3">Stock</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const draft = rowDrafts[p.id] ?? { price: String(p.price), stock: String(p.stock) };
            const dirty = draft.price !== String(p.price) || draft.stock !== String(p.stock);
            const setDraft = (patch: Partial<{ price: string; stock: string }>) =>
              setRowDrafts((r) => ({ ...r, [p.id]: { ...(r[p.id] ?? { price: String(p.price), stock: String(p.stock) }), ...patch } }));
            return (
            <tr key={p.id} className={`border-t border-slate-100 hover:bg-slate-50 ${!p.active ? "opacity-50" : ""}`}>
              <td className="px-4 py-2.5 flex items-center gap-3">
                <img src={p.image} alt="" className="w-9 h-9 rounded-lg object-cover" />
                <span className="font-medium text-slate-900">{p.name}</span>
              </td>
              <td className="px-4 py-2.5 text-slate-500 capitalize">{p.category}</td>
              <td className="px-4 py-2.5">
                <input
                  type="number"
                  value={draft.price}
                  onChange={(e) => setDraft({ price: e.target.value })}
                  className={`w-24 rounded-md border px-2 py-1 text-sm ${dirty && draft.price !== String(p.price) ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}
                />
              </td>
              <td className="px-4 py-2.5">
                <input
                  type="number"
                  value={draft.stock}
                  onChange={(e) => setDraft({ stock: e.target.value })}
                  className={`w-20 rounded-md border px-2 py-1 text-sm ${dirty && draft.stock !== String(p.stock) ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}
                />
              </td>
              <td className="px-4 py-2.5">{p.active ? pill("Active", "green") : pill("Hidden", "slate")}</td>
              <td className="px-4 py-2.5 whitespace-nowrap space-x-2">
                {dirty && (
                  <>
                    <button
                      onClick={() => saveRow(p)}
                      disabled={savingId === p.id}
                      className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {savingId === p.id ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => setRowDrafts((r) => {
                        const next = { ...r };
                        delete next[p.id];
                        return next;
                      })}
                      className="text-xs font-semibold text-slate-400 hover:underline"
                    >
                      Reset
                    </button>
                  </>
                )}
                <button
                  onClick={() => openEdit(p)}
                  className="text-xs font-semibold text-slate-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                  className="text-xs font-semibold text-violet-600 hover:underline"
                >
                  Variants ({p.variants?.filter((v) => v.active).length ?? 0}) {expanded === p.id ? "▴" : "▾"}
                </button>
                <button
                  onClick={() => update(p.id, { active: !p.active })}
                  className="text-xs font-semibold text-emerald-600 hover:underline"
                >
                  {p.active ? "Hide" : "Show"}
                </button>
                <button
                  onClick={() => deleteProduct(p)}
                  className="text-xs font-semibold text-red-500 hover:underline"
                >
                  Delete
                </button>
              </td>
            </tr>
            );
          }).flatMap((row, idx) => {
            const p = products[idx];
            if (expanded !== p.id) return [row];
            return [row,
              <tr key={`v${p.id}`} className="bg-violet-50/50">
                <td colSpan={6} className="px-6 py-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Gallery images <span className="normal-case font-medium text-slate-400">(★ sets cover)</span></p>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <div className="relative">
                      <img src={p.image} alt="" className="w-14 h-14 rounded-lg object-cover ring-2 ring-emerald-400" />
                      <span className="absolute -top-1.5 -right-1.5 bg-emerald-600 text-white text-[8px] font-bold px-1 rounded">COVER</span>
                    </div>
                    {(p.imageRecords ?? []).map((im) => (
                      <div key={im.id} className="relative group/img">
                        <img src={im.url} alt="" className={`w-14 h-14 rounded-lg object-cover ${im.url === p.image ? "ring-2 ring-emerald-400" : ""}`} />
                        <button
                          onClick={() => setCover(p, im.url)}
                          disabled={im.url === p.image}
                          title={im.url === p.image ? "Current cover" : "Set as cover image"}
                          className={`absolute -top-1.5 -left-1.5 w-[18px] h-[18px] rounded-full text-[10px] font-bold transition ${
                            im.url === p.image
                              ? "bg-emerald-600 text-white"
                              : "bg-white text-slate-500 border border-slate-200 opacity-0 group-hover/img:opacity-100 hover:bg-emerald-50"
                          }`}
                          aria-label="Set as cover image"
                        >
                          ★
                        </button>
                        <button
                          onClick={() => deleteImage(im.id)}
                          className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold opacity-0 group-hover/img:opacity-100 transition"
                          aria-label="Remove image"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <input
                      placeholder="/img/… or https://…"
                      value={imgUrl}
                      onChange={(e) => setImgUrl(e.target.value)}
                      className="w-52 rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                    />
                    <button
                      onClick={() => addImage(p.id)}
                      className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                    >
                      + Add image
                    </button>
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2 mt-4">
                    Variants of {p.name} — per-variant stock & price difference
                  </p>
                  {(p.variants ?? []).length === 0 && (
                    <p className="text-xs text-slate-500 mb-2">No variants — this is a simple product.</p>
                  )}
                  <div className="space-y-1.5 mb-3">
                    {(p.variants ?? []).map((v) => (
                      <div key={v.id} className={`flex items-center gap-3 text-sm ${!v.active ? "opacity-40" : ""}`}>
                        <span className="w-36 font-semibold text-slate-900 truncate inline-flex items-center gap-2">
                          {v.swatch && v.swatch !== "transparent" && (
                            <span className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: v.swatch }} />
                          )}
                          {v.label}
                        </span>
                        <span className="w-28 text-xs text-slate-400">{v.sku || "—"}</span>
                        <label className="text-xs text-slate-500">Δ price
                          <input type="number" defaultValue={v.priceDelta}
                            onBlur={(e) => { const n = parseInt(e.target.value, 10) || 0; if (n !== v.priceDelta) updateVariant(v.id, { priceDelta: n }); }}
                            className="ml-1.5 w-20 rounded-md border border-slate-200 px-2 py-1 text-sm" />
                        </label>
                        <label className="text-xs text-slate-500">Stock
                          <input type="number" defaultValue={v.stock}
                            onBlur={(e) => { const n = parseInt(e.target.value, 10); if (!Number.isNaN(n) && n !== v.stock) updateVariant(v.id, { stock: n }); }}
                            className="ml-1.5 w-20 rounded-md border border-slate-200 px-2 py-1 text-sm" />
                        </label>
                        <label className="text-xs text-slate-500 inline-flex items-center">Swatch
                          <input type="color" defaultValue={v.swatch && v.swatch.startsWith("#") ? v.swatch : "#10b981"}
                            onBlur={(e) => { if (e.target.value !== v.swatch) updateVariant(v.id, { swatch: e.target.value }); }}
                            className="ml-1.5 w-8 h-7 rounded border border-slate-200 cursor-pointer" />
                        </label>
                        {v.active && (
                          <button onClick={() => deleteVariant(v.id)} className="text-xs font-semibold text-red-500 hover:underline">
                            Deactivate
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-end gap-2 flex-wrap">
                    <input placeholder="Label (e.g. Black)" value={vForm.label}
                      onChange={(e) => setVForm({ ...vForm, label: e.target.value })}
                      className="w-36 rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                    <input placeholder="SKU" value={vForm.sku}
                      onChange={(e) => setVForm({ ...vForm, sku: e.target.value })}
                      className="w-28 rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                    <input type="number" placeholder="Δ price" value={vForm.priceDelta}
                      onChange={(e) => setVForm({ ...vForm, priceDelta: +e.target.value })}
                      className="w-24 rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                    <input type="number" placeholder="Stock" value={vForm.stock}
                      onChange={(e) => setVForm({ ...vForm, stock: +e.target.value })}
                      className="w-20 rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                    <button onClick={() => addVariant(p.id)}
                      className="px-4 py-1.5 rounded-md bg-violet-600 text-white text-xs font-bold hover:bg-violet-700">
                      + Add variant
                    </button>
                  </div>
                </td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
      <p className="px-4 py-3 text-xs text-slate-400 border-t border-slate-100">
        Edit price/stock inline — a "Save" button appears once you change a value. "Variants" manages per-option stock & price differences; product stock becomes the variant total. "Hide" and "Delete" both soft-delete.
      </p>
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setEdit(null)} />
          <form onSubmit={saveEdit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <p className="font-bold text-slate-900 text-sm mb-4">Edit product #{edit.id}</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold uppercase text-slate-400">Name</label>
                <input value={eForm.name} onChange={(e) => setEForm({ ...eForm, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-400">Category</label>
                <select value={eForm.category} onChange={(e) => setEForm({ ...eForm, category: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-400">Price (Rs)</label>
                <input type="number" min="1" value={eForm.price} onChange={(e) => setEForm({ ...eForm, price: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-400">Compare-at (Rs)</label>
                <input type="number" min="0" value={eForm.compareAt} onChange={(e) => setEForm({ ...eForm, compareAt: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Optional" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-400">Stock</label>
                <input type="number" min="0" value={eForm.stock} onChange={(e) => setEForm({ ...eForm, stock: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-400">Cover image URL</label>
                <input value={eForm.image} onChange={(e) => setEForm({ ...eForm, image: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="/img/… or https://…" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-400">Badge</label>
                <input value={eForm.badge} onChange={(e) => setEForm({ ...eForm, badge: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder='e.g. "-30%"' />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="text-xs font-bold uppercase text-slate-400">Description</label>
                <input value={eForm.description} onChange={(e) => setEForm({ ...eForm, description: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Short product description" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-5 flex-wrap">
              {(["featured", "bestSeller", "newArrival", "dealOfDay"] as const).map((k) => (
                <label key={k} className="inline-flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={eForm[k]} onChange={(e) => setEForm({ ...eForm, [k]: e.target.checked })}
                    className="h-4 w-4 accent-emerald-600" />
                  {k === "bestSeller" ? "Best seller" : k === "newArrival" ? "New arrival" : k === "dealOfDay" ? "Deal of the day" : "Featured"}
                </label>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button type="submit" className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">
                Save changes
              </button>
              <button type="button" onClick={() => setEdit(null)} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-500 hover:bg-slate-100">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

/* ================= orders ================= */
function OrdersTable({ orders, onStatus }: { orders: Order[]; onStatus?: (id: string, s: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  if (orders.length === 0)
    return <p className="text-sm text-slate-500 py-4 text-center">No orders yet.</p>;
  return (
    <table className="w-full text-sm min-w-[620px]">
      <thead className="text-left text-xs uppercase text-slate-500">
        <tr>
          <th className="py-2 pr-4">Order</th>
          <th className="py-2 pr-4">Customer</th>
          <th className="py-2 pr-4">Items</th>
          <th className="py-2 pr-4">Payment</th>
          <th className="py-2 pr-4">Coupon</th>
          <th className="py-2 pr-4">Total</th>
          <th className="py-2 pr-4">Status</th>
          <th className="py-2"></th>
        </tr>
      </thead>
      <tbody>
        {orders.flatMap((o) => {
          const row = (
            <tr key={o.id} className="border-t border-slate-100">
              <td className="py-2.5 pr-4 font-bold text-slate-900">{o.id}</td>
              <td className="py-2.5 pr-4 text-slate-500">{o.customer || o.email || "—"}</td>
              <td className="py-2.5 pr-4 text-slate-500">{o.items.reduce((s, i) => s + i.qty, 0)}</td>
              <td className="py-2.5 pr-4">
                <span className="text-xs uppercase font-semibold text-slate-600">{o.paymentInfo?.method ?? o.payment ?? "—"}</span>{" "}
                {o.paymentInfo &&
                  pill(
                    o.paymentInfo.status,
                    o.paymentInfo.status === "paid" ? "green" : o.paymentInfo.status === "refunded" ? "slate" : o.paymentInfo.status === "failed" ? "red" : "amber"
                  )}
              </td>
              <td className="py-2.5 pr-4 text-slate-500">{o.couponCode || "—"}</td>
              <td className="py-2.5 pr-4 font-semibold">{fmt(o.total)}</td>
              <td className="py-2.5 pr-4">
                {onStatus ? (
                  <select
                    value={o.status}
                    onChange={(e) => onStatus(o.id, e.target.value)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  pill(o.status, o.status === "Delivered" ? "green" : o.status === "Cancelled" ? "red" : "amber")
                )}
              </td>
              <td className="py-2.5 text-right">
                <button
                  onClick={() => setOpen(open === o.id ? null : o.id)}
                  className="text-xs font-semibold text-violet-600 hover:underline whitespace-nowrap"
                >
                  {open === o.id ? "Hide ▴" : "Details ▾"}
                </button>
              </td>
            </tr>
          );
          if (open !== o.id) return [row];
          return [
            row,
            <tr key={`${o.id}-detail`} className="bg-slate-50/70">
              <td colSpan={8} className="px-4 py-4">
                <OrderDetails order={o} />
              </td>
            </tr>,
          ];
        })}
      </tbody>
    </table>
  );
}

function OrderDetails({ order: o }: { order: Order }) {
  const row = (label: string, value: string | undefined | null) => (
    <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100 last:border-0 text-sm">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="text-slate-700 text-right break-words">{value?.trim() || "—"}</span>
    </div>
  );
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Products in order</p>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {o.items.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">No items.</p>}
          {o.items.map((it, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{it.name}</p>
                {it.variantLabel && (
                  <p className="text-xs text-slate-400">
                    {it.variantLabel}
                    {it.sku ? ` · ${it.sku}` : ""}
                  </p>
                )}
              </div>
              <span className="text-slate-500 whitespace-nowrap">{it.qty} × {fmt(it.price)}</span>
              <span className="font-semibold text-slate-900 whitespace-nowrap">{fmt(it.price * it.qty)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 bg-white rounded-xl border border-slate-200 px-4 py-2.5 text-sm">
          <div className="flex justify-between py-1 text-slate-500">
            <span>Subtotal</span><span>{fmt(o.subtotal ?? 0)}</span>
          </div>
          {o.discount ? (
            <div className="flex justify-between py-1 text-emerald-600">
              <span>Discount{o.couponCode ? ` (${o.couponCode})` : ""}</span><span>−{fmt(o.discount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between py-1 text-slate-500">
            <span>Shipping</span><span>{o.shipping ? fmt(o.shipping) : "Free"}</span>
          </div>
          <div className="flex justify-between py-1 font-bold text-slate-900 border-t border-slate-100 mt-1">
            <span>Total</span><span>{fmt(o.total)}</span>
          </div>
        </div>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Customer</p>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5">
          {row("Name", o.customer)}
          {row("Email", o.email)}
          {row("Phone", o.phone)}
          {row("Order placed", o.createdAt)}
          {row("Payment", o.paymentInfo ? `${o.paymentInfo.method.toUpperCase()} · ${o.paymentInfo.status}` : o.payment)}
        </div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2 mt-4">Shipping address</p>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5">
          {row("Address", o.address)}
          {row("City", o.city)}
        </div>
      </div>
    </div>
  );
}

function OrdersSection() {
  const [orders, setOrders] = useState<Order[]>([]);
  const { push } = useToast();
  const load = useCallback(() => {
    api<Order[]>("/api/orders").then(setOrders).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const setStatus = async (id: string, status: string) => {
    try {
      await api(`/api/orders/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) });
      push(`${id} → ${status}`);
      load();
    } catch (e) {
      push(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <OrdersTable orders={orders} onStatus={setStatus} />
    </div>
  );
}

/* ================= customers ================= */
interface Customer {
  id: number; name: string; email: string; isAdmin: boolean;
  createdAt: string; orderCount: number; totalSpent: number;
}

function CustomersSection() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  useEffect(() => {
    api<Customer[]>("/api/customers").then(setCustomers).catch(() => {});
  }, []);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm min-w-[560px]">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Orders</th>
            <th className="px-4 py-3">Spent</th>
            <th className="px-4 py-3">Role</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id} className="border-t border-slate-100">
              <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
              <td className="px-4 py-3 text-slate-500">{c.email}</td>
              <td className="px-4 py-3">{c.orderCount}</td>
              <td className="px-4 py-3 font-semibold">{fmt(c.totalSpent)}</td>
              <td className="px-4 py-3">{c.isAdmin ? pill("Admin", "green") : <span className="text-xs text-slate-400">Customer</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ================= coupons ================= */
interface Coupon {
  code: string; type: string; value: number; minOrder: number;
  active: boolean; expiresAt: string | null; usedCount: number;
}

function CouponsSection() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState({ code: "", type: "percent", value: 10, minOrder: 0 });
  const { push } = useToast();
  const load = useCallback(() => {
    api<Coupon[]>("/api/coupons").then(setCoupons).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/api/coupons", { method: "POST", body: JSON.stringify(form) });
      push(`Coupon ${form.code.toUpperCase()} created`);
      setForm({ code: "", type: "percent", value: 10, minOrder: 0 });
      load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed", "error");
    }
  };
  const toggle = async (c: Coupon) => {
    await api(`/api/coupons/${c.code}`, { method: "PUT", body: JSON.stringify({ active: !c.active }) });
    load();
  };
  const del = async (c: Coupon) => {
    await api(`/api/coupons/${c.code}`, { method: "DELETE" });
    push(`Deleted ${c.code}`, "info");
    load();
  };

  return (
    <>
      <form onSubmit={create} className="bg-white rounded-2xl border border-slate-200 p-5 mb-5 grid sm:grid-cols-5 gap-3 items-end">
        <div className="sm:col-span-1">
          <label className="text-xs font-bold uppercase text-slate-400">Code</label>
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="SAVE15" required />
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-slate-400">Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="percent">% off</option>
            <option value="fixed">Rs off</option>
            <option value="freeship">Free shipping</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-slate-400">Value</label>
          <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: +e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-slate-400">Min order</label>
          <input type="number" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: +e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <button className="py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">
          + Create
        </button>
      </form>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Min order</th>
              <th className="px-4 py-3">Used</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.code} className="border-t border-slate-100">
                <td className="px-4 py-3 font-bold text-slate-900">{c.code}</td>
                <td className="px-4 py-3 text-slate-600">
                  {c.type === "percent" ? `${c.value}% off` : c.type === "fixed" ? `${fmt(c.value)} off` : "Free shipping"}
                </td>
                <td className="px-4 py-3 text-slate-500">{c.minOrder ? fmt(c.minOrder) : "—"}</td>
                <td className="px-4 py-3 text-slate-500">{c.usedCount}×</td>
                <td className="px-4 py-3">{c.active ? pill("Active", "green") : pill("Inactive", "slate")}</td>
                <td className="px-4 py-3 space-x-3 whitespace-nowrap">
                  <button onClick={() => toggle(c)} className="text-xs font-semibold text-emerald-600 hover:underline">
                    {c.active ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => del(c)} className="text-xs font-semibold text-red-500 hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ================= reviews ================= */
interface Review {
  id: number; productId: number; productName: string; name: string;
  rating: number; text: string; status: string; createdAt: string;
}

function ReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const { push } = useToast();
  const load = useCallback(() => {
    api<Review[]>("/api/reviews").then(setReviews).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const setStatus = async (id: number, status: string) => {
    await api(`/api/reviews/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
    push(`Review ${status}`);
    load();
  };
  const del = async (id: number) => {
    await api(`/api/reviews/${id}`, { method: "DELETE" });
    push("Review deleted", "info");
    load();
  };

  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-slate-900 text-sm">{r.name}</span>
              <span className="text-amber-400 text-sm">{"★".repeat(r.rating)}</span>
              <span className="text-xs text-slate-400">on {r.productName}</span>
            </div>
            <p className="text-sm text-slate-600">{r.text || <em className="text-slate-400">No comment</em>}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {pill(r.status, r.status === "approved" ? "green" : r.status === "rejected" ? "red" : "amber")}
            {r.status !== "approved" && (
              <button onClick={() => setStatus(r.id, "approved")} className="text-xs font-semibold text-emerald-600 hover:underline">Approve</button>
            )}
            {r.status !== "rejected" && (
              <button onClick={() => setStatus(r.id, "rejected")} className="text-xs font-semibold text-amber-600 hover:underline">Reject</button>
            )}
            <button onClick={() => del(r.id)} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
          </div>
        </div>
      ))}
      {reviews.length === 0 && <p className="text-sm text-slate-500">No reviews yet.</p>}
    </div>
  );
}

/* ================= returns ================= */
interface ReturnReq { id: number; orderId: string; email: string; reason: string; status: string; createdAt: string }

function ReturnsSection() {
  const [returns, setReturns] = useState<ReturnReq[]>([]);
  const { push } = useToast();
  const load = useCallback(() => {
    api<ReturnReq[]>("/api/returns").then(setReturns).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const setStatus = async (id: number, status: string) => {
    await api(`/api/returns/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
    push(`Return #${id} → ${status}`);
    load();
  };

  const refund = async (r: ReturnReq) => {
    const restock = window.confirm("Issue full refund for this order.\n\nOK = refund AND restock items\nCancel = refund only");
    try {
      await api("/api/refunds", {
        method: "POST",
        body: JSON.stringify({ orderId: r.orderId, returnId: r.id, reason: r.reason, restock }),
      });
      push(`Refund issued for ${r.orderId}`);
      load();
    } catch (e) {
      push(e instanceof Error ? e.message : "Refund failed", "error");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {returns.length === 0 ? (
        <p className="text-sm text-slate-500 p-6 text-center">No return requests.</p>
      ) : (
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {returns.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-bold text-slate-900">{r.orderId}</td>
                <td className="px-4 py-3 text-slate-600">{r.reason}</td>
                <td className="px-4 py-3 text-slate-500">{r.email || "—"}</td>
                <td className="px-4 py-3">
                  <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold">
                    {RETURN_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {r.status === "Approved" && (
                    <button onClick={() => refund(r)} className="text-xs font-bold text-emerald-600 hover:underline">
                      💸 Issue refund
                    </button>
                  )}
                  {r.status === "Refunded" && pill("Refunded", "slate")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ================= tickets ================= */
interface Ticket { id: number; subject: string; message: string; email: string; status: string; reply: string | null; createdAt: string }

function TicketsSection() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const { push } = useToast();
  const load = useCallback(() => {
    api<Ticket[]>("/api/tickets").then(setTickets).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const setStatus = async (id: number, status: string) => {
    await api(`/api/tickets/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
    push(`Ticket #${id} → ${status}`);
    load();
  };

  return (
    <div className="space-y-3">
      {tickets.length === 0 && <p className="text-sm text-slate-500">No support tickets.</p>}
      {tickets.map((t) => (
        <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 text-sm">#{t.id} — {t.subject}</p>
            <p className="text-sm text-slate-600 truncate">{t.message}</p>
            <p className="text-xs text-slate-400 mt-0.5">{t.email || "no email"} · {t.createdAt}</p>
          </div>
          <select value={t.status} onChange={(e) => setStatus(t.id, e.target.value)}
            className="rounded-md border border-slate-200 px-2 py-1.5 text-xs font-semibold shrink-0">
            {TICKET_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}

/* ================= notifications ================= */
interface Notif { id: number; type: string; title: string; body: string; read: boolean; createdAt: string }

const NOTIF_ICON: Record<string, string> = {
  order: "🧾", stock: "⚠️", review: "⭐", return: "↩️", ticket: "🎫", user: "👤", system: "🖥️",
};

function NotificationsSection() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const load = useCallback(() => {
    api<Notif[]>("/api/notifications").then(setNotifs).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const markAll = async () => {
    await api("/api/notifications/read-all", { method: "PUT" });
    load();
  };
  const mark = async (id: number) => {
    await api(`/api/notifications/${id}/read`, { method: "PUT" });
    load();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center">
        <p className="font-bold text-slate-900 text-sm">Latest activity</p>
        <button onClick={markAll} className="text-xs font-semibold text-emerald-600 hover:underline">
          Mark all read
        </button>
      </div>
      {notifs.map((n) => (
        <div key={n.id}
          className={`px-5 py-3.5 border-b border-slate-50 flex items-center gap-4 ${n.read ? "opacity-60" : "bg-emerald-50/40"}`}>
          <span className="text-xl">{NOTIF_ICON[n.type] ?? "🔔"}</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-900 text-sm">{n.title}</p>
            <p className="text-xs text-slate-500 truncate">{n.body}</p>
          </div>
          <span className="text-[10px] text-slate-400 whitespace-nowrap">{n.createdAt}</span>
          {!n.read && (
            <button onClick={() => mark(n.id)} className="text-xs font-semibold text-emerald-600 hover:underline shrink-0">
              Read
            </button>
          )}
        </div>
      ))}
      {notifs.length === 0 && <p className="text-sm text-slate-500 p-6 text-center">Nothing yet.</p>}
    </div>
  );
}

/* ================= settings ================= */
const SETTING_LABELS: Record<string, string> = {
  storeName: "Store name",
  supportEmail: "Support email",
  currency: "Currency",
  freeShippingThreshold: "Free-shipping threshold (Rs)",
  shippingFee: "Shipping fee (Rs)",
  lowStockThreshold: "Low-stock alert threshold",
  facebookPixelId: "Facebook (Meta) Pixel ID",
};

function SettingsSection() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const { push } = useToast();
  useEffect(() => {
    api<Record<string, string>>("/api/settings").then(setSettings).catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await api("/api/settings", { method: "PUT", body: JSON.stringify(settings) });
      push("Settings saved");
    } catch (e) {
      push(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-lg space-y-4">
      {Object.entries(SETTING_LABELS).map(([key, label]) => (
        <div key={key}>
          <label className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</label>
          <input
            value={settings[key] ?? ""}
            onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
          />
        </div>
      ))}
      <button onClick={save} disabled={busy}
        className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50">
        {busy ? "Saving…" : "Save changes"}
      </button>
      <p className="text-xs text-slate-400">
        Shipping settings apply to new orders immediately (totals are computed server-side).
      </p>
    </div>
  );
}

/* ================= analytics ================= */
interface AnalyticsData {
  counts: Record<string, number>;
  topSearches: { q: string; c: number }[];
  zeroResultSearches: { q: string; c: number }[];
  topCarted: { name: string; c: number }[];
  funnel: { add_to_cart: number; checkout_start: number; purchase: number };
  visitors: number;
  consentStats: { analyticsYes: number; marketingYes: number; total: number };
  abandonedCarts: number;
  revenueByMethod: { method: string; orders: number; revenue: number }[];
  revenueByCategory: { category: string; revenue: number }[];
}

function AnalyticsSection() {
  const [a, setA] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<AnalyticsData>("/api/admin/analytics").then(setA).catch((e) => setError(e.message));
  }, []);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!a) return <p className="text-sm text-slate-500">Loading analytics…</p>;

  const funnelMax = Math.max(1, a.funnel.add_to_cart);
  const funnelRows: [string, number][] = [
    ["Added to cart", a.funnel.add_to_cart],
    ["Started checkout", a.funnel.checkout_start],
    ["Purchased", a.funnel.purchase],
  ];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          ["Tracked visitors", String(a.visitors), "🧑‍💻"],
          ["Analytics consent", `${a.consentStats.analyticsYes ?? 0}/${a.consentStats.total ?? 0}`, "🍪"],
          ["Marketing consent", `${a.consentStats.marketingYes ?? 0}/${a.consentStats.total ?? 0}`, "📣"],
          ["Abandoned carts", String(a.abandonedCarts), "🛒"],
        ].map(([l, v, i]) => (
          <div key={l} className="bg-white rounded-2xl p-5 border border-slate-200">
            <p className="text-2xl mb-1">{i}</p>
            <p className="text-xl font-black text-slate-900">{v}</p>
            <p className="text-xs text-slate-500">{l}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="font-bold text-slate-900 mb-4">Conversion funnel</p>
          {funnelRows.map(([label, v]) => (
            <div key={label} className="mb-3">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{label}</span>
                <span className="font-bold text-slate-900">{v}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${(v / funnelMax) * 100}%` }} />
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-400 mt-2">
            Only events from visitors who consented to analytics are counted.
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="font-bold text-slate-900 mb-3">Revenue by payment method</p>
          {a.revenueByMethod.map((m) => (
            <div key={m.method} className="flex justify-between py-2 border-b border-slate-50 text-sm">
              <span className="uppercase font-semibold text-slate-600">{m.method}</span>
              <span className="text-slate-500">{m.orders} orders · {fmt(m.revenue)}</span>
            </div>
          ))}
          <p className="font-bold text-slate-900 mt-4 mb-2">Revenue by category</p>
          {a.revenueByCategory.map((c) => (
            <div key={c.category} className="flex justify-between py-1.5 border-b border-slate-50 text-sm">
              <span className="capitalize text-slate-600">{c.category}</span>
              <span className="text-slate-500">{fmt(c.revenue)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="font-bold text-slate-900 mb-3">Top searches</p>
          {a.topSearches.length === 0 ? (
            <p className="text-sm text-slate-500">No search events yet.</p>
          ) : (
            a.topSearches.map((s) => (
              <div key={s.q} className="flex justify-between py-1.5 border-b border-slate-50 text-sm">
                <span className="text-slate-700">"{s.q}"</span>
                <span className="text-slate-400">{s.c}×</span>
              </div>
            ))
          )}
          {(a.zeroResultSearches?.length ?? 0) > 0 && (
            <>
              <p className="font-bold text-slate-900 mt-5 mb-2">
                Searches with no results <span className="text-xs font-semibold text-amber-600">(stocking opportunities)</span>
              </p>
              {a.zeroResultSearches.map((s) => (
                <div key={s.q} className="flex justify-between py-1.5 border-b border-slate-50 text-sm">
                  <span className="text-amber-700">"{s.q}"</span>
                  <span className="text-slate-400">{s.c}×</span>
                </div>
              ))}
            </>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="font-bold text-slate-900 mb-3">Most added to cart</p>
          {a.topCarted.length === 0 ? (
            <p className="text-sm text-slate-500">No cart events yet.</p>
          ) : (
            a.topCarted.map((s) => (
              <div key={s.name} className="flex justify-between py-1.5 border-b border-slate-50 text-sm">
                <span className="text-slate-700 truncate mr-3">{s.name}</span>
                <span className="text-slate-400">{s.c}×</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

/* ================= inventory ================= */
interface StockMove {
  id: number; productId: number; productName: string; delta: number;
  reason: string; refType: string | null; refId: string | null;
  actor: string; note: string; createdAt: string;
}

function InventorySection() {
  const [moves, setMoves] = useState<StockMove[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [form, setForm] = useState({ productId: 0, delta: -1, reason: "damaged", note: "" });
  const { push } = useToast();
  const load = useCallback(() => {
    api<StockMove[]>("/api/inventory/moves").then(setMoves).catch(() => {});
    api<AdminProduct[]>("/api/products?includeInactive=1").then((p) => {
      setProducts(p);
      setForm((f) => (f.productId ? f : { ...f, productId: p[0]?.id ?? 0 }));
    }).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const adjust = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/api/inventory/adjust", { method: "POST", body: JSON.stringify(form) });
      push("Stock adjusted (logged to audit trail)");
      setForm({ ...form, note: "" });
      load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Adjustment failed", "error");
    }
  };

  return (
    <>
      <form onSubmit={adjust} className="bg-white rounded-2xl border border-slate-200 p-5 mb-5 grid sm:grid-cols-5 gap-3 items-end">
        <div className="sm:col-span-2">
          <label className="text-xs font-bold uppercase text-slate-400">Product</label>
          <select value={form.productId} onChange={(e) => setForm({ ...form, productId: +e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} (stock {p.stock})</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-slate-400">Δ Qty</label>
          <input type="number" value={form.delta} onChange={(e) => setForm({ ...form, delta: +e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-slate-400">Reason</label>
          <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="manual">Manual</option>
            <option value="damaged">Damaged</option>
            <option value="correction">Correction</option>
            <option value="return-restock">Return restock</option>
          </select>
        </div>
        <button className="py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">
          Apply
        </button>
        <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder="Note (optional, e.g. 'dropped in warehouse')"
          className="sm:col-span-5 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 font-bold text-slate-900 text-sm">
          Stock movement history
        </div>
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Product</th>
              <th className="px-4 py-2.5">Change</th>
              <th className="px-4 py-2.5">Reason</th>
              <th className="px-4 py-2.5">Ref</th>
              <th className="px-4 py-2.5">Actor</th>
              <th className="px-4 py-2.5">When</th>
            </tr>
          </thead>
          <tbody>
            {moves.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-medium text-slate-900">{m.productName}</td>
                <td className={`px-4 py-2.5 font-bold ${m.delta > 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {m.delta > 0 ? "+" : ""}{m.delta}
                </td>
                <td className="px-4 py-2.5">{pill(m.reason, m.reason === "sale" ? "slate" : m.reason === "damaged" ? "red" : "green")}</td>
                <td className="px-4 py-2.5 text-slate-500">{m.refId || "—"}</td>
                <td className="px-4 py-2.5 text-slate-500">{m.actor}</td>
                <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">{m.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ================= staff & roles ================= */
const ROLES = [
  "customer", "superadmin", "manager", "order-manager", "inventory-manager",
  "marketing-manager", "support", "content-editor", "reports-viewer",
];

interface StaffUser { id: number; name: string; email: string; role: string; createdAt: string }

function StaffSection() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [error, setError] = useState("");
  const { push } = useToast();
  const load = useCallback(() => {
    api<StaffUser[]>("/api/staff").then(setUsers).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const setRole = async (id: number, role: string) => {
    try {
      await api(`/api/staff/${id}/role`, { method: "PUT", body: JSON.stringify({ role }) });
      push("Role updated (audited)");
      load();
    } catch (e) {
      push(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  if (error) return <p className="text-sm text-red-600">{error} — only the Super Admin can manage staff.</p>;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm min-w-[560px]">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-slate-100">
              <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
              <td className="px-4 py-3 text-slate-500">{u.email}</td>
              <td className="px-4 py-3">
                <select value={u.role} onChange={(e) => setRole(u.id, e.target.value)}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold">
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-3 text-xs text-slate-400 border-t border-slate-100">
        Roles gate API access per area (orders, inventory, coupons…). Every role change is written to the audit log.
      </p>
    </div>
  );
}

/* ================= audit log ================= */
interface AuditEntry {
  id: number; userEmail: string; action: string; entity: string;
  entityId: string; details: string; createdAt: string;
}

function AuditSection() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api<AuditEntry[]>("/api/audit").then(setLogs).catch((e) => setError(e.message));
  }, []);
  if (error) return <p className="text-sm text-red-600">{error} — only the Super Admin can view the audit log.</p>;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm min-w-[680px]">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2.5">When</th>
            <th className="px-4 py-2.5">Who</th>
            <th className="px-4 py-2.5">Action</th>
            <th className="px-4 py-2.5">Entity</th>
            <th className="px-4 py-2.5">Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} className="border-t border-slate-100">
              <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">{l.createdAt}</td>
              <td className="px-4 py-2.5 text-slate-600">{l.userEmail}</td>
              <td className="px-4 py-2.5 font-semibold text-slate-900">{l.action}</td>
              <td className="px-4 py-2.5 text-slate-500">{l.entity}{l.entityId ? `:${l.entityId}` : ""}</td>
              <td className="px-4 py-2.5 text-slate-500 max-w-xs truncate">{l.details}</td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No admin actions logged yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ================= auth gate ================= */
function AdminGate({
  onLogin,
  loggedInNonAdmin,
}: {
  onLogin: (e: string, p: string) => Promise<unknown>;
  loggedInNonAdmin: boolean;
}) {
  const [email, setEmail] = useState("admin@xccessoriespoint.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const u = (await onLogin(email, password)) as { isAdmin?: boolean };
      if (!u.isAdmin) setError("This account does not have admin access.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-2xl">
        <p className="text-center font-black text-xl text-slate-900 mb-1">
          Xccessories<span className="text-emerald-600">Point</span>
        </p>
        <p className="text-center text-xs uppercase tracking-widest text-slate-400 mb-6">
          Admin Console
        </p>
        {loggedInNonAdmin && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3 mb-4">
            You're signed in as a customer. Sign in with an admin account to continue.
          </p>
        )}
        <form onSubmit={submit} className="space-y-3">
          <input
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
            type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Admin email" required
          />
          <input
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
            type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={busy}
            className="w-full py-3 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in to Admin"}
          </button>
        </form>
        <p className="mt-4 text-[11px] text-slate-400 text-center">
          Demo: admin@xccessoriespoint.com / admin123
        </p>
        <Link to="/" className="block mt-3 text-center text-sm text-emerald-600 hover:underline">
          ← Back to store
        </Link>
      </div>
    </div>
  );
}
