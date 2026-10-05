// Server components call FastAPI directly over the Podman network;
// the browser goes through nginx at /api.
const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

export type Product = {
  id: number;
  seller_id: number;
  name: string;
  description: string | null;
  category: string;
  base_price: string;
  stock_quantity: number;
  image_url: string | null;
  created_at: string;
};

export async function getProducts(): Promise<Product[]> {
  const res = await fetch(`${API_URL}/products`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load products (${res.status})`);
  return res.json();
}

// ==========================================
// دوال جلب بيانات الداشبوردات الثلاثة
// ==========================================

export async function getSellerDashboard(sellerId = 1) {
  const res = await fetch(`${API_URL}/dashboard/seller?seller_id=${sellerId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load seller dashboard (${res.status})`);
  return res.json();
}

export async function getBuyerDashboard(buyerId = 4) {
  const res = await fetch(`${API_URL}/dashboard/buyer?buyer_id=${buyerId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load buyer dashboard (${res.status})`);
  return res.json();
}

export async function getAdminDashboard() {
  const res = await fetch(`${API_URL}/dashboard/admin`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load admin dashboard (${res.status})`);
  return res.json();
}