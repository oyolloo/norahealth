"use client";

import { useBooking } from "@/lib/BookingContext";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBooking } from "@/actions/booking.action";
import { toast } from "sonner";

const ConfirmBooking = ({ userDetails }) => {
  const originalSubmitWrapRef = useRef(null);
  const formRef = useRef(null);
  const [showStickySubmit, setShowStickySubmit] = useState(false);
  const { bookingData } = useBooking();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const fullNameFromAccount = userDetails?.account
    ? [userDetails.account.firstName, userDetails.account.lastName]
        .filter(Boolean)
        .join(" ")
    : "";

  // Prefer what the patient actually typed on the /booking step (carried across
  // in bookingData). Fall back to their logged-in account details only when a
  // field was left blank — e.g. the desktop flow collects the name here rather
  // than on the previous step. Previously this seeded ONLY from the account, so
  // a booking typed for someone else (e.g. "Jenny Smith") was silently replaced
  // by the logged-in user's own details on this confirm screen.
  const [form, setForm] = useState({
    fullName: bookingData?.fullName || fullNameFromAccount,
    email: bookingData?.email || userDetails?.email || "",
    phoneNumber: bookingData?.phoneNumber || userDetails?.account?.phoneNumber || "",
    notes: bookingData?.notes || "",
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  useEffect(() => {
    if (!bookingData?.bookingdate || !bookingData?.bookingtime) {
      router.replace("/booking");
    }
  }, [bookingData, router]);

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
    const formatted = date.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
    const timeRange = endStr
      ? `${to12h(startStr)} – ${to12h(endStr)}`
      : to12h(startStr);
    return `${formatted}, ${timeRange}`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!bookingData?.bookingdate || !bookingData?.bookingtime) {
      toast.error("No booking slot selected.");
      return;
    }

    setSubmitting(true);
    try {
      // Build the payload from React state (what the user actually sees/typed),
      // not from the DOM. Reading the DOM let browser autofill silently put the
      // logged-in user's details back into the fields, so a booking typed for
      // someone else got submitted under the wrong name/email.
      const formData = new FormData();
      formData.set("fullName", form.fullName?.trim() || "");
      formData.set("email", form.email?.trim() || "");
      formData.set("phoneNumber", form.phoneNumber?.trim() || "");
      formData.set("notes", form.notes?.trim() || "");
      formData.set("bookingdate", bookingData.bookingdate);
      formData.set("bookingtime", bookingData.bookingtime);
      formData.set("serviceName", "Oral Contraception");
      formData.set("providerName", "Manor Chemist");
      formData.set("nhsService", "NHS Service");

      const res = await createBooking(formData);
      if (!res.success) {
        toast.error(res.msg || "Booking failed.");
        return;
      }
      toast.success("Your appointment has been booked.");
      router.push("/");
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while booking.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");

    const setupObserver = () => {
      if (!mql.matches) {
        setShowStickySubmit(false);
        return;
      }
      const target = originalSubmitWrapRef.current;
      if (!target) return;

      const observer = new IntersectionObserver(
        ([entry]) => setShowStickySubmit(!entry.isIntersecting),
        { threshold: 0.1 }
      );
      observer.observe(target);
      return () => observer.disconnect();
    };

    let cleanup = setupObserver();
    const onResizeChange = () => {
      if (cleanup) cleanup();
      cleanup = setupObserver();
    };
    mql.addEventListener?.("change", onResizeChange);
    window.addEventListener("resize", onResizeChange);

    return () => {
      if (cleanup) cleanup();
      mql.removeEventListener?.("change", onResizeChange);
      window.removeEventListener("resize", onResizeChange);
    };
  }, []);

  return (
    <section className="py-8">
      <div className="container custom-container mx-auto sm:px-4 px-[24px]">
        <form onSubmit={handleSubmit} ref={formRef}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 bg-[#FAF9F8] rounded-[12px] p-4 md:p-6 2xl:p-8">
            {/* LEFT */}
            <div className="lg:col-span-2 min-w-0 flex flex-col gap-8">
              <Link
                href="/booking"
                className="flex items-center gap-[7px] text-[#3A3D42] w-fit"
              >
                <ArrowLeft className="size-6" strokeWidth={1.8} />
                <span className="text-base tracking-[-0.3px]">Back</span>
              </Link>

              <div className="flex flex-col gap-4">
                <Input
                  label="Name"
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                />
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                />
                <Input
                  label="Phone number"
                  name="phoneNumber"
                  type="tel"
                  value={form.phoneNumber}
                  onChange={handleChange}
                  placeholder="Phone number"
                />
              </div>

              <Notes value={form.notes} onChange={handleChange} />
            </div>

            {/* RIGHT */}
            <div className="min-w-0 flex flex-col gap-4">
              <div className="booking-img order-2 lg:order-1 max-[1367px]:max-h-40 overflow-hidden rounded-[16px]">
                <Image
                  src="/images/booking.png"
                  width={370}
                  height={200}
                  alt="booking"
                  className="rounded-[16px] w-full"
                />
              </div>

              <div className="order-1 lg:order-2 bg-[#F4E7E1] rounded-[16px] p-4 2xl:p-6">
                <h2 className="text-[#0D060C] text-[18px] md:text-[24px] font-medium pb-2 2xl:pb-5 border-b border-[#CE893646] mb-3">
                  Oral Contraception
                </h2>
                <div className="space-y-2 2xl:space-y-4 mb-4">
                  <SummaryRow
                    label="Date:"
                    value={formatBookingDate(
                      bookingData?.bookingdate,
                      bookingData?.bookingtime,
                      bookingData?.bookingendtime
                    )}
                  />
                  <SummaryRow label="Provider:" value="Manor Chemist" />
                  <SummaryRow label="NHS Service:" value="NHS Service" />
                </div>

                <input type="hidden" name="serviceName" value="Oral Contraception" />
                <input type="hidden" name="providerName" value="Manor Chemist" />
                <input type="hidden" name="nhsService" value="NHS Service" />

                <div ref={originalSubmitWrapRef}>
                  <SubmitButton submitting={submitting} />
                </div>
              </div>

              {/* Mobile sticky submit */}
              <div
                className={[
                  "lg:hidden fixed left-0 right-0 bottom-20 sm:bottom-5 z-50 p-3 px-[44px]",
                  "container custom-container mx-auto",
                  showStickySubmit ? "block" : "hidden",
                ].join(" ")}
              >
                <SubmitButton submitting={submitting} />
              </div>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
};

/* ---------- Reusable pieces ---------- */

const Input = ({ label, ...props }) => (
  <div className="flex flex-col gap-2">
    <label className="text-sm text-[#3A3D42] tracking-[-0.2px]">{label}</label>
    <input
      {...props}
      required
      className="bg-white border border-[#EEE0CF] text-[#0D060C] placeholder:text-[#0D060C] text-sm tracking-[-0.2px] w-full px-5 py-3.5 rounded-[8px] outline-none focus:border-[#CE8936] transition"
    />
  </div>
);

const Notes = ({ value, onChange }) => (
  <div className="flex flex-col gap-[11px]">
    <label className="text-sm font-medium text-[#0D060C] tracking-[-0.2px]">
      Notes (Optional)
    </label>
    <textarea
      name="notes"
      rows={4}
      value={value}
      onChange={onChange}
      placeholder="Please indicate which contraceptive medicine you are currently on"
      className="border border-[#D9D9D9] rounded-[8px] px-4 pt-[15px] pb-4 text-sm tracking-[-0.2px] text-[#0D060C] placeholder:text-[#3A3D42]/50 w-full outline-none focus:border-[#CE8936] transition resize-none"
    />
  </div>
);

const SummaryRow = ({ label, value }) => (
  <div className="text-[#3A3D42] flex items-start gap-2">
    <span>{label}</span>
    <span className="text-[#0D060C] font-medium">{value}</span>
  </div>
);

const SubmitButton = ({ submitting }) => (
  <button
    type="submit"
    disabled={submitting}
    className="group w-full bg-theme text-white text-base font-medium py-3 px-[18px] rounded-full hover:bg-[#491F40] transition duration-300 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
  >
    <span className="flex items-center justify-center gap-1.5">
      {submitting ? "Confirming…" : "Confirm booking"}
      {!submitting && (
        <ArrowUpRight className="size-5 group-hover:rotate-45 transition duration-300" />
      )}
    </span>
  </button>
);

export default ConfirmBooking;
