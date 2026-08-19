import { useEffect, useState } from "react";
import { Link, useRouter } from "../router";
import { useAuth, useCart, useToast, fmt, placeOrderAPI, validateCouponAPI, authFetch } from "../context/store";
import type { Order } from "../types";
import { track } from "../lib/tracking";
import { swatchFor, swatchStyle } from "../lib/swatch";
import { pixelTrack } from "../lib/pixel";

const STEPS = ["Cart", "Address", "Payment", "Done"];

export default function CheckoutPage() {
  const { items, total, setQty, remove, clear } = useCart();
  const { user } = useAuth();
  const { push } = useToast();
  const { navigate } = useRouter();

  const saved = (() => {
    try { return JSON.parse(localStorage.getItem("xp_checkout") || "{}"); } catch { return {}; }
  })();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.name || saved.name || "");
  const [email, setEmail] = useState(user?.email || saved.email || "");
  const [phone, setPhone] = useState(saved.phone || "");
  const [address, setAddress] = useState(saved.address || "");
  const [city, setCity] = useState(saved.city || "Lahore");
  const [payment, setPayment] = useState(saved.payment || "cod");

  // checkout error recovery: persist the form so an interrupted checkout resumes
  useEffect(() => {
    localStorage.setItem("xp_checkout", JSON.stringify({ name, email, phone, address, city, payment }));
  }, [name, email, phone, address, city, payment]);

  // smooth step transitions
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);

  // saved addresses (logged-in users)
  interface SavedAddress { id: number; name: string; phone: string; address: string; city: string }
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  useEffect(() => {
    if (!user) return;
    authFetch("/api/addresses")
      .then((r) => (r.ok ? r.json() : []))
      .then(setSavedAddresses)
      .catch(() => {});
  }, [user]);

  const applySaved = (a: SavedAddress) => {
    if (a.name) setName(a.name);
    if (a.phone) setPhone(a.phone);
    setAddress(a.address);
    setCity(a.city);
  };

  // coupon state
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number; freeShip: boolean } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  // consent-gated funnel analytics
  useEffect(() => {
    if (items.length > 0) {
      track("checkout_start", { items: items.length, subtotal: total });
      pixelTrack("InitiateCheckout", {
        num_items: items.reduce((s, i) => s + i.qty, 0),
        value: total,
        currency: "PKR",
        content_ids: items.map((i) => String(i.product.id)),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const discount = coupon?.discount ?? 0;
  const shipping = coupon?.freeShip || total >= 5000 || total === 0 ? 0 : 250;
  const grand = Math.max(0, total - discount + shipping);

  // coupon prefilled by the exit-intent offer
  useEffect(() => {
    const pre = sessionStorage.getItem("xp_prefill_coupon");
    if (pre && !coupon && total > 0) {
      sessionStorage.removeItem("xp_prefill_coupon");
      validateCouponAPI(pre, total)
        .then((c) => {
          setCoupon(c);
          setCouponInput(pre);
          push(`Coupon ${c.code} applied — you save ${fmt(c.discount)} 🎉`);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const applyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponBusy(true);
    try {
      const c = await validateCouponAPI(couponInput.trim(), total);
      setCoupon(c);
      push(
        c.freeShip
          ? `Coupon ${c.code} applied — free shipping!`
          : `Coupon ${c.code} applied — you save ${fmt(c.discount)}`
      );
    } catch (err) {
      setCoupon(null);
      push(err instanceof Error ? err.message : "Invalid coupon", "error");
    } finally {
      setCouponBusy(false);
    }
  };

  const input =
    "w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 bg-white";

  const placeOrder = async () => {
    setBusy(true);
    try {
      const o = await placeOrderAPI({
        items: items.map((i) => ({ id: i.product.id, qty: i.qty, variantId: i.variantId || undefined })),
        coupon: coupon?.code,
        email,
        customer: name,
        phone,
        address,
        city,
        payment,
      });
      setOrder(o);
      localStorage.removeItem("xp_checkout");
      pixelTrack("Purchase", {
        value: o.total,
        currency: "PKR",
        content_type: "product",
        content_ids: o.items.map((i) => String((i as { productId?: number }).productId ?? "")),
        num_items: o.items.reduce((s, i) => s + i.qty, 0),
      });
      clear();
      setStep(3);
      push(`Order ${o.id} placed! 🎉`);
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not place order — is the API running?", "error");
    } finally {
      setBusy(false);
    }
  };

  // shared coupon UI for the order summary
  const couponSlot = (
    <div className="mt-3 pt-3 border-t border-slate-100">
      {coupon ? (
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-emerald-700">🏷️ {coupon.code}</span>
          <button
            onClick={() => {
              setCoupon(null);
              setCouponInput("");
            }}
            className="text-xs text-red-500 hover:underline"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
            placeholder="Coupon code"
            className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-emerald-500"
          />
          <button
            onClick={applyCoupon}
            disabled={couponBusy}
            className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50"
          >
            {couponBusy ? "…" : "Apply"}
          </button>
        </div>
      )}
      <p className="text-[10px] text-slate-400 mt-1.5">Try: WELCOME10 · XP500 · FREESHIP</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* minimal checkout header */}
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-black text-slate-900">
            Xccessories<span className="text-emerald-600">Point</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/shop" className="text-xs font-semibold text-emerald-600 hover:underline">← Continue shopping</Link>
            <span className="text-xs text-slate-400 flex items-center gap-1.5">🔒 Secure checkout</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* stepper */}
        <div className="flex items-center mb-10 max-w-lg mx-auto">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center relative">
              {i > 0 && (
                <div className={`absolute top-4 right-1/2 w-full h-0.5 ${i <= step ? "bg-emerald-500" : "bg-slate-200"}`} />
              )}
              <div
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  i < step ? "bg-emerald-600 text-white" : i === step ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`text-xs mt-1.5 font-medium ${i <= step ? "text-slate-900" : "text-slate-400"}`}>{s}</span>
            </div>
          ))}
        </div>

        {/* step 0: cart review */}
        {step === 0 && (
          <div className="fade-up">
            <h1 className="text-2xl font-black text-slate-900 mb-5">Review your cart</h1>
            {items.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                <div className="text-5xl mb-3">🛒</div>
                <p className="font-bold text-slate-900 mb-4">Your cart is empty</p>
                <Link to="/shop" className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700">
                  Continue shopping
                </Link>
              </div>
            ) : (
              <div className="grid md:grid-cols-[1fr_280px] gap-6">
                <div className="space-y-3">
                  {items.map(({ product, qty, variantId, variantLabel }) => (
                    <div key={`${product.id}:${variantId ?? 0}`} className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4 items-center">
                      <img src={product.image} alt="" className="w-16 h-16 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate">{product.name}</p>
                        {variantLabel && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                            {swatchFor({ label: variantLabel }) && (
                              <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={swatchStyle(swatchFor({ label: variantLabel })!)} />
                            )}
                            {variantLabel}
                          </span>
                        )}
                        <p className="text-sm text-emerald-700 font-bold">{fmt(product.price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setQty(product.id, qty - 1, variantId)} className="w-7 h-7 rounded-md border border-slate-200">−</button>
                        <span className="w-6 text-center text-sm font-bold">{qty}</span>
                        <button onClick={() => setQty(product.id, qty + 1, variantId)} className="w-7 h-7 rounded-md border border-slate-200">+</button>
                      </div>
                      <button onClick={() => remove(product.id, variantId)} className="text-slate-300 hover:text-red-500">✕</button>
                    </div>
                  ))}
                </div>
                <OrderSummary total={total} shipping={shipping} grand={grand} discount={discount} couponSlot={couponSlot}>
                  <button onClick={() => setStep(1)} className="w-full py-3 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700">
                    Continue to Address →
                  </button>
                </OrderSummary>
              </div>
            )}
          </div>
        )}

        {/* step 1: address */}
        {step === 1 && (
          <div className="fade-up grid md:grid-cols-[1fr_280px] gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h1 className="text-xl font-black text-slate-900 mb-5">Delivery address</h1>
              {savedAddresses.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Saved addresses</p>
                  <div className="flex gap-2 flex-wrap">
                    {savedAddresses.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => applySaved(a)}
                        className="px-3.5 py-2 rounded-xl glass-soft text-left text-xs hover:ring-2 hover:ring-emerald-300 transition"
                      >
                        <span className="block font-bold text-slate-900">{a.city}</span>
                        <span className="block text-slate-500 max-w-[180px] truncate">{a.address}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <input className={input} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
                <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <div>
                  <input
                    className={input}
                    placeholder="Phone (03xx…)"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 11))}
                  />
                  {phone.length > 0 && !/^03[0-9]{9}$/.test(phone) && (
                    <p className="text-[11px] text-amber-600 mt-1">Enter an 11-digit number starting with 03</p>
                  )}
                </div>
                <select className={input} value={city} onChange={(e) => setCity(e.target.value)}>
                  {["Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Quetta"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <textarea
                  className={`${input} sm:col-span-2`}
                  rows={3}
                  placeholder="Street address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setStep(0)} className="px-5 py-2.5 rounded-lg border border-slate-300 font-semibold text-sm">
                  ← Back
                </button>
                <button
                  onClick={() => {
                    if (!name || !email || !phone || !address) return push("Please fill all address fields", "error");
                    if (!/^03[0-9]{9}$/.test(phone)) return push("Please enter a valid phone number (03xxxxxxxxx)", "error");
                    setStep(2);
                  }}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                >
                  Continue to Payment →
                </button>
              </div>
            </div>
            <OrderSummary total={total} shipping={shipping} grand={grand} discount={discount} couponSlot={couponSlot} />
          </div>
        )}

        {/* step 2: payment */}
        {step === 2 && (
          <div className="fade-up grid md:grid-cols-[1fr_280px] gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h1 className="text-xl font-black text-slate-900 mb-5">Payment method</h1>
              <div className="space-y-3">
                {[
                  { id: "cod", label: "Cash on Delivery", desc: "Pay when your order arrives", icon: "💵" },
                  { id: "card", label: "Debit / Credit Card", desc: "Visa, Mastercard (demo)", icon: "💳" },
                  { id: "wallet", label: "Mobile Wallet", desc: "JazzCash / Easypaisa (demo)", icon: "📲" },
                ].map((m) => (
                  <label
                    key={m.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition ${
                      payment === m.id ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input type="radio" name="pay" checked={payment === m.id} onChange={() => setPayment(m.id)} className="accent-emerald-600" />
                    <span className="text-2xl">{m.icon}</span>
                    <span>
                      <span className="block font-semibold text-slate-900 text-sm">{m.label}</span>
                      <span className="block text-xs text-slate-500">{m.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(1)} className="px-5 py-2.5 rounded-lg border border-slate-300 font-semibold text-sm">
                  ← Back
                </button>
                <button
                  onClick={placeOrder}
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy ? "Placing order…" : `Place Order · ${fmt(grand)}`}
                </button>
              </div>
              <div className="flex items-center justify-center gap-5 mt-5 text-[11px] text-slate-400">
                <span>🔒 Secure checkout</span>
                <span>↩ 7-day returns</span>
                <span>💵 Pay on delivery</span>
                <span>✓ No account needed</span>
              </div>
            </div>
            <OrderSummary total={total} shipping={shipping} grand={grand} discount={discount} couponSlot={couponSlot} />
          </div>
        )}

        {/* step 3: done */}
        {step === 3 && order && (
          <div className="fade-up max-w-md mx-auto text-center bg-white rounded-2xl border border-slate-200 p-10">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-2xl font-black text-slate-900 mb-2">Order confirmed!</h1>
            <p className="text-sm text-slate-500 mb-2">
              Your order ID is{" "}
              <span className="font-bold text-emerald-700 select-all">{order.id}</span>
              <button
                onClick={() => { navigator.clipboard?.writeText(order.id); push("Order ID copied 📋"); }}
                className="ml-2 text-xs font-bold text-emerald-600 hover:underline"
              >
                Copy
              </button>
            </p>
            <p className="text-xs text-slate-500 mb-4">
              🚚 Estimated delivery:{" "}
              <span className="font-semibold text-slate-700">
                {new Date(Date.now() + 2 * 86400000).toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short" })}
                {" – "}
                {new Date(Date.now() + 4 * 86400000).toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short" })}
              </span>
            </p>
            <p className="text-sm text-slate-500 mb-6">
              Total paid: <span className="font-bold text-slate-900">{fmt(order.total)}</span>
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => printInvoice(order, { name, email, address, city, payment })}
                className="px-6 py-2.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-700"
              >
                🧾 Download invoice
              </button>
              <button
                onClick={() => navigate("/")}
                className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
              >
                Back to store
              </button>
              <button
                onClick={() => navigate("/shop")}
                className="px-6 py-2.5 rounded-lg border border-slate-300 font-semibold"
              >
                Keep shopping
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function OrderSummary({
  total,
  shipping,
  grand,
  discount = 0,
  couponSlot,
  children,
}: {
  total: number;
  shipping: number;
  grand: number;
  discount?: number;
  couponSlot?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <aside className="bg-white rounded-2xl border border-slate-200 p-5 h-fit">
      <p className="font-bold text-slate-900 mb-3">Order summary</p>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Subtotal</span>
          <span>{fmt(total)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-emerald-700 font-semibold">
            <span>Discount</span>
            <span>−{fmt(discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-slate-600">
          <span>Shipping</span>
          <span>{shipping === 0 ? <span className="text-emerald-600 font-semibold">FREE</span> : fmt(shipping)}</span>
        </div>
        <div className="flex justify-between font-black text-slate-900 border-t border-slate-100 pt-2 text-base">
          <span>Total</span>
          <span>{fmt(grand)}</span>
        </div>
      </div>
      {shipping > 0 && (
        <p className="text-xs text-slate-400 mt-2">Free shipping on orders over Rs 5,000</p>
      )}
      {couponSlot}
      {children && <div className="mt-4">{children}</div>}
    </aside>
  );
}


/* ---------- printable invoice (opens print dialog → save as PDF) ---------- */
function printInvoice(
  order: Order,
  meta: { name: string; email: string; address: string; city: string; payment: string }
) {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td>${i.name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">Rs ${i.price.toLocaleString()}</td><td style="text-align:right">Rs ${(i.price * i.qty).toLocaleString()}</td></tr>`
    )
    .join("");
  const html = `<!doctype html><html><head><title>Invoice ${order.id}</title><style>
    body{font-family:system-ui,sans-serif;max-width:640px;margin:32px auto;color:#0f172a;padding:0 16px}
    h1{font-size:20px} .muted{color:#64748b;font-size:13px}
    table{width:100%;border-collapse:collapse;margin:20px 0;font-size:14px}
    th,td{padding:8px 6px;border-bottom:1px solid #e2e8f0;text-align:left}
    th{font-size:11px;text-transform:uppercase;color:#64748b}
    .tot{font-weight:800} .brand{color:#059669}
  </style></head><body>
    <h1>Xccessories<span class="brand">Point</span> — Invoice</h1>
    <p class="muted">Order <b>${order.id}</b> · ${new Date(order.createdAt ?? Date.now()).toLocaleDateString()} · Payment: ${meta.payment.toUpperCase()}</p>
    <p class="muted">Bill to: ${meta.name} · ${meta.email}<br/>${meta.address}, ${meta.city}</p>
    <table>
      <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="3" style="text-align:right">Subtotal</td><td style="text-align:right">Rs ${(order.subtotal ?? 0).toLocaleString()}</td></tr>
        ${order.discount ? `<tr><td colspan="3" style="text-align:right">Discount${order.couponCode ? ` (${order.couponCode})` : ""}</td><td style="text-align:right">−Rs ${order.discount.toLocaleString()}</td></tr>` : ""}
        <tr><td colspan="3" style="text-align:right">Shipping</td><td style="text-align:right">${order.shipping ? "Rs " + order.shipping.toLocaleString() : "FREE"}</td></tr>
        <tr class="tot"><td colspan="3" style="text-align:right">Grand total</td><td style="text-align:right">Rs ${order.total.toLocaleString()}</td></tr>
      </tfoot>
    </table>
    <p class="muted">Thank you for shopping with XccessoriesPoint · support@xccessoriespoint.pk · 7-day easy returns</p>
    <script>window.print()</script>
  </body></html>`;
  const w = window.open("", "_blank", "width=720,height=900");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}
