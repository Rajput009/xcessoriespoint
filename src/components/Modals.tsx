import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import { Link, useRouter } from "../router";
import { swatchFor, swatchStyle } from "../lib/swatch";
import {
  useAuth,
  useCart,
  useProducts,
  useToast,
  useUI,
  useWishlist,
  fmt,
  authFetch,
} from "../context/store";
import type { Order } from "../types";

/* ---------- shared shells ---------- */
function Overlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-blue-950/30 " />
      {children}
    </div>
  );
}

function CenterModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <Overlay onClose={onClose}>
      <div
        className="relative m-auto w-[92vw] max-w-md surface !bg-white rounded-3xl shadow-2xl shadow-blue-950/20 p-6 fade-up max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white text-slate-500"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </Overlay>
  );
}

function Drawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <Overlay onClose={onClose}>
      <div
        className="relative ml-auto h-full w-full max-w-md surface !bg-white !border-l !border-white/60 shadow-2xl shadow-blue-950/25 slide-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/50">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white text-slate-500"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </Overlay>
  );
}

/* ---------- Auth ---------- */
function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { login, register } = useAuth();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(name, email, password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const input =
    "w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <CenterModal title={mode === "login" ? "Sign in" : "Create account"} onClose={onClose}>
      <div className="flex rounded-lg bg-slate-100 p-1 mb-5 text-sm font-semibold">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-md transition ${
              mode === m ? "bg-white shadow text-blue-700" : "text-slate-500"
            }`}
          >
            {m === "login" ? "Login" : "Register"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-3">
        {mode === "register" && (
          <input className={input} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
        )}
        <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={busy}
          className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
    </CenterModal>
  );
}

/* ---------- Cart drawer ---------- */
const FREE_SHIP_AT = 5000;

function CartDrawer({ onClose }: { onClose: () => void }) {
  const { items, setQty, remove, total, add } = useCart();
  const { products } = useProducts();
  const { navigate } = useRouter();
  const toFree = Math.max(0, FREE_SHIP_AT - total);
  const freePct = Math.min(100, Math.round((total / FREE_SHIP_AT) * 100));
  // cross-sell: 2 best sellers not already in the cart (simple products for one-tap add)
  const inCart = new Set(items.map((i) => i.product.id));
  const upsells = products
    .filter((p) => !inCart.has(p.id) && p.stock > 0 && !(p.variants?.length) && (p.bestSeller || p.rating >= 4.5))
    .slice(0, 2);

  return (
    <Drawer title={`Your Cart${items.length ? ` (${items.reduce((s2, i) => s2 + i.qty, 0)})` : ""}`} onClose={onClose}>
      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="text-5xl mb-3">🛒</div>
          <p className="font-semibold text-slate-900 mb-1">Your cart is empty</p>
          <p className="text-sm text-slate-500 mb-5">Find something you'll love.</p>
          <button
            onClick={() => {
              onClose();
              navigate("/shop");
            }}
            className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Browse products
          </button>
        </div>
      ) : (
        <>
          <div className="px-5 pt-4">
            <div className="surface-muted rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-slate-700 mb-1.5">
                {toFree === 0 ? (
                  <>🎉 You've unlocked <span className="text-blue-700 font-bold">FREE shipping!</span></>
                ) : (
                  <>Add <span className="text-blue-700 font-bold">{fmt(toFree)}</span> more for free shipping</>
                )}
              </p>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-sky-400 transition-all duration-500"
                  style={{ width: `${freePct}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {items.map(({ product, qty, variantId, variantLabel }) => (
              <div key={`${product.id}:${variantId ?? 0}`} className="flex gap-3">
                <img src={product.image} alt="" className="w-16 h-16 rounded-lg object-cover bg-slate-100" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{product.name}</p>
                  {variantLabel && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded mb-0.5">
                      {swatchFor({ label: variantLabel }) && (
                        <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={swatchStyle(swatchFor({ label: variantLabel })!)} />
                      )}
                      {variantLabel}
                    </span>
                  )}
                  <p className="text-sm text-blue-700 font-bold">{fmt(product.price)}</p>
                  {product.stock > 0 && product.stock <= 15 && (
                    <p className="text-[11px] font-semibold text-amber-600 mt-0.5">⚠ Only {product.stock} left</p>
                  )}
                  {qty >= product.stock && product.stock > 0 && (
                    <p className="text-[11px] font-semibold text-red-500 mt-0.5">Max available quantity</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <button onClick={() => setQty(product.id, qty - 1, variantId)} className="w-7 h-7 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">−</button>
                    <span className="text-sm font-semibold w-6 text-center">{qty}</span>
                    <button
                      onClick={() => setQty(product.id, Math.min(product.stock || 99, qty + 1), variantId)}
                      disabled={qty >= (product.stock || 99)}
                      className="w-7 h-7 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                    >+</button>
                    <button onClick={() => remove(product.id, variantId)} className="ml-auto text-xs text-red-500 hover:underline">Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 p-5 space-y-3">
            {upsells.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                  Goes well with your cart
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {upsells.map((u) => (
                    <div key={u.id} className="surface-muted rounded-xl p-2 flex items-center gap-2">
                      <img src={u.image} alt="" className="w-9 h-9 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-slate-900 truncate">{u.name}</p>
                        <p className="text-[11px] font-bold text-blue-700">{fmt(u.price)}</p>
                      </div>
                      <button
                        onClick={() => add(u)}
                        className="w-7 h-7 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-blue-600 shrink-0"
                        aria-label={`Add ${u.name}`}
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-900">
              <span>Subtotal</span>
              <span>{fmt(total)}</span>
            </div>
            <button
              onClick={() => {
                onClose();
                navigate("/checkout");
              }}
              className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
            >
              Checkout →
            </button>
            <button
              onClick={() => {
                onClose();
                navigate("/checkout?via=whatsapp");
              }}
              className="w-full py-3 rounded-lg bg-[#25D366] text-white font-semibold hover:brightness-95 flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4.5 h-4.5" aria-hidden>
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.02h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.17 8.17 0 0 1-1.25-4.35c0-4.53 3.7-8.22 8.24-8.22 2.2 0 4.27.86 5.82 2.41a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.2-8.24 8.2z" />
                <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.08-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z" />
              </svg>
              Order on WhatsApp
            </button>
            <p className="text-center text-[11px] text-slate-400">
              💵 Cash on delivery available · 🔒 Secure checkout · ↩ 7-day returns
            </p>
          </div>
        </>
      )}
    </Drawer>
  );
}

/* ---------- Wishlist ---------- */
function WishlistModal({ onClose }: { onClose: () => void }) {
  const { ids, toggle } = useWishlist();
  const { products } = useProducts();
  const { add } = useCart();
  const list = products.filter((p) => ids.includes(p.id));

  return (
    <Drawer title={`Wishlist (${list.length})`} onClose={onClose}>
      {list.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="text-5xl mb-3">♡</div>
          <p className="font-semibold text-slate-900 mb-1">No saved items yet</p>
          <p className="text-sm text-slate-500 mb-5">Tap the heart on any product.</p>
          <Link
            to="/shop"
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Browse products
          </Link>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {list.map((p) => (
            <div key={p.id} className="flex gap-3 items-center">
              <img src={p.image} alt="" className="w-16 h-16 rounded-lg object-cover bg-slate-100" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                <p className="text-sm text-blue-700 font-bold">{fmt(p.price)}</p>
              </div>
              <button
                onClick={() => add(p)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-blue-600"
              >
                Add
              </button>
              <button onClick={() => toggle(p.id)} className="text-slate-400 hover:text-red-500" aria-label="Remove">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}

/* ---------- Account ---------- */
function AccountModal({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const { navigate } = useRouter();
  const { openModal } = useUI();
  const { products } = useProducts();
  const { add } = useCart();
  const { push } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    authFetch("/api/orders")
      .then((r) => (r.ok ? r.json() : []))
      .then(setOrders)
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
  }, [user]);

  const reorder = (o: Order) => {
    let added = 0;
    for (const it of o.items as { productId?: number; variantId?: number | null; variantLabel?: string | null; qty: number }[]) {
      const p = products.find((x) => x.id === it.productId);
      if (p && p.stock > 0) {
        add(p, Math.min(it.qty, p.stock), it.variantId ?? 0, it.variantLabel ?? undefined);
        added++;
      }
    }
    if (added === 0) push("Those items are no longer available", "error");
    else openModal("cart");
  };

  if (!user) return null;

  return (
    <CenterModal title="My Account" onClose={onClose}>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-bold">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-slate-900">{user.name}</p>
          <p className="text-sm text-slate-500">{user.email}</p>
          {user.isAdmin && (
            <span className="inline-block mt-1 text-[10px] font-bold uppercase bg-blue-600 text-white px-2 py-0.5 rounded">
              Admin
            </span>
          )}
        </div>
      </div>
      {/* order history */}
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Order history</p>
        {ordersLoading ? (
          <p className="text-sm text-slate-500">Loading orders…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-slate-500">No orders yet — go find something you love!</p>
        ) : (
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {orders.map((o) => (
              <div key={o.id} className="surface-muted rounded-xl px-3.5 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">{o.id}</p>
                  <p className="text-[11px] text-slate-500">
                    {o.createdAt?.slice(0, 10)} · {o.items.reduce((s2, i) => s2 + i.qty, 0)} items · {fmt(o.total)}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  o.status === "Delivered" ? "bg-blue-100 text-blue-700"
                  : ["Cancelled", "Failed", "Refunded"].includes(o.status) ? "bg-slate-200 text-slate-500"
                  : "bg-amber-100 text-amber-700"
                }`}>
                  {o.status}
                </span>
                <button
                  onClick={() => reorder(o)}
                  className="text-[11px] font-bold text-blue-600 hover:underline whitespace-nowrap"
                >
                  ↻ Reorder
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-2">
        <button
          onClick={() => openModal("track")}
          className="w-full text-left px-4 py-3 rounded-lg border border-slate-200 hover:border-blue-400 text-sm font-medium"
        >
          📦 Track an order
        </button>
        {user.isAdmin && (
          <button
            onClick={() => {
              onClose();
              navigate("/admin");
            }}
            className="w-full text-left px-4 py-3 rounded-lg border border-slate-200 hover:border-blue-400 text-sm font-medium"
          >
            🛠️ Admin dashboard
          </button>
        )}
        <button
          onClick={() => {
            logout();
            onClose();
          }}
          className="w-full text-left px-4 py-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium"
        >
          ↩ Sign out
        </button>
      </div>
    </CenterModal>
  );
}

/* ---------- Track Order ---------- */
function TrackOrderModal({ onClose }: { onClose: () => void }) {
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  const track = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOrder(null);
    try {
      const r = await fetch(`/api/orders/${encodeURIComponent(orderId.trim())}`);
      if (!r.ok) throw new Error("Order not found. Check the ID (e.g. XP-A1B2C3).");
      setOrder(await r.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reach the server");
      push("Could not find that order", "error");
    } finally {
      setBusy(false);
    }
  };

  const steps = ["Confirmed", "Processing", "Packed", "Shipped", "Delivered"];
  const statusIdx: Record<string, number> = {
    Pending: -1, Confirmed: 0, Processing: 1, Packed: 2, Shipped: 3, Delivered: 4,
  };
  const stepIdx = order ? statusIdx[order.status] ?? -1 : -1;

  return (
    <CenterModal title="Track Order" onClose={onClose}>
      <form onSubmit={track} className="flex gap-2 mb-4">
        <input
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          placeholder="Order ID e.g. XP-A1B2C3"
          className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
          required
        />
        <button
          disabled={busy}
          className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "…" : "Track"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {order && (
        <div className="fade-up">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-slate-900">{order.id}</p>
            <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
              {order.status}
            </span>
          </div>
          <div className="flex items-center mb-4">
            {steps.map((s, i) => (
              <div key={s} className="flex-1 flex flex-col items-center relative">
                {i > 0 && (
                  <div className={`absolute top-3 right-1/2 w-full h-0.5 ${i <= stepIdx ? "bg-blue-500" : "bg-slate-200"}`} />
                )}
                <div
                  className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i <= stepIdx ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {i + 1}
                </div>
                <span className="text-[10px] mt-1 text-slate-500">{s}</span>
              </div>
            ))}
          </div>
          {order.status === "Pending" && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2.5 mb-3">
              ⏳ Awaiting COD confirmation — we'll call you shortly to confirm this order.
            </p>
          )}
          <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1.5">
            {order.items.map((it, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-slate-600 truncate mr-3">{it.name} × {it.qty}</span>
                <span className="font-semibold">{fmt(it.price * it.qty)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-900">
              <span>Total</span>
              <span>{fmt(order.total)}</span>
            </div>
          </div>
        </div>
      )}
    </CenterModal>
  );
}

/* ---------- root switch ---------- */
export default function Modals() {
  const { modal, openModal } = useUI();
  const close = () => openModal(null);
  if (!modal) return null;
  switch (modal) {
    case "auth": return <AuthModal onClose={close} />;
    case "cart": return <CartDrawer onClose={close} />;
    case "wishlist": return <WishlistModal onClose={close} />;
    case "account": return <AccountModal onClose={close} />;
    case "track": return <TrackOrderModal onClose={close} />;
    default: return null;
  }
}
