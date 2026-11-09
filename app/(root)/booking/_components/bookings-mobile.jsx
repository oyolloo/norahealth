"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { useBooking } from "@/lib/BookingContext";
import AppointmentPicker from "./appointment-picker";
import { useBookingSubmit, BookingConfirmedPopup } from "./booking-submit";

export default function BookingsMobile() {
  const router = useRouter();
  const { bookingData, setBookingData } = useBooking();
  const { submitting, confirmed, submit } = useBookingSubmit();

  const [form, setForm] = useState({
    fullName: bookingData?.fullName || "",
    email: bookingData?.email || "",
    phoneNumber: bookingData?.phoneNumber || "",
    notes: bookingData?.notes || "",
  });

  const [slot, setSlot] = useState(() => {
    if (bookingData?.bookingdate && bookingData?.bookingtime) {
      return {
        date: bookingData.bookingdate,
        time: bookingData.bookingtime,
        endTime: bookingData.bookingendtime,
      };
    }
    return null;
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }

  const canConfirm = Boolean(slot?.date && slot?.time) && !submitting;

  function confirm() {
    if (!slot?.date || !slot?.time) {
      toast.error("Please select an available date and time slot.");
      return;
    }
    if (!form.fullName.trim() || !form.email.trim() || !form.phoneNumber.trim()) {
      toast.error("Please fill in your name, email and phone number.");
      return;
    }
    setBookingData({
      ...(bookingData ?? {}),
      bookingdate: slot.date,
      bookingtime: slot.time,
      bookingendtime: slot.endTime,
      ...form,
    });
    // Book straight away (one step) instead of opening /booking/confirm.
    submit(form, slot);
  }

  return (
    <div className="flex flex-col gap-4">
      <BookingConfirmedPopup booking={confirmed} />
      <h2 className="text-[20px] leading-[27px] font-semibold text-[#0D060C] tracking-[-0.3px]">
        Book a free telephone appointment
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

      {/* Calendar + slots block (matching order booking design) */}
      <div className="bg-[#FAF9F8] border border-[#EEE0CF] rounded-[16px] p-4 flex flex-col gap-4">
        <AppointmentPicker
          value={slot}
          onSelect={setSlot}
          autoSelectSlot={false}
          showTurnaround={false}
        />
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-[11px]">
        <label className="text-sm font-medium text-[#0D060C] tracking-[-0.2px]">
          Notes (Optional)
        </label>
        <textarea
          name="notes"
          rows={2}
          value={form.notes}
          onChange={handleChange}
          placeholder="Please give brief details of your query"
          className="border border-[#D9D9D9] rounded-[8px] px-4 pt-[15px] pb-4 text-sm tracking-[-0.2px] text-[#0D060C] placeholder:text-[#3A3D42]/50 w-full outline-none focus:border-[#CE8936] transition resize-none"
        />
      </div>

      {/* Confirm Button */}
      <button
        type="button"
        onClick={confirm}
        disabled={!canConfirm}
        aria-disabled={!canConfirm}
        className={[
          "group w-full text-base font-medium py-3 px-[18px] rounded-full transition duration-300",
          canConfirm
            ? "bg-[#D6866B] text-white hover:bg-[#c5755a] cursor-pointer"
            : "bg-[#D9D9D9] text-[#6B6660] cursor-not-allowed",
        ].join(" ")}
      >
        <span className="flex items-center justify-center gap-1.5">
          {submitting ? "Confirming\u2026" : "Confirm Appointment"}
          <ArrowUpRight
            className={[
              "size-5 transition duration-300",
              canConfirm ? "group-hover:rotate-45" : "",
            ].join(" ")}
          />
        </span>
      </button>

      {/* Image */}
      <div className="flex flex-col gap-5">
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
    <label htmlFor={props.name} className="sr-only text-sm text-[#3A3D42] tracking-[-0.2px]">{label}</label>
    <input
      id={props.name}
      {...props}
      className="bg-white border border-[#EEE0CF] text-[#0D060C] placeholder:text-[#3A3D42] text-sm tracking-[-0.2px] w-full px-5 py-3.5 rounded-[8px] outline-none focus:border-[#CE8936] transition"
    />
  </div>
);
