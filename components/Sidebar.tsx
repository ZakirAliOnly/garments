"use client";
import Image from "next/image";
import type { Page } from "@/types";
const sections: { label: string; items: { id: Page; icon: string; label: string }[] }[] = [
  { label: "Main", items: [{ id: "dashboard", icon: "house", label: "Dashboard" }] },
  { label: "Business", items: [
    { id: "stock", icon: "boxes-stacked", label: "Stock / Inventory" },
    { id: "purchase", icon: "cart-shopping", label: "Purchase" },
    { id: "invoice", icon: "file-invoice", label: "Invoice" },
    { id: "refund", icon: "rotate-left", label: "Refund & Replace" },
    { id: "cashbook", icon: "book-open", label: "Cashbook" },
    { id: "workers", icon: "users", label: "Workers" },
    { id: "payment-methods", icon: "wallet", label: "Payment Method" },
  ] },
  { label: "More", items: [{ id: "reports", icon: "chart-line", label: "Reports" }, { id: "settings", icon: "gear", label: "Settings" }] },
];
interface Props { activePage: Page; setActivePage: (p: Page) => void; onLogout: () => void; isOpen?: boolean; onClose?: () => void }
export default function Sidebar({ activePage, setActivePage, onLogout, isOpen, onClose }: Props) {
  return <>
    {isOpen && <button className="sidebar-overlay active" onClick={onClose} aria-label="Close navigation" />}
    <aside className={`app-sidebar${isOpen ? " sidebar-open" : ""}`}>
      <div className="brand"><Image src="/logo.svg" alt="" width={50} height={54} /><div><strong>Garments</strong><small>TAILOR MGMT SYSTEM</small></div></div>
      <nav aria-label="Main navigation">{sections.map(section => <div className="nav-section" key={section.label}>
        <p>{section.label}</p>{section.items.map(item => <button key={item.id} className={`nav-item${activePage === item.id ? " selected" : ""}`} aria-current={activePage === item.id ? "page" : undefined} onClick={() => setActivePage(item.id)}>
          <i aria-hidden="true" className={`fa-solid fa-${item.icon}`} /><span>{item.label}</span>{activePage === item.id && <span className="nav-dot" />}
        </button>)}
      </div>)}</nav>
      <div className="sidebar-account"><span className="avatar">A</span><div><strong>Admin</strong><small>Administrator</small></div><button onClick={onLogout} aria-label="Sign out"><i className="fa-solid fa-right-from-bracket" /></button></div>
    </aside>
  </>;
}
