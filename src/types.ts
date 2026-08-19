export interface Variant {
  id: number;
  label: string;
  sku: string | null;
  priceDelta: number;
  stock: number;
  image: string | null;
  swatch?: string | null;
  active?: boolean;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  compareAt: number | null;
  rating: number;
  reviews: number;
  stock: number;
  image: string;
  badge?: string;
  featured?: boolean;
  bestSeller?: boolean;
  newArrival?: boolean;
  dealOfDay?: boolean;
  description?: string;
  variants?: Variant[];
  images?: string[];
  imageRecords?: { id: number; url: string }[];
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface CartItem {
  product: Product;
  qty: number;
  variantId?: number;
  variantLabel?: string | null;
}

export interface User {
  id: number;
  name: string;
  email: string;
  isAdmin?: boolean;
  role?: string;
}

export interface Order {
  id: string;
  items: { name: string; qty: number; price: number }[];
  subtotal?: number;
  shipping?: number;
  discount?: number;
  couponCode?: string | null;
  total: number;
  status: string;
  createdAt: string;
  email?: string;
  address?: string;
  customer?: string;
  city?: string;
  payment?: string;
  paymentInfo?: { method: string; status: string; amount: number; txnRef: string | null } | null;
}

export interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}
