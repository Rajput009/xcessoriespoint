/* ---------------------------------------------------------------
   WhatsApp ordering helpers
   The storefront can hand an order off to WhatsApp (very common for
   PK/COD stores). Number can be overridden per-deploy with
   VITE_WHATSAPP_NUMBER (international format, digits only).
---------------------------------------------------------------- */

export const WHATSAPP_NUMBER: string =
  (import.meta.env?.VITE_WHATSAPP_NUMBER as string | undefined)?.replace(/[^0-9]/g, "") ||
  "923000000000";

export interface WaLine {
  name: string;
  variantLabel?: string | null;
  qty: number;
  price: number;
}

export interface WaOrderInput {
  orderId?: string | null;
  lines: WaLine[];
  subtotal: number;
  discount?: number;
  couponCode?: string | null;
  shipping: number;
  total: number;
  name: string;
  phone: string;
  email?: string;
  address: string;
  apartment?: string;
  city: string;
  postalCode?: string;
  notes?: string;
  payment?: string;
}

const rs = (n: number) => "Rs " + Math.round(n).toLocaleString("en-PK");

/** Human-readable WhatsApp order message (plain text, no markup). */
export function buildOrderMessage(o: WaOrderInput): string {
  const L: string[] = [];
  L.push("*New Order — XccessoriesPoint*");
  if (o.orderId) L.push(`Order ID: ${o.orderId}`);
  L.push("");
  L.push("*Items*");
  o.lines.forEach((l, i) => {
    const label = l.variantLabel ? ` (${l.variantLabel})` : "";
    L.push(`${i + 1}. ${l.name}${label} × ${l.qty} — ${rs(l.price * l.qty)}`);
  });
  L.push("");
  L.push(`Subtotal: ${rs(o.subtotal)}`);
  if (o.discount) L.push(`Discount${o.couponCode ? ` (${o.couponCode})` : ""}: -${rs(o.discount)}`);
  L.push(`Shipping: ${o.shipping ? rs(o.shipping) : "FREE"}`);
  L.push(`*Total: ${rs(o.total)}*`);
  L.push("");
  L.push("*Delivery details*");
  L.push(`Name: ${o.name || "-"}`);
  L.push(`Phone: ${o.phone || "-"}`);
  if (o.email) L.push(`Email: ${o.email}`);
  L.push(`Address: ${[o.address, o.apartment].filter(Boolean).join(", ") || "-"}`);
  L.push(`City: ${o.city}${o.postalCode ? " " + o.postalCode : ""}`);
  if (o.payment) L.push(`Payment: ${paymentLabel(o.payment)}`);
  if (o.notes) L.push(`Notes: ${o.notes}`);
  L.push("");
  L.push("Please confirm my order. Thank you!");
  return L.join("\n");
}

export function paymentLabel(id: string) {
  return (
    {
      cod: "Cash on Delivery",
      card: "Debit / Credit Card",
      wallet: "JazzCash / Easypaisa",
      whatsapp: "Confirm on WhatsApp (COD)",
    }[id] || id
  );
}

/** wa.me deep link for a message. */
export function waLink(message: string, number: string = WHATSAPP_NUMBER) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** Opens WhatsApp in a new tab (falls back to same-tab if popup blocked). */
export function openWhatsApp(message: string, number: string = WHATSAPP_NUMBER) {
  const url = waLink(message, number);
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) window.location.href = url;
}
