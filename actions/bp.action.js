"use server";

import { submitBpReading } from "@/lib/bpToken";

export async function submitBpAction(token, formData) {
  const systolic = formData.get("systolic");
  const diastolic = formData.get("diastolic");
  const readingDate = formData.get("readingDate");

  return await submitBpReading(token, {
    systolic,
    diastolic,
    readingDate,
  });
}

