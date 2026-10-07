"use client";

import {
  getBookableDates,
  getBookingSlots,
} from "@/actions/bookingSlot.action";
import { useBooking } from "@/lib/BookingContext";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

/* ---------- date helpers ---------- */
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function formatYMD(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function parseYMD(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function isSameDay(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function fmt(hhmm) {
  if (!hhmm) return "";
  const [hh, mm] = hhmm.split(":");
  return `${Number(hh)}:${mm}`;
}

/**
 * Mobile-only booking screen — pixel-faithful to Figma 47930:1363.
 * Self-contained custom month calendar so the desktop react-calendar
 * (and its global CSS) stay untouched.
 */
export default function BookingsMobile() {
  const router = useRouter();
  const { bookingData, setBookingData } = useBooking();

  const today = useMemo(() => startOfDay(new Date()), []);
  const [view, setView] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookableStrings, setBookableStrings] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [step, setStep] = useState(0); // 0: calendar, 1: time slots
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    notes: "",
  });

  const bookableDates = useMemo(
    () => bookableStrings.map(parseYMD),
    [bookableStrings]
  );

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await getBookableDates();
        if (!res?.success) {
          toast.error(res?.msg || "Failed to load available days.");
          return;
        }
        setBookableStrings(res.data || []);
      } catch (err) {
        console.error(err);
        toast.error("Could not load available days.");
      }
    })();
  }, []);

  function isBookable(date) {
    if (date < today) return false;
    if (isSameDay(date, today)) return true;
    return bookableDates.some((d) => isSameDay(d, date));
  }

  const selectedIsBookable = isBookable(selectedDate);

  useEffect(() => {
    (async () => {
      if (!selectedIsBookable) {
        setTimeSlots([]);
        return;
      }
      setLoadingSlots(true);
      try {
        const res = await getBookingSlots(formatYMD(selectedDate));
        setTimeSlots(res?.success ? res.data || [] : []);
        if (!res?.success) toast.error(res?.msg || "Failed to load slots");
      } catch (err) {
        console.error(err);
        setTimeSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    })();
  }, [selectedDate, selectedIsBookable]);

  /* ---- month grid (Mon-start, 6 rows) ---- */
  const monthLabel = useMemo(
    () =>
      new Date(view.year, view.month, 1).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      }),
    [view]
  );

  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const lead = (first.getDay() + 6) % 7; // Mon = 0
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < lead; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++)
      arr.push(new Date(view.year, view.month, d));
    while (arr.length % 7 !== 0) arr.push(null);
    while (arr.length < 42) arr.push(null);
    return arr;
  }, [view]);

  function shiftMonth(delta) {
    setView((v) => {
      const m = v.month + delta;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }
  const canGoPrev = !(
    view.year === today.getFullYear() && view.month <= today.getMonth()
  );

  function handleBackToCalendar() {
    setStep(0);
    setSelectedSlot(null);
  }

  const isToday = isSameDay(selectedDate, today);
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const slots = useMemo(
    () =>
      timeSlots.map((s) => {
        const [h, m] = (s.startTime || "0:0").split(":").map(Number);
        return { ...s, isPast: isToday && h * 60 + m <= nowMins };
      }),
    [timeSlots, isToday, nowMins]
  );

  const dayLabel = selectedDate.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  function confirm() {
    if (!selectedIsBookable || !selectedSlot) {
      toast.error("Please select an available date and time slot.");
      return;
    }
    const selected = slots.find((s) => s.startTime === selectedSlot);
    setBookingData({
      ...(bookingData ?? {}),
      bookingdate: formatYMD(selectedDate),
      bookingtime: selectedSlot,
      bookingendtime: selected?.endTime,
      ...form,
    });
    router.push("/booking/confirm");
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-[20px] leading-[27px] font-semibold text-[#0D060C] tracking-[-0.3px]">
        Book a free appointment in just a few clicks
      </h2>

      {/* Contact fields */}
      <div className="flex flex-col gap-4">
        <Field
          label="Name"
          name="fullName"
          value={form.fullName}
          onChange={handleChange}
          placeholder="Enter your full name"
        />
        <Field
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          placeholder="Enter your email"
        />
        <Field
          label="Phone number"
          name="phoneNumber"
          type="tel"
          value={form.phoneNumber}
          onChange={handleChange}
          placeholder="Phone number"
        />
      </div>

      {/* Calendar + slots block */}
      <div className="bg-[#F4E7E1] rounded-[12px] p-4 flex flex-col gap-6">
        {/* Month calendar card */}
        <div
          className="mx-auto w-full max-w-[342px] bg-[#FAF9F8] rounded-[16px] p-4 transition-all duration-300"
          style={{ display: step === 1 ? 'none' : 'block' }}
        >
          <div className="flex flex-col gap-[15px]">
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => canGoPrev && shiftMonth(-1)}
                disabled={!canGoPrev}
                className="grid size-[15px] place-items-center text-black disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="size-[15px]" strokeWidth={2} />
              </button>
              <p className="text-xs font-medium leading-5 text-black">
                {monthLabel}
              </p>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
                className="grid size-[15px] place-items-center text-black cursor-pointer"
              >
                <ChevronRight className="size-[15px]" strokeWidth={2} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-[3.125px]">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className="grid place-items-center h-[31px] text-[9px] leading-[14px] text-black"
                >
                  {w}
                </div>
              ))}
              {cells.map((d, i) => {
                if (!d) return <div key={`b${i}`} className="size-[31px] mx-auto" />;
                const active = isSameDay(d, selectedDate);
                const bookable = isBookable(d);
                return (
                  <button
                    type="button"
                    key={formatYMD(d)}
                    disabled={!bookable}
                    onClick={() => {
                      setSelectedDate(d);
                      setSelectedSlot(null);
                      setStep(1);
                    }}
                    className={[
                      "size-[31px] mx-auto grid place-items-center rounded-[2.5px] text-[9px] leading-[14px] transition",
                      active
                        ? "bg-[#CE8936] text-white"
                        : bookable
                        ? "bg-[#F5EDE4] text-black cursor-pointer hover:bg-[#eaddcf]"
                        : "text-black/80 cursor-not-allowed",
                    ].join(" ")}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Day label + slots */}
        <div
          className="mx-auto w-full max-w-[342px] bg-[#FAF9F8] rounded-[16px] p-4 flex flex-col gap-[15px] transition-all duration-300"
          style={{ display: step === 0 ? 'none' : 'block' }}
        >
          {/* Header with back button and date title */}
          <div className="flex items-center justify-between gap-2 mb-4">
            {step === 1 && (
              <button
                type="button"
                onClick={handleBackToCalendar}
                className="text-[#2B3244] hover:text-[#1a1a1a] transition cursor-pointer text-lg flex-shrink-0"
                aria-label="Back to calendar"
              >
                ←
              </button>
            )}
            <p className="text-right text-[18px] leading-[27px] font-medium text-[#2B3244] tracking-[-0.3px]">
              {dayLabel}
            </p>
          </div>

          {!selectedIsBookable ? (
            <p className="text-center text-xs text-[#6B7280]">
              No availability on this date. Try another day.
            </p>
          ) : loadingSlots ? (
            <p className="text-center text-xs text-[#6B7280]">
              Loading time slots…
            </p>
          ) : slots.length === 0 ? (
            <p className="text-center text-xs text-[#6B7280]">
              No time slots for this date.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-[6px]">
              {slots.map((s) => {
                const disabled = s.isPast || s.isFull;
                const active = selectedSlot === s.startTime;
                return (
                  <button
                    type="button"
                    key={s.id}
                    disabled={disabled}
                    onClick={() => setSelectedSlot(s.startTime)}
                    title={
                      s.isFull
                        ? "Fully booked"
                        : s.isPast
                        ? "Time has passed"
                        : undefined
                    }
                    className={[
                      "h-[38px] px-1 rounded-[8px] flex items-center justify-center text-[12px] text-center tracking-[-0.2px] transition",
                      disabled
                        ? "bg-[#EBDAD2] text-[#A3A3A3] line-through cursor-not-allowed"
                        : active
                        ? "bg-[#D6866B] text-white cursor-pointer"
                        : "border border-[#DFCAB0] text-[#0D060C] cursor-pointer hover:border-[#D6866B]",
                    ].join(" ")}
                  >
                    {fmt(s.startTime)} - {fmt(s.endTime)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-[11px]">
        <label className="text-sm font-medium text-[#0D060C] tracking-[-0.2px]">
          Notes (Optional)
        </label>
        <textarea
          name="notes"
          rows={3}
          value={form.notes}
          onChange={handleChange}
          placeholder="Please give brief details of your query"
          className="border border-[#D9D9D9] rounded-[8px] px-4 pt-[15px] pb-4 text-sm tracking-[-0.2px] text-[#0D060C] placeholder:text-[#3A3D42]/50 w-full outline-none focus:border-[#CE8936] transition resize-none"
        />
      </div>

      {/* Confirm + image */}
      <div className="flex flex-col gap-5">
        <button
          type="button"
          onClick={confirm}
          className="group w-full bg-[#D6866B] text-white text-base font-medium py-3 px-[18px] rounded-full hover:bg-[#c5755a] transition duration-300 cursor-pointer"
        >
          <span className="flex items-center justify-center gap-1.5">
            Confirm Appointment
            <ArrowUpRight className="size-5 group-hover:rotate-45 transition duration-300" />
          </span>
        </button>

        <div className="h-[200px] rounded-[16px] overflow-hidden">
          <Image
            src="/images/booking.png"
            width={370}
            height={200}
            alt="booking"
            className="size-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, ...props }) => (
  <div className="flex flex-col gap-2">
    <label className="text-sm text-[#3A3D42] tracking-[-0.2px]">{label}</label>
    <input
      {...props}
      className="bg-white border border-[#EEE0CF] text-[#0D060C] placeholder:text-[#3A3D42] text-sm tracking-[-0.2px] w-full px-5 py-3.5 rounded-[8px] outline-none focus:border-[#CE8936] transition"
    />
  </div>
);
