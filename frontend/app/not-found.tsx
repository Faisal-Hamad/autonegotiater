import Link from "next/link";
export default function NotFound() {
    return <div className="panel empty">
    <p className="eyebrow">404</p>
    <h1>Page or product not found</h1>
    <p className="muted my-5">This item may not exist in the current data source.</p>
    <Link className="btn" href="/products">Back to marketplace</Link>
    </div>;
}
