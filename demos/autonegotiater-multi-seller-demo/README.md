# Isolated local frontend demo

This folder preserves the approved mock-only multi-seller prototype separately from the production frontend at repository root. No backend or production credentials are required. Dependencies use the same patched versions as the production app.

In Windows PowerShell, from this folder:

```powershell
cd frontend
npm ci
$env:USE_MOCK_DATA="true"
npm run dev -- --port 3001
```

For explicit isolated demo builds, use AUTONEG_ISOLATED_DEMO_BUILD=true as documented by the prototype's own Containerfile/configuration. Never use that artifact on the production domain. All report data in this app is DEMO / SAMPLE DATA.

Generated .env files, node_modules, .next outputs and npm caches are ignored and must not be committed. Historical requirements and audits are kept under ../../docs/integration/history; later production evidence is under ../../docs/releases.
