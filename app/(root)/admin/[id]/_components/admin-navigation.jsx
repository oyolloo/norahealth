"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Sections of the combined patient record on /account
const SECTIONS = [
  { id: "account-info", label: "Account Info" },
  { id: "appointments", label: "Appointments" },
  { id: "orders", label: "Orders" },
];

const AdminNavigation = ({ userId }) => {
  const path = usePathname();
  const accountPath = `/admin/${userId}/account`;
  const onAccount = path.toString() === accountPath;
  const [active, setActive] = useState(SECTIONS[0].id);
  const clickLock = useRef(null);

  // Highlight the section currently in view
  useEffect(() => {
    if (!onAccount) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Skip updates while a button click is scrolling the page
        if (clickLock.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.left - b.boundingClientRect.left);
        if (visible.length) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [onAccount]);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
    clearTimeout(clickLock.current);
    clickLock.current = setTimeout(() => (clickLock.current = null), 1000);
  };

  return (
    <>
      <div className='flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide'>
        <ButtonGroup>
          <ButtonGroup className='hidden sm:flex'>
            <Button variant='outline' size='icon' aria-label='Go Back' asChild>
              <Link href='/admin'>
                <ArrowLeftIcon />
              </Link>
            </Button>
          </ButtonGroup>
          <ButtonGroup>
            {SECTIONS.map(({ id, label }) =>
              onAccount ? (
                <Button
                  key={id}
                  variant={active === id ? "default" : "outline"}
                  aria-current={active === id ? "true" : undefined}
                  onClick={() => scrollTo(id)}
                >
                  {label}
                </Button>
              ) : (
                <Button key={id} variant='outline' asChild>
                  <Link href={`${accountPath}#${id}`}>{label}</Link>
                </Button>
              ),
            )}
          </ButtonGroup>
        </ButtonGroup>
      </div>
    </>
  );
};

export default AdminNavigation;
