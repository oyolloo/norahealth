import { AdminProvider } from "@/lib/adminContext";
import React from "react";
import AdminSidebar from "./_components/adminSidebar";
import { ProfileProvider } from "@/lib/profileContext";

export const metadata = {
  title: "Admin",
  description: "Free Oral Contraception, Delivered to Your Door",
};

const layout = ({ children }) => {
  return (
    <ProfileProvider>
      <AdminProvider>
        {/* translate="no" / notranslate: keep the Google Translate widget away
            from the admin UI. Translate rewrites text nodes (wraps them in
            <font> tags), which collides with React re-renders here and can throw
            hydration error #418 and spin into a re-render loop when filtering the
            large tables. Admin is staff-only/English, so it never needs it. */}
        <section translate="no" className='notranslate py-0 lg:py-[130px] relative'>
          <div className='container custom-container mx-auto px-0 md:px-[24px] sm:px-0 py-0 sm:py-5 md:py-10 lg:py-0'>
            <div className=' bg-[#FAF9F8] md:bg-[#FAF9F8] rounded-[16px] shadow-[0_10px_80px_0_rgba(30,96,221,0.06)] flex'>
              {/* SIDEBAR */}
              <AdminSidebar />
              {/* MAIN CONTENT */}
              {children}
            </div>
          </div>
        </section>
      </AdminProvider>
    </ProfileProvider>
  );
};

export default layout;
