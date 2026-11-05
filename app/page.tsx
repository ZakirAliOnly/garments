"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hasPage, pagesFor, type SessionUser } from "@/lib/auth/permissions";
import UsersPage from "@/components/pages/UsersPage";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import LoginPage from "@/components/pages/LoginPage";
import DashboardPage from "@/components/pages/DashboardPage";
import StockPage from "@/components/pages/StockPage";
import InvoicePage from "@/components/pages/InvoicePage";
import RefundPage from "@/components/pages/RefundPage";
import ExpensesPage from "@/components/pages/ExpensesPage";
import CashbookPage from "@/components/pages/CashbookPage";
import PurchasePage from "@/components/pages/PurchasePage";
import SettingsPage from "@/components/pages/SettingsPage";
import WorkersPage from "@/components/pages/WorkersPage";
import PaymentMethodsPage from "@/components/pages/PaymentMethodsPage";
import ReportsPage from "@/components/pages/ReportsPage";
import { authClient } from "@/lib/auth/client";
import type { Page } from "@/types";

export default function Home() {
  const cache = useQueryClient();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [activePage, setActivePage] = useState<Page | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const identity = useRef<string | null>(null);
  const refreshSession = useCallback(async () => {
    try {
      const next = await authClient.getSession();
      const key = next ? JSON.stringify(next) : null;
      if (identity.current !== key) {
        cache.clear();
        identity.current = key;
      }
      setUser(next);
      setSessionError("");
      setActivePage((page) =>
        next
          ? page && hasPage(next, page)
            ? page
            : (pagesFor(next)[0] ?? null)
          : null,
      );
    } catch {
      setSessionError("Unable to check your session. Please try again.");
    } finally {
      setChecking(false);
    }
  }, [cache]);
  useEffect(() => {
    void refreshSession();
    const interval = setInterval(() => void refreshSession(), 30000);
    const focus = () => void refreshSession();
    window.addEventListener("focus", focus);
    window.addEventListener("garments:session-changed", focus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", focus);
      window.removeEventListener("garments:session-changed", focus);
    };
  }, [refreshSession]);
  const navigate = (page: Page, query = "") => {
    if (user && hasPage(user, page)) {
      setActivePage(page);
      setInvoiceSearch(query);
      setSidebarOpen(false);
    }
    void refreshSession();
  };
  if (checking) return null;
  if (!user) {
    if (sessionError)
      return (
        <div className="finance-empty" role="alert">
          {sessionError}
          <button
            className="finance-button"
            onClick={() => void refreshSession()}
          >
            Retry
          </button>
        </div>
      );
    return <LoginPage onLogin={() => void refreshSession()} />;
  }
  const allowedPages = pagesFor(user);

  return (
    <div>
      <Sidebar
        activePage={activePage}
        user={user}
        allowedPages={allowedPages}
        setActivePage={navigate}
        onLogout={async () => {
          await authClient.signOut();
          cache.clear();
          identity.current = null;
          setUser(null);
          setActivePage(null);
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <Header
        allowedPages={allowedPages}
        onNavigate={navigate}
        activePage={activePage}
        onMenuToggle={() => setSidebarOpen((o) => !o)}
      />
      <main
        className="workspace"
        style={{
          marginLeft: "var(--sw)",
          marginTop: "var(--hh)",
          padding: "24px 24px 56px",
          minHeight: "calc(100vh - var(--hh))",
        }}
      >
        {sessionError && (
          <div className="finance-error" role="alert">
            {sessionError}
          </div>
        )}
        {!activePage && (
          <div className="finance-empty">
            <i className="fa-solid fa-lock" aria-hidden="true" />
            <h2>No module access yet</h2>
            <p>Ask your administrator to allow the pages you need.</p>
            <button
              className="finance-button secondary"
              onClick={() => void refreshSession()}
            >
              Refresh access
            </button>
          </div>
        )}
        {activePage === "user-management" && user.role === "admin" && (
          <UsersPage currentUserId={user.id} />
        )}
        {activePage === "dashboard" && (
          <DashboardPage allowedPages={allowedPages} setActivePage={navigate} />
        )}
        {activePage === "stock" && <StockPage />}
        {activePage === "invoice" && (
          <InvoicePage searchQuery={invoiceSearch} />
        )}
        {activePage === "refund" && <RefundPage />}
        {activePage === "expenses" && <ExpensesPage />}
        {activePage === "cashbook" && <CashbookPage />}
        {activePage === "purchase" && <PurchasePage />}
        {activePage === "settings" && <SettingsPage />}
        {activePage === "workers" && <WorkersPage />}
        {activePage === "payment-methods" && <PaymentMethodsPage />}
        {activePage === "reports" && <ReportsPage />}
      </main>
      <footer
        style={{
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
          color: "var(--muted)",
        }}
      >
        <span>
          Garments Tailor Management System &copy; {new Date().getFullYear()}
        </span>
        <span>
          Powered by{" "}
          <strong style={{ color: "var(--blue)" }}>AddsMint.com</strong>
        </span>
      </footer>
    </div>
  );
}
