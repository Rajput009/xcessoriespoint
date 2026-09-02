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
      <div className="absolute inset-0 bg-slate-900/40 " />
      <div
        className="relative surface !bg-white rounded-3xl shadow-2xl shadow-slate-950/25 max-w-md w-full p-8 text-center fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-white text-slate-400"
          aria-label="Close"
        >
          ✕
        </button>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-2xl ring-1 ring-teal-100">🎁</div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 mb-2">Wait — your cart misses you</h2>
        <p className="text-sm text-slate-600 mb-1">
          You have <span className="font-semibold">{count} item{count > 1 ? "s" : ""}</span> worth{" "}
          <span className="font-semibold text-slate-900">{fmt(total)}</span> waiting.
        </p>
        <p className="text-sm text-slate-600 mb-5">
          Complete your order now and take <span className="font-semibold text-orange-600">10% off</span> with:
        </p>
        <div className="mb-6 inline-block rounded-full border-2 border-dashed border-orange-300 bg-orange-50 px-6 py-2.5 font-mono text-lg font-bold tracking-[0.2em] text-orange-600">
          WELCOME10
        </div>
        <div className="flex gap-3">
          <button
            onClick={claim}
            className="btn-primary flex-1"
          >
            Apply &amp; checkout →
          </button>
          <button
            onClick={() => setOpen(false)}
            className="btn-ghost px-5"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
