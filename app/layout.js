import { DM_Sans, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "react-datepicker/dist/react-datepicker.css";
import "react-calendar/dist/Calendar.css";
import "./globals.css";
import Script from "next/script";

const dmSams = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: "Nora Health",
  description: "Free Oral Contraception, Delivered to Your Door",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang='en'
      className={`${dmSams.variable} ${inter.variable} antialiased`}
    >
       {/* ✅ GTM Script (HEAD) */}
      <head>
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){w[l]=w[l]||[];
              w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});
              var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
              j.async=true;
              j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
              f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','GTM-KFPKM54F');
            `,
          }}
        />
      </head>
      <body>
        {/* ✅ GTM NoScript (immediately after body open) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-KFPKM54F"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <main>{children}</main>
        <Toaster position='top-center' />
      </body>
    </html>
  );
}
