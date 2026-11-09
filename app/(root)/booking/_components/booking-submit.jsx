"use client";

// One-step booking: "Confirm Appointment" on /booking now saves the booking
// straight away and shows the confirmation popup. Before, it opened
// /booking/confirm with the same fields and a second confirm button
// (client feedback, 9 Nov). The popup is the same one /booking/confirm shows.
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { createBooking } from "@/actions/booking.action";

export function useBookingSubmit() {
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(null);

  async function submit(form, slot) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("fullName", form.fullName?.trim() || "");
      formData.set("email", form.email?.trim() || "");
      formData.set("phoneNumber", form.phoneNumber?.trim() || "");
      formData.set("notes", form.notes?.trim() || "");
      formData.set("bookingdate", slot.date);
      formData.set("bookingtime", slot.time);
      formData.set("serviceName", "Oral Contraception");
      formData.set("providerName", "Manor Chemist");
      formData.set("nhsService", "NHS Service");
      const res = await createBooking(formData);
      if (!res?.success) {
        toast.error(res?.msg || "Booking failed.");
        return;
      }
      setConfirmed({ ...form, slot });
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while booking.");
    } finally {
      setSubmitting(false);
    }
  }

  return { submitting, confirmed, submit };
}

function to12h(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatBookingDate(dateStr, startStr, endStr) {
  if (!dateStr || !startStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const formatted = date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
  const timeRange = endStr ? `${to12h(startStr)} \u2013 ${to12h(endStr)}` : to12h(startStr);
  return `${formatted}, ${timeRange}`;
}

export function BookingConfirmedPopup({ booking }) {
  const router = useRouter();
  useEffect(() => {
    if (!booking) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [booking]);
  if (!booking) return null;
  const phone = booking.phoneNumber?.trim();
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => router.push("/")}>
      <div className="relative w-full max-w-sm rounded-[16px] bg-white p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Close" onClick={() => router.push("/")} className="absolute right-4 top-4 text-[#3A3D42] hover:text-[#0D060C] transition cursor-pointer">
          <X className="size-5" strokeWidth={1.8} />
        </button>
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[#FBF0E2]">
          <svg viewBox="0 0 24 24" fill="none" stroke="#D6866B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-6">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[1.5px] text-[#B5701F]">Request received</p>
        <h3 className="mb-5 text-[#0D060C] text-xl font-semibold tracking-[-0.3px]">Your telephone appointment is confirmed</h3>
        <div className="mb-4 rounded-[12px] bg-[#FAF9F8] px-4 py-3 text-left">
          <p className="text-xs text-[#6B6660]">Appointment</p>
          <p className="mb-2 text-base font-semibold text-[#3F1535]">
            {formatBookingDate(booking.slot?.date, booking.slot?.time, booking.slot?.endTime)}
          </p>
          {phone ? (
            <>
              <p className="text-xs text-[#6B6660]">Contact Number Provided</p>
              <p className="text-base font-semibold text-[#3F1535]">{phone}</p>
            </>
          ) : null}
        </div>
        <div className="mb-4 rounded-[12px] border-l-4 border-[#D6866B] bg-[#FAF9F8] px-4 py-3 text-left text-sm leading-[22px] text-[#3A3D42]">
          <p className="mb-1 font-semibold text-[#0D060C]">When we call</p>
          We&rsquo;ll call from 0208 679 7198. We never use a private number. Please keep your phone free for the full hour.
        </div>
        <p className="text-sm text-[#3A3D42]">
          We&rsquo;ve sent the details to{" "}
          <span className="font-medium text-[#0D060C] break-all">{booking.email?.trim() || "your email"}</span>.
        </p>
      </div>
    </div>
  );
}
