import { apiErrorMessage, getProduct, isMockDataEnabled } from "@/lib/api";
import { ProductDetails } from "@/components/products";
import { CatalogError } from "@/components/catalog-error";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page({ params }: {
    params: Promise<{
        id: string;
    }>;
}) { const { id } = await params; if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)))
    notFound(); let product; try { product = await getProduct(Number(id)); } catch (error) { return <CatalogError message={apiErrorMessage(error)}/>; } if (!product) {
    if (isMockDataEnabled()) {
        const { LocalProductDetails } = await import("@/components/demo-pages");
        return <LocalProductDetails id={Number(id)}/>;
    }
    notFound();
} return <ProductDetails product={product}/>; }
