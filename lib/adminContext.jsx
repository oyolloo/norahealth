"use client";
import { usePathname } from "next/navigation";
import React, { createContext, useContext, useEffect, useState } from "react";

const AdminContext = createContext();

export const AdminProvider = ({ children }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  // Desktop-only: the sidebar starts as an icon rail and opens over the page
  // on hover. The toggle pins it open. Persists across in-admin navigation
  // (provider stays mounted); reset to the rail on full reload.
  const [collapsed, setCollapsed] = useState(true);
  const pathname = usePathname();

  // Close mobile menu whenever pathname changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const value = {
    menuOpen,
    setMenuOpen,
    collapsed,
    setCollapsed,
  };
  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
};

export const useAdmin = () => useContext(AdminContext);
