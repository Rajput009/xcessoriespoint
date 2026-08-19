import { Link, useRouter } from "../router";
import { useEffect } from "react";

const POLICIES: Record<string, { title: string; updated: string; sections: [string, string][] }> = {
  "/privacy": {
    title: "Privacy & Cookie Policy",
    updated: "August 2026",
    sections: [
      ["What we collect", "Account details (name, email), order information (delivery address, phone), and — only with your consent — anonymous analytics events such as product views and searches. Payment card data is never stored on our servers or in cookies."],
      ["Cookies & storage", "Essential cookies/storage keep your cart, login session and checkout working. Analytics and marketing trackers (including the Meta Pixel) load ONLY after you opt in via the cookie banner. You can change your choice anytime via 'Manage cookies' in the footer."],
      ["How we use your data", "To fulfil orders, provide support, send order updates, and — with consent — improve the store through aggregate analytics. We never sell personal data."],
      ["Your rights", "You may request a copy or deletion of your personal data at any time by emailing support@xccessoriespoint.pk. Consent records are versioned and time-stamped."],
      ["Retention", "Order records are kept for accounting purposes. Analytics events are aggregate and contain no personally identifying information."],
    ],
  },
  "/returns": {
    title: "Returns & Refund Policy",
    updated: "August 2026",
    sections: [
      ["7-day easy returns", "You can request a return within 7 days of delivery for any reason. Items should be unused and in original packaging with all accessories."],
      ["Damaged or incorrect items", "If your order arrives damaged or isn't what you ordered, contact us within 48 hours — we replace it or refund you in full, including shipping."],
      ["How to request", "Use the Track Order tool with your order ID and submit a return request, or message us on WhatsApp. Approved returns are refunded within 5–7 working days."],
      ["Refund method", "Card and wallet payments are reversed to the original method. COD orders are refunded via bank transfer or mobile wallet."],
      ["Warranty", "Electronics carry a 6-month replacement warranty; cables carry a lifetime warranty. Warranty claims follow the same process as returns."],
    ],
  },
  "/terms": {
    title: "Terms of Service",
    updated: "August 2026",
    sections: [
      ["Orders & pricing", "All prices are in Pakistani Rupees and include applicable taxes. Order totals (including discounts and shipping) are computed server-side at the moment of purchase. We may cancel orders in case of pricing errors or stock issues, with a full refund."],
      ["Cash on Delivery", "COD orders start as 'Pending' and are confirmed by phone before dispatch. Repeatedly refused COD deliveries may limit future COD availability."],
      ["Delivery", "Estimated delivery is 2–3 working days for Lahore & Karachi and 3–5 working days elsewhere. Estimates are not guarantees; couriers may face delays."],
      ["Accounts", "You are responsible for keeping your account credentials secure. We may suspend accounts engaged in fraud or abuse (rate limits protect the store automatically)."],
      ["Contact", "XccessoriesPoint · support@xccessoriespoint.pk · +92 300 000 0000 · Lahore & Karachi, Pakistan."],
    ],
  },
};

export default function PolicyPage() {
  const { path } = useRouter();
  const policy = POLICIES[path];

  useEffect(() => {
    if (policy) document.title = `${policy.title} — XccessoriesPoint`;
    window.scrollTo({ top: 0 });
  }, [path, policy]);

  if (!policy) return null;

  return (
    <main className="pt-[120px] md:pt-44 max-w-3xl mx-auto px-6 pb-16">
      <nav className="text-xs text-slate-400 mb-4">
        <Link to="/" className="hover:text-emerald-600">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-slate-600 font-medium">{policy.title}</span>
      </nav>
      <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-1">{policy.title}</h1>
      <p className="text-xs text-slate-400 mb-8">Last updated: {policy.updated}</p>
      <div className="space-y-4">
        {policy.sections.map(([h, body]) => (
          <section key={h} className="glass rounded-2xl p-5">
            <h2 className="font-bold text-slate-900 mb-1.5">{h}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
          </section>
        ))}
      </div>
      <div className="mt-8 flex gap-3 flex-wrap text-sm font-semibold">
        {Object.entries(POLICIES)
          .filter(([p]) => p !== path)
          .map(([p, pol]) => (
            <Link key={p} to={p} className="text-emerald-700 hover:underline">
              {pol.title} →
            </Link>
          ))}
      </div>
    </main>
  );
}
