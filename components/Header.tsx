"use client";
import type { Page } from "@/types";

const pageTitles: Record<string, string> = {
  dashboard: "Dashboard",
  stock: "Stock / Inventory",
  invoice: "Invoice",
  refund: "Refund & Replace",
  cashbook: "Cashbook",
};

export default function Header({ activePage, onMenuToggle }: { activePage: Page; onMenuToggle?: () => void }) {
  return (
    <header style={{
      position: "fixed", top: 0, left: "var(--sw)", right: 0, height: "var(--hh)",
      background: "rgba(255,255,255,.95)", backdropFilter: "blur(20px)",
      borderBottom: "1px solid var(--bg2)",
      display: "flex", alignItems: "center", padding: "0 24px", gap: 14, zIndex: 90,
      boxShadow: "0 2px 20px rgba(10,22,40,.06)"
    }}>
      {/* Hamburger — visible only on mobile via CSS */}
      <button
        className="menu-toggle-btn"
        onClick={onMenuToggle}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--ink)", fontSize: 18, padding: "4px 6px", borderRadius: 8,
          alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
        aria-label="Open menu"
      >
        <i className="fa-solid fa-bars"></i>
      </button>

      <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", flex: 1, letterSpacing: "-.2px" }}>
        {pageTitles[activePage] || activePage}
      </div>
    </header>
  );
}
