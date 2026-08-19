import { useEffect, useState } from "react";
import { useRouter } from "../router";
import { useCart, fmt } from "../context/store";

/**
 * Exit-intent recovery offer (desktop): when the cursor leaves the top of the
 * viewport with items in the cart, offer WELCOME10 once per session.
 */
export default function ExitIntentOffer() {
  const [open, setOpen] = useState(false);
  const { count, total } = useCart();
  const { path, navigate } = useRouter();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.clientY > 12) return;
      if (sessionStorage.getItem("xp_exit_shown")) return;
      if (count === 0) return;
      if (path.startsWith("/checkout") || path.startsWith("/admin")) return;
      sessionStorage.setItem("xp_exit_shown", "1");
      setOpen(true);
    };
    document.addEventListener("mouseleave", handler);
    return () => document.removeEventListener("mouseleave", handler);
  }, [count, path]);

  if (!open) return null;

  const claim = () => {
    sessionStorage.setItem("xp_prefill_coupon", "WELCOME10");
    setOpen(false);
    navigate("/checkout");
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-md" />
      <div
        className="relative glass !bg-white/85 rounded-3xl shadow-2xl shadow-emerald-950/25 max-w-md w-full p-8 text-center fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-white/80 text-slate-400"
          aria-label="Close"
        >
          ✕
        </button>
        <div className="text-5xl mb-3">🎁</div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Wait — your cart misses you!</h2>
        <p className="text-sm text-slate-600 mb-1">
          You have <span className="font-bold">{count} item{count > 1 ? "s" : ""}</span> worth{" "}
          <span className="font-bold text-emerald-700">{fmt(total)}</span> waiting.
        </p>
        <p className="text-sm text-slate-600 mb-5">
          Complete your order now and take <span className="font-black text-emerald-700">10% OFF</span> with:
        </p>
        <div className="inline-block border-2 border-dashed border-emerald-400 bg-emerald-50 rounded-xl px-6 py-2.5 font-black text-emerald-700 tracking-widest text-lg mb-6">
          WELCOME10
        </div>
        <div className="flex gap-3">
          <button
            onClick={claim}
            className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 neon-glow-soft"
          >
            Apply & checkout →
          </button>
          <button
            onClick={() => setOpen(false)}
            className="px-5 py-3 rounded-xl glass-soft text-sm font-semibold text-slate-600"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
