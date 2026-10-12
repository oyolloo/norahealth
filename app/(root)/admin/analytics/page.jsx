import { getAnalyticsAction } from "@/actions/analytics.action";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const PERIODS = [
  ["today", "Today"],
  ["week", "This week (from Monday)"],
  ["month", "This month"],
];

function Tile({ label, value, hint }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-[#0D060C]">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const AnalyticsPage = async () => {
  const res = await getAnalyticsAction();

  if (!res?.success) {
    return <div className="w-full p-10">{res?.msg || "Could not load analytics."}</div>;
  }

  return (
    <div className="w-full p-10 flex flex-col gap-6">
      <h2 className="text-xl font-semibold">Analytics</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Tile label="Patients signed up" value={res.totalPatients} />
        <Tile
          label="Patients with at least one order"
          value={res.patientsWithOrder}
          hint="A medicine order has been created for them"
        />
        <Tile
          label="Order requests, all time"
          value={res.totalRequests}
          hint="Submitted through Order Now"
        />
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Order requests</TableHead>
              <TableHead className="text-right">Same</TableHead>
              <TableHead className="text-right">New</TableHead>
              <TableHead className="text-right">MAP</TableHead>
              <TableHead className="text-right">Medicine orders created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PERIODS.map(([key, label]) => {
              const r = res.requests[key];
              return (
                <TableRow key={key}>
                  <TableCell className="font-medium">{label}</TableCell>
                  <TableCell className="text-right">{r.total}</TableCell>
                  <TableCell className="text-right">{r.SAME_OC}</TableCell>
                  <TableCell className="text-right">{r.DIFFERENT_OC}</TableCell>
                  <TableCell className="text-right">{r.MORNING_AFTER_PILL}</TableCell>
                  <TableCell className="text-right">{res.medicineOrders[key]}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        One request can ask for more than one type, so Same, New and MAP can add
        up to more than the request total. Days are counted in UTC.
      </p>
    </div>
  );
};

export default AnalyticsPage;
