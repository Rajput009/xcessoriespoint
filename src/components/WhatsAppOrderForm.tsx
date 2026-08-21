import { WHATSAPP_NUMBER } from "../lib/whatsapp";

/* Shared floating-label field (same look as the Shopify-style checkout) */
const field =
  "w-full rounded-md border border-slate-300 bg-white px-3.5 py-3 text-[15px] text-slate-900 placeholder:text-transparent outline-none transition focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/25";

export function WaField({
  label,
  value,
  onChange,
  inputMode,
  error,
  optional,
  className = "",
  autoComplete,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "text" | "numeric" | "email" | "tel";
  error?: string | null;
  optional?: boolean;
  className?: string;
  autoComplete?: string;
  textarea?: boolean;
}) {
  const common = `${field} peer ${error ? "border-red-500 focus:border-red-500 focus:ring-red-200" : ""}`;
  return (
    <label className={`relative block ${className}`}>
      {textarea ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={label} className={`${common} pt-6 pb-2 resize-none`} />
      ) : (
        <input
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={label}
          className={`${common} focus:pt-6 focus:pb-1.5 ${value ? "pt-6 pb-1.5" : ""}`}
        />
      )}
      <span
        className={`pointer-events-none absolute left-3.5 text-slate-500 transition-all ${
          value || textarea ? "top-1.5 text-[11px]" : "top-3.5 text-[15px] peer-focus:top-1.5 peer-focus:text-[11px]"
        }`}
      >
        {label}
        {optional && <span className="text-slate-400"> (optional)</span>}
      </span>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function WaIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.08-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.02h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.17 8.17 0 0 1-1.25-4.35c0-4.53 3.7-8.22 8.24-8.22 2.2 0 4.27.86 5.82 2.41a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.2-8.24 8.2z" />
    </svg>
  );
}

export interface WhatsAppFormValues {
  name: string;
  phone: string;
  email: string;
  address: string;
  apartment: string;
  city: string;
  notes: string;
}

/**
 * Standalone "Order on WhatsApp" form — an alternative to the card/COD
 * checkout. Collects the minimum a COD store needs, previews the message,
 * records the order in the backend and hands it off to WhatsApp.
 */
export default function WhatsAppOrderForm({
  values,
  set,
  cities,
  errors,
  showErrors,
  message,
  busy,
  itemCount,
  totalLabel,
  onSubmit,
  onSwitchToCheckout,
}: {
  values: WhatsAppFormValues;
  set: {
    name: (v: string) => void;
    phone: (v: string) => void;
    email: (v: string) => void;
    address: (v: string) => void;
    apartment: (v: string) => void;
    city: (v: string) => void;
    notes: (v: string) => void;
  };
  cities: string[];
  errors: { name: string | null; phone: string | null; address: string | null };
  showErrors: boolean;
  message: string;
  busy: boolean;
  itemCount: number;
  totalLabel: string;
  onSubmit: () => void;
  onSwitchToCheckout: () => void;
}) {
  return (
    <div className="fade-up">
      {/* header */}
      <div className="rounded-lg border border-[#25D366]/40 bg-[#f3fdf6] p-5 mb-6">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0">
            <WaIcon className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-[17px] font-bold text-slate-900">Order on WhatsApp</h2>
            <p className="text-[13px] text-slate-600 mt-0.5">
              No card, no account. Fill this short form — your {itemCount} item{itemCount === 1 ? "" : "s"} and details are sent to{" "}
              <span className="font-semibold">+{WHATSAPP_NUMBER}</span> and our team confirms your order and delivery time on chat.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <WaField label="Full name" autoComplete="name" value={values.name} onChange={set.name} error={showErrors ? errors.name : null} />
        <WaField
          label="WhatsApp number (03xxxxxxxxx)"
          inputMode="numeric"
          autoComplete="tel"
          value={values.phone}
          onChange={(v) => set.phone(v.replace(/[^0-9]/g, "").slice(0, 11))}
          error={showErrors ? errors.phone : null}
        />
        <WaField label="Email" inputMode="email" autoComplete="email" value={values.email} onChange={set.email} optional />
        <WaField label="Delivery address" autoComplete="street-address" value={values.address} onChange={set.address} error={showErrors ? errors.address : null} />
        <div className="grid grid-cols-2 gap-3">
          <label className="relative block">
            <select
              value={values.city}
              onChange={(e) => set.city(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3.5 pt-6 pb-1.5 text-[15px] outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/25"
            >
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute left-3.5 top-1.5 text-[11px] text-slate-500">City</span>
          </label>
          <WaField label="Landmark" value={values.apartment} onChange={set.apartment} optional />
        </div>
        <WaField label="Message for us" value={values.notes} onChange={set.notes} optional textarea />
      </div>

      {/* message preview */}
      <details className="mt-5 rounded-md border border-slate-200 bg-slate-50 overflow-hidden group" open>
        <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-semibold text-slate-700 flex items-center justify-between">
          Preview the WhatsApp message
          <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap border-t border-slate-200 bg-white p-4 text-[11px] leading-relaxed text-slate-600">
          {message}
        </pre>
      </details>

      <button
        onClick={onSubmit}
        disabled={busy || itemCount === 0}
        className="mt-5 w-full flex items-center justify-center gap-2.5 rounded-md bg-[#25D366] py-4 text-[15px] font-bold text-white transition hover:brightness-95 disabled:opacity-60"
      >
        {busy ? (
          "Sending your order…"
        ) : (
          <>
            <WaIcon className="w-5 h-5" />
            Send order on WhatsApp · {totalLabel}
          </>
        )}
      </button>

      <p className="mt-3 text-center text-[12px] text-slate-500">
        Opens WhatsApp with your order pre-written — just press send. Payment is Cash on Delivery.
      </p>

      <button onClick={onSwitchToCheckout} className="mt-5 w-full text-center text-[13px] text-emerald-700 hover:underline">
        ← Use the normal checkout instead
      </button>
    </div>
  );
}
