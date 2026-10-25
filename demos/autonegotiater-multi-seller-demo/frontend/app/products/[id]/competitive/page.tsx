import { isMockDataEnabled } from "@/lib/api";
import { CompetitiveNegotiation } from "@/components/competitive-negotiation";
import { BackendPending } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function CompetitivePage({ params }: { params: Promise<{ id: string }> }) {
    if (!isMockDataEnabled()) return <BackendPending title="Competitive negotiation is available in local Mock Data mode only" />;
    const { id } = await params;
    return <CompetitiveNegotiation productId={Number(id)} />;
}
