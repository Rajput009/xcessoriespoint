import { useToast } from "../context/store";

export default function Toasts() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[100] space-y-2 w-[92vw] max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`fade-up flex items-center gap-2.5 px-4 py-3 rounded-2xl backdrop-blur-xl border text-sm font-medium text-white cursor-pointer select-none transition-all hover:opacity-90 ${
            t.type === "error"
              ? "bg-red-600/90 border-red-400/40 shadow-lg shadow-red-600/25"
              : t.type === "info"
              ? "bg-slate-900/85 border-white/15 shadow-lg shadow-slate-900/25"
              : "bg-emerald-600/90 border-emerald-300/40 neon-glow"
          }`}
        >
          <span className="font-bold">{t.type === "error" ? "✕" : t.type === "info" ? "ℹ" : "✓"}</span>
          <span className="flex-1">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
