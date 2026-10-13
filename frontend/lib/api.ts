// Server components call FastAPI directly over the Podman network;
// the browser goes through nginx at /api.
const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

export function isMockDataEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.USE_MOCK_DATA === "true";
}

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
  if (isMockDataEnabled()) {
    const { mockProducts } = await import("./mock-data");
    return structuredClone(mockProducts);
  }
  const res = await fetch(`${API_URL}/products`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load products (${res.status})`);
  return res.json();
}

export async function getProduct(id: number): Promise<Product | null> {
  if (isMockDataEnabled()) {
    const { mockProducts } = await import("./mock-data");
    const product = mockProducts.find(product => product.id === id);
    return product ? structuredClone(product) : null;
  }
  const res = await fetch(`${API_URL}/products/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load product (${res.status})`);
  return res.json();
}

export async function getSellerDashboard(sellerId = 1) {
  if (isMockDataEnabled()) {
    const { getMockSellerDashboard } = await import("./mock-data");
    return structuredClone(getMockSellerDashboard(sellerId));
  }
  const res = await fetch(`${API_URL}/dashboard/seller?seller_id=${sellerId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load seller dashboard (${res.status})`);
  return res.json();
}

export async function getBuyerDashboard(buyerId = 4) {
  if (isMockDataEnabled()) {
    const { getMockBuyerDashboard } = await import("./mock-data");
    return structuredClone(getMockBuyerDashboard(buyerId));
  }
  const res = await fetch(`${API_URL}/dashboard/buyer?buyer_id=${buyerId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load buyer dashboard (${res.status})`);
  return res.json();
}

export async function getAdminDashboard() {
  if (isMockDataEnabled()) {
    const { getMockAdminDashboard } = await import("./mock-data");
    return structuredClone(getMockAdminDashboard());
  }
  const res = await fetch(`${API_URL}/dashboard/admin`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load admin dashboard (${res.status})`);
  return res.json();
}

export async function getWorkspaceBootstrap() {
  if (isMockDataEnabled()) {
    const { mockProducts } = await import("./mock-data");
    const { initialDemoState } = await import("./demo-model");
    return structuredClone(initialDemoState(mockProducts));
  }
  try {
    const res = await fetch(`${API_URL}/workspace/bootstrap`, { cache: "no-store" });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback during container static build step when backend is not yet connected
  }
  const products = await getProducts().catch(() => []);
  const { initialDemoState } = await import("./demo-model");
  return structuredClone(initialDemoState(products));
}
