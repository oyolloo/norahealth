"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Heart, ArrowRight } from "lucide-react";
import { submitBpAction } from "@/actions/bp.action";

export default function BpForm({ token, reading, patientName, reviewDateFormatted, medicineName }) {
  const [systolic, setSystolic] = useState(reading?.systolic ? String(reading.systolic) : "");
  const [diastolic, setDiastolic] = useState(reading?.diastolic ? String(reading.diastolic) : "");
  const [readingDate, setReadingDate] = useState(() => {
    if (reading?.readingDate) {
      return new Date(reading.readingDate).toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(reading?.status === "submitted");
  const [submittedData, setSubmittedData] = useState(
    reading?.status === "submitted"
      ? {
          systolic: reading.systolic,
          diastolic: reading.diastolic,
          date: reading.readingDate,
        }
      : null
  );

  async function handleSubmit(e) {
    e.preventDefault();
    const sys = Number(systolic);
    const dia = Number(diastolic);

    if (!sys || sys < 70 || sys > 250) {
      toast.error("Please enter a valid systolic (top) number between 70 and 250 mmHg.");
      return;
    }
    if (!dia || dia < 40 || dia > 150) {
      toast.error("Please enter a valid diastolic (bottom) number between 40 and 150 mmHg.");
      return;
    }
    if (sys <= dia) {
      toast.error("Systolic (top number) must be higher than diastolic (bottom number).");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("systolic", String(sys));
      fd.set("diastolic", String(dia));
      fd.set("readingDate", readingDate);

      const res = await submitBpAction(token, fd);
      if (res.success) {
        setSubmitted(true);
        setSubmittedData({
          systolic: sys,
          diastolic: dia,
          date: readingDate,
        });
        toast.success("Blood pressure reading submitted successfully.");
      } else {
        toast.error(res.msg || "Failed to submit reading.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted && submittedData) {
    return (
      <div className="rounded-2xl border border-[#B7E1CD] bg-[#F4FAF6] p-6 text-center sm:p-8">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[#E6F4EC] text-[#1F7A4D]">
          <CheckCircle2 className="size-8" strokeWidth={2.2} />
        </div>
        <h2 className="text-xl font-bold text-[#1F7A4D] sm:text-2xl">
          Thank you, {patientName || "Patient"}!
        </h2>
        <p className="mt-2 text-sm text-[#2E5B3D]">
          Your blood pressure reading of{" "}
          <strong className="font-semibold text-[#1F7A4D]">
            {submittedData.systolic}/{submittedData.diastolic} mmHg
          </strong>{" "}
          has been safely received and recorded in your Nora Health clinical file.
        </p>

        {reviewDateFormatted ? (
          <div className="mt-6 rounded-xl border border-[#D5E1F2] bg-white p-4 text-left shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#2B5DA8]">
              Next Step: Consultation Review
            </p>
            <p className="mt-1 text-sm text-[#1F2122]">
              Our clinician will review your blood pressure during your upcoming review call on{" "}
              <strong>{reviewDateFormatted}</strong>.
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-6 text-xs text-[#6B7280] underline hover:text-[#1F2122] cursor-pointer"
        >
          Need to update or re-submit this reading?
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Inputs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor="bp-sys"
            className="flex items-center justify-between text-sm font-semibold text-[#0D060C]"
          >
            <span>Systolic (Top number)</span>
            <span className="text-xs font-normal text-muted-foreground">mmHg</span>
          </label>
          <div className="relative">
            <input
              id="bp-sys"
              type="number"
              inputMode="numeric"
              required
              min={70}
              max={250}
              value={systolic}
              onChange={(e) => setSystolic(e.target.value)}
              placeholder="e.g. 120"
              className="w-full rounded-lg border border-[#EEE0CF] bg-white px-4 py-3 text-base text-[#0D060C] placeholder:text-muted-foreground/60 outline-none focus:border-[#CE8936] transition"
            />
          </div>
          <p className="text-[12px] text-muted-foreground">Usually between 90 and 140</p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="bp-dia"
            className="flex items-center justify-between text-sm font-semibold text-[#0D060C]"
          >
            <span>Diastolic (Bottom number)</span>
            <span className="text-xs font-normal text-muted-foreground">mmHg</span>
          </label>
          <div className="relative">
            <input
              id="bp-dia"
              type="number"
              inputMode="numeric"
              required
              min={40}
              max={150}
              value={diastolic}
              onChange={(e) => setDiastolic(e.target.value)}
              placeholder="e.g. 80"
              className="w-full rounded-lg border border-[#EEE0CF] bg-white px-4 py-3 text-base text-[#0D060C] placeholder:text-muted-foreground/60 outline-none focus:border-[#CE8936] transition"
            />
          </div>
          <p className="text-[12px] text-muted-foreground">Usually between 60 and 90</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="bp-date" className="block text-sm font-semibold text-[#0D060C]">
          Date reading was taken
        </label>
        <input
          id="bp-date"
          type="date"
          required
          max={new Date().toISOString().slice(0, 10)}
          value={readingDate}
          onChange={(e) => setReadingDate(e.target.value)}
          className="w-full rounded-lg border border-[#EEE0CF] bg-white px-4 py-3 text-sm text-[#0D060C] outline-none focus:border-[#CE8936] transition"
        />
      </div>

      {/* NHS Red-flag Clinical Guidance Notice */}
      <div className="rounded-xl border border-[#F5C2BC] bg-[#FDECEA] p-4 text-xs leading-relaxed text-[#7A1A12]">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="size-4 shrink-0 text-[#B42318] mt-0.5" />
          <div>
            <strong className="font-semibold text-[#B42318] block mb-0.5">
              NHS Safety Notice:
            </strong>
            If your blood pressure is consistently 140/90 mmHg or higher, or if you feel unwell, have a severe headache, blurred vision, or chest pain, please seek immediate medical advice or call NHS 111.
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="group flex w-full items-center justify-center gap-2 rounded-full bg-[#D6866B] py-3.5 px-6 text-base font-semibold text-white transition hover:bg-[#c5755a] disabled:cursor-not-allowed disabled:bg-[#D9D9D9] disabled:text-[#6B6660] cursor-pointer"
      >
        <span>{loading ? "Submitting..." : "Submit Blood Pressure"}</span>
        {!loading && <ArrowRight className="size-4 transition group-hover:translate-x-1" />}
      </button>
    </form>
  );
}

