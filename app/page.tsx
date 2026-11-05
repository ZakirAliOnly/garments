"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import LoginPage from "@/components/pages/LoginPage";
import DashboardPage from "@/components/pages/DashboardPage";
import StockPage from "@/components/pages/StockPage";
import InvoicePage from "@/components/pages/InvoicePage";
import RefundPage from "@/components/pages/RefundPage";
import CashbookPage from "@/components/pages/CashbookPage";
import PurchasePage from "@/components/pages/PurchasePage";
import SettingsPage from "@/components/pages/SettingsPage";
import ReportsPage from "@/components/pages/ReportsPage";
import { authClient } from "@/lib/auth/client";
import type { Page } from "@/types";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null); // null = checking
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    authClient.getSession().then(setIsLoggedIn);
  }, []);

  // Still checking — show nothing to avoid login flash
  if (isLoggedIn === null) return null;

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div>
      <Sidebar
        activePage={activePage}
        setActivePage={(p) => { setActivePage(p); setInvoiceSearch(""); setSidebarOpen(false); }}
        onLogout={async () => { await authClient.signOut(); setIsLoggedIn(false); }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <Header onNavigate={(page, query = "") => { setActivePage(page); setInvoiceSearch(query); }} activePage={activePage} onMenuToggle={() => setSidebarOpen(o => !o)} />
      <main className="workspace" style={{
        marginLeft: "var(--sw)",
        marginTop: "var(--hh)",
        padding: "24px 24px 56px",
        minHeight: "calc(100vh - var(--hh))"
      }}>
        {activePage === "dashboard" && <DashboardPage setActivePage={setActivePage} />}
        {activePage === "stock" && <StockPage />}
        {activePage === "invoice" && <InvoicePage searchQuery={invoiceSearch} />}
        {activePage === "refund" && <RefundPage />}
        {activePage === "cashbook" && <CashbookPage />}
        {activePage === "purchase" && <PurchasePage />}
        {activePage === "settings" && <SettingsPage />}
        {activePage === "reports" && <ReportsPage />}
      </main>
      <footer style={{
        position: "fixed",
        bottom: 0,
        left: "var(--sw)",
        right: 0,
        zIndex: 80,
        padding: "10px 24px",
        borderTop: "1px solid var(--bg2)",
        background: "rgba(255,255,255,.92)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "11px",
        color: "var(--muted)"
      }}>
        <span>Garments Tailor Management System &copy; {new Date().getFullYear()}</span>
        <span>Powered by <strong style={{ color: "var(--blue)" }}>AddsMint.com</strong></span>
      </footer>
    </div>
  );
}
