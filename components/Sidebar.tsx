"use client";
import type { Page } from "@/types";

interface NavSubItem {
  id: string;
  icon: string;
  label: string;
  locked: boolean;
}

interface NavItem {
  id: string;
  icon: string;
  label: string;
  locked: boolean;
  subItems?: NavSubItem[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "Main",
    items: [
      { id: "dashboard", icon: "fa-gauge-high", label: "Dashboard", locked: false },
    ],
  },
  {
    label: "Business",
    items: [
      { id: "stock", icon: "fa-boxes-stacked", label: "Stock / Inventory", locked: false },
      { id: "purchase", icon: "fa-cart-flatbed", label: "Purchase", locked: false },
      { id: "invoice", icon: "fa-file-invoice", label: "Invoice", locked: false },
      { id: "refund", icon: "fa-rotate-left", label: "Refund & Replace", locked: false },
      { id: "cashbook", icon: "fa-book-open", label: "Cashbook", locked: false },
      { id: "tax", icon: "fa-receipt", label: "Tax Management", locked: true },
    ],
  },
  {
    label: "Workers",
    items: [
      { id: "workers", icon: "fa-people-group", label: "Karegar (Workers)", locked: false },
      { id: "orderupdate", icon: "fa-rotate", label: "Order Updates", locked: false },
    ],
  },
  {
    label: "More",
    items: [
      { id: "reports", icon: "fa-chart-bar", label: "Reports", locked: false },
      { id: "settings", icon: "fa-gear", label: "Settings", locked: false },
    ],
  },
];

interface SidebarProps {
  activePage: Page;
  setActivePage: (p: Page) => void;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ activePage, setActivePage, onLogout, isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay backdrop */}
      <div
        className={`sidebar-overlay${isOpen ? " active" : ""}`}
        onClick={onClose}
      />
      <aside
        className={`app-sidebar${isOpen ? " sidebar-open" : ""}`}
        style={{
          position: "fixed", top: 0, left: 0, bottom: 0, width: 248,
          background: "var(--ink)", display: "flex", flexDirection: "column", zIndex: 100,
          boxShadow: "4px 0 30px rgba(0,0,0,.25)"
        }}>
      {/* Logo */}
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,.07)",
        display: "flex", alignItems: "center", gap: 12,
        background: "rgba(255,255,255,.03)"
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: "white", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Garments" style={{ objectFit: "contain", width: "100%", height: "100%" }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "white", lineHeight: 1.3 }}>Garments</div>
          <div style={{ fontSize: 9.5, color: "var(--blue4)", letterSpacing: ".5px", textTransform: "uppercase", marginTop: 1 }}>Tailor Mgmt System</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "12px 0 8px" }}>
        {navSections.map((section) => (
          <div key={section.label}>
            <div style={{
              padding: "12px 20px 5px", fontSize: 9.5, fontWeight: 700,
              color: "rgba(90,171,240,.6)", letterSpacing: "1.2px", textTransform: "uppercase"
            }}>{section.label}</div>

            {section.items.map((item) => {
              const isActive = activePage === item.id;
              const subActive = item.subItems?.some(s => activePage === s.id) ?? false;
              const showSub = (isActive || subActive) && item.subItems && item.subItems.length > 0;

              return (
                <div key={item.id}>
                  {/* Main item */}
                  <div
                    onClick={() => !item.locked && setActivePage(item.id as Page)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "9px 20px",
                      color: item.locked ? "rgba(168,212,248,.35)" : (isActive || subActive) ? "white" : "rgba(168,212,248,.75)",
                      cursor: item.locked ? "not-allowed" : "pointer",
                      fontSize: 13, fontWeight: (isActive || subActive) ? 600 : 500,
                      borderLeft: isActive ? "3px solid var(--blue3)" : "3px solid transparent",
                      margin: "1px 8px 1px 0",
                      borderRadius: "0 8px 8px 0",
                      background: isActive
                        ? "linear-gradient(90deg, rgba(26,111,204,.35), rgba(26,111,204,.12))"
                        : subActive ? "rgba(26,111,204,.08)" : "transparent",
                      opacity: item.locked ? 0.55 : 1,
                      transition: "all var(--tr)",
                      position: "relative",
                    }}
                  >
                    <i className={`fa-solid ${item.icon}`} style={{
                      width: 18, textAlign: "center", fontSize: 14, flexShrink: 0,
                      opacity: (isActive || subActive) ? 1 : 0.8,
                      color: (isActive || subActive) ? "var(--blue4)" : "inherit"
                    }}></i>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.locked && (
                      <i className="fa-solid fa-lock" style={{ fontSize: 10, opacity: 0.6 }}></i>
                    )}
                    {item.subItems && !item.locked && (
                      <i className={`fa-solid fa-chevron-${showSub ? "down" : "right"}`} style={{ fontSize: 9, opacity: 0.5 }}></i>
                    )}
                    {isActive && !item.subItems && (
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: "var(--blue4)",
                        animation: "pulse 2s infinite",
                        display: "inline-block"
                      }}></span>
                    )}
                  </div>

                  {/* Sub-items */}
                  {showSub && item.subItems!.map((sub) => {
                    const subIsActive = activePage === sub.id;
                    return (
                      <div
                        key={sub.id}
                        onClick={() => !sub.locked && setActivePage(sub.id as Page)}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "7px 20px 7px 44px",
                          color: sub.locked ? "rgba(168,212,248,.25)" : subIsActive ? "white" : "rgba(168,212,248,.55)",
                          cursor: sub.locked ? "not-allowed" : "pointer",
                          fontSize: 12, fontWeight: subIsActive ? 600 : 400,
                          borderLeft: subIsActive ? "3px solid var(--blue3)" : "3px solid transparent",
                          margin: "1px 8px 1px 0",
                          borderRadius: "0 8px 8px 0",
                          background: subIsActive
                            ? "linear-gradient(90deg, rgba(26,111,204,.3), rgba(26,111,204,.08))"
                            : "transparent",
                          opacity: sub.locked ? 0.4 : 1,
                          transition: "all var(--tr)",
                        }}
                      >
                        <i className={`fa-solid ${sub.icon}`} style={{
                          width: 14, textAlign: "center", fontSize: 12, flexShrink: 0,
                          color: subIsActive ? "var(--blue4)" : "inherit", opacity: subIsActive ? 1 : 0.7
                        }}></i>
                        <span style={{ flex: 1 }}>{sub.label}</span>
                        {sub.locked && <i className="fa-solid fa-lock" style={{ fontSize: 9, opacity: 0.5 }}></i>}
                        {subIsActive && (
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--blue4)", animation: "pulse 2s infinite", display: "inline-block" }}></span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer user */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--blue), var(--blue2))",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 13, fontWeight: 700, flexShrink: 0
          }}>A</div>
          <div>
            <div style={{ fontSize: 13, color: "white", fontWeight: 600 }}>Admin</div>
            <div style={{ fontSize: 10, color: "var(--blue4)" }}>Administrator</div>
          </div>
          <button
            onClick={onLogout}
            title="Sign out"
            style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(90,171,240,.6)", cursor: "pointer", fontSize: 15, padding: 6, borderRadius: 7, transition: "color var(--tr)" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--red)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(90,171,240,.6)"}
          >
            <i className="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      </div>
      <div style={{ padding: "8px 16px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,.05)" }}>
        <p style={{ fontSize: 9.5, color: "rgba(90,171,240,.4)", letterSpacing: ".3px" }}>
          Powered by <span style={{ color: "rgba(90,171,240,.7)", fontWeight: 600 }}>AddsMint.com</span>
        </p>
      </div>
      </aside>
    </>
  );
}
