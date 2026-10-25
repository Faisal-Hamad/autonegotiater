// SOURCE_VERIFIED against the partial AWS reference; not a live OpenAPI assertion.
// Payload types document existing contracts. They do not authorize their use.
export type WorkspacePayloads = {
  register: { name: string; email: string; role?: string; password?: string | null };
  profile: { name: string; email: string };
  userStatus: { active: boolean };
  product: { seller_id: number; name: string; category: string; base_price: number; stock_quantity: number; description?: string | null; image_url?: string | null };
  rules: { seller_id: number; minimum: number; threshold: number; discount: number; rounds: number; enabled?: boolean };
  session: { buyer_id: number; product_id: number; budget: number; mode?: string; scenario?: string; warranty?: number; delivery?: string };
  end: { buyer_id: number; status: string };
  rating: { buyer_id: number; rating: number; feedback?: string };
};
export const workspaceContracts = {
  bootstrap: { method: "GET", path: "/workspace/bootstrap", payload: null },
  register: { method: "POST", path: "/workspace/users/register", payload: "register" },
  profile: { method: "PUT", path: "/workspace/users/{user_id}", payload: "profile" },
  userStatus: { method: "PATCH", path: "/workspace/users/{user_id}/status", payload: "userStatus" },
  createProduct: { method: "POST", path: "/workspace/products", payload: "product" },
  updateProduct: { method: "PUT", path: "/workspace/products/{product_id}", payload: "product" },
  rules: { method: "PUT", path: "/workspace/products/{product_id}/rules", payload: "rules" },
  session: { method: "POST", path: "/workspace/sessions", payload: "session" },
  advance: { method: "POST", path: "/workspace/sessions/{session_id}/advance", payload: null },
  approve: { method: "POST", path: "/workspace/sessions/{session_id}/approve", payload: null },
  end: { method: "POST", path: "/workspace/sessions/{session_id}/end", payload: "end" },
  rating: { method: "POST", path: "/workspace/deals/{deal_id}/rating", payload: "rating" },
} as const;
export type WorkspaceOperation = keyof typeof workspaceContracts;
export type WorkspaceInput<K extends WorkspaceOperation> = typeof workspaceContracts[K]["payload"] extends keyof WorkspacePayloads
  ? WorkspacePayloads[typeof workspaceContracts[K]["payload"]] : undefined;
// Deliberately no client-side Role/User-ID authorization or environment bypass.
// Authenticated, server-scoped response contracts must be agreed before enabling private calls.
export const privateIntegrationBlocker = "Account features are unavailable until secure sign-in, server-enforced access control and role-scoped API responses are available. No changes have been saved.";
