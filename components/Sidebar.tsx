import Link from "next/link";

const nav = [
  { href: "/", label: "Executive Overview" },
  { href: "/diagnostics", label: "Why / Why Not" },
  { href: "/planning", label: "Next Quarter Forecast" },
  { href: "/actions", label: "Action Center" },
  { href: "/slices", label: "Matrix Drilldown" },
  { href: "/accounts", label: "Accounts" },
];

export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 border-r border-slate-700 bg-slate-900 p-4">
      <div className="mb-6 border-b border-slate-700 pb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">COO Ops Cockpit</p>
        <p className="mt-2 text-lg font-semibold text-slate-100">Operations Dashboard</p>
      </div>
      <nav className="space-y-1">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-md px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
