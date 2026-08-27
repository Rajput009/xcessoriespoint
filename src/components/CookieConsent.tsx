import { useEffect, useState } from "react";
import { getConsent, saveConsent, CONSENT_OPEN_EVENT, type Consent } from "../lib/tracking";
import { initPixel, revokePixel } from "../lib/pixel";

export default function CookieConsent() {
  const [open, setOpen] = useState(() => getConsent() === null);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const handler = () => {
      const c = getConsent();
      if (c) {
        setAnalytics(c.analytics);
        setMarketing(c.marketing);
        setCustomize(true);
      }
      setOpen(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, handler);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, handler);
  }, []);

  if (!open) return null;

  const finish = (c: Consent) => {
    saveConsent(c);
    // Meta Pixel obeys the marketing toggle
    if (c.marketing) initPixel();
    else revokePixel();
    setOpen(false);
    setCustomize(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] p-4 md:p-6 pointer-events-none">
      <div className="pointer-events-auto max-w-3xl mx-auto surface !bg-white rounded-3xl shadow-2xl shadow-blue-950/15 p-5 md:p-6 fade-up">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-2xl">🍪</span>
          <div>
            <p className="font-bold text-slate-900">Your privacy, your choice</p>
            <p className="text-sm text-slate-500 mt-0.5">
              We use essential cookies to run the store (cart, login, checkout). With your
              permission we'd also like to use privacy-aware analytics to improve the shop.
              No payment data is ever stored in cookies.{" "}
              <a href="/privacy" className="text-blue-700 font-semibold underline decoration-dotted">
                Privacy & cookie policy
              </a>
            </p>
          </div>
        </div>

        {customize && (
          <div className="mb-4 space-y-2 border-t border-slate-100 pt-3">
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked disabled className="accent-blue-600" />
              <span>
                <span className="font-semibold text-slate-900">Essential</span>{" "}
                <span className="text-slate-500">— login, cart, checkout, security (always on)</span>
              </span>
            </label>
            <label className="flex items-center gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="accent-blue-600"
              />
              <span>
                <span className="font-semibold text-slate-900">Analytics</span>{" "}
                <span className="text-slate-500">— product views, searches, checkout funnel</span>
              </span>
            </label>
            <label className="flex items-center gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="accent-blue-600"
              />
              <span>
                <span className="font-semibold text-slate-900">Marketing</span>{" "}
                <span className="text-slate-500">— personalized promotions and retargeting</span>
              </span>
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => finish({ essential: true, analytics: true, marketing: true })}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700"
          >
            Accept all
          </button>
          <button
            onClick={() => finish({ essential: true, analytics: false, marketing: false })}
            className="px-5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-50"
          >
            Essential only
          </button>
          {customize ? (
            <button
              onClick={() => finish({ essential: true, analytics, marketing })}
              className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700"
            >
              Save preferences
            </button>
          ) : (
            <button
              onClick={() => setCustomize(true)}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-blue-700 hover:underline"
            >
              Customize
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
