"use client";
export default function ErrorPage({ reset }: {
    error: Error;
    reset: () => void;
}) {
    return <div role="alert" className="panel empty">
    <h1>We couldn't load this page</h1>
    <p className="muted my-5">Check your connection and API configuration. Local Mock Data must be enabled to use the simulation without FastAPI.</p>
    <button className="btn" onClick={reset}>Try again</button>
    </div>;
}
