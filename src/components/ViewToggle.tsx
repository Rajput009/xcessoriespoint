import { GridIcon, ListIcon } from "./icons";

export type ProductView = "grid" | "list";

type ViewToggleProps = {
  view: ProductView;
  onChange: (view: ProductView) => void;
};

export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="Product view"
      className="inline-flex shrink-0 items-center rounded-lg border border-slate-200 bg-white p-0.5"
    >
      <button
        type="button"
        onClick={() => onChange("grid")}
        aria-pressed={view === "grid"}
        aria-label="Grid view"
        title="Grid view"
        className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 ${
          view === "grid" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        <GridIcon size={16} />
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-pressed={view === "list"}
        aria-label="List view"
        title="List view"
        className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 ${
          view === "list" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        <ListIcon size={16} />
      </button>
    </div>
  );
}
