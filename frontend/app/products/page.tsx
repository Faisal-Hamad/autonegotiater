import { getProducts } from "@/lib/api";
import { ProductCatalog } from "@/components/products";
export const dynamic = "force-dynamic";
export default async function ProductsPage() { return <ProductCatalog products={await getProducts()}/>; }
