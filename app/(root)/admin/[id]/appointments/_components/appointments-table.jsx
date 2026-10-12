"use client";

import { PanelLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdmin } from "@/lib/adminContext";
import { formatDate, formatShortDate, getFullName } from "@/lib/utils";
import { ocTypeLabel } from "@/lib/ocType";
import AdminNavigation from "../../_components/admin-navigation";

const OC_TEXT = {
  SAME_OC: "I would like to order a pill which I am currently taking",
  DIFFERENT_OC: "I would like to start a new type of pill",
  MORNING_AFTER_PILL: "I would like the Morning After Pill (aka Plan B)",
};

function StatusBadge({ value }) {
  const s = value || "Incomplete";
  if (s === "Complete")
    return <Badge className="bg-green-600 text-white">Complete</Badge>;
  if (s === "FailedEncounter")
    return <Badge className="bg-red-600 text-white">Failed Encounter</Badge>;
  if (s === "FirstCallAttempted")
    return <Badge className="bg-orange-500 text-white">1st Call Attempted</Badge>;
  if (s === "SecondCallAttempted")
    return <Badge className="bg-orange-500 text-white">2nd Call Attempted</Badge>;
  return <Badge className="bg-yellow-500 text-white">Incomplete</Badge>;
}

// Appointment times are stored as wall-clock values in UTC.
function apptTime(b) {
  if (b.slot?.startTime && b.slot?.endTime)
    return `${b.slot.startTime} – ${b.slot.endTime}`;
  if (!b.appointment) return "—";
  const start = new Date(b.appointment);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const t = (d) =>
    d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  return `${t(start)} – ${t(end)}`;
}

export function AppointmentsTable({ userId, user, bookings, error }) {
  const { setMenuOpen } = useAdmin();
  const now = Date.now();

  return (
    <div className="w-full p-10">
      <div className="flex items-center gap-4 mb-4">
        <AdminNavigation userId={userId} />
      </div>
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => setMenuOpen(true)}
          className="lg:hidden w-[40px] h-[40px] bg-[#d67b0e] text-white flex justify-center items-center rounded-full"
        >
          <PanelLeft />
        </button>
        <h2 className="text-xl font-semibold">
          Appointments of {getFullName(user)}
        </h2>
        <p className="text-sm text-muted-foreground">
          Date of Birth: {formatShortDate(user?.account?.dob)}
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Appointment Date</TableHead>
              <TableHead>Appointment Time</TableHead>
              <TableHead>OC Requested</TableHead>
              <TableHead>Contact Number</TableHead>
              <TableHead>Appointment Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  {error}
                </TableCell>
              </TableRow>
            ) : bookings.length ? (
              bookings.map((b) => {
                const upcoming =
                  b.appointment && new Date(b.appointment).getTime() > now;
                const requested = (b.ocRequest || [])
                  .map((k) => OC_TEXT[k])
                  .filter(Boolean);
                return (
                  <TableRow key={b.id}>
                    <TableCell className="whitespace-nowrap">
                      {b.appointment ? formatDate(new Date(b.appointment)) : "—"}
                      {upcoming && (
                        <Badge variant="outline" className="ml-2">
                          Upcoming
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {apptTime(b)}
                    </TableCell>
                    <TableCell className="whitespace-normal max-w-[320px]">
                      {requested.length ? (
                        <>
                          <span className="font-medium">
                            {ocTypeLabel(b.ocRequest)}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {requested.join("; ")}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {b.phoneNumber || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={b.bookingStatus} />
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No appointments found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
