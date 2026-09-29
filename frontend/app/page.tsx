import Link from "next/link";

export default function Home() {
  return (
    <section className="py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Let an AI agent negotiate for you</h1>
      <p className="mx-auto mt-4 max-w-xl text-slate-600">
        Set your limits once. AutoNegotiater handles offers and counteroffers on price, warranty and delivery,
        and nothing is final until you approve it.
      </p>
      <Link
        href="/products"
        className="mt-8 inline-block rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700"
      >
        Browse products
      </Link>
    </section>
  );
}
