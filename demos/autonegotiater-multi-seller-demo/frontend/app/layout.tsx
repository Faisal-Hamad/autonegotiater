import type { Metadata } from "next";
import { DemoProvider } from "@/components/demo-provider";
import { CompetitiveProvider } from "@/components/competitive-provider";
import { SiteShell } from "@/components/site-shell";
import { isMockDataEnabled } from "@/lib/api";
import "./globals.css";
export const metadata: Metadata = {
    title: "AutoNegotiater",
    description: "AI-powered automated negotiation for C2C marketplaces",
};
export default async function RootLayout({ children }: {
    children: React.ReactNode;
}) {
    const enabled = isMockDataEnabled();
    const products = enabled ? (await import("@/lib/mock-data")).mockProducts : [];
    return <html lang="en" dir="ltr">
    <body>
    <DemoProvider enabled={enabled} products={products}>
    <CompetitiveProvider><SiteShell>{children}</SiteShell></CompetitiveProvider>
    </DemoProvider>
    </body>
    </html>;
}
