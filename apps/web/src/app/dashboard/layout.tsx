import Link from "next/link";

const nav = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/messages", label: "Sales Activity" },
  { href: "/dashboard/slips", label: "Slip Review" },
  { href: "/dashboard/identities", label: "Identity Mapping" },
  { href: "/dashboard/statements", label: "Statements" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 border-r border-gray-800 p-4 space-y-1">
        <div className="font-bold text-lg mb-6">JoeAI</div>
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded px-3 py-2 text-sm hover:bg-gray-800"
          >
            {item.label}
          </Link>
        ))}
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
