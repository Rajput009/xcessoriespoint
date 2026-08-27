import { useEffect, useState } from "react";
import { ArrowUpIcon } from "./icons";

export default function FloatingButtons() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <>
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="fixed bottom-36 md:bottom-6 right-4 z-30 w-12 h-12 rounded-full bg-slate-900 text-white shadow-lg hover:bg-blue-600 transition-colors flex items-center justify-center fade-up"
        aria-label="Back to top"
      >
        <ArrowUpIcon size={20} />
      </button>
    </>
  );
}
