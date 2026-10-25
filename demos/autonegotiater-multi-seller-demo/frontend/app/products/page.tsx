import { apiErrorMessage, getProducts } from "@/lib/api";
import { ProductCatalog } from "@/components/products";
import { CatalogError } from "@/components/catalog-error";
export const dynamic = "force-dynamic";
export default async function ProductsPage() {
  try { return <ProductCatalog products={await getProducts()}/>; }
  catch (error) { return <CatalogError message={apiErrorMessage(error)}/>; }
}
