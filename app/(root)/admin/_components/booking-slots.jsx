"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Calendar from "react-calendar";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Link from "next/link";
import { toast } from "sonner";
import { PanelLeft, Trash } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  getBookableDates,
  getBookingSlots,
  deleteBookingSlot,
  deleteBookingSlotsByDate,
  deleteBookingSlotsByRange,
} from "@/actions/bookingSlot.action";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useAdmin } from "@/lib/adminContext";
import { getFutureApptsAction } from "@/actions/futureAppt.action";
import { reviewsByHour, slotHour } from "@/lib/futureAppt";

/**
 * Reusable confirm dialog hook (uses shadcn AlertDialog)
 * Usage:
 *   const { confirm, ConfirmDialog } = useConfirmDialog();
 *   // await confirm({ title, description }) -> boolean
 *   // render <ConfirmDialog />
 */
function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [resolver, setResolver] = useState(null);
  const [title, setTitle] = useState("Are you sure?");
  const [description, setDescription] = useState("");

  const confirm = ({ title: t = "Are you sure?", description: d = "" } = {}) =>
    new Promise((resolve) => {
      setTitle(t);
      setDescription(d);
      setResolver(() => resolve);
      setOpen(true);
    });

  const handleConfirm = () => {
    resolver?.(true);
    setOpen(false);
  };

  const handleCancel = () => {
    resolver?.(false);
    setOpen(false);
  };

  const ConfirmDialog = () => (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} className='cursor-pointer!'>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className='bg-theme cursor-pointer!'
          >
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, ConfirmDialog };
}

export default function BookingSlots() {
  const router = useRouter();
  const { setMenuOpen } = useAdmin();

  // parse "YYYY-MM-DD" from server into Date object for calendar
  function parseYMD(ymd) {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  // format Date -> "YYYY-MM-DD" (for server)
  function formatYMD(date) {
    if (!date) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // all dates with configured slots in DB (for admin)
  const [slotDateStrings, setSlotDateStrings] = useState([]);
  const slotDates = useMemo(
    () => slotDateStrings.map((s) => parseYMD(s)),
    [slotDateStrings]
  );

  // helper functions to fetch data (used after deletes to refresh)
  const fetchSlotDates = useCallback(async () => {
    try {
      const res = await getBookableDates(true);
      if (!res || !res.success) {
        toast.error(res?.msg || "Failed to load slot days.");
        return;
      }
      setSlotDateStrings(res.data || []);
    } catch (err) {
      console.error("fetchSlotDates error:", err);
      toast.error("Could not load slot days.");
    }
  }, []);

  useEffect(() => {
    fetchSlotDates();
  }, [fetchSlotDates]);

  const today = useMemo(() => {
    const t = new Date();
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    // If today is Sunday (closed), move to Monday
    if (d.getDay() === 0) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  }, []);

  const [value, setValue] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [timeSlots, setTimeSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // ---------- Bulk delete (month / range) ----------
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState("month"); // "month" | "range"
  const [bulkMonth, setBulkMonth] = useState(null); // Date (month + year)
  const [bulkStart, setBulkStart] = useState(""); // "YYYY-MM-DD"
  const [bulkEnd, setBulkEnd] = useState(""); // "YYYY-MM-DD"
  const [bulkLoading, setBulkLoading] = useState(false);

  // CC-16: Future Appts (set on orders) shown on the calendar. Read only.
  const [futureAppts, setFutureAppts] = useState([]);
  useEffect(() => {
    getFutureApptsAction()
      .then((rows) => setFutureAppts(Array.isArray(rows) ? rows : []))
      .catch(() => setFutureAppts([]));
  }, []);
  const ymdLocal = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const futureApptsFor = (d) => futureAppts.filter((a) => a.day === ymdLocal(d));

  function isSameDay(a, b) {
    if (!a || !b) return false;
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  const selectedDateHasSlots = useMemo(
    () => slotDates.some((d) => isSameDay(d, value)),
    [slotDates, value]
  );

  // Sunday is closed/unclickable in admin as well
  function tileDisabled({ date, view }) {
    if (view !== "month") return false;
    return date.getDay() === 0;
  }

  function onDateChange(d) {
    if (d.getDay() === 0) return; // ignore Sunday clicks
    setValue(d);
    setSelectedSlot(null);
  }

  // fetch slots from DB whenever date changes
  const fetchSlotsForDate = useCallback(
    async (dateObj) => {
      if (!dateObj) {
        setTimeSlots([]);
        return;
      }

      setLoadingSlots(true);
      try {
        const ymd = formatYMD(dateObj);
        const res = await getBookingSlots(ymd);

        if (!res.success) {
          toast.error(res.msg || "Failed to load slots");
          setTimeSlots([]);
          return;
        }

        setTimeSlots(res.data || []);
      } catch (err) {
        console.error(err);
        toast.error("Could not load time slots.");
        setTimeSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchSlotsForDate(value);
  }, [value, fetchSlotsForDate]);

  // ---------- Confirm dialog hook ----------
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // ---------- Delete handlers ----------

  // delete single slot by id (uses shadcn confirm)
  async function handleDeleteSlot(slotId) {
    if (!slotId) return;

    const slotDate = formatYMD(value);
    const proceed = await confirm({
      title: "Delete Slot",
      description: `Delete this slot (${slotDate})? This action cannot be undone.`,
    });
    if (!proceed) return;

    try {
      const res = await deleteBookingSlot({ slotId, slotDate });

      if (!res || !res.success) {
        toast.error(res?.msg || "Failed to delete slot");
        return;
      }

      toast.success(res.msg || "Slot deleted");
      await fetchSlotsForDate(value);
      await fetchSlotDates();
      setSelectedSlot(null);
    } catch (err) {
      console.error("deleteBookingSlot error", err);
      toast.error("Delete failed");
    }
  }

  // delete all slots for selected date (uses shadcn confirm)
  async function handleDeleteSlotsForDate() {
    const ymd = formatYMD(value); // "YYYY-MM-DD"
    if (!ymd) return;

    const proceed = await confirm({
      title: `Delete ALL slots for ${ymd}?`,
      description: "This action cannot be undone. Do you want to continue?",
    });
    if (!proceed) return;

    try {
      const res = await deleteBookingSlotsByDate({ slotDate: ymd });

      if (!res) {
        toast.error("Delete failed (no response).");
        return;
      }

      if (!res.success) {
        if (res.booked && Array.isArray(res.booked) && res.booked.length > 0) {
          const times = res.booked
            .map((b) => `${b.startTime}` + (b.endTime ? `-${b.endTime}` : ""))
            .join(", ");
          toast.error(`${res.msg}. Booked slots: ${times}`);
        } else {
          toast.error(res.msg || "Failed to delete slots for date");
        }
        return;
      }

      toast.success(res.msg || "Slots deleted for date");

      await fetchSlotDates();
      await fetchSlotsForDate(value);
      setSelectedSlot(null);
    } catch (err) {
      console.error("deleteBookingSlotsByDate error", err);
      toast.error("Delete failed");
    }
  }

  // bulk delete by month or date range
  async function handleBulkDelete() {
    let payload;
    let label;

    if (bulkMode === "month") {
      if (!bulkMonth) {
        toast.error("Pick a month");
        return;
      }
      const ym = `${bulkMonth.getFullYear()}-${String(
        bulkMonth.getMonth() + 1
      ).padStart(2, "0")}`; // "YYYY-MM"
      payload = { month: ym };
      label = ym;
    } else {
      if (!bulkStart || !bulkEnd) {
        toast.error("Pick a start and end date");
        return;
      }
      if (bulkStart > bulkEnd) {
        toast.error("Start date must be before end date");
        return;
      }
      payload = { startDate: bulkStart, endDate: bulkEnd };
      label = `${bulkStart} → ${bulkEnd}`;
    }

    const proceed = await confirm({
      title: "Delete slots in bulk?",
      description: `Delete all UNBOOKED slots for ${label}? Booked slots are kept. This cannot be undone.`,
    });
    if (!proceed) return;

    setBulkLoading(true);
    try {
      const res = await deleteBookingSlotsByRange(payload);
      if (!res?.success) {
        toast.error(res?.msg || "Bulk delete failed");
        return;
      }
      toast.success(res.msg);
      setBulkOpen(false);
      await fetchSlotDates();
      await fetchSlotsForDate(value);
      setSelectedSlot(null);
    } catch (err) {
      console.error("deleteBookingSlotsByRange error", err);
      toast.error("Bulk delete failed");
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className='bg-[#f4e7e1] rounded-2xl overflow-hidden flex flex-col md:flex-row h-full'>
      {/* Left: react-calendar */}
      <div className='max-w-[730px] w-full p-6 bg-[#faf9f8] rounded-2xl'>
        {/* HEADER */}
        <div className='flex items-center gap-4 mb-4'>
          <button
            onClick={() => setMenuOpen(true)}
            className='lg:hidden w-[40px] h-[40px] bg-[#d67b0e] text-white flex justify-center items-center rounded-full'
          >
            <PanelLeft />
          </button>
          <h2 className='text-xl font-semibold'>Appointment Slots</h2>
        </div>
        <div className='flex gap-4 mb-3'>
          <Link
            href='/admin/booking-slot/create-slot'
            className=' bg-[#d67b0e] hover:bg-black px-3 py-2 w-fit rounded-lg flex items-center justify-center text-white text-[12px] md:text-[16px] font-medium  tracking-widest'
          >
            Add Slot
          </Link>
          <Link
            href='/admin/booking-slot/bulk-slot'
            className=' bg-[#d67b0e] hover:bg-black px-3 py-2 w-fit rounded-lg flex items-center justify-center text-white text-[12px] md:text-[16px] font-medium  tracking-widest'
          >
            Create Bulk Slot
          </Link>
          <button
            onClick={() => setBulkOpen((o) => !o)}
            className='bg-red-600 hover:bg-black px-3 py-2 w-fit rounded-lg flex items-center justify-center text-white text-[12px] md:text-[16px] font-medium tracking-widest'
          >
            Bulk Delete
          </button>
        </div>

        {/* Bulk delete panel (by month or date range) */}
        {bulkOpen && (
          <div className='mb-4 p-4 rounded-lg border border-[#DFCAB0] bg-white'>
            <div className='flex items-center gap-4 mb-3'>
              <label className='flex items-center gap-2 text-sm font-medium'>
                <input
                  type='radio'
                  name='bulkMode'
                  checked={bulkMode === "month"}
                  onChange={() => setBulkMode("month")}
                />
                By Month
              </label>
              <label className='flex items-center gap-2 text-sm font-medium'>
                <input
                  type='radio'
                  name='bulkMode'
                  checked={bulkMode === "range"}
                  onChange={() => setBulkMode("range")}
                />
                By Date Range
              </label>
            </div>

            {bulkMode === "month" ? (
              <div className='flex flex-col gap-1 mb-3'>
                <span className='text-xs text-gray-600'>Month</span>
                <DatePicker
                  selected={bulkMonth}
                  onChange={(date) => setBulkMonth(date)}
                  dateFormat='MMMM yyyy'
                  showMonthYearPicker
                  placeholderText='Select month'
                  className='border rounded px-2 py-1 text-sm w-full'
                />
              </div>
            ) : (
              <div className='flex flex-col sm:flex-row gap-3 mb-3'>
                <div className='flex flex-col gap-1'>
                  <span className='text-xs text-gray-600'>From</span>
                  <input
                    type='date'
                    value={bulkStart}
                    onChange={(e) => setBulkStart(e.target.value)}
                    className='border rounded px-2 py-1 text-sm'
                  />
                </div>
                <div className='flex flex-col gap-1'>
                  <span className='text-xs text-gray-600'>To</span>
                  <input
                    type='date'
                    value={bulkEnd}
                    onChange={(e) => setBulkEnd(e.target.value)}
                    className='border rounded px-2 py-1 text-sm'
                  />
                </div>
              </div>
            )}

            <div className='flex items-center gap-2'>
              <button
                onClick={handleBulkDelete}
                disabled={bulkLoading}
                className='bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm px-3 py-2 rounded'
              >
                {bulkLoading ? "Deleting..." : "Delete Slots"}
              </button>
              <button
                onClick={() => setBulkOpen(false)}
                className='text-sm px-3 py-2 rounded border'
              >
                Cancel
              </button>
            </div>
            <p className='text-xs text-gray-500 mt-2'>
              Only unbooked slots are deleted. Booked slots are kept.
            </p>
          </div>
        )}
        <div className='calendar-wrapper'>
          <Calendar
            onChange={onDateChange}
            value={value}
            tileDisabled={tileDisabled}
            tileContent={({ date, view }) =>
              view === "month" && futureApptsFor(date).length ? (
                <span
                  title={`${futureApptsFor(date).length} Future Appt`}
                  className='mx-auto mt-0.5 block size-1.5 rounded-full bg-[#3F1535]'
                />
              ) : null
            }
            className='react-calendar-custom w-full border-0'
          />
        </div>
      </div>

      {/* Right: Time slots */}
      <aside className='max-w-[360px] w-full bg-[#f4e7e1] p-[24px_16px] lg:p-[32px_36px] flex flex-col'>
        <div className='mb-4 flex items-center justify-between'>
          <div className='text-[14px] font-semibold text-[#2B3244]'>
            {value.toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>

          {/* Delete all button (only show when slots exist) */}
          {timeSlots.length > 0 && (
            <button
              onClick={handleDeleteSlotsForDate}
              title='Delete all unbooked slots for this date'
              className='ml-2 text-xs text-red-600 border border-red-200 bg-white px-2 py-1 rounded hover:bg-red-50 font-medium'
            >
              Delete unbooked
            </button>
          )}
        </div>

        {futureApptsFor(value).length > 0 && (
          <div className='mb-4 rounded-md border border-[#DFCAB0] bg-white p-3'>
            <div className='mb-2 text-xs font-semibold uppercase tracking-wide text-[#3F1535]'>
              Future Appt ({futureApptsFor(value).length})
            </div>
            <ul className='space-y-2'>
              {futureApptsFor(value).map((a) => (
                <li key={a.orderId} className='text-sm leading-5'>
                  <Link href={`/admin/${a.userId}/orders`} className='font-medium hover:underline'>
                    {a.name}
                  </Link>
                  <div className='text-xs text-gray-600'>
                    {a.medicine}
                    {a.time ? ` · ${a.time}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className='flex-1 space-y-2.5 max-h-[520px] overflow-y-auto custom-scrollbar pr-1'>
          {loadingSlots && (
            <div className='text-sm text-gray-600 py-4 text-center'>Loading slots...</div>
          )}

          {!loadingSlots && timeSlots.length === 0 && (
            <div className='text-left p-4 bg-white/70 rounded-xl border border-[#DFCAB0]/60'>
              <div className='text-sm font-medium text-gray-700 mb-1'>
                No slots configured for this date.
              </div>
              <div className='text-xs text-gray-500 mb-3'>
                Admin can add individual or bulk slots for this day.
              </div>
              <Link
                href='/admin/booking-slot/create-slot'
                className='inline-block text-xs bg-[#d67b0e] text-white px-3 py-1.5 rounded font-medium hover:bg-black transition'
              >
                + Add Slot
              </Link>
            </div>
          )}

          {timeSlots.map((slot) => {
            const isActive = selectedSlot === slot.id;
            // CC-27: reviews at this hour count toward the slot's capacity too.
            const reviewsHere = reviewsByHour(futureApptsFor(value))[slotHour(slot.startTime)] || 0;
            const bookedCount = (slot.booked || 0) + reviewsHere;
            const capacity = slot.capacity || 1;
            const isFull = slot.isFull || bookedCount >= capacity;
            const bookings = slot.bookings || [];

            return (
              <div
                key={slot.id}
                className='rounded-lg border border-[#DFCAB0] bg-white overflow-hidden transition shadow-xs'
              >
                <div
                  onClick={() => setSelectedSlot(isActive ? null : slot.id)}
                  className={`w-full cursor-pointer p-3 flex items-center justify-between transition ${
                    isActive ? "bg-[#faf1ec]" : "hover:bg-[#fbf7f4]"
                  }`}
                >
                  <div className='flex flex-col gap-0.5 text-left'>
                    <span className='text-sm font-semibold text-gray-900'>
                      {slot.label}
                    </span>
                    <span className='text-[11px] text-gray-500'>
                      Click to {isActive ? "hide" : "view"} bookings
                    </span>
                  </div>

                  <div className='flex items-center gap-2'>
                    {isFull ? (
                      <span className='text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold'>
                        Booked ({bookedCount}/{capacity})
                      </span>
                    ) : bookedCount > 0 ? (
                      <span className='text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold'>
                        Booked ({bookedCount}/{capacity})
                      </span>
                    ) : (
                      <span className='text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold'>
                        Open (0/{capacity})
                      </span>
                    )}

                    {/* delete icon; only show if slot is NOT booked */}
                    {!slot.isBooked && (slot.booked || 0) === 0 ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSlot(slot.id);
                        }}
                        title='Delete slot'
                        className='text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition'
                      >
                        <Trash className='w-4 h-4' />
                      </button>
                    ) : (
                      <div
                        title='Cannot delete booked slot'
                        className='text-gray-300 p-1 cursor-not-allowed'
                      >
                        <Trash className='w-4 h-4' />
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Patient Bookings List */}
                {isActive && (
                  <div className='border-t border-[#DFCAB0]/70 p-3 bg-[#faf9f8] text-left text-xs'>
                    <div className='font-semibold text-gray-700 uppercase tracking-wider text-[10px] mb-2 flex items-center justify-between'>
                      <span>Patient Bookings</span>
                      <span className='text-gray-500 font-normal'>
                        {bookings.length} of {capacity} booked
                      </span>
                    </div>

                    {bookings.length === 0 ? (
                      <div className='text-gray-500 py-1 italic'>
                        No patient bookings for this slot yet.
                      </div>
                    ) : (
                      <div className='space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1'>
                        {bookings.map((b, idx) => (
                          <div
                            key={b.id || idx}
                            className='p-2 bg-white rounded border border-[#DFCAB0]/60 space-y-1'
                          >
                            <div className='flex items-center justify-between font-medium text-gray-900'>
                              <span>{b.fullName || "Unnamed Patient"}</span>
                              <span className='text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-normal'>
                                {b.bookingStatus || "Booked"}
                              </span>
                            </div>
                            {b.phoneNumber && (
                              <div className='text-gray-600 flex items-center gap-1 text-[11px]'>
                                <span>📞</span>
                                <span>{b.phoneNumber}</span>
                              </div>
                            )}
                            {b.email && (
                              <div className='text-gray-600 flex items-center gap-1 text-[11px] truncate'>
                                <span>✉️</span>
                                <span className='truncate'>{b.email}</span>
                              </div>
                            )}
                            {b.userId && (
                              <div className='pt-1'>
                                <Link
                                  href={`/admin/${b.userId}/orders`}
                                  className='text-[11px] text-[#d67b0e] hover:underline font-medium'
                                >
                                  View Patient Record →
                                </Link>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Confirm Dialog (render once) */}
      <ConfirmDialog />
    </div>
  );
}
