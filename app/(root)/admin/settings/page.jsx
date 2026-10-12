import { getAddressSettingsAction } from "@/actions/settings.action";
import AddressSettingsForm from "./_components/address-settings-form";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Open Google Cloud",
    body: (
      <>
        Go to{" "}
        <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-[#B4690E] underline">
          console.cloud.google.com
        </a>{" "}
        and sign in with the Google account you want to own this. Create a new project, for example
        &ldquo;Nora Health&rdquo;.
      </>
    ),
  },
  {
    title: "Turn on billing",
    body: (
      <>
        Open <b>Billing</b> and link a billing account to the project. Google needs a card on file for
        address search. Google&rsquo;s pricing page lists any free monthly usage, so check it there.
        Under <b>Billing &gt; Budgets &amp; alerts</b> you can set a monthly budget so you get an email
        before costs grow.
      </>
    ),
  },
  {
    title: "Enable Places API (New)",
    body: (
      <>
        Open <b>APIs &amp; Services &gt; Library</b>, search for <b>Places API (New)</b> and press{" "}
        <b>Enable</b>. Pick the one with &ldquo;(New)&rdquo; in the name.
      </>
    ),
  },
  {
    title: "Create an API key",
    body: (
      <>
        Open <b>APIs &amp; Services &gt; Credentials</b>, press <b>Create credentials &gt; API key</b> and
        copy the key Google shows you.
      </>
    ),
  },
  {
    title: "Restrict the key",
    body: (
      <>
        Edit the key. Under <b>API restrictions</b> choose <b>Restrict key</b> and tick only{" "}
        <b>Places API (New)</b>. Under <b>Application restrictions</b> choose <b>IP addresses</b> and add
        your website server&rsquo;s IP address (your developer can give it to you). Do not use
        &ldquo;Websites&rdquo;: this site calls Google from its server, so a website restriction would
        block it.
      </>
    ),
  },
  {
    title: "Cap daily use (recommended)",
    body: (
      <>
        Open <b>APIs &amp; Services &gt; Places API (New) &gt; Quotas</b> and lower the requests-per-day
        limit to a number you are comfortable paying for. The site also stops calling Google after 1,000
        searches in an hour.
      </>
    ),
  },
  {
    title: "Paste it here",
    body: (
      <>
        Paste the key below, press <b>Test key</b>, turn on <b>Google address search</b> and press{" "}
        <b>Save</b>. If anything goes wrong, turn it off again and patients go back to the free
        postcode lookup.
      </>
    ),
  },
];

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

      <section className="rounded-2xl border border-[#ECE7E1] bg-white p-6">
        <h3 className="text-lg font-semibold text-[#0D060C]">How to get a Google API key</h3>
        <p className="mt-1 text-sm text-[#6B6660]">About 10 minutes. You only do this once.</p>
        <ol className="mt-5 flex flex-col gap-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#CE8936] text-sm font-semibold text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-[#0D060C]">{s.title}</p>
                <p className="text-sm leading-6 text-[#3A3D42]">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-xs text-[#6B6660]">
          Google&rsquo;s own guide:{" "}
          <a
            href="https://developers.google.com/maps/documentation/places/web-service/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Places API overview
          </a>
          .
        </p>
      </section>
    </div>
  );
};

export default SettingsPage;
