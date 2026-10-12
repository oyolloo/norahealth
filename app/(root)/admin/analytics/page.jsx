import Link from "next/link";
import { getAnalyticsAction } from "@/actions/analytics.action";
import BarChart from "./_components/bar-chart";

export const dynamic = "force-dynamic";

const RANGE_TABS = [
  ["today", "Today"],
  ["week", "This week"],
  ["month", "This month"],
  ["year", "This year"],
  ["all", "All time"],
];

const COMPARE = {
  today: "vs same time yesterday",
  week: "vs same point last week",
  month: "vs same point last month",
  year: "vs same point last year",
};

// Categorical slots 1-3 of the validated reference palette.
const TYPE_KEYS = [
  { key: "SAME_OC", label: "Same", color: "#2a78d6" },
  { key: "DIFFERENT_OC", label: "New", color: "#eb6834" },
  { key: "MORNING_AFTER_PILL", label: "MAP", color: "#1baf7a" },
];
const single = (label) => [{ key: "total", label, color: "#2a78d6" }];

function Delta({ now, prev, range }) {
  if (prev == null)
    return <p className="mt-2 text-xs text-[var(--viz-muted)]">Since the first record</p>;
  if (prev === 0)
    return (
      <p className="mt-2 text-xs text-[var(--viz-muted)]">
        {now ? `Nothing at the ${COMPARE[range].replace("vs ", "")}` : `No change ${COMPARE[range]}`}
      </p>
    );
  const pct = Math.round(((now - prev) / prev) * 100);
  const word = pct > 0 ? "Up" : "Down";
  return (
    <p className="mt-2 text-xs text-[var(--viz-muted)]">
      <span className="font-medium text-[#0D060C]">
        {pct === 0 ? "No change" : `${word} ${Math.abs(pct)}%`}
      </span>{" "}
      ({prev}) {COMPARE[range]}
    </p>
  );
}

function Kpi({ label, block, range }) {
  return (
    <div className="rounded-2xl border border-[var(--viz-grid)] bg-white p-5">
      <p className="text-sm text-[var(--viz-muted)]">{label}</p>
      <p className="mt-1 text-[32px] leading-none font-semibold tabular-nums text-[#0D060C]">
        {block.total}
      </p>
      <Delta now={block.total} prev={block.previous} range={range} />
    </div>
  );
}

function Card({ title, subtitle, children, className = "" }) {
  return (
    <section
      className={`rounded-2xl border border-[var(--viz-grid)] bg-white p-5 min-w-0 ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#0D060C]">{title}</h3>
        {subtitle && <p className="text-xs text-[var(--viz-muted)]">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function TypeShare({ types }) {
  const sum = TYPE_KEYS.reduce((s, k) => s + types[k.key], 0);
  if (!sum)
    return <p className="text-sm text-[var(--viz-muted)]">No order requests in this period.</p>;
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
        {TYPE_KEYS.filter((k) => types[k.key]).map((k) => (
          <div
            key={k.key}
            style={{ width: `${(types[k.key] / sum) * 100}%`, background: k.color }}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-3">
        {TYPE_KEYS.map((k) => (
          <li key={k.key} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-[#3A3D42]">
              <span className="inline-block size-2.5 rounded-full" style={{ background: k.color }} />
              {k.label}
            </span>
            <span className="tabular-nums text-[#0D060C]">
              <span className="font-semibold">{types[k.key]}</span>
              <span className="ml-2 text-[var(--viz-muted)]">
                {Math.round((types[k.key] / sum) * 100)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const AnalyticsPage = async ({ searchParams }) => {
  const { range: q } = await searchParams;
  const res = await getAnalyticsAction(q || "month");

  if (!res?.success) {
    return <div className="w-full p-10">{res?.msg || "Could not load analytics."}</div>;
  }
  const { range, requests, appointments, orders, signups } = res;

  return (
    <div
      className="w-full min-w-0 p-6 md:p-10 flex flex-col gap-6"
      style={{
        "--viz-grid": "#ECE7E1",
        "--viz-axis": "#CFC7BE",
        "--viz-muted": "#6B6660",
        "--viz-faint": "#B5AEA6",
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#0D060C]">Analytics</h2>
          <p className="text-sm text-[var(--viz-muted)]">
            {res.totalPatients} patients signed up, {res.patientsWithOrder} with at least one
            medicine order
          </p>
        </div>
        <nav className="flex flex-wrap gap-1 rounded-full border border-[var(--viz-grid)] bg-white p-1">
          {RANGE_TABS.map(([key, label]) => (
            <Link
              key={key}
              href={`/admin/analytics?range=${key}`}
              className={`rounded-full px-4 py-1.5 text-sm transition ${
                key === range ? "bg-[#CE8936] text-white" : "text-[#3A3D42] hover:bg-[#F4E7E1]"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi label="Order requests" block={requests} range={range} />
        <Kpi label="Appointments booked" block={appointments} range={range} />
        <Kpi label="Medicine orders created" block={orders} range={range} />
        <Kpi label="New patient sign-ups" block={signups} range={range} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card
          title="Order requests by type"
          subtitle="One request can ask for more than one type."
          className="xl:col-span-2"
        >
          <div className="mb-3 flex flex-wrap gap-4 text-xs text-[#3A3D42]">
            {TYPE_KEYS.map((k) => (
              <span key={k.key} className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-sm" style={{ background: k.color }} />
                {k.label}
              </span>
            ))}
          </div>
          <BarChart data={requests.series} keys={TYPE_KEYS} unitLabel="Requests" height={260} />
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-[var(--viz-muted)]">Show as table</summary>
            <div className="mt-2 max-h-64 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--viz-muted)]">
                  <tr>
                    <th className="py-1">Period</th>
                    <th className="py-1 text-right">Requests</th>
                    {TYPE_KEYS.map((k) => (
                      <th key={k.key} className="py-1 text-right">
                        {k.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.series
                    .filter((s) => !s.future)
                    .map((s) => (
                      <tr key={s.tipLabel} className="border-t border-[var(--viz-grid)]">
                        <td className="py-1">{s.tipLabel}</td>
                        <td className="py-1 text-right tabular-nums">{s.total}</td>
                        {TYPE_KEYS.map((k) => (
                          <td key={k.key} className="py-1 text-right tabular-nums">
                            {s[k.key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </details>
        </Card>

        <Card title="Type share" subtitle="Same, New and MAP in this period">
          <TypeShare types={requests.types} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Appointments booked">
          <BarChart data={appointments.series} keys={single("Appointments")} height={180} />
        </Card>
        <Card title="Medicine orders created">
          <BarChart data={orders.series} keys={single("Orders")} height={180} />
        </Card>
        <Card title="New patient sign-ups">
          <BarChart data={signups.series} keys={single("Sign-ups")} height={180} />
        </Card>
      </div>

      <p className="text-xs text-[var(--viz-muted)]">All times are UK time.</p>
    </div>
  );
};

export default AnalyticsPage;
