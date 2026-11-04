"use client";

import { Clock, WalletMinimal, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useBooking } from "@/lib/BookingContext";
import AppointmentPicker from "./appointment-picker";
import BookingsMobile from "./bookings-mobile";

function BookingsDesktop() {
  const router = useRouter();
  const { bookingData, setBookingData } = useBooking();

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

  const canConfirm = Boolean(slot?.date && slot?.time);

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
    router.push("/booking/confirm");
  }

  return (
    <div className='hidden md:block'>
      <h2 className='text-center text-[#1F2122] text-[18px] md:text-[24px] font-semibold max-w-[680px] mx-auto mb-[40px]'>
        Book a free telephone appointment in just a few clicks to discuss your
        contraceptive needs.
      </h2>
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-[30px]'>
        {/* Left column: Image + Telephone appointment info */}
        <div className='flex flex-col gap-5 lg:col-span-1'>
          <Image
            src='/images/booking.png'
            width={370}
            height={318}
            alt='booking'
            className='rounded-2xl object-cover w-full'
          />
          <div className='bg-[#F4E7E1] rounded-2xl p-[30px_24px]'>
            <h2 className='text-[#0D060C] text-[18px] md:text-[24px] font-medium pb-5 border-b border-[#CE893646] mb-5'>
              Telephone Appointment
            </h2>
            <div className='space-y-5'>
              <div className='text-[#3A3D42] flex items-start gap-2'>
                <Clock className='w-5' /> <span>10m</span>
              </div>
              <div className='text-[#3A3D42] flex items-start gap-2'>
                <WalletMinimal className='text-[#3A3D42] w-5' />{" "}
                <span>Free NHS</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Contact details + AppointmentPicker + Notes + Confirm */}
        <div className='lg:col-span-2 flex flex-col gap-5'>
          {/* Contact Fields with placeholders */}
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
            <div>
              <label htmlFor='desktop-fullName' className='sr-only'>
                Full Name
              </label>
              <input
                id='desktop-fullName'
                name='fullName'
                value={form.fullName}
                onChange={handleChange}
                placeholder='Enter your full name'
                className='bg-white border border-[#EEE0CF] text-[#0D060C] placeholder:text-[#3A3D42] text-sm tracking-[-0.2px] w-full px-4 py-3 rounded-[8px] outline-none focus:border-[#CE8936] transition'
              />
            </div>
            <div>
              <label htmlFor='desktop-email' className='sr-only'>
                Email Address
              </label>
              <input
                id='desktop-email'
                name='email'
                type='email'
                value={form.email}
                onChange={handleChange}
                placeholder='Enter your email'
                className='bg-white border border-[#EEE0CF] text-[#0D060C] placeholder:text-[#3A3D42] text-sm tracking-[-0.2px] w-full px-4 py-3 rounded-[8px] outline-none focus:border-[#CE8936] transition'
              />
            </div>
            <div>
              <label htmlFor='desktop-phone' className='sr-only'>
                Phone Number
              </label>
              <input
                id='desktop-phone'
                name='phoneNumber'
                type='tel'
                value={form.phoneNumber}
                onChange={handleChange}
                placeholder='Phone number'
                className='bg-white border border-[#EEE0CF] text-[#0D060C] placeholder:text-[#3A3D42] text-sm tracking-[-0.2px] w-full px-4 py-3 rounded-[8px] outline-none focus:border-[#CE8936] transition'
              />
            </div>
          </div>

          {/* Calendar + slots block */}
          <div className='bg-[#FAF9F8] border border-[#EEE0CF] rounded-[16px] p-5 flex flex-col gap-4'>
            <h3 className='text-base font-semibold text-[#0D060C] tracking-[-0.3px]'>
              Book your appointment
            </h3>
            <AppointmentPicker
              value={slot}
              onSelect={setSlot}
              autoSelectSlot={false}
          showTurnaround={false}
            />
          </div>

          {/* Notes */}
          <div className='flex flex-col gap-2'>
            <label
              htmlFor='desktop-notes'
              className='text-sm font-medium text-[#0D060C] tracking-[-0.2px]'
            >
              Notes (Optional)
            </label>
            <textarea
              id='desktop-notes'
              name='notes'
              rows={2}
              value={form.notes}
              onChange={handleChange}
              placeholder='Please give brief details of your query'
              className='border border-[#D9D9D9] bg-white rounded-[8px] px-4 py-3 text-sm tracking-[-0.2px] text-[#0D060C] placeholder:text-[#3A3D42]/50 w-full outline-none focus:border-[#CE8936] transition resize-none'
            />
          </div>

          {/* Confirm Button */}
          <button
            type='button'
            onClick={confirm}
            disabled={!canConfirm}
            aria-disabled={!canConfirm}
            className={[
              'group w-full text-base font-medium py-3.5 px-6 rounded-full transition duration-300',
              canConfirm
                ? 'bg-[#D6866B] text-white hover:bg-[#c5755a] cursor-pointer'
                : 'bg-[#D9D9D9] text-[#6B6660] cursor-not-allowed',
            ].join(' ')}
          >
            <span className='flex items-center justify-center gap-1.5'>
              Confirm Appointment
              <ArrowUpRight
                className={[
                  'size-5 transition duration-300',
                  canConfirm ? 'group-hover:rotate-45' : '',
                ].join(' ')}
              />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

const Bookings = () => {
  return (
    <section className='section-padding'>
      <div className='container custom-container mx-auto sm:px-0 px-[24px]'>
        {/* Mobile (Figma) */}
        <div className='md:hidden'>
          <BookingsMobile />
        </div>

        {/* Tablet / desktop */}
        <BookingsDesktop />
      </div>
    </section>
  );
};

export default Bookings;
