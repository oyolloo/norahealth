"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MoreHorizontal, PanelLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { deleteBooking } from "@/actions/booking.action";
import { FutureApptDialog } from "../../orders/_components/future-appt-cell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { BookingStatusInline, OrderStatusInline } from "../../_components/inline-status";
import { CreateAppointmentForm } from "./create-appointment-form";

const OC_TEXT = {
  SAME_OC: "I would like to order a pill which I am currently taking",
  DIFFERENT_OC: "I would like to start a new type of pill",
  MORNING_AFTER_PILL: "I would like the Morning After Pill (aka Plan B)",
};

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

// Current UK wall-clock time expressed the same way appointments are stored.
function ukNowAsUtc() {
  const s = new Date().toLocaleString("sv-SE", { timeZone: "Europe/London" });
  return Date.parse(s.replace(" ", "T") + "Z");
}

export function AppointmentsTable({
  userId,
  user,
  bookings = [],
  orders = [],
  error,
  embedded = false,
}) {
  const { setMenuOpen } = useAdmin();
  const router = useRouter();
  const now = ukNowAsUtc();

  const [editingReview, setEditingReview] = useState(null);
  const [cancellingReview, setCancellingReview] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  async function handleConfirmCancelReview() {
    if (!cancellingReview) return;
    try {
      setCancelling(true);
      const res = await deleteBooking({ bookingId: cancellingReview.id });
      if (res?.success) {
        toast.success("Future review cancelled.");
        setCancellingReview(null);
        router.refresh();
      } else {
        toast.error(res?.msg || "Failed to cancel review.");
      }
    } catch (err) {
      console.error("Cancel review error:", err);
      toast.error("Failed to cancel review.");
    } finally {
      setCancelling(false);
    }
  }

  const [apptWindow, setApptWindow] = useState("ALL");
  const [columnVisibility, setColumnVisibility] = useState({
    date: true,
    time: true,
    ocRequest: true,
    phone: true,
    status: true,
    orderStatus: true,
  });

  const columns = [
    { id: "date", label: "Appointment Date" },
    { id: "time", label: "Appointment Time" },
    { id: "ocRequest", label: "OC Requested" },
    { id: "phone", label: "Contact Number" },
    { id: "status", label: "Call Status" },
    { id: "orderStatus", label: "Order Status" },
  ];

  // Map each booking to its corresponding order (direct link or greedy chronological pairing matching OC Orders)
  const bookingOrderMap = useMemo(() => {
    const map = new Map();
    for (const b of bookings) {
      if (b.order?.id) {
        map.set(b.id, b.order);
      } else if (b.orderId) {
        const o = (orders || []).find((ord) => ord.id === b.orderId);
        if (o) map.set(b.id, o);
      }
    }

    const madeAt = (x) =>
      x?.createdAt
        ? new Date(x.createdAt).getTime()
        : x?.appointment
        ? new Date(x.appointment).getTime()
        : 0;
    const TOL = 60 * 1000;

    const bs = [...bookings]
      .filter((b) => !map.has(b.id) && b.bookingType !== "Review")
      .sort((a, b) => madeAt(a) - madeAt(b));

    const alreadyPairedOrderIds = new Set(
      Array.from(map.values()).map((o) => o.id)
    );
    const os = [...(orders || [])]
      .filter((o) => !alreadyPairedOrderIds.has(o.id))
      .sort((a, b) => madeAt(a) - madeAt(b));

    const usedBooking = new Set();
    for (const o of os) {
      let best = null;
      let bestIdx = -1;
      for (let i = 0; i < bs.length; i++) {
        if (usedBooking.has(i)) continue;
        if (madeAt(bs[i]) <= madeAt(o) + TOL) {
          if (!best || madeAt(bs[i]) >= madeAt(best)) {
            best = bs[i];
            bestIdx = i;
          }
        }
      }
      if (bestIdx >= 0) {
        usedBooking.add(bestIdx);
        map.set(best.id, o);
      }
    }

    return map;
  }, [bookings, orders]);

  const filteredBookings = useMemo(() => {
    const londonDay = (d) =>
      new Date(d).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    const addDaysYMD = (ymd, n) => {
      const [y, m, d] = ymd.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
    };
    const today = londonDay(Date.now());
    const nowTime = Date.now();

    return (bookings || []).filter((b) => {
      if (apptWindow === "missed" && b.bookingStatus !== "FailedEncounter")
        return false;
      if (
        apptWindow === "today" &&
        b.appointment &&
        londonDay(b.appointment) > today
      )
        return false;
      if (
        apptWindow === "next3" &&
        b.appointment &&
        londonDay(b.appointment) > addDaysYMD(today, 3)
      )
        return false;
      if (
        apptWindow === "next7" &&
        b.appointment &&
        londonDay(b.appointment) > addDaysYMD(today, 7)
      )
        return false;
      if (
        apptWindow === "upcoming" &&
        !(
          b.appointment &&
          (londonDay(b.appointment) >= today ||
            new Date(b.appointment).getTime() > nowTime)
        )
      )
        return false;
      return true;
    });
  }, [bookings, apptWindow]);

  const visibleCount =
    (Object.values(columnVisibility).filter(Boolean).length || 1) + 1;

  return (
    <div className={embedded ? "w-full" : "w-full p-10"}>
      {embedded ? (
        <h2 className="text-xl font-semibold">Appointments</h2>
      ) : (
        <>
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
        </>
      )}

      {/* TOOLBAR: Create Appointment + Appointment Window + Columns Dropdown */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <CreateAppointmentForm userId={userId} user={user} />
          <Select value={apptWindow} onValueChange={setApptWindow}>
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="Appointment Window" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="next3">Next 3 days</SelectItem>
              <SelectItem value="next7">Next 7 days</SelectItem>
              <SelectItem value="missed">Missed call</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columns <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {columns.map((col) => (
              <DropdownMenuCheckboxItem
                key={col.id}
                className="capitalize"
                checked={columnVisibility[col.id]}
                onCheckedChange={(val) =>
                  setColumnVisibility((prev) => ({ ...prev, [col.id]: !!val }))
                }
              >
                {col.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columnVisibility.date && (
                <TableHead>Appointment Date</TableHead>
              )}
              {columnVisibility.time && (
                <TableHead>Appointment Time</TableHead>
              )}
              {columnVisibility.ocRequest && (
                <TableHead>OC Requested</TableHead>
              )}
              {columnVisibility.phone && (
                <TableHead>Contact Number</TableHead>
              )}
              {columnVisibility.status && (
                <TableHead>Call Status</TableHead>
              )}
              {columnVisibility.orderStatus && (
                <TableHead>Order Status</TableHead>
              )}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={visibleCount} className="h-24 text-center">
                  {error}
                </TableCell>
              </TableRow>
            ) : filteredBookings.length ? (
              filteredBookings.map((b) => {
                const upcoming =
                  b.appointment && new Date(b.appointment).getTime() > now;
                const requested = (b.ocRequest || [])
                  .map((k) => OC_TEXT[k])
                  .filter(Boolean);
                return (
                  <TableRow key={b.id}>
                    {columnVisibility.date && (
                      <TableCell className="whitespace-nowrap">
                        {b.bookingType === "Review" ? (
                          <button
                            type="button"
                            onClick={() => setEditingReview(b)}
                            className="inline-flex items-center gap-1.5 hover:underline font-medium text-left"
                            title="Change review date/time"
                          >
                            <span>
                              {b.appointment
                                ? formatDate(new Date(b.appointment))
                                : "—"}
                            </span>
                            <Pencil className="size-3 text-[#2B5DA8]" />
                            <Badge className="ml-1 bg-[#E6F4EC] text-[#1F7A4D] border-[#B7E1CD] hover:bg-[#E6F4EC]">
                              Review
                            </Badge>
                          </button>
                        ) : (
                          <>
                            {b.appointment
                              ? formatDate(new Date(b.appointment))
                              : "—"}
                            {upcoming ? (
                              <Badge variant="outline" className="ml-2">
                                Upcoming
                              </Badge>
                            ) : null}
                          </>
                        )}
                      </TableCell>
                    )}
                    {columnVisibility.time && (
                      <TableCell className="whitespace-nowrap">
                        {apptTime(b)}
                      </TableCell>
                    )}
                    {columnVisibility.ocRequest && (
                      <TableCell className="whitespace-normal max-w-[320px]">
                        {b.bookingType === "Review" ? (
                          <>
                            <span className="font-medium text-[#1F7A4D]">
                              Review (Follow-up)
                            </span>
                            {b.notes ? (
                              <span className="block text-xs text-muted-foreground">
                                {b.notes}
                              </span>
                            ) : null}
                          </>
                        ) : requested.length ? (
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
                    )}
                    {columnVisibility.phone && (
                      <TableCell className="whitespace-nowrap">
                        {b.phoneNumber || "—"}
                      </TableCell>
                    )}
                    {columnVisibility.status && (
                      <TableCell>
                        <BookingStatusInline booking={b} />
                      </TableCell>
                    )}
                    {columnVisibility.orderStatus && (
                      <TableCell>
                        {bookingOrderMap.get(b.id) ? (
                          <OrderStatusInline order={bookingOrderMap.get(b.id)} />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right whitespace-nowrap">
                      {b.bookingType === "Review" ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingReview(b)}>
                              <Pencil className="mr-2 size-4 text-[#2B5DA8]" />
                              Change review
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-700 focus:bg-red-50"
                              onClick={() => setCancellingReview(b)}
                            >
                              <Trash2 className="mr-2 size-4 text-red-600" />
                              Cancel review
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={visibleCount} className="h-24 text-center">
                  No appointments found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {editingReview ? (
        <FutureApptDialog
          order={{
            id: editingReview.order?.id || editingReview.orderId,
            futureApptAt:
              editingReview.order?.futureApptAt ||
              editingReview.appointment,
            futureApptDays: editingReview.order?.futureApptDays,
            futureApptTime: editingReview.order?.futureApptTime,
            appointment: editingReview.appointment,
            notes: editingReview.notes,
            medicineName:
              editingReview.order?.medicineName || "Oral Contraception",
          }}
          isReview={true}
          open={!!editingReview}
          onOpenChange={(open) => {
            if (!open) {
              setEditingReview(null);
              router.refresh();
            }
          }}
          onSaved={() => {
            router.refresh();
          }}
        />
      ) : null}

      <AlertDialog
        open={!!cancellingReview}
        onOpenChange={(open) => !open && !cancelling && setCancellingReview(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel future review?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel this patient&apos;s scheduled future review appointment and clear all automated follow-up SMS reminders. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Back</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={cancelling}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmCancelReview();
              }}
            >
              {cancelling ? "Cancelling..." : "Cancel review"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
