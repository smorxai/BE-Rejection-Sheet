"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/": "Overview Dashboard",
  "/entry": "Rejection Entry",
  "/entry/rework": "Rework Entry",
  "/entries": "Entries Log",
  "/analytics": "Analytics & Trends",
  "/ai": "AI Insights",
  "/admin/lines": "Admin – Production Lines",
  "/admin/parts": "Admin – Process Types",
  "/admin/defects": "Admin – Defect Types",
  "/admin/users": "Admin – Users",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          title={TITLES[pathname] ?? "Dashboard"}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
