"use client";

import {
  getBookableDates,
  getBookingSlots,
} from "@/actions/bookingSlot.action";
import { useBooking } from "@/lib/BookingContext";
import { useRouter } from "next/navigation";
import React, { useState, useMemo, useEffect, useRef } from "react";
import Calendar from "react-calendar";
import { toast } from "sonner";

export default function BookingCalander() {
  const router = useRouter();
  const { bookingData, setBookingData } = useBooking();
  const [nowTick, setNowTick] = useState(Date.now());
  const timeSlotsSectionRef = useRef(null);
  const [step, setStep] = useState(0);


  useEffect(() => {
  const id = setInterval(() => setNowTick(Date.now()), 30 * 1000); // update every 30s
  return () => clearInterval(id);
}, []);


// helper: "HH:MM" -> minutes from 00:00
function toMinutes(hhmm) {
  if (!hhmm) return 0;
  const [hh, mm] = hhmm.split(":").map(Number);
  return hh * 60 + mm;
}

// helper: current minutes
function currentMinutes() {
  const n = new Date(nowTick);
  return n.getHours() * 60 + n.getMinutes();
}

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

  // bookable dates from DB
  const [bookableDateStrings, setBookableDateStrings] = useState([]);
  const bookableDates = useMemo(
    () => bookableDateStrings.map((s) => parseYMD(s)),
    [bookableDateStrings]
  );

  useEffect(() => {
    async function fetchBookableDates() {
      try {
        const res = await getBookableDates();
        if (!res.success) {
          toast.error(res.msg || "Failed to load available days.");
          return;
        }
        setBookableDateStrings(res.data || []);
      } catch (err) {
        console.error(err);
        toast.error("Could not load available days.");
      }
    }

    fetchBookableDates();
  }, []);

  const today = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);

  const [value, setValue] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [timeSlots, setTimeSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    console.log('Step changed to:', step);
  }, [step]);

  function isSameDay(a, b) {
    if (!a || !b) return false;
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  const selectedDateIsBookable = useMemo(
    () => bookableDates.some((d) => isSameDay(d, value)),
    [bookableDates, value]
  );

  useEffect(() => {
    if (!selectedDateIsBookable) {
      setSelectedSlot(null);
      setTimeSlots([]);
    }
  }, [selectedDateIsBookable]);

  function tileDisabled({ date, view }) {
    if (view !== "month") return false;
    //  Disable all past dates
    if (date < today) return true;

    //  Allow today even if not in bookableDates (optional)
    if (isSameDay(date, today)) return false;
    const isBookable = bookableDates.some((d) => isSameDay(d, date));
    if (isSameDay(date, today)) return false;
    return !isBookable;
  }

  function onDateChange(d) {
    console.log('onDateChange called with date:', d);
    setValue(d);
    setSelectedSlot(null);
    console.log('About to setStep(1)');
    setStep(1);
    console.log('setStep(1) called');
    setTimeout(() => {
      console.log('Timeout fired, scrolling to time slots');
      timeSlotsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  function handleBackToCalendar() {
    setStep(0);
    setSelectedSlot(null);
  }

  function extractStartTime(slotId) {
    if (!slotId) return "";
    return slotId.split("-")[0]; // "09:00"
  }

  // fetch slots from DB when date changes & is bookable
  useEffect(() => {
    async function fetchSlots() {
      if (!value || !selectedDateIsBookable) {
        setTimeSlots([]);
        return;
      }

      setLoadingSlots(true);
      try {
        const ymd = formatYMD(value); // "2025-12-06"
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
    }

    fetchSlots();
  }, [value, selectedDateIsBookable]);

  function handleSlotSelect(slot) {
    if (!selectedDateIsBookable) {
      toast.error("That date has no availability. Please choose another day.");
      return;
    }

    if (!value) {
      toast.error("Please select a date first.");
      return;
    }

    setSelectedSlot(slot.startTime);

    const booking = {
      ...(bookingData ?? {}),
      bookingdate: formatYMD(value), // "YYYY-MM-DD"
      bookingtime: slot.startTime, // "HH:MM"
      bookingendtime: slot.endTime, // "HH:MM"
    };

    setBookingData(booking);
    router.push("/booking/confirm");
  }

  // filtered slots for UI
const visibleSlots = useMemo(() => {
  if (!value) return [];
  if (!isSameDay(value, today)) return timeSlots; // not today -> show all

  const nowMins = currentMinutes();

  // rule: hide slots that already started (startTime <= now)
  return timeSlots.filter((slot) => toMinutes(slot.startTime) > nowMins);
}, [timeSlots, value, today, nowTick]);

  return (
    <div className='bg-[#f4e7e1] rounded-2xl overflow-hidden flex flex-col md:flex-row h-full'>
      {/* Left: react-calendar */}
      <div
        className='step-slide-container max-w-[730px] w-full p-3 md:p-6 bg-[#faf9f8] rounded-2xl transition-all duration-300 md:block'
        style={{ display: step === 1 ? 'none' : 'block' }}
      >
        <div className='calendar-wrapper'>
          <Calendar
            onChange={onDateChange}
            value={value}
            tileDisabled={tileDisabled}
            className='react-calendar-custom w-full border-0 text-sm md:text-base'
          />
        </div>
      </div>

      {/* Right: Time slots */}
      <aside
        ref={timeSlotsSectionRef}
        className='step-slide-container max-w-100 lg:max-w-82.5 w-full bg-[#f4e7e1] p-4 md:p-[40px_50px] transition-all duration-300 md:block'
        style={{ display: step === 0 ? 'none' : 'block' }}
      >
        {step === 1 && (
          <button
            onClick={handleBackToCalendar}
            className='mb-4 md:hidden flex items-center gap-2 text-sm font-medium text-[#2B3244] hover:text-[#1a1a1a] transition'
          >
            <span>←</span> Change date
          </button>
        )}
        <div className='mb-4'>
          <div className='text-[18px] font-medium text-[#2B3244] text-center'>
            {value.toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}
          </div>
        </div>

        {!selectedDateIsBookable ? (
          <div className='text-left p-4 '>
            <div className='text-sm mb-2'>
              Sorry, no availability on this date. Try another day.
            </div>
          </div>
        ) : (
          <div className='space-y-2 max-h-[480px] overflow-y-scroll custom-scrollbar pr-3'>
            {loadingSlots && (
              <div className='text-sm mb-2'>Loading time slots...</div>
            )}

            {!loadingSlots && timeSlots.length === 0 && (
              <div className='text-sm mb-2'>
                No time slots available for this date.
              </div>
            )}

            {visibleSlots.map((slot) => {
              const isActive = selectedSlot === slot.id;
              return (
                <button
                  key={slot.id}
                  onClick={() => handleSlotSelect(slot)}
                  className={`w-full cursor-pointer text-center p-3 rounded-md border transition focus:outline-none flex items-center justify-center text-base font-medium text-black
                    ${
                      isActive
                        ? "bg-[#D6866B] text-white border-[#D6866B]"
                        : "border border-[#DFCAB0] hover:shadow-sm"
                    }`}
                >
                  <div className='text-sm'>{slot.label}</div>
                </button>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}
