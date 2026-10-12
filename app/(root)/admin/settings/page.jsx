import { getAddressSettingsAction } from "@/actions/settings.action";
import AddressSettingsForm from "./_components/address-settings-form";

export const dynamic = "force-dynamic";

const SettingsPage = async () => {
  const res = await getAddressSettingsAction();
  if (!res?.success) return <div className="w-full p-10">{res?.msg || "Could not load settings."}</div>;

  return (
    <div className="w-full min-w-0 p-6 md:p-10 flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#0D060C]">Settings</h2>
        <p className="text-sm text-[#6B6660]">Options that change how the patient side of the site works.</p>
      </div>

      <section className="rounded-2xl border border-[#ECE7E1] bg-white p-6 flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[#0D060C]">Address lookup</h3>
            <p className="text-sm text-[#6B6660] max-w-[62ch]">
              Helps patients fill in their home and delivery address on registration, profile and account
              forms.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              res.provider === "google" ? "bg-[#E7F4EC] text-[#1E6B3A]" : "bg-[#F4E7E1] text-[#0D060C]"
            }`}
          >
            In use: {res.provider === "google" ? "Google address search" : "Free postcode lookup"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#ECE7E1] bg-[#FAF9F8] p-4">
            <p className="text-sm font-semibold text-[#0D060C]">Free postcode lookup (default)</p>
            <p className="mt-1 text-sm text-[#3A3D42]">
              Works with no setup. As patients type a postcode they get matching UK postcodes, and a
              wrong postcode is flagged. They type the street address themselves.
            </p>
          </div>
          <div className="rounded-xl border border-[#ECE7E1] bg-[#FAF9F8] p-4">
            <p className="text-sm font-semibold text-[#0D060C]">Google address search (optional)</p>
            <p className="mt-1 text-sm text-[#3A3D42]">
              Patients start typing their address and pick it from a list. The address and postcode fill
              in for them. Needs your own Google API key and Google may charge for use.
            </p>
          </div>
        </div>

        {!res.ready && (
          <p className="rounded-lg bg-[#FBF0E2] px-4 py-3 text-sm text-[#8A5A12]">
            Settings storage is not set up on the server yet, so changes cannot be saved. Patients use the
            free postcode lookup until it is. Ask your developer to run the database update.
          </p>
        )}

        <AddressSettingsForm enabled={res.enabled} hasKey={res.hasKey} keyHint={res.keyHint} ready={res.ready} />
      </section>

    </div>
  );
};

export default SettingsPage;
