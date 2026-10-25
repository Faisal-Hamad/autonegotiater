import { NegotiationSetup } from "@/components/negotiation";
export default async function Page({ params }: {
    params: Promise<{
        id: string;
    }>;
}) { const { id } = await params; return <NegotiationSetup productId={Number(id)}/>; }
