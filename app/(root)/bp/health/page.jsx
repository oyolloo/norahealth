import VerifyForm from "./_components/verify-form";

export const metadata = {
  title: "Submit Blood Pressure | Nora Health NHS",
  description: "Submit your home blood pressure reading for your upcoming NHS oral contraception review.",
  robots: { index: false, follow: false },
};

export default function BpHealthPage() {
  return (
    <div className="min-h-[70vh] bg-[#FAF7F3] py-8 px-4 sm:py-12">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-[#E7D8C6] bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-bold text-[#0D060C] sm:text-2xl">Your blood pressure reading</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            To keep your details safe, please confirm who you are first.
          </p>
          <div className="mt-6">
            <VerifyForm />
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Nora Health in partnership with Manor Chemist & Clinic. Powered by NHS Community Pharmacy Contraception Service.
        </p>
      </div>
    </div>
  );
}
