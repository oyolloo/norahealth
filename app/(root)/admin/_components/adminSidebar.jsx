"use client";
import { useAdmin } from "@/lib/adminContext";
import {
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  User,
  ClipboardClock,
  NotebookPen,
  Shield,
  Pill,
  Calendar,
  ChartColumn,
  Settings,
  MessageSquareText,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

const NAV_ITEMS = [
  {
    href: "/admin",
    label: "Patients",
    Icon: User,
    isActive: (p) => p === "/admin",
  },
  {
    href: "/admin/profile",
    label: "My Profile",
    Icon: Shield,
    isActive: (p) => p === "/admin/profile",
  },
  {
    href: "/admin/appointments",
    label: "Appointments",
    Icon: ClipboardClock,
    isActive: (p) =>
      p.startsWith("/admin/appointments") &&
      !p.startsWith("/admin/appointments-order"),
  },
  {
    href: "/admin/oc-orders",
    label: "OC Orders",
    Icon: Pill,
    isActive: (p) => p.startsWith("/admin/oc-orders"),
  },
  {
    href: "/admin/booking-slot",
    label: "Appointment Slot",
    Icon: Calendar,
    isActive: (p) => p.startsWith("/admin/booking-slot"),
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    Icon: ChartColumn,
    isActive: (p) => p.startsWith("/admin/analytics"),
  },
  {
    href: "/admin/blog",
    label: "Blogs",
    Icon: NotebookPen,
    isActive: (p) => p.startsWith("/admin/blog"),
  },
  {
    href: "/admin/automations",
    label: "Automations",
    Icon: MessageSquareText,
    isActive: (p) => p.startsWith("/admin/automations"),
  },
  {
    href: "/admin/settings",
    label: "Settings",
    Icon: Settings,
    isActive: (p) => p.startsWith("/admin/settings"),
  },
];

const AdminSidebar = () => {
  const { menuOpen, setMenuOpen, collapsed, setCollapsed } = useAdmin();
  const pathname = usePathname();

  const activeClasses = "bg-[#d67b0e] text-white";
  const inactiveClasses = "text-[#3A3D42] hover:bg-[#f4d9c0]";

  return (
    <aside
      className={`w-[300px] bg-[#F4E7E1] lg:rounded-[12px] p-6 pr-8 flex-shrink-0 absolute lg:relative top-0 lg:top-auto lg:left-0 h-dvh lg:h-auto transition-all duration-500 z-20 ${
        menuOpen ? "left-0" : "-left-[500px]"
      } ${collapsed ? "lg:w-[84px] lg:p-4" : "lg:w-[300px] lg:p-12"}`}
    >
      {/* Mobile close */}
      <button
        onClick={() => setMenuOpen(false)}
        className='lg:hidden w-[40px] h-[40px] items-center gap-2 bg-[#CE8936] text-white flex justify-center rounded-full absolute top-6 -right-5 z-10'
      >
        <PanelLeft />
      </button>

      {/* Desktop minimise / expand */}
      <div
        className={`hidden lg:flex mb-4 ${
          collapsed ? "justify-center" : "justify-end"
        }`}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand menu" : "Minimise menu"}
          title={collapsed ? "Expand menu" : "Minimise menu"}
          className='w-9 h-9 flex items-center justify-center rounded-full bg-[#CE8936] text-white hover:bg-[#b97622] transition cursor-pointer'
        >
          {collapsed ? (
            <PanelLeftOpen className='w-4 h-4' />
          ) : (
            <PanelLeftClose className='w-4 h-4' />
          )}
        </button>
      </div>

      <nav className='space-y-2 text-base'>
        {NAV_ITEMS.map(({ href, label, Icon, isActive }) => (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            className={`w-full flex items-center gap-2 py-2.5 px-3 rounded-[16px] text-left transition ${
              collapsed ? "lg:justify-center lg:px-2" : ""
            } ${isActive(pathname) ? activeClasses : inactiveClasses}`}
          >
            <Icon className='w-4 h-4 shrink-0' />
            <span className={collapsed ? "lg:hidden" : ""}>{label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
};

export default AdminSidebar;
