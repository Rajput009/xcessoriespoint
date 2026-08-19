import { useEffect, useState } from "react";
import { useToast } from "../context/store";
import { ArrowUpIcon, MessageIcon } from "./icons";

export default function FloatingButtons() {
  const [visible, setVisible] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <>
      <button
        onClick={() => {
          window.open("https://wa.me/923000000000?text=" + encodeURIComponent("Hi! I need help with my XccessoriesPoint order."), "_blank");
          push("Opening WhatsApp support 💬", "info");
        }}
        className="fixed bottom-36 md:bottom-6 left-4 z-30 w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-600/30 hover:scale-105 transition-transform flex items-center justify-center fade-up"
        aria-label="WhatsApp support"
      >
        <MessageIcon size={20} />
      </button>
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="fixed bottom-36 md:bottom-6 right-4 z-30 w-12 h-12 rounded-full bg-slate-900 text-white shadow-lg hover:bg-emerald-600 transition-colors flex items-center justify-center fade-up"
        aria-label="Back to top"
      >
        <ArrowUpIcon size={20} />
      </button>
    </>
  );
}
