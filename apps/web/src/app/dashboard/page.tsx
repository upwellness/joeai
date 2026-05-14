export default function DashboardOverview() {
  const cards = [
    { label: "Messages Today", value: "—" },
    { label: "Slips Matched", value: "—" },
    { label: "Pending Review", value: "—" },
    { label: "Failed", value: "—" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded border border-gray-800 p-4 bg-gray-900/40"
          >
            <div className="text-xs uppercase opacity-60">{c.label}</div>
            <div className="text-3xl font-bold mt-2">{c.value}</div>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm opacity-60">
        Hook real metrics in once API is wired. See <code>/api/messages</code>{" "}
        and <code>/api/slips</code>.
      </p>
    </div>
  );
}
