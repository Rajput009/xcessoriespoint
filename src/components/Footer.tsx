import { useState } from "react";
import { Link } from "../router";
import { useToast, useUI } from "../context/store";
import { openConsentManager } from "../lib/tracking";
import { pixelTrack } from "../lib/pixel";

export default function Footer() {
  const { push } = useToast();
  const { openModal } = useUI();
  const [email, setEmail] = useState("");

  return (
    <footer className="bg-gradient-to-b from-slate-900 via-emerald-950 to-emerald-950 text-slate-300 mt-20 pb-20 md:pb-0">
      <div className="max-w-7xl mx-auto px-6 py-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <p className="text-xl font-black text-white mb-3">
            Xccessories<span className="text-emerald-500">Point</span>
          </p>
          <p className="text-sm text-slate-400 leading-relaxed">
            Premium tech accessories at honest prices. Earbuds, wearables, power
            and protection — delivered across Pakistan.
          </p>
        </div>
        <div>
          <p className="font-semibold text-white mb-3 text-sm uppercase tracking-wide">Shop</p>
          <ul className="space-y-2 text-sm">
            <li><Link to="/shop" className="hover:text-emerald-400">All Products</Link></li>
            <li><Link to="/category/audio" className="hover:text-emerald-400">Audio</Link></li>
            <li><Link to="/category/wearables" className="hover:text-emerald-400">Wearables</Link></li>
            <li><Link to="/category/power" className="hover:text-emerald-400">Power &amp; Charging</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-white mb-3 text-sm uppercase tracking-wide">Buying Guides</p>
          <ul className="space-y-2 text-sm">
            <li><Link to="/guides/what-is-anc-noise-cancellation" className="hover:text-emerald-400">What is ANC?</Link></li>
            <li><Link to="/guides/mah-explained-power-banks" className="hover:text-emerald-400">mAh explained</Link></li>
            <li><Link to="/guides/gan-chargers-explained" className="hover:text-emerald-400">GaN chargers</Link></li>
            <li><Link to="/guides/spo2-smartwatch-tracking" className="hover:text-emerald-400">SpO2 tracking</Link></li>
            <li><Link to="/guides/tpu-vs-silicone-phone-cases" className="hover:text-emerald-400">Case materials</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-white mb-3 text-sm uppercase tracking-wide">Support</p>
          <ul className="space-y-2 text-sm">
            <li>
              <button onClick={() => openModal("track")} className="hover:text-emerald-400">
                Track Order
              </button>
            </li>
            <li>
              <button onClick={() => openConsentManager()} className="hover:text-emerald-400">
                Manage cookies
              </button>
            </li>
            <li><Link to="/checkout" className="hover:text-emerald-400">Checkout</Link></li>
            <li><Link to="/admin" className="hover:text-emerald-400">Admin</Link></li>
            <li><Link to="/privacy" className="hover:text-emerald-400">Privacy Policy</Link></li>
            <li><Link to="/returns" className="hover:text-emerald-400">Returns & Refunds</Link></li>
            <li><Link to="/terms" className="hover:text-emerald-400">Terms of Service</Link></li>
            <li><span className="text-slate-400">support@xccessoriespoint.pk</span></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-white mb-3 text-sm uppercase tracking-wide">Newsletter</p>
          <p className="text-sm text-slate-400 mb-3">Deals and drops, once a week.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!email.trim()) return push("Please enter an email", "error");
              try {
                const r = await fetch("/api/newsletter", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email }),
                });
                if (!r.ok) throw new Error((await r.json()).error);
                pixelTrack("Lead", { content_name: "newsletter" });
                push("Subscribed! Welcome to the club 🎉");
                setEmail("");
              } catch (err) {
                push(err instanceof Error ? err.message : "Subscription failed", "error");
              }
            }}
            className="flex gap-2"
          >
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="flex-1 min-w-0 rounded-xl bg-white/10 backdrop-blur border border-white/15 px-3 py-2 text-sm outline-none focus:border-emerald-400 placeholder-slate-400"
            />
            <button className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 neon-glow-soft">
              Join
            </button>
          </form>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} XccessoriesPoint. All rights reserved.
      </div>
    </footer>
  );
}
