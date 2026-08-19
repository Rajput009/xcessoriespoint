import type { Product, Category } from "../types";

export const CATEGORIES: Category[] = [
  { id: "audio", name: "Audio", icon: "🎧" },
  { id: "wearables", name: "Wearables", icon: "⌚" },
  { id: "power", name: "Power & Charging", icon: "🔋" },
  { id: "cases", name: "Cases & Protection", icon: "📱" },
  { id: "cables", name: "Cables & Hubs", icon: "🔌" },
];

export const PRODUCTS: Product[] = [
  { id: 1, name: "AeroBuds Pro Wireless Earbuds", category: "audio", price: 4999, compareAt: 7999, rating: 4.8, reviews: 1243, stock: 42, image: "/img/earbuds.jpg", badge: "-38%", featured: true, bestSeller: true, dealOfDay: true, description: "Active noise cancellation, 32h battery with case, wireless charging, IPX5." },
  { id: 2, name: "PulseWave Over-Ear Headphones", category: "audio", price: 8999, compareAt: 12999, rating: 4.7, reviews: 861, stock: 18, image: "/img/headphones.jpg", badge: "-30%", bestSeller: true, newArrival: true, description: "Hybrid ANC, 60-hour playtime, plush memory-foam earcups, multipoint pairing." },
  { id: 3, name: "VitaFit S2 Smartwatch", category: "wearables", price: 6499, compareAt: 9499, rating: 4.6, reviews: 672, stock: 27, image: "/img/smartwatch.jpg", badge: "-32%", bestSeller: true, dealOfDay: true, description: "AMOLED display, GPS, SpO2 & heart-rate tracking, 10-day battery." },
  { id: 4, name: "VoltCore 20K Power Bank", category: "power", price: 3499, compareAt: 4999, rating: 4.5, reviews: 954, stock: 63, image: "/img/powerbank.jpg", badge: "-30%", bestSeller: true, description: "20,000 mAh, 22.5W fast charge, LED display, dual USB-C + USB-A." },
  { id: 5, name: "ArmorFlex Slim Phone Case", category: "cases", price: 1299, compareAt: 1999, rating: 4.4, reviews: 511, stock: 120, image: "/img/case.jpg", badge: "-35%", newArrival: true, description: "Military-grade drop protection in a 1.2 mm slim shell, MagSafe ready." },
  { id: 6, name: "GaNSpark 65W Fast Charger", category: "power", price: 2799, compareAt: 3999, rating: 4.7, reviews: 738, stock: 55, image: "/img/charger.jpg", badge: "-30%", bestSeller: true, newArrival: true, description: "GaN II tech, 65W USB-C PD + USB-A, foldable pins, braided cable included." },
  { id: 7, name: "AeroBuds Lite Earbuds", category: "audio", price: 2499, compareAt: 3499, rating: 4.3, reviews: 322, stock: 80, image: "/img/earbuds.jpg", badge: "-29%", newArrival: true, description: "Crisp sound, 24h battery, touch controls, USB-C quick charge." },
  { id: 8, name: "VitaFit Active Band", category: "wearables", price: 2999, compareAt: 3999, rating: 4.2, reviews: 289, stock: 34, image: "/img/smartwatch.jpg", badge: "-25%", newArrival: true, description: "Slim fitness band with 14 sport modes and sleep tracking." },
  { id: 9, name: "VoltCore Mini 10K", category: "power", price: 2199, compareAt: 2999, rating: 4.4, reviews: 410, stock: 71, image: "/img/powerbank.jpg", badge: "-27%", newArrival: true, description: "Pocket-size 10,000 mAh with built-in USB-C cable." },
  { id: 10, name: "ClearShield Case (Crystal)", category: "cases", price: 999, compareAt: 1499, rating: 4.1, reviews: 198, stock: 140, image: "/img/case.jpg", badge: "-33%", description: "Anti-yellowing crystal-clear TPU with reinforced corners." },
  { id: 11, name: "FlexLine 100W USB-C Cable (2m)", category: "cables", price: 899, compareAt: 1299, rating: 4.6, reviews: 623, stock: 200, image: "/img/charger.jpg", badge: "-31%", newArrival: true, description: "Braided nylon, 100W PD, 480 Mbps data, lifetime warranty." },
  { id: 12, name: "HubMax 7-in-1 USB-C Hub", category: "cables", price: 4499, compareAt: 5999, rating: 4.5, reviews: 344, stock: 25, image: "/img/powerbank.jpg", badge: "-25%", newArrival: true, description: "4K HDMI, 100W passthrough, SD/microSD, 3× USB 3.0." },
  { id: 13, name: "PulseWave Studio Wired", category: "audio", price: 5499, compareAt: 6999, rating: 4.4, reviews: 152, stock: 12, image: "/img/headphones.jpg", badge: "-21%", description: "Studio-tuned 50 mm drivers, detachable cable, folding design." },
  { id: 14, name: "VitaFit Kids Watch", category: "wearables", price: 3999, compareAt: 5499, rating: 4.0, reviews: 96, stock: 20, image: "/img/smartwatch.jpg", badge: "-27%", description: "GPS tracking, SOS button, games, parental controls." },
  { id: 15, name: "GaNSpark 30W Compact", category: "power", price: 1599, compareAt: 2199, rating: 4.5, reviews: 267, stock: 90, image: "/img/charger.jpg", badge: "-27%", description: "Tiny 30W GaN charger, perfect travel companion." },
  { id: 16, name: "ArmorFlex Rugged Case", category: "cases", price: 1799, compareAt: 2499, rating: 4.6, reviews: 231, stock: 48, image: "/img/case.jpg", badge: "-28%", description: "Dual-layer rugged protection with kickstand and camera guard." },
];
