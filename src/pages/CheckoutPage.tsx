import { useEffect, useMemo, useState } from "react";
import { Link, useRouter } from "../router";
import { useAuth, useCart, useToast, fmt, placeOrderAPI, validateCouponAPI, authFetch } from "../context/store";
import type { Order } from "../types";
import { track } from "../lib/tracking";
import { swatchFor, swatchStyle } from "../lib/swatch";
import { pixelTrack } from "../lib/pixel";
import { useStoreConfig, cfgNum } from "../lib/config";
import { buildOrderMessage, openWhatsApp, paymentLabel, WHATSAPP_NUMBER } from "../lib/whatsapp";

const CITIES = ["Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Quetta", "Sialkot", "Gujranwala", "Hyderabad", "Other"];

const PAY_METHODS = [
  { id: "cod", label: "Cash on Delivery", desc: "Pay the courier when your parcel arrives.", icon: "💵", available: true },
  { id: "whatsapp", label: "Confirm on WhatsApp", desc: "We prepare your order and confirm it with you on WhatsApp.", icon: "💬", available: true },
  { id: "card", label: "Debit / Credit Card", desc: "Online card payments will be available soon.", icon: "💳", available: false },
  { id: "wallet", label: "JazzCash / Easypaisa", desc: "Mobile wallet payments will be available soon.", icon: "📲", available: false },
];

/* Shopify-style field styling */
const field =
  "w-full rounded-md border border-slate-300 bg-white px-3.5 py-3 text-[15px] text-slate-900 placeholder:text-transparent outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/25";

/** Floating-label input, the way Shopify checkout renders its fields. */
function Field({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  error,
  optional,
  className = "",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: "text" | "numeric" | "email" | "tel";
  error?: string | null;
  optional?: boolean;
  className?: string;
  autoComplete?: string;
}) {
  return (
    <label className={`relative block ${className}`}>
      <input
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        className={`${field} peer focus:pt-6 focus:pb-1.5 ${error ? "border-red-500 focus:border-red-500 focus:ring-red-200" : ""} ${value ? "pt-6 pb-1.5" : ""}`}
      />
      <span
        className={`pointer-events-none absolute left-3.5 text-slate-500 transition-all ${
          value ? "top-1.5 text-[11px]" : "top-3.5 text-[15px] peer-focus:top-1.5 peer-focus:text-[11px]"
        }`}
      >
        {label}
        {optional && <span className="text-slate-400"> (optional)</span>}
      </span>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export default function CheckoutPage() {
  const { items, total, setQty, remove, clear } = useCart();
  const { user } = useAuth();
  const { push } = useToast();
  const { navigate } = useRouter();

  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem("xp_checkout") || "{}");
    } catch {
      return {};
    }
  })();

  const [name, setName] = useState(user?.name || saved.name || "");
  const [email, setEmail] = useState(user?.email || saved.email || "");
  const [phone, setPhone] = useState(saved.phone || "");
  const [address, setAddress] = useState(saved.address || "");
  const [apartment, setApartment] = useState(saved.apartment || "");
  const [city, setCity] = useState(saved.city || "Lahore");
  const [postalCode, setPostalCode] = useState(saved.postalCode || "");
  const [notes, setNotes] = useState(saved.notes || "");
  // ?via=whatsapp deep-links straight to the WhatsApp option; card/wallet
  // selections from older sessions fall back to the supported COD flow.
  const viaWhatsApp = new URLSearchParams(window.location.search).get("via") === "whatsapp";
  const initialPayment = viaWhatsApp || saved.payment === "whatsapp" ? "whatsapp" : "cod";
  const [payment, setPayment] = useState(initialPayment);
  const [saveInfo, setSaveInfo] = useState(saved.saveInfo ?? true);
  const [newsletter, setNewsletter] = useState(saved.newsletter ?? false);
  const [showErrors, setShowErrors] = useState(false);

  const [summaryOpen, setSummaryOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);

  // persist the form so an interrupted checkout resumes
  useEffect(() => {
    if (!saveInfo) return;
    localStorage.setItem(
      "xp_checkout",
      JSON.stringify({ name, email, phone, address, apartment, city, postalCode, notes, payment, saveInfo, newsletter })
    );
  }, [name, email, phone, address, apartment, city, postalCode, notes, payment, saveInfo, newsletter]);

  /* saved addresses (logged-in users) */
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

  /* coupon */
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number; freeShip: boolean } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

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
  // thresholds/fee come from Admin → Settings via /api/config — the server
  // remains the source of truth at charge time, this only keeps the preview honest
  const cfg = useStoreConfig();
  const shipThreshold = cfgNum(cfg?.freeShippingThreshold, 5000);
  const shipFee = cfgNum(cfg?.shippingFee, 250);
  const shipping = coupon?.freeShip || total >= shipThreshold || total === 0 ? 0 : shipFee;
  const grand = Math.max(0, total - discount + shipping);
  const deliveryRange = /lahore|karachi/i.test(city)
    ? cfg?.deliveryDaysCity ?? "2-3"
    : cfg?.deliveryDaysOther ?? "3-5";

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
      push(c.freeShip ? `Coupon ${c.code} applied — free shipping!` : `Coupon ${c.code} applied — you save ${fmt(c.discount)}`);
    } catch (err) {
      setCoupon(null);
      push(err instanceof Error ? err.message : "Invalid coupon", "error");
    } finally {
      setCouponBusy(false);
    }
  };

  /* ---------------- validation ---------------- */
  const isWhatsApp = payment === "whatsapp";
  const needsEmail = payment === "card" || payment === "wallet";
  // accept how Pakistanis actually type numbers: +92 / 0092 / spaces / dashes.
  // normalization lives HERE (single source of truth) so the stored value is
  // always canonical and the validator below can't drift from the input mask
  const normalizePhone = (v: string) => {
    let d = v.replace(/[^0-9+]/g, "");
    if (d.startsWith("+92")) d = "0" + d.slice(3);
    else if (d.startsWith("0092")) d = "0" + d.slice(4);
    else if (d.startsWith("92") && d.length >= 11) d = "0" + d.slice(2);
    return d.replace(/[^0-9]/g, "").slice(0, 11);
  };
  const normalizedPhone = normalizePhone(phone);
  const errors = {
    name: !name.trim() ? "Enter a name" : null,
    email: !email.trim() ? (needsEmail ? "Enter an email address" : null) : /^\S+@\S+\.\S+$/.test(email) ? null : "Enter a valid email",
    phone: !/^03[0-9]{9}$/.test(normalizedPhone) ? "Enter a valid phone (03xx xxxxxxx)" : null,
    address: !address.trim() ? "Enter an address" : null,
  };
  const valid = !Object.values(errors).some(Boolean);

  /* WhatsApp pre-send preview (display only — the real message is rebuilt
     server-side data after the order exists, never used to fake one) */
  const waMessage = useMemo(
    () =>
      buildOrderMessage({
        lines: items.map((i) => ({
          name: i.product.name,
          variantLabel: i.variantLabel,
          qty: i.qty,
          price: i.product.price,
        })),
        subtotal: total,
        discount,
        couponCode: coupon?.code,
        shipping,
        total: grand,
        name,
        phone: normalizedPhone,
        email,
        address,
        apartment,
        city,
        postalCode,
        notes,
        payment,
      }),
    [items, total, discount, coupon, shipping, grand, name, normalizedPhone, email, address, apartment, city, postalCode, notes, payment]
  );

  /* ---------------- submit ---------------- */
  const submit = async () => {
    if (items.length === 0) return push("Your cart is empty", "error");
    setShowErrors(true);
    if (!valid) {
      push(Object.values(errors).find(Boolean) as string, "error");
      document.querySelector<HTMLInputElement>("input")?.focus();
      return;
    }
    setBusy(true);
    try {
      // one conversion: browser pixel + server CAPI share this ID for dedup
      const eventId = crypto.randomUUID();
      const o = await placeOrderAPI({
        items: items.map((i) => ({ id: i.product.id, qty: i.qty, variantId: i.variantId || undefined })),
        coupon: coupon?.code,
        email,
        customer: name,
        phone: normalizedPhone,
        address: [address, apartment].filter(Boolean).join(", "),
        city: postalCode ? `${city} ${postalCode}` : city,
        payment,
        eventId,
      });
      setOrder(o);
      localStorage.removeItem("xp_checkout");
      pixelTrack("Purchase", {
        value: o.total,
        currency: "PKR",
        content_type: "product",
        content_ids: o.items.map((i) => String((i as { productId?: number }).productId ?? "")),
        num_items: o.items.reduce((s, i) => s + i.qty, 0),
        eventID: eventId,
      });
      if (isWhatsApp) {
        openWhatsApp(
          buildOrderMessage({
            orderId: o.id,
            lines: o.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
            subtotal: o.subtotal ?? total,
            discount: o.discount,
            couponCode: o.couponCode,
            shipping: o.shipping ?? shipping,
            total: o.total,
            name,
            phone,
            email,
            address,
            apartment,
            city,
            postalCode,
            notes,
            payment,
          })
        );
      }
      clear();
      push(`Order ${o.id} placed! 🎉`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      // no fake success: if the API fails, NO order exists. Opening WhatsApp
      // with client-computed totals would mislead the customer and create an
      // order the store can't see — show the real error instead.
      // also stop persisting their contact details after a failed attempt
      localStorage.removeItem("xp_checkout");
      push(err instanceof Error ? err.message : "Could not place order — please try again or contact us on WhatsApp.", "error");
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- confirmation ---------------- */
  if (order) {
    return (
      <ThankYou
        order={order}
        meta={{ name, email, phone, address, apartment, city, postalCode, payment, notes }}
        onHome={() => navigate("/")}
        onShop={() => navigate("/shop")}
        onCopy={() => {
          navigator.clipboard?.writeText(order.id);
          push("Order ID copied 📋");
        }}
      />
    );
  }

  /* ---------------- summary panel (shared mobile + desktop) ---------------- */
  const summary = (
    <div>
      <ul className="space-y-4">
        {items.map(({ product, qty, variantId, variantLabel }) => (
          <li key={`${product.id}:${variantId ?? 0}`} className="flex items-center gap-4">
            <div className="relative shrink-0">
              <img src={product.image} alt="" className="w-14 h-14 rounded-lg object-contain border border-slate-200 bg-white p-1" />
              <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-slate-500 text-white text-[11px] font-bold flex items-center justify-center">
                {qty}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-slate-900 leading-tight line-clamp-2">{product.name}</p>
              {variantLabel && (
                <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-500">
                  {swatchFor({ label: variantLabel }) && (
                    <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={swatchStyle(swatchFor({ label: variantLabel })!)} />
                  )}
                  {variantLabel}
                </span>
              )}
              <div className="mt-1 flex items-center gap-2">
                <button type="button" onClick={() => setQty(product.id, qty - 1, variantId)} aria-label={`Decrease ${product.name} quantity`} className="w-6 h-6 rounded border border-slate-300 text-slate-600 leading-none">
                  −
                </button>
                <span className="text-xs font-semibold w-4 text-center">{qty}</span>
                <button type="button" onClick={() => setQty(product.id, qty + 1, variantId)} aria-label={`Increase ${product.name} quantity`} className="w-6 h-6 rounded border border-slate-300 text-slate-600 leading-none">
                  +
                </button>
                <button type="button" onClick={() => remove(product.id, variantId)} className="ml-1 text-[11px] text-slate-400 hover:text-red-500">
                  Remove
                </button>
              </div>
            </div>
            <span className="text-[13px] font-semibold text-slate-900">{fmt(product.price * qty)}</span>
          </li>
        ))}
      </ul>

      {/* discount code */}
      <div className="mt-6">
        {coupon ? (
          <div className="flex items-center justify-between rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2">
            <span className="text-[13px] font-semibold text-emerald-800">🏷️ {coupon.code} applied</span>
            <button
              onClick={() => {
                setCoupon(null);
                setCouponInput("");
              }}
              className="text-xs text-emerald-700 hover:underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              placeholder="Discount code"
              className="flex-1 min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            />
            <button
              onClick={applyCoupon}
              disabled={couponBusy || !couponInput.trim()}
              className="px-5 rounded-md border border-slate-300 bg-slate-100 text-sm font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
            >
              {couponBusy ? "…" : "Apply"}
            </button>
          </div>
        )}
        <p className="mt-1.5 text-[11px] text-slate-400">Try WELCOME10 · XP500 · FREESHIP</p>
      </div>

      {/* totals */}
      <div className="mt-6 space-y-2 border-t border-slate-200 pt-5 text-[14px]">
        <Row label={`Subtotal · ${items.reduce((s, i) => s + i.qty, 0)} items`} value={fmt(total)} />
        {discount > 0 && <Row label="Discount" value={`−${fmt(discount)}`} accent />}
        <Row label="Shipping" value={shipping === 0 ? "FREE" : fmt(shipping)} />
        <div className="flex items-center justify-between border-t border-slate-200 pt-3 mt-3">
          <span className="text-base font-semibold text-slate-900">Total</span>
          <span className="flex items-baseline gap-2">
            <span className="text-xs text-slate-500">PKR</span>
            <span className="text-2xl font-bold text-slate-900">{fmt(grand)}</span>
          </span>
        </div>
        {shipping > 0 && <p className="text-[11px] text-slate-500">Free shipping on orders over Rs 5,000</p>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* ---------- Shopify-style checkout header ---------- */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-[1180px] mx-auto px-5 lg:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-black tracking-tight">
            Xccessories<span className="text-emerald-600">Point</span>
          </Link>
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">🔒 Secure checkout</span>
        </div>
      </header>

      {/* mobile order summary accordion */}
      <div className="lg:hidden bg-[#fafafa] border-b border-slate-200">
        <button onClick={() => setSummaryOpen((v) => !v)} className="w-full max-w-[560px] mx-auto flex items-center justify-between px-5 py-4">
          <span className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
            🛒 {summaryOpen ? "Hide" : "Show"} order summary
            <span className={`transition-transform ${summaryOpen ? "rotate-180" : ""}`}>▾</span>
          </span>
          <span className="text-lg font-bold">{fmt(grand)}</span>
        </button>
        {summaryOpen && <div className="px-5 pb-6 max-w-[560px] mx-auto">{summary}</div>}
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:min-h-[calc(100vh-61px)]">
        {/* ---------- right: order summary (desktop) ---------- */}
        <aside className="hidden lg:block lg:order-2 bg-[#fafafa] border-l border-slate-200">
          <div className="max-w-[430px] px-10 py-10 sticky top-0">
            {items.length === 0 ? <p className="text-sm text-slate-500">Your cart is empty.</p> : summary}
          </div>
        </aside>

        {/* ---------- left: the form ---------- */}
        <main id="main-content" className="lg:order-1">
          <div className="max-w-[560px] lg:ml-auto px-5 lg:px-10 py-8 lg:py-10">
            {/* breadcrumb (single-page checkout — every step is on this page) */}
            <nav className="flex flex-wrap items-center gap-2 text-[13px] text-slate-400 mb-6">
              <Link to="/shop" className="text-emerald-700 hover:underline">Cart</Link>
              <span>›</span>
              <span className="text-slate-900 font-medium">Information</span>
              <span>›</span>
              <span className="text-slate-900 font-medium">Shipping</span>
              <span>›</span>
              <span className="text-slate-900 font-medium">Payment</span>
            </nav>

            {items.length === 0 ? (
              <div className="rounded-lg border border-slate-200 p-10 text-center">
                <div className="text-5xl mb-3">🛒</div>
                <p className="font-bold mb-1">Your cart is empty</p>
                <p className="text-sm text-slate-500 mb-5">Add a few accessories and come back.</p>
                <Link to="/shop" className="inline-block px-6 py-3 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-700">
                  Continue shopping
                </Link>
              </div>
            ) : (
              <>
                {/* express checkout — same form, WhatsApp instead of paying online */}
                <section className="mb-7">
                  <p className="text-center text-xs uppercase tracking-wider text-slate-400 mb-3">Express checkout</p>
                  <button
                    type="button"
                    onClick={() => {
                      setPayment("whatsapp");
                      document.getElementById("xp-payment")?.scrollIntoView?.({ behavior: "smooth", block: "center" });
                    }}
                    className={`w-full flex items-center justify-center gap-2.5 rounded-md py-3.5 font-bold text-white transition ${
                      isWhatsApp ? "bg-[#128C7E]" : "bg-[#25D366] hover:brightness-95"
                    }`}
                  >
                    <WaIcon className="w-5 h-5" />
                    {isWhatsApp ? "WhatsApp selected — fill the form below" : "Order on WhatsApp"}
                  </button>
                  <p className="mt-2 text-center text-[11px] text-slate-500">
                    No card needed — we confirm your order on {"+" + WHATSAPP_NUMBER} in minutes.
                  </p>
                  <div className="flex items-center gap-3 mt-6">
                    <span className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs text-slate-400">OR</span>
                    <span className="h-px flex-1 bg-slate-200" />
                  </div>
                </section>

                {/* contact */}
                <section className="mb-8">
                  <div className="flex items-baseline justify-between mb-3">
                    <h2 className="text-[17px] font-semibold">Contact</h2>
                    {!user && (
                      <Link to="/" className="text-[13px] text-emerald-700 hover:underline">
                        Have an account? Log in
                      </Link>
                    )}
                  </div>
                  <div className="space-y-3">
                    <Field
                      label="Mobile number (03xx xxxxxxx)"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      // no mangling here — normalizePhone() owns the format;
                      // stripping +92 prefixes in the mask used to cut the
                      // last digit off pasted international numbers
                      onChange={setPhone}
                      error={showErrors ? errors.phone : null}
                    />
                    <Field
                      label="Email address"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={setEmail}
                      optional={!needsEmail}
                      error={showErrors ? errors.email : null}
                    />
                    <label className="flex items-center gap-2.5 text-[13px] text-slate-600">
                      <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                      Email me with news and offers
                    </label>
                  </div>
                </section>

                {/* delivery */}
                <section className="mb-8">
                  <h2 className="text-[17px] font-semibold mb-3">Delivery</h2>

                  {savedAddresses.length > 0 && (
                    <div className="mb-3 flex gap-2 flex-wrap">
                      {savedAddresses.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => applySaved(a)}
                          className="px-3 py-2 rounded-md border border-slate-300 text-left text-xs hover:border-emerald-500"
                        >
                          <span className="block font-bold text-slate-900">{a.city}</span>
                          <span className="block text-slate-500 max-w-[180px] truncate">{a.address}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="relative">
                      <select disabled className="w-full rounded-md border border-slate-300 bg-slate-50 px-3.5 pt-6 pb-1.5 text-[15px] text-slate-700">
                        <option>Pakistan</option>
                      </select>
                      <span className="pointer-events-none absolute left-3.5 top-1.5 text-[11px] text-slate-500">Country / Region</span>
                    </div>
                    <Field label="Full name" autoComplete="name" value={name} onChange={setName} error={showErrors ? errors.name : null} />
                    <Field label="Address (street, area)" autoComplete="street-address" value={address} onChange={setAddress} error={showErrors ? errors.address : null} />
                    <Field label="Apartment / suite" value={apartment} onChange={setApartment} optional />
                    <div className="grid grid-cols-2 gap-3">
                      <label className="relative block">
                        <select
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full rounded-md border border-slate-300 bg-white px-3.5 pt-6 pb-1.5 text-[15px] outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/25"
                        >
                          {CITIES.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute left-3.5 top-1.5 text-[11px] text-slate-500">City</span>
                      </label>
                      <Field label="Postal code" inputMode="numeric" value={postalCode} onChange={(v) => setPostalCode(v.replace(/[^0-9]/g, "").slice(0, 6))} />
                    </div>
                    <label className="relative block">
                      <textarea
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Order notes"
                        className={`${field} pt-6 pb-2 resize-none`}
                      />
                      <span className="pointer-events-none absolute left-3.5 top-1.5 text-[11px] text-slate-500">
                        Order notes / landmark <span className="text-slate-400">(optional)</span>
                      </span>
                    </label>
                    <label className="flex items-center gap-2.5 text-[13px] text-slate-600">
                      <input type="checkbox" checked={saveInfo} onChange={(e) => setSaveInfo(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                      Save this information for next time
                    </label>
                  </div>
                </section>

                {/* shipping method */}
                <section className="mb-8">
                  <h2 className="text-[17px] font-semibold mb-3">Shipping method</h2>
                  <div className="flex items-center justify-between rounded-md border-2 border-emerald-600 bg-emerald-50/60 px-4 py-3.5">
                    <span className="text-sm">
                      <span className="block font-semibold text-slate-900">Standard courier</span>
                      <span className="block text-xs text-slate-500">TCS / Leopards · {deliveryRange} working days</span>
                    </span>
                    <span className="text-sm font-semibold">{shipping === 0 ? "FREE" : fmt(shipping)}</span>
                  </div>
                </section>

                {/* payment */}
                <section className="mb-8" id="xp-payment">
                  <h2 className="text-[17px] font-semibold">Payment</h2>
                  <p className="text-[13px] text-slate-500 mb-3">
                    {isWhatsApp ? "We’ll confirm your order with you on WhatsApp." : "No online payment required — pay cash when your parcel arrives."}
                  </p>
                  <div className="rounded-md border border-slate-300 divide-y divide-slate-200 overflow-hidden">
                    {PAY_METHODS.map((m) => {
                      const disabled = !m.available;
                      return (
                        <div key={m.id}>
                          <label
                            className={`flex items-center gap-3 px-4 py-3.5 transition ${
                              disabled
                                ? "cursor-not-allowed opacity-55"
                                : payment === m.id
                                ? "cursor-pointer bg-emerald-50/70"
                                : "cursor-pointer hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="radio"
                              name="pay"
                              disabled={disabled}
                              checked={payment === m.id}
                              onChange={() => setPayment(m.id)}
                              className="w-4 h-4 accent-emerald-600"
                            />
                            <span className="text-lg">{m.icon}</span>
                            <span className="flex-1">
                              <span className="block text-sm font-semibold text-slate-900">{m.label}</span>
                              <span className="block text-xs text-slate-500">{m.desc}</span>
                            </span>
                            {disabled && <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Coming soon</span>}
                          </label>
                        {payment === m.id && m.id === "whatsapp" && (
                          <div className="bg-[#f6fdf8] border-t border-emerald-100 px-4 py-4">
                            <p className="text-[13px] text-slate-600 mb-2">
                              Placing the order opens WhatsApp with everything below pre-written to{" "}
                              <span className="font-semibold">+{WHATSAPP_NUMBER}</span> — just press send. Email is optional for this option.
                            </p>
                            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-emerald-100 bg-white p-3 text-[11px] leading-relaxed text-slate-600">
                              {waMessage}
                            </pre>
                          </div>
                        )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-sm font-bold text-emerald-900">💵 Cash on Delivery across Pakistan</p>
                  <p className="mt-1 text-xs leading-relaxed text-emerald-800">We’ll call to confirm your order before dispatch. Pay the courier only after you receive the parcel.</p>
                </div>

                {/* submit */}
                <button
                  onClick={submit}
                  disabled={busy}
                  className={`w-full rounded-md py-4 text-[15px] font-bold text-white transition disabled:opacity-60 ${
                    isWhatsApp ? "bg-[#25D366] hover:brightness-95" : "bg-slate-900 hover:bg-emerald-700"
                  }`}
                >
                  {busy ? (
                    "Placing your order…"
                  ) : isWhatsApp ? (
                    <span className="flex items-center justify-center gap-2">
                      <WaIcon className="w-5 h-5" />
                      Complete order on WhatsApp · {fmt(grand)}
                    </span>
                  ) : (
                    <span>Place COD order · {fmt(grand)}</span>
                  )}
                </button>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
                  <span>🔒 Secure checkout</span>
                  <span>↩ 7-day returns</span>
                  <span>💵 Pay on delivery</span>
                  <span>✓ No account needed</span>
                </div>

                <footer className="mt-8 border-t border-slate-200 pt-5 flex flex-wrap gap-4 text-[12px] text-emerald-700">
                  <Link to="/returns" className="hover:underline">Refund policy</Link>
                  <Link to="/privacy" className="hover:underline">Privacy policy</Link>
                  <Link to="/terms" className="hover:underline">Terms of service</Link>
                </footer>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex justify-between ${accent ? "text-emerald-700 font-semibold" : "text-slate-600"}`}>
      <span>{label}</span>
      <span className={accent ? "" : "text-slate-900"}>{value}</span>
    </div>
  );
}

function WaIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.08-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.02h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.17 8.17 0 0 1-1.25-4.35c0-4.53 3.7-8.22 8.24-8.22 2.2 0 4.27.86 5.82 2.41a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.2-8.24 8.2z" />
    </svg>
  );
}

/* ---------------- thank-you page (Shopify style) ---------------- */
function ThankYou({
  order,
  meta,
  onHome,
  onShop,
  onCopy,
}: {
  order: Order;
  meta: { name: string; email: string; phone: string; address: string; apartment: string; city: string; postalCode: string; payment: string; notes: string };
  onHome: () => void;
  onShop: () => void;
  onCopy: () => void;
}) {
  const eta = (d: number) =>
    new Date(Date.now() + d * 86400000).toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short" });
  // city-aware ETA from the same settings the checkout copy and Terms use
  const cfg = useStoreConfig();
  const metro = /lahore|karachi/i.test(meta.city || "");
  const [loDays, hiDays] = (metro ? cfg?.deliveryDaysCity ?? "2-3" : cfg?.deliveryDaysOther ?? "3-5")
    .split("-").map((n) => parseInt(n, 10) || 0);
  const etaRange = `${eta(loDays || 2)} – ${eta(hiDays || loDays + 1 || 4)}`;

  /* guest → account upgrade (commitment & consistency: they just bought) */
  const { user, register } = useAuth();
  const { push } = useToast();
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [acctDone, setAcctDone] = useState(false);
  const showUpgrade = !user && !!meta.email;

  const createAccount = async () => {
    if (pw.length < 6) return push("Password must be at least 6 characters", "error");
    setPwBusy(true);
    try {
      await register(meta.name || "Customer", meta.email, pw);
      setAcctDone(true);
      push("Account created — you're logged in 🎉");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/already exists/i.test(msg)) push("An account with this email already exists — log in from the menu to see this order.", "error");
      else push(msg || "Could not create account", "error");
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="max-w-[1180px] mx-auto px-5 lg:px-8 py-4">
          <Link to="/" className="text-xl font-black tracking-tight">
            Xccessories<span className="text-emerald-600">Point</span>
          </Link>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-2">
        <aside className="hidden lg:block lg:order-2 bg-[#fafafa] border-l border-slate-200">
          <div className="max-w-[430px] px-10 py-10 space-y-4">
            {order.items.map((i, k) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  {i.name} <span className="text-slate-400">× {i.qty}</span>
                </span>
                <span className="font-semibold">{fmt(i.price * i.qty)}</span>
              </div>
            ))}
            <div className="border-t border-slate-200 pt-4 space-y-2 text-sm">
              <Row label="Subtotal" value={fmt(order.subtotal ?? order.total)} />
              {!!order.discount && <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`} value={`−${fmt(order.discount)}`} accent />}
              <Row label="Shipping" value={order.shipping ? fmt(order.shipping) : "FREE"} />
              <div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-bold">
                <span>Total</span>
                <span>{fmt(order.total)}</span>
              </div>
            </div>
          </div>
        </aside>

        <main id="main-content" className="lg:order-1">
          <div className="max-w-[560px] lg:ml-auto px-5 lg:px-10 py-10 fade-up">
            <div className="flex items-start gap-4">
              <span className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xl shrink-0">✓</span>
              <div>
                <p className="text-sm text-slate-500">
                  Order <span className="font-semibold text-slate-700 select-all">{order.id}</span>
                  <button onClick={onCopy} className="ml-2 text-xs font-bold text-emerald-700 hover:underline">Copy</button>
                </p>
                <h1 className="text-2xl font-bold text-slate-900 mt-0.5">Thank you, {meta.name.split(" ")[0] || "friend"}!</h1>
              </div>
            </div>

            <div className="mt-7 rounded-lg border border-slate-200 p-5">
              <p className="font-semibold text-slate-900 mb-1">Your order is confirmed</p>
              <p className="text-sm text-slate-500">
                We'll send tracking details {meta.email ? `to ${meta.email}` : "on WhatsApp"}. Estimated delivery{" "}
                <span className="font-semibold text-slate-700">{etaRange}</span>.
              </p>

              {/* what happens next — sets expectations & builds anticipation */}
              <div className="mt-5 pt-5 border-t border-slate-100">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-4">What happens next</p>
                <ol>
                  {(meta.payment === "cod" || meta.payment === "whatsapp"
                    ? [
                        { label: "Order placed", sub: `Reference ${order.id}`, done: true },
                        { label: "Quick phone confirmation", sub: "We'll call you shortly to confirm — keep your phone nearby", done: false },
                        { label: "Dispatched", sub: "Packed and handed to the courier", done: false },
                        { label: "Delivered", sub: `Estimated ${etaRange} · pay cash on arrival`, done: false },
                      ]
                    : [
                        { label: "Order placed", sub: `Reference ${order.id}`, done: true },
                        { label: "Payment received", sub: "Paid online — nothing else needed from you", done: true },
                        { label: "Dispatched", sub: "Packed and handed to the courier", done: false },
                        { label: "Delivered", sub: `Estimated ${etaRange}`, done: false },
                      ]
                  ).map((s, i, arr) => (
                    <li key={s.label} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            s.done ? "bg-emerald-600 text-white" : "border-2 border-slate-200 text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        {i < arr.length - 1 && <span className="w-px flex-1 bg-slate-200 my-0.5" />}
                      </div>
                      <div className={i < arr.length - 1 ? "pb-4" : ""}>
                        <p className={`text-sm font-semibold leading-5 ${s.done ? "text-emerald-700" : "text-slate-700"}`}>
                          {s.label}
                        </p>
                        <p className="text-xs text-slate-400">{s.sub}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                {(meta.payment === "cod" || meta.payment === "whatsapp") && (
                  <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                    💡 Pay only when your order arrives — have {fmt(order.total)} ready for the courier.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 p-5">
              <p className="font-semibold text-slate-900 mb-3">Order details</p>
              <dl className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-slate-500 text-xs mb-1">Contact</dt>
                  <dd className="text-slate-800">{meta.email || meta.phone}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-xs mb-1">Payment</dt>
                  <dd className="text-slate-800">{paymentLabel(meta.payment)} · {fmt(order.total)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-xs mb-1">Shipping address</dt>
                  <dd className="text-slate-800">
                    {meta.name}
                    <br />
                    {[meta.address, meta.apartment].filter(Boolean).join(", ")}
                    <br />
                    {meta.city} {meta.postalCode}
                    <br />
                    {meta.phone}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-xs mb-1">Shipping method</dt>
                  <dd className="text-slate-800">Standard courier (2–4 days)</dd>
                </div>
              </dl>
            </div>

            <button
              onClick={() =>
                openWhatsApp(
                  buildOrderMessage({
                    orderId: order.id,
                    lines: order.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
                    subtotal: order.subtotal ?? order.total,
                    discount: order.discount,
                    couponCode: order.couponCode,
                    shipping: order.shipping ?? 0,
                    total: order.total,
                    name: meta.name,
                    phone: meta.phone,
                    email: meta.email,
                    address: meta.address,
                    apartment: meta.apartment,
                    city: meta.city,
                    postalCode: meta.postalCode,
                    notes: meta.notes,
                    payment: meta.payment,
                  })
                )
              }
              className="mt-5 w-full flex items-center justify-center gap-2.5 rounded-md bg-[#25D366] py-3.5 font-bold text-white hover:brightness-95"
            >
              <WaIcon className="w-5 h-5" />
              Send order details on WhatsApp
            </button>

            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={() => printInvoice(order, meta, () => push("Popup blocked — allow popups to print the invoice", "error"))} className="flex-1 min-w-[160px] rounded-md border border-slate-300 py-3 text-sm font-semibold hover:bg-slate-50">
                🧾 Download invoice
              </button>
              <button onClick={onShop} className="flex-1 min-w-[160px] rounded-md bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-emerald-700">
                Continue shopping
              </button>
            </div>

            {/* one-click account upgrade — pre-filled with the details just used */}
            {showUpgrade && !acctDone && (
              <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-5">
                <p className="font-semibold text-slate-900 text-sm">Save your details & track orders</p>
                <p className="text-xs text-slate-500 mt-0.5 mb-3">
                  Create a password for <span className="font-semibold text-slate-700">{meta.email}</span> — your
                  address and this order are saved automatically.
                </p>
                {pwOpen ? (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && createAccount()}
                      placeholder="Choose a password (6+ characters)"
                      autoComplete="new-password"
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 bg-white"
                    />
                    <button
                      onClick={createAccount}
                      disabled={pwBusy}
                      className="rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      {pwBusy ? "Creating…" : "Create account"}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setPwOpen(true)} className="text-sm font-bold text-emerald-700 hover:underline">
                    Yes, save my details →
                  </button>
                )}
              </div>
            )}
            {acctDone && (
              <p className="mt-4 text-sm font-semibold text-emerald-700">✓ Account created — your address is saved for next time.</p>
            )}

            <p className="mt-6 text-sm text-slate-500">
              Need help?{" "}
              <button onClick={onHome} className="text-emerald-700 hover:underline">
                Back to store
              </button>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ---------- printable invoice (opens print dialog → save as PDF) ---------- */
const escHtml = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function printInvoice(
  order: Order,
  meta: { name: string; email: string; address: string; city: string; payment: string },
  onBlocked?: () => void
) {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td>${escHtml(i.name)}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">Rs ${i.price.toLocaleString()}</td><td style="text-align:right">Rs ${(i.price * i.qty).toLocaleString()}</td></tr>`
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
    <p class="muted">Order <b>${escHtml(order.id)}</b> · ${new Date(order.createdAt ?? Date.now()).toLocaleDateString()} · Payment: ${escHtml(meta.payment.toUpperCase())}</p>
    <p class="muted">Bill to: ${escHtml(meta.name)} · ${escHtml(meta.email)}<br/>${escHtml(meta.address)}, ${escHtml(meta.city)}</p>
    <table>
      <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="3" style="text-align:right">Subtotal</td><td style="text-align:right">Rs ${(order.subtotal ?? 0).toLocaleString()}</td></tr>
        ${order.discount ? `<tr><td colspan="3" style="text-align:right">Discount${order.couponCode ? ` (${escHtml(order.couponCode)})` : ""}</td><td style="text-align:right">−Rs ${order.discount.toLocaleString()}</td></tr>` : ""}
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
  } else if (onBlocked) {
    onBlocked(); // popup blocker fired — tell the user instead of doing nothing
  }
}
