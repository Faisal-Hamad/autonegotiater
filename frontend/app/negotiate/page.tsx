import { RequestSetup } from "@/components/negotiation";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: {
    searchParams: Promise<{
        products?: string;
    }>;
}) {
    const { products = "" } = await searchParams;
    const productIds = [...new Set(products.split(",").map(Number).filter(id => Number.isInteger(id) && id > 0))];
    return <RequestSetup productIds={productIds}/>;
}
