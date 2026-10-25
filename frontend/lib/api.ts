// Server components use the internal API origin. Never expose it in UI errors.
import { privateIntegrationBlocker, type WorkspaceOperation, type WorkspaceInput } from "./api-contracts";
const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:8000";
// Next.js replaces this flag at BUILD time via next.config.ts. Normal releases bake false.
export function isIsolatedDemoBuild(): boolean {
  return process.env.NEXT_PUBLIC_AUTONEG_DEMO_BUILD === "true";
}
export function isMockDataEnabled(): boolean {
  if (isIsolatedDemoBuild()) return true;
  return process.env.NODE_ENV === "development" && process.env.USE_MOCK_DATA === "true";
}
export type Product = {
  id: number; seller_id: number; name: string; description: string | null;
  category: string; base_price: string; stock_quantity: number;
  image_url: string | null; created_at: string; catalog_id?: string; model_key?: string;
};
export type ApiErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "UNAVAILABLE" | "INVALID_RESPONSE" | "INVALID_REQUEST" | "INTEGRATION_BLOCKED";
export class ApiError extends Error {
  constructor(public readonly code: ApiErrorCode, message: string, public readonly status?: number) { super(message); this.name = "ApiError"; }
}
export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "The service is temporarily unavailable. Please try again.";
}
function invalid(): never { throw new ApiError("INVALID_RESPONSE", "The product service returned an unsupported response. Please try again later."); }
export function parseProduct(value: unknown): Product {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const x = value as Record<string, unknown>;
  if (!Number.isSafeInteger(x.id) || Number(x.id) <= 0 || !Number.isSafeInteger(x.seller_id) || Number(x.seller_id) <= 0 ||
      typeof x.name !== "string" || !x.name.trim() || typeof x.category !== "string" ||
      !(x.description === null || typeof x.description === "string") ||
      !(x.image_url === null || typeof x.image_url === "string") ||
      typeof x.created_at !== "string" || !Number.isFinite(Date.parse(x.created_at)) ||
      !Number.isSafeInteger(x.stock_quantity) || Number(x.stock_quantity) < 0 ||
      !(typeof x.base_price === "string" || typeof x.base_price === "number") ||
      !/^\d+(?:\.\d+)?$/.test(String(x.base_price)) || !Number.isFinite(Number(x.base_price)) || Number(x.base_price) < 0) return invalid();
  // Explicit allowlist: no Seller minimums, budgets, or unknown backend fields.
  return { id: Number(x.id), seller_id: Number(x.seller_id), name: x.name, category: x.category,
    description: x.description, image_url: x.image_url, base_price: String(x.base_price),
    stock_quantity: Number(x.stock_quantity), created_at: x.created_at };
}
async function publicRequest(path: string): Promise<Response> {
  if (isIsolatedDemoBuild()) throw new ApiError("INTEGRATION_BLOCKED", "DEMO MODE: external API connections are disabled.");
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
  } catch { throw new ApiError("UNAVAILABLE", "Failed to load products. The product service is unavailable. Please try again."); }
  if (response.status === 401) throw new ApiError("UNAUTHORIZED", "Your session is unavailable or has expired. Secure sign-in is required.", 401);
  if (response.status === 403) throw new ApiError("FORBIDDEN", "You do not have permission to view this information.", 403);
  if (!response.ok && response.status !== 404) throw new ApiError("UNAVAILABLE", "Failed to load products. Please try again later.", response.status);
  return response;
}
async function json(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { return invalid(); }
}
export async function getProducts(): Promise<Product[]> {
  if (isMockDataEnabled()) { const { mockProducts } = await import("./mock-data"); return structuredClone(mockProducts); }
  const response = await publicRequest("/products");
  if (response.status === 404) throw new ApiError("UNAVAILABLE", "The product catalog service is unavailable.", 404);
  const data = await json(response);
  if (!Array.isArray(data)) return invalid();
  const products = data.map(parseProduct);
  if (new Set(products.map(p => p.id)).size !== products.length) return invalid();
  return products;
}
export async function getProduct(id: number): Promise<Product | null> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError("INVALID_REQUEST", "Choose a valid product.");
  if (isMockDataEnabled()) { const { mockProducts } = await import("./mock-data"); const p = mockProducts.find(p => p.id === id); return p ? structuredClone(p) : null; }
  const response = await publicRequest(`/products/${id}`);
  if (response.status === 404) return null;
  const product = parseProduct(await json(response));
  if (product.id !== id) return invalid();
  return product;
}
// Safe integration boundary for EXISTING contracts. No request is sent while auth,
// response privacy, GET side effects and persistence guarantees remain unresolved.
// Return unknown intentionally: raw workspace state must never be cast to a role-safe DTO.
export async function requestWorkspace<K extends WorkspaceOperation>(_operation: K, _input: WorkspaceInput<K>): Promise<unknown> {
  throw new ApiError("INTEGRATION_BLOCKED", privateIntegrationBlocker);
}
export async function getSellerDashboard(sellerId = 1) {
  if (isMockDataEnabled()) { const { getMockSellerDashboard } = await import("./mock-data"); return structuredClone(getMockSellerDashboard(sellerId)); }
  throw new ApiError("INTEGRATION_BLOCKED", privateIntegrationBlocker);
}
export async function getBuyerDashboard(buyerId = 4) {
  if (isMockDataEnabled()) { const { getMockBuyerDashboard } = await import("./mock-data"); return structuredClone(getMockBuyerDashboard(buyerId)); }
  throw new ApiError("INTEGRATION_BLOCKED", privateIntegrationBlocker);
}
export async function getAdminDashboard() {
  if (isMockDataEnabled()) { const { getMockAdminDashboard } = await import("./mock-data"); return structuredClone(getMockAdminDashboard()); }
  throw new ApiError("INTEGRATION_BLOCKED", privateIntegrationBlocker);
}
