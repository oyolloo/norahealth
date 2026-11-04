import React from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBpReadingByToken } from "@/lib/bpToken";
import BpForm from "./_components/bp-form";

export const metadata = {
  title: "Submit Blood Pressure | Nora Health NHS",
  description: "Submit your home blood pressure reading for your upcoming NHS oral contraception review.",
};

export default async function BpPage({ params }) {
  const { token } = await params;
  const reading = await getBpReadingByToken(token);

  if (!reading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-[#E7D8C6] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[#FDECEA] text-[#B42318]">
            !
          </div>
          <h1 className="text-xl font-bold text-[#0D060C]">Invalid or Expired Link</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This blood pressure submission link is invalid, has expired, or has already been completed.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-block rounded-full bg-[#D6866B] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#c5755a]"
            >
              Go to Nora Health Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (reading.alreadySubmitted) {
    const first = reading.user?.account?.firstName?.trim() || "there";
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-[#E7D8C6] bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-[#0D060C]">Thank you, {first}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We have your blood pressure reading. Our clinician will review it at your appointment.
          </p>
        </div>
      </div>
    );
  }

  // First name only: the page opens without a login.
  const patientName = reading.user?.account?.firstName?.trim() || "there";

  const futureApptDate = reading.order?.futureApptAt;
  const reviewDateFormatted = futureApptDate
    ? new Date(futureApptDate).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;

  const medicineName =
    reading.order?.medicineName || "Combined Oral Contraception";

  return (
    <div className="min-h-screen bg-[#FAF7F3] py-8 px-4 sm:py-12">
      <div className="mx-auto max-w-xl">
        {/* Header Branding */}
        <div className="mb-6 text-center">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-bold tracking-tight text-[#3F1535]">
              Nora<span className="text-[#D6866B]">Health</span>
            </span>
          </Link>
          <span className="ml-2 inline-flex items-center rounded-full bg-[#E8F0FB] px-2.5 py-0.5 text-xs font-semibold text-[#2B5DA8]">
            NHS Service
          </span>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#E7D8C6] bg-white p-6 shadow-sm sm:p-8">
          {/* Patient Context Banner */}
          <div className="mb-6 rounded-xl border border-[#EEE0CF] bg-[#FAF9F8] p-4 text-sm">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <span className="block text-xs font-medium text-muted-foreground">Patient</span>
                <strong className="font-semibold text-[#0D060C]">{patientName}</strong>
              </div>
              {reviewDateFormatted && (
                <div>
                  <span className="block text-xs font-medium text-muted-foreground">
                    Upcoming Review Date
                  </span>
                  <strong className="font-semibold text-[#0D060C]">{reviewDateFormatted}</strong>
                </div>
              )}
            </div>
            <div className="mt-3 border-t border-[#E7D8C6]/60 pt-2 text-xs text-[#6B6660]">
              <span>Medication: </span>
              <strong className="font-medium text-[#0D060C]">{medicineName}</strong>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="text-xl font-bold text-[#0D060C] sm:text-2xl">
              Submit Your Blood Pressure Reading
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Please enter your recent home blood pressure reading below so our clinician can review it during your consultation.
            </p>
          </div>

          {/* Form */}
          <BpForm
            token={token}
            reading={reading}
            patientName={patientName}
            reviewDateFormatted={reviewDateFormatted}
            medicineName={medicineName}
          />
        </div>

        {/* Footer info */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Nora Health in partnership with Manor Chemist & Clinic. Powered by NHS Community Pharmacy Contraception Service.
        </p>
      </div>
    </div>
  );
}

