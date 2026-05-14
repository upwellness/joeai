import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-4xl font-bold mb-4">JoeAI</h1>
      <p className="text-lg opacity-80 mb-8">
        LINE OA Sales Intelligence &amp; Customer Payment Bot
      </p>
      <div className="space-y-3">
        <Link
          href="/login"
          className="inline-block rounded-md bg-blue-600 text-white px-4 py-2 font-medium hover:bg-blue-700"
        >
          Login
        </Link>
      </div>
      <section className="mt-16 space-y-2 text-sm opacity-70">
        <p>Status: Bootstrap scaffold — see README for setup.</p>
        <p>
          API health: <code>GET /api/health</code>
        </p>
      </section>
    </main>
  );
}
