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
