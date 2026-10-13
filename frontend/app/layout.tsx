import type { Metadata } from "next";
import { DemoProvider } from "@/components/demo-provider";
import { SiteShell } from "@/components/site-shell";
import { getWorkspaceBootstrap } from "@/lib/api";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "AutoNegotiater",
    description: "AI-powered automated negotiation for C2C marketplaces",
};

export default async function RootLayout({ children }: {
    children: React.ReactNode;
}) {
    const initialData = await getWorkspaceBootstrap();
    return <html lang="en" dir="ltr">
    <body>
    <DemoProvider enabled={true} products={initialData.products ?? []} initialData={initialData}>
    <SiteShell>{children}</SiteShell>
    </DemoProvider>
    </body>
    </html>;
}
