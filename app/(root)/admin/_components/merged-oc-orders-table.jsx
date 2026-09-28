"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  LoaderIcon,
  MoreHorizontal,
  PanelLeft,
} from "lucide-react";

import { formatDate } from "@/lib/utils";
import { useAdmin } from "@/lib/adminContext";

import {
  createOrderFromBooking,
  deleteBooking,
  getAllBookingOrdersAction,
  updateBookingStatus,
} from "@/actions/booking.action";
import {
  deleteOrder,
  getAllOrdersAction,
  updateOrderStatus,
} from "@/actions/order.action";

/* ---------- expandable-row detail field ---------- */
function DetailField({ label, value }) {
  const empty =
    value === null || value === undefined || value === "" ? true : false;
  return (
    <div className="flex min-w-[110px] max-w-[260px] flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-[#0D060C] break-words">
        {empty ? <span className="text-muted-foreground">—</span> : value}
      </dd>
    </div>
  );
}

/* ---------- booking status badge (from appointment-order-table) ---------- */
function BookingStatusBadge({ value }) {
  const s = value || "Incomplete";
  if (s === "Complete")
    return <Badge className="bg-green-600 text-white">Complete</Badge>;
  if (s === "FailedEncounter")
    return <Badge className="bg-red-600 text-white">Failed Encounter</Badge>;
  if (s === "FirstCallAttempted")
    return (
      <Badge className="bg-orange-500 text-white">1st Call Attempted</Badge>
    );
  if (s === "SecondCallAttempted")
    return (
      <Badge className="bg-orange-500 text-white">2nd Call Attempted</Badge>
    );
  return <Badge className="bg-yellow-500 text-white">Incomplete</Badge>;
}

/* ---------- order status pill (from all-order-table) ---------- */
function OrderStatusPill({ status, trackingId }) {
  const base =
    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap";
  if (status === "clinicalreview")
    return (
      <span className={`${base} bg-amber-50 text-amber-700 border-amber-200`}>
        Awaiting Dispatch
      </span>
    );
  if (status === "posted")
    return (
      <span
        className={`${base} bg-blue-50 text-blue-700 border-blue-200 flex flex-col items-start`}
      >
        <span>Posted via Royal Mail</span>
        {trackingId ? <span>{`Tracking ID: ${trackingId}`}</span> : null}
      </span>
    );
  if (status === "delivered")
    return (
      <span className={`${base} bg-green-50 text-green-700 border-green-200`}>
        Delivered
      </span>
    );
  if (status === "declined")
    return (
      <span className={`${base} bg-red-50 text-red-500 border-red-200`}>
        Declined
      </span>
    );
  return (
    <span className={`${base} bg-gray-50 text-gray-700 border-gray-200`}>
      {String(status)}
    </span>
  );
}

/* ---------- appointment date + time-range cell ---------- */
function ApptDateTime({ appointment }) {
  if (!appointment) return <span className="text-muted-foreground">—</span>;
  const start = new Date(appointment);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const t = (d) =>
    d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  return (
    <span className="flex flex-col whitespace-nowrap">
      <span>{formatDate(start)}</span>
      <span className="text-xs text-muted-foreground">{`${t(start)} – ${t(end)}`}</span>
    </span>
  );
}

/* ---------- normalise both sources into one row shape ---------- */
function normaliseBooking(b) {
  return {
    _type: "booking",
    key: `booking-${b.id}`,
    id: b.id,
    fullName: b.fullName || "N/A",
    email: b.email || "N/A",
    phoneNumber: b.phoneNumber || "N/A",
    userId: b?.user?.id || null,
    appointment: b.appointment || null,
    bookingStatus: b.bookingStatus || "Incomplete",
    medicineName: null,
    trackingId: null,
    status: null,
    createdAt: b.createdAt || b.appointment || null,
    _raw: b,
  };
}

function normaliseOrder(o) {
  return {
    _type: "order",
    key: `order-${o.id}`,
    id: o.id,
    fullName: o.fullName || "N/A",
    email: o.email || "N/A",
    phoneNumber: o.phoneNumber || "N/A",
    userId: o.userId || null,
    appointment: null,
    bookingStatus: null,
    medicineName: o.medicineName || null,
    trackingId: o.trackingId || null,
    status: o.status || null,
    createdAt: o.createdAt || null,
    _raw: o,
  };
}

/**
 * Merge the two sources into ONE row per patient journey.
 *
 * A Booking (online appointment/call) and an Order (medicine dispatch) are
 * separate DB records with no direct link — both only tie to the patient.
 * So we group by patient (email, falling back to userId) and pair each
 * patient's bookings and orders chronologically: booking[0]↔order[0], etc.
 * The common case (1 booking + 1 order) collapses to a single combined row;
 * any extra unpaired booking/order stays as its own row so nothing is hidden.
 */
function pairByPatient(bookings, orders) {
  // When did each record enter the system? A booking's own createdAt (falling
  // back to its appointment day) marks when it was made; an order is always
  // created AFTER the booking it came from — admin runs "Create Order" once the
  // consultation call is done. So an order can only belong to a booking that
  // already existed when the order was made.
  const madeAt = (x) =>
    x?.createdAt
      ? new Date(x.createdAt).getTime()
      : x?.appointment
      ? new Date(x.appointment).getTime()
      : 0;
  const TOL = 60 * 1000; // 1 min grace for clock skew
  const keyOf = (r) => {
    const email = String(r.email || "").trim().toLowerCase();
    if (email && email !== "n/a") return `e:${email}`;
    if (r.userId) return `u:${r.userId}`;
    return `x:${r._type}-${r.id}`; // unique -> never merges
  };

  const groups = new Map(); // key -> { bookings, orders }
  for (const b of bookings) {
    const k = keyOf(b);
    if (!groups.has(k)) groups.set(k, { bookings: [], orders: [] });
    groups.get(k).bookings.push(b);
  }
  for (const o of orders) {
    const k = keyOf(o);
    if (!groups.has(k)) groups.set(k, { bookings: [], orders: [] });
    groups.get(k).orders.push(o);
  }

  const rows = [];
  for (const [k, g] of groups) {
    const bs = [...g.bookings].sort((a, b) => madeAt(a) - madeAt(b)); // oldest first
    const os = [...g.orders].sort((a, b) => madeAt(a) - madeAt(b));

    // Greedy time-aware pairing (replaces blind booking[i]↔order[i] by index,
    // which glued a brand-new appointment to a patient's OLD order — issue
    // #655/#333). For each order, oldest first, grab the LATEST still-free
    // booking that was created at/before the order. A booking made AFTER an
    // order is never eligible for it, so a fresh appointment keeps its own date
    // and shows no order (—) until its own order is created.
    const usedBooking = new Set();
    const pairs = []; // { booking, order }

    for (const o of os) {
      let best = null;
      let bestIdx = -1;
      for (let i = 0; i < bs.length; i++) {
        if (usedBooking.has(i)) continue;
        if (madeAt(bs[i]) <= madeAt(o) + TOL) {
          // eligible; keep the one closest before the order
          if (!best || madeAt(bs[i]) >= madeAt(best)) {
            best = bs[i];
            bestIdx = i;
          }
        }
      }
      if (bestIdx >= 0) usedBooking.add(bestIdx);
      pairs.push({ booking: best, order: o });
    }

    // Bookings with no order yet (e.g. a fresh appointment awaiting its order)
    // stay on their own row so nothing is hidden.
    for (let i = 0; i < bs.length; i++) {
      if (!usedBooking.has(i)) pairs.push({ booking: bs[i], order: null });
    }

    pairs.forEach((p, i) => {
      const primary = p.booking || p.order;
      rows.push({
        key: `${k}-${i}`,
        booking: p.booking,
        order: p.order,
        fullName: primary.fullName,
        email: primary.email,
        phoneNumber: primary.phoneNumber,
        userId: primary.userId,
        appointment: p.booking?.appointment || null,
        createdAt: Math.max(madeAt(p.booking), madeAt(p.order)), // most recent activity
      });
    });
  }
  return rows;
}

const PAGE_SIZE = 10;

export default function MergedOcOrdersTable() {
  const { setMenuOpen } = useAdmin();

  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [callStatusFilter, setCallStatusFilter] = useState("ALL");
  const [orderStatusFilter, setOrderStatusFilter] = useState("ALL");
  const [nameSearch, setNameSearch] = useState("");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [expanded, setExpanded] = useState(() => new Set()); // expanded row keys

  const toggleExpanded = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // ----- Create Order dialog (booking rows) -----
  const [orderOpen, setOrderOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [medicineName, setMedicineName] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [createStatus, setCreateStatus] = useState("clinicalreview");
  const [creatingOrder, setCreatingOrder] = useState(false);

  // ----- Update Booking Status dialog (booking rows) -----
  const [bStatusOpen, setBStatusOpen] = useState(false);
  const [selectedForBStatus, setSelectedForBStatus] = useState(null);
  const [bookingStatus, setBookingStatus] = useState("Incomplete");
  const [updatingBStatus, setUpdatingBStatus] = useState(false);

  // ----- Update Order Status dialog (order rows) -----
  const [oStatusOpen, setOStatusOpen] = useState(false);
  const [selectedForOStatus, setSelectedForOStatus] = useState(null);
  const [orderStatus, setOrderStatus] = useState("");
  const [orderTrackingId, setOrderTrackingId] = useState("");
  const [updatingOStatus, setUpdatingOStatus] = useState(false);

  // ----- Delete dialog (both) -----
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // {_type, id}
  const [deleting, setDeleting] = useState(false);

  async function fetchAll() {
    setLoading(true);
    try {
      const [bookingRes, orderRes] = await Promise.all([
        getAllBookingOrdersAction({
          year: year || undefined,
          month: month || undefined,
          day: day || undefined,
        }),
        // Pull all orders for a client-side merge (admin sets are small).
        getAllOrdersAction({
          year: year || undefined,
          month: month || undefined,
          day: day || undefined,
          page: 0,
          pageSize: 5000,
        }),
      ]);

      const bookings = (bookingRes?.bookings || []).map(normaliseBooking);
      const orders = (orderRes?.orders || []).map(normaliseOrder);

      // One combined row per patient journey (booking + its order).
      // Rank each row by its "activity day": the appointment day when there
      // is one, otherwise the created day (so an order-only row — created
      // directly via "Create Order" with no appointment — is still placed by
      // its date instead of being dumped at the very bottom). Fully newest
      // first: newest day at the top, and within a day the latest appointment
      // time slot first; order-only rows fall to the day's bottom by most
      // recent activity.
      const dayOf = (d) => {
        const x = new Date(d);
        return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
      };
      const minsOf = (d) => {
        const x = new Date(d);
        return x.getUTCHours() * 60 + x.getUTCMinutes();
      };
      const activityMs = (r) =>
        r.appointment ? new Date(r.appointment).getTime() : r.createdAt || 0;
      const combined = pairByPatient(bookings, orders).sort((a, b) => {
        const da = a.appointment || a.createdAt ? dayOf(activityMs(a)) : -Infinity;
        const db = b.appointment || b.createdAt ? dayOf(activityMs(b)) : -Infinity;
        if (db !== da) return db - da; // newest day first
        const ta = a.appointment ? minsOf(a.appointment) : -Infinity;
        const tb = b.appointment ? minsOf(b.appointment) : -Infinity;
        if (ta !== tb) return tb - ta; // latest appointment slot first within the day
        return (b.createdAt || 0) - (a.createdAt || 0); // then newest activity
      });

      setRows(combined);
      setPageIndex(0);
    } catch (err) {
      console.error(err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, day]);

  // Client-side type + name filtering on top of the merged set.
  const filtered = useMemo(() => {
    const q = nameSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (
        callStatusFilter !== "ALL" &&
        (!r.booking || r.booking.bookingStatus !== callStatusFilter)
      )
        return false;
      if (
        orderStatusFilter !== "ALL" &&
        (!r.order || r.order.status !== orderStatusFilter)
      )
        return false;
      if (q && !String(r.fullName).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, callStatusFilter, orderStatusFilter, nameSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const pageRows = filtered.slice(
    safePageIndex * PAGE_SIZE,
    safePageIndex * PAGE_SIZE + PAGE_SIZE,
  );

  useEffect(() => {
    setPageIndex(0);
  }, [callStatusFilter, orderStatusFilter, nameSearch]);

  // ----- filter option lists -----
  const now = new Date();
  const currentYear = now.getFullYear();
  const yearOptions = (() => {
    const s = new Set([currentYear, currentYear + 1]);
    for (let y = 2024; y <= currentYear + 1; y++) s.add(y);
    return Array.from(s).sort((a, b) => a - b);
  })();
  const months = [
    { id: 1, label: "Jan" },
    { id: 2, label: "Feb" },
    { id: 3, label: "Mar" },
    { id: 4, label: "Apr" },
    { id: 5, label: "May" },
    { id: 6, label: "Jun" },
    { id: 7, label: "Jul" },
    { id: 8, label: "Aug" },
    { id: 9, label: "Sep" },
    { id: 10, label: "Oct" },
    { id: 11, label: "Nov" },
    { id: 12, label: "Dec" },
  ];
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const COLSPAN = 6; // primary cols: Name, Phone, Appt, Call Status, Order Status, Actions

  return (
    <div className="w-full p-6 overflow-x-auto">
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => setMenuOpen(true)}
          className="lg:hidden w-[40px] h-[40px] bg-[#d67b0e] text-white flex justify-center items-center rounded-full"
        >
          <PanelLeft />
        </button>
        <h2 className="text-xl font-semibold">OC Orders</h2>
        <Badge variant="outline" className="ml-1">
          {filtered.length}
        </Badge>
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Year</label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[120px] bg-white/40">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Month</label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[120px] bg-white/40">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Day</label>
          <Select value={day} onValueChange={setDay}>
            <SelectTrigger className="w-[80px] bg-white/40">
              <SelectValue placeholder="Day" />
            </SelectTrigger>
            <SelectContent>
              {days.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Call Status</label>
          <Select value={callStatusFilter} onValueChange={setCallStatusFilter}>
            <SelectTrigger className="w-[170px] bg-white/40">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="Incomplete">Incomplete</SelectItem>
              <SelectItem value="FirstCallAttempted">
                1st Call Attempted
              </SelectItem>
              <SelectItem value="SecondCallAttempted">
                2nd Call Attempted
              </SelectItem>
              <SelectItem value="Complete">Complete</SelectItem>
              <SelectItem value="FailedEncounter">Failed Encounter</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">
            Order Status
          </label>
          <Select
            value={orderStatusFilter}
            onValueChange={setOrderStatusFilter}
          >
            <SelectTrigger className="w-[170px] bg-white/40">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="clinicalreview">Awaiting Dispatch</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto">
          <Button
            variant="outline"
            onClick={() => {
              setYear("");
              setMonth("");
              setDay("");
              setCallStatusFilter("ALL");
              setOrderStatusFilter("ALL");
              setNameSearch("");
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* SEARCH */}
      <div className="flex items-center py-4 w-full max-w-sm">
        <input
          value={nameSearch}
          onChange={(e) => setNameSearch(e.target.value)}
          placeholder="Search by patient name..."
          className="w-[260px] bg-white/40 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200"
        />
      </div>

      {/* TABLE */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Contact Number</TableHead>
              <TableHead>Appointment Time</TableHead>
              <TableHead>Call Status</TableHead>
              <TableHead>Order Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={COLSPAN} className="h-24 text-center">
                  <div className="flex h-[30vh] w-full items-center justify-center">
                    <LoaderIcon
                      role="status"
                      aria-label="Loading"
                      className="size-5 animate-spin"
                    />
                  </div>
                </TableCell>
              </TableRow>
            ) : pageRows.length ? (
              pageRows.map((r) => {
                const isOpen = expanded.has(r.key);
                return (
                  <React.Fragment key={r.key}>
                    {/* PRIMARY ROW — essential columns only */}
                    <TableRow
                      className="cursor-pointer"
                      data-state={isOpen ? "selected" : undefined}
                      onClick={() => toggleExpanded(r.key)}
                    >
                      <TableCell>
                        {r.userId ? (
                          <Link
                            href={`/admin/${r.userId}/orders`}
                            className="font-medium hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {r.fullName}
                          </Link>
                        ) : (
                          <span className="font-medium">{r.fullName}</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.phoneNumber}
                      </TableCell>
                      <TableCell>
                        <ApptDateTime appointment={r.appointment} />
                      </TableCell>
                      <TableCell>
                        {r.booking ? (
                          <BookingStatusBadge value={r.booking.bookingStatus} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.order ? (
                          <OrderStatusPill
                            status={r.order.status}
                            trackingId={r.order.trackingId}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RowActions
                          row={r}
                          onCreateOrder={(b) => {
                            setSelectedBooking(b);
                            setMedicineName("");
                            setTrackingId("");
                            setCreateStatus("clinicalreview");
                            setOrderOpen(true);
                          }}
                          onUpdateBookingStatus={(b) => {
                            setSelectedForBStatus(b);
                            setBookingStatus(b.bookingStatus || "Incomplete");
                            setBStatusOpen(true);
                          }}
                          onUpdateOrderStatus={(o) => {
                            setSelectedForOStatus(o);
                            setOrderStatus(o.status || "");
                            setOrderTrackingId(o.trackingId || "");
                            setOStatusOpen(true);
                          }}
                          onDelete={(target) => {
                            setDeleteTarget(target);
                            setDeleteOpen(true);
                          }}
                        />
                      </TableCell>
                    </TableRow>

                    {/* DETAIL ROW — hidden until expanded */}
                    {isOpen && (
                      <TableRow className="bg-[#faf9f8] hover:bg-[#faf9f8]">
                        <TableCell colSpan={COLSPAN} className="p-0">
                          <dl className="flex flex-wrap gap-x-10 gap-y-3 px-6 py-4">
                            {r.booking && (
                              <DetailField
                                label="Appointment ID"
                                value={r.booking.id}
                              />
                            )}
                            {r.order && (
                              <DetailField label="Order ID" value={r.order.id} />
                            )}
                            <DetailField label="Email" value={r.email} />
                            <DetailField
                              label="Medicine"
                              value={r.order?.medicineName}
                            />
                            <DetailField
                              label="Tracking ID"
                              value={r.order?.trackingId}
                            />
                            <DetailField
                              label="Created"
                              value={
                                r.createdAt
                                  ? formatDate(new Date(r.createdAt))
                                  : null
                              }
                            />
                          </dl>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={COLSPAN} className="text-center h-24">
                  No records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* PAGINATION */}
      <div className="flex items-center justify-end gap-3 py-4">
        <Button
          variant="outline"
          size="sm"
          disabled={safePageIndex === 0}
          onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
        >
          Previous
        </Button>
        <div className="text-sm text-muted-foreground">
          Page {safePageIndex + 1} of {totalPages} ({filtered.length} total)
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={safePageIndex + 1 >= totalPages}
          onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
        >
          Next
        </Button>
      </div>

      {/* CREATE ORDER DIALOG (booking) */}
      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Order</DialogTitle>
            <DialogDescription>
              Create an order from this appointment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Medicine Name</label>
              <Input
                placeholder="Insert Medicine Name"
                value={medicineName}
                onChange={(e) => setMedicineName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Tracking ID</label>
              <Input
                placeholder="EX: #XH45333A4825NR"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Order Status</label>
              <Select value={createStatus} onValueChange={setCreateStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clinicalreview">
                    Awaiting Dispatch
                  </SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#d18a2d] hover:bg-[#b97622]"
              disabled={creatingOrder}
              onClick={async () => {
                if (creatingOrder) return;
                if (!medicineName?.trim())
                  return toast.error("Medicine Name is required");
                try {
                  setCreatingOrder(true);
                  const res = await createOrderFromBooking({
                    bookingId: selectedBooking.id,
                    medicineName: medicineName.trim(),
                    trackingId: trackingId.trim(),
                    status: createStatus,
                  });
                  if (res?.success) {
                    toast.success(res?.message || "Order created successfully");
                    setOrderOpen(false);
                    await fetchAll();
                  } else {
                    toast.error(res?.message || "Failed");
                  }
                } finally {
                  setCreatingOrder(false);
                }
              }}
            >
              {creatingOrder ? (
                <span className="flex items-center gap-2">
                  <LoaderIcon className="size-4 animate-spin" />
                  Creating...
                </span>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UPDATE BOOKING STATUS DIALOG */}
      <Dialog open={bStatusOpen} onOpenChange={setBStatusOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Booking Status</DialogTitle>
            <DialogDescription>
              Mark this request as Incomplete, 1st/2nd Call Attempted, Complete,
              or Failed Encounter.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={bookingStatus} onValueChange={setBookingStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Incomplete">Incomplete</SelectItem>
                  <SelectItem value="FirstCallAttempted">
                    1st Call Attempted
                  </SelectItem>
                  <SelectItem value="SecondCallAttempted">
                    2nd Call Attempted
                  </SelectItem>
                  <SelectItem value="Complete">Complete</SelectItem>
                  <SelectItem value="FailedEncounter">
                    Failed Encounter
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBStatusOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-theme"
              disabled={updatingBStatus}
              onClick={async () => {
                if (!selectedForBStatus?.id) return;
                try {
                  setUpdatingBStatus(true);
                  const res = await updateBookingStatus({
                    bookingId: selectedForBStatus.id,
                    bookingStatus,
                  });
                  if (res?.success) {
                    toast.success(res?.msg || "Status updated");
                    setBStatusOpen(false);
                    await fetchAll();
                  } else {
                    toast.error(res?.msg || "Update failed");
                  }
                } finally {
                  setUpdatingBStatus(false);
                }
              }}
            >
              {updatingBStatus ? (
                <span className="flex items-center gap-2">
                  <LoaderIcon className="size-4 animate-spin" />
                  Updating...
                </span>
              ) : (
                "Update"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UPDATE ORDER STATUS DIALOG */}
      <Dialog open={oStatusOpen} onOpenChange={setOStatusOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block font-medium">Tracking ID</label>
              <Input
                type="text"
                value={orderTrackingId}
                placeholder="Enter tracking id"
                onChange={(e) => setOrderTrackingId(e.target.value)}
              />
            </div>
            <Select value={orderStatus} onValueChange={setOrderStatus}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clinicalreview">Awaiting Dispatch</SelectItem>
                <SelectItem value="posted">Posted via Royal Mail</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOStatusOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-theme"
              disabled={updatingOStatus}
              onClick={async () => {
                if (!selectedForOStatus?.id) return;
                try {
                  setUpdatingOStatus(true);
                  const fd = new FormData();
                  fd.set("orderId", String(selectedForOStatus.id));
                  fd.set("trackingId", orderTrackingId || "");
                  fd.set("status", orderStatus || "");
                  const res = await updateOrderStatus(null, fd);
                  if (res?.success) {
                    toast.success(res?.msg || "Updated");
                    setOStatusOpen(false);
                    await fetchAll();
                  } else {
                    toast.error(res?.msg || "Update failed");
                  }
                } finally {
                  setUpdatingOStatus(false);
                }
              }}
            >
              {updatingOStatus ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRM (both) */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this{" "}
              {deleteTarget?._type === "booking" ? "appointment" : "order"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteTarget) return;
                try {
                  setDeleting(true);
                  let res;
                  if (deleteTarget._type === "booking") {
                    res = await deleteBooking({ bookingId: deleteTarget.id });
                  } else {
                    // deleteOrder reads orderId from FormData, not an object.
                    const fd = new FormData();
                    fd.set("orderId", String(deleteTarget.id));
                    res = await deleteOrder(fd);
                  }
                  if (res?.success) {
                    toast.success(res?.message || res?.msg || "Deleted");
                    setDeleteOpen(false);
                    setDeleteTarget(null);
                    await fetchAll();
                  } else {
                    toast.error(res?.message || res?.msg || "Delete failed");
                  }
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------- per-row actions menu (combined booking + order) ---------- */
function RowActions({
  row,
  onCreateOrder,
  onUpdateBookingStatus,
  onUpdateOrderStatus,
  onDelete,
}) {
  const { booking, order } = row;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>

        {booking && (
          <>
            {!order && (
              <DropdownMenuItem onClick={() => onCreateOrder(booking)}>
                Create Order
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onUpdateBookingStatus(booking)}>
              Update Call Status
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/admin/appointments-order/${booking.id}`}>
                View Appointment
              </Link>
            </DropdownMenuItem>
          </>
        )}

        {order && (
          <>
            <DropdownMenuItem onClick={() => onUpdateOrderStatus(order)}>
              Update Order Status
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/admin/orders/${order.id}`}>View Order</Link>
            </DropdownMenuItem>
          </>
        )}

        {booking && (
          <DropdownMenuItem
            className="text-red-600"
            onClick={() => onDelete({ _type: "booking", id: booking.id })}
          >
            Delete Appointment
          </DropdownMenuItem>
        )}
        {order && (
          <DropdownMenuItem
            className="text-red-600"
            onClick={() => onDelete({ _type: "order", id: order.id })}
          >
            Delete Order
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
