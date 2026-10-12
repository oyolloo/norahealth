"use client";

import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

export default function ApiKeyHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="How to get a Google API key"
          className="grid size-5 place-items-center rounded-full text-[#B4690E] hover:bg-[#FBF0E2] focus-visible:outline-2 focus-visible:outline-[#CE8936]"
        >
          <Info className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-[min(440px,calc(100vw-32px))] max-h-[70vh] overflow-auto bg-white p-5 text-[#3A3D42]"
      >
        <p className="font-semibold text-[#0D060C]">How to get a Google API key</p>
        <p className="mt-0.5 text-xs text-[#6B6660]">About 10 minutes. You only do this once.</p>
        <ol className="mt-4 flex flex-col gap-3.5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#CE8936] text-xs font-semibold text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#0D060C]">{s.title}</p>
                <p className="text-[13px] leading-5">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-[#6B6660]">
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
      </PopoverContent>
    </Popover>
  );
}
