import { isIsolatedDemoBuild, isMockDataEnabled } from "@/lib/api";
// Frontend-only health. Never probes bootstrap, FastAPI or any database.
export const dynamic = "force-dynamic";
export function GET() {
  const demo = isIsolatedDemoBuild();
  return Response.json({ service: "autonegotiater-frontend", status: "alive",
    mode: demo ? "demo" : "standard", mock: isMockDataEnabled(),
    privateFeatures: demo ? "demo-only" : "blocked", backendConnected: false,
    storage: demo ? "browser-local" : "unavailable", releaseReady: false },
    { headers: { "Cache-Control": "no-store" } });
}
