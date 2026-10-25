"use client";
import { useRouter } from "next/navigation";
export function CatalogError({ message }: { message: string }) {
  const router = useRouter();
  return <section className="panel empty" role="alert"><h1>Products are unavailable</h1>
    <p className="muted my-5">{message}</p><button className="btn" onClick={() => router.refresh()}>Try again</button></section>;
}
