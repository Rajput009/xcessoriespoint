import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Product, Category, CartItem, User, Toast, Order } from "../types";
import { PRODUCTS, CATEGORIES } from "../data/catalog";
import { track, getVisitorId } from "../lib/tracking";
import { pixelTrack } from "../lib/pixel";

/* ---------------- Toast ---------------- */
interface ToastCtx {
  toasts: Toast[];
  push: (message: string, type?: Toast["type"]) => void;
}
const ToastContext = createContext<ToastCtx>({ toasts: [], push: () => {} });
export const useToast = () => useContext(ToastContext);

/* ---------------- Products ---------------- */
interface ProductsCtx {
  products: Product[];
  categories: Category[];
  loading: boolean;
  offline: boolean;
}
const ProductsContext = createContext<ProductsCtx>({
  products: [],
  categories: [],
  loading: true,
  offline: false,
});
export const useProducts = () => useContext(ProductsContext);

/* ---------------- Cart ---------------- */
interface CartCtx {
  items: CartItem[];
  add: (p: Product, qty?: number, variantId?: number, variantLabel?: string) => void;
  remove: (id: number, variantId?: number) => void;
  setQty: (id: number, qty: number, variantId?: number) => void;
  clear: () => void;
  count: number;
  total: number;
}
const CartContext = createContext<CartCtx>(null as unknown as CartCtx);
export const useCart = () => useContext(CartContext);

/* ---------------- Wishlist ---------------- */
interface WishlistCtx {
  ids: number[];
  toggle: (id: number) => void;
  has: (id: number) => boolean;
}
const WishlistContext = createContext<WishlistCtx>(null as unknown as WishlistCtx);
export const useWishlist = () => useContext(WishlistContext);

/* ---------------- Auth ---------------- */
interface AuthCtx {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
}
const AuthContext = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(AuthContext);

/** Fetch wrapper that attaches the session token. */
export function authFetch(input: string, init: RequestInit = {}) {
  const token = localStorage.getItem("xp_token");
  return fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

/* ---------------- Storefront UI (open state) ---------------- */
export type ModalName = "auth" | "cart" | "wishlist" | "account" | "track" | null;
interface UICtx {
  modal: ModalName;
  openModal: (m: ModalName) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}
const UIContext = createContext<UICtx>(null as unknown as UICtx);
export const useUI = () => useContext(UIContext);

/* ---------------- Combined provider ---------------- */
export function StoreProvider({ children }: { children: ReactNode }) {
  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const push = (message: string, type: Toast["type"] = "success") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  // Products (API with offline fallback)
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pr, cr] = await Promise.all([
          fetch("/api/products").then((r) => (r.ok ? r.json() : Promise.reject())),
          fetch("/api/categories").then((r) => (r.ok ? r.json() : Promise.reject())),
        ]);
        if (!cancelled) {
          setProducts(pr);
          setCategories(cr);
        }
      } catch {
        if (!cancelled) {
          setProducts(PRODUCTS);
          setCategories(CATEGORIES);
          setOffline(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auth (token sessions)
  const [user, setUser] = useState<User | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("xp_user") || "null");
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("xp_token"));
  useEffect(() => {
    localStorage.setItem("xp_user", JSON.stringify(user));
  }, [user]);
  useEffect(() => {
    if (token) localStorage.setItem("xp_token", token);
    else localStorage.removeItem("xp_token");
  }, [token]);

  // Validate the stored session on load
  useEffect(() => {
    if (!token) return;
    authFetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((u: User) => setUser(u))
      .catch(() => {
        // Session expired/invalid — sign out locally (keep offline mode quiet)
        setUser(null);
        setToken(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Login failed");
    const { token: t, user: u } = await r.json();
    localStorage.setItem("xp_token", t); // sync write so immediate authFetch calls see it
    setToken(t);
    setUser(u);
    push(`Welcome back, ${u.name}!`);
    return u;
  };
  const register = async (name: string, email: string, password: string): Promise<User> => {
    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Registration failed");
    const { token: t, user: u } = await r.json();
    localStorage.setItem("xp_token", t); // sync write so immediate authFetch calls see it
    setToken(t);
    setUser(u);
    pixelTrack("CompleteRegistration", { status: true });
    push(`Account created. Welcome, ${u.name}!`);
    return u;
  };
  const logout = () => {
    authFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("xp_token");
    setUser(null);
    setToken(null);
    push("Signed out", "info");
  };

  // Cart — server-side (SQLite) with localStorage fallback when the API is unreachable
  const [items, setItems] = useState<CartItem[]>([]);
  const cartMode = useRef<"server" | "local">("server");
  const productsRef = useRef<Product[]>([]);
  productsRef.current = products;

  const cartHeaders = (): Record<string, string> => {
    const id = localStorage.getItem("xp_cart_id");
    return id ? { "X-Cart-Id": id } : {};
  };

  interface ServerCart {
    id: string;
    items: { productId: number; variantId: number; variantLabel: string | null; qty: number; name: string; price: number; image: string; stock: number }[];
  }

  const applyServerCart = (payload: ServerCart) => {
    if (payload.id) localStorage.setItem("xp_cart_id", payload.id);
    setItems(
      payload.items.map((it) => {
        const full = productsRef.current.find((p) => p.id === it.productId);
        // server-computed price & per-variant stock always win
        const product: Product = {
          ...(full ?? {
            id: it.productId,
            name: it.name,
            category: "",
            compareAt: null,
            rating: 0,
            reviews: 0,
          }),
          id: it.productId,
          name: it.name,
          price: it.price,
          stock: it.stock,
          image: it.image,
        } as Product;
        return { product, qty: it.qty, variantId: it.variantId || 0, variantLabel: it.variantLabel };
      })
    );
  };

  const cartApi = async (path: string, init: RequestInit = {}): Promise<boolean> => {
    try {
      const r = await authFetch(path, {
        ...init,
        headers: { ...(init.headers || {}), ...cartHeaders() },
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        push((err as { error?: string }).error || "Cart update failed", "error");
        return false;
      }
      applyServerCart(await r.json());
      return true;
    } catch {
      // network failure → degrade to local cart mode
      cartMode.current = "local";
      try {
        setItems(JSON.parse(localStorage.getItem("xp_cart") || "[]"));
      } catch {
        setItems([]);
      }
      return false;
    }
  };

  // initial load + refetch whenever the signed-in user changes (guest cart merges server-side)
  useEffect(() => {
    cartApi("/api/cart").then(() => {
      // returning-visitor nudge: remind once per session about a waiting cart
      if (sessionStorage.getItem("xp_cart_reminded")) return;
      setTimeout(() => {
        setItems((current) => {
          const n = current.reduce((s2, i) => s2 + i.qty, 0);
          if (n > 0 && !sessionStorage.getItem("xp_cart_reminded") && !location.pathname.startsWith("/checkout")) {
            sessionStorage.setItem("xp_cart_reminded", "1");
            push(`🛒 You have ${n} item${n > 1 ? "s" : ""} waiting in your cart`, "info");
          }
          return current;
        });
      }, 1800);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // persist local fallback cart
  useEffect(() => {
    if (cartMode.current === "local") localStorage.setItem("xp_cart", JSON.stringify(items));
  }, [items]);

  const localAdd = (p: Product, qty: number, variantId = 0, variantLabel?: string) =>
    setItems((prev) => {
      const found = prev.find((i) => i.product.id === p.id && (i.variantId ?? 0) === variantId);
      if (found)
        return prev.map((i) =>
          i.product.id === p.id && (i.variantId ?? 0) === variantId ? { ...i, qty: i.qty + qty } : i
        );
      const delta = p.variants?.find((v) => v.id === variantId)?.priceDelta ?? 0;
      const product = delta ? { ...p, price: p.price + delta } : p;
      return [...prev, { product, qty, variantId, variantLabel }];
    });

  const add = (p: Product, qty = 1, variantId = 0, variantLabel?: string) => {
    const variant = p.variants?.find((v) => v.id === variantId);
    const unit = p.price + (variant?.priceDelta ?? 0);
    const sku = variant?.sku ?? String(p.id);
    track("add_to_cart", { id: p.id, name: p.name, price: unit, qty, variant: variant?.label });
    pixelTrack("AddToCart", {
      content_ids: [sku],
      content_name: variant ? `${p.name} — ${variant.label}` : p.name,
      content_type: "product",
      value: unit * qty,
      currency: "PKR",
    });
    if (cartMode.current === "server") {
      cartApi("/api/cart/items", {
        method: "POST",
        body: JSON.stringify({ productId: p.id, qty, variantId: variantId || undefined }),
      }).then((ok) => {
        if (!ok && cartMode.current === "local") localAdd(p, qty, variantId, variant?.label ?? variantLabel);
      });
    } else {
      localAdd(p, qty, variantId, variant?.label ?? variantLabel);
    }
    push(`Added "${variant ? `${p.name} — ${variant.label}` : p.name}" to cart`);
  };

  const removeItem = (id: number, variantId = 0) => {
    if (cartMode.current === "server") {
      cartApi(`/api/cart/items/${id}?variantId=${variantId}`, { method: "DELETE" });
    } else {
      setItems((prev) => prev.filter((i) => !(i.product.id === id && (i.variantId ?? 0) === variantId)));
    }
  };

  const setQty = (id: number, qty: number, variantId = 0) => {
    if (cartMode.current === "server") {
      cartApi(`/api/cart/items/${id}`, { method: "PUT", body: JSON.stringify({ qty, variantId }) });
    } else {
      setItems((prev) =>
        qty <= 0
          ? prev.filter((i) => !(i.product.id === id && (i.variantId ?? 0) === variantId))
          : prev.map((i) =>
              i.product.id === id && (i.variantId ?? 0) === variantId ? { ...i, qty } : i
            )
      );
    }
  };

  const clear = () => {
    if (cartMode.current === "server") cartApi("/api/cart", { method: "DELETE" });
    else setItems([]);
  };
  const count = items.reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + i.qty * i.product.price, 0);

  // Wishlist (persisted)
  const [ids, setIds] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("xp_wish") || "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => {
    localStorage.setItem("xp_wish", JSON.stringify(ids));
  }, [ids]);
  const toggle = (id: number) => {
    const adding = !ids.includes(id);
    setIds((prev) =>
      adding ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)
    );
    if (adding) pixelTrack("AddToWishlist", { content_ids: [String(id)], content_type: "product" });
    push(adding ? "Added to wishlist" : "Removed from wishlist", "info");
  };
  const has = (id: number) => ids.includes(id);

  // UI
  const [modal, setModal] = useState<ModalName>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const openModal = (m: ModalName) => setModal(m);

  return (
    <ToastContext.Provider value={{ toasts, push }}>
      <ProductsContext.Provider value={{ products, categories, loading, offline }}>
        <AuthContext.Provider value={{ user, token, login, register, logout }}>
          <WishlistContext.Provider value={{ ids, toggle, has }}>
            <CartContext.Provider
              value={{ items, add, remove: removeItem, setQty, clear, count, total }}
            >
              <UIContext.Provider value={{ modal, openModal, searchQuery, setSearchQuery }}>
                {children}
              </UIContext.Provider>
            </CartContext.Provider>
          </WishlistContext.Provider>
        </AuthContext.Provider>
      </ProductsContext.Provider>
    </ToastContext.Provider>
  );
}

/* ---------------- helpers ---------------- */
export const fmt = (n: number) => `Rs ${n.toLocaleString("en-PK")}`;

export async function placeOrderAPI(payload: {
  items: { id: number; qty: number; variantId?: number }[];
  coupon?: string;
  email: string;
  customer: string;
  phone: string;
  address: string;
  city: string;
  payment: string;
}): Promise<Order> {
  const r = await authFetch("/api/orders", {
    method: "POST",
    headers: { "X-Visitor-Id": getVisitorId() },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error((await r.json()).error || "Order failed");
  return r.json();
}

export async function validateCouponAPI(code: string, subtotal: number) {
  const r = await fetch("/api/coupons/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, subtotal }),
  });
  if (!r.ok) throw new Error((await r.json()).error || "Invalid coupon");
  return r.json() as Promise<{ code: string; type: string; discount: number; freeShip: boolean }>;
}
