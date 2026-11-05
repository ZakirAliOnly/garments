"use client";
import type { Page } from "@/types";
const titles: Record<Page, [string, string]> = {
 dashboard: ["Dashboard", "house"], stock: ["Stock / Inventory", "boxes-stacked"], purchase: ["Purchase", "cart-shopping"], invoice: ["Invoice", "file-invoice"], refund: ["Refund & Replace", "rotate-left"], cashbook: ["Cashbook", "book-open"], reports: ["Reports", "chart-line"], settings: ["Settings", "gear"]
};
export default function Header({activePage, onMenuToggle}: {activePage: Page; onMenuToggle?: () => void}) {
 const [title, icon] = titles[activePage];
 return <header className="app-header"><button className="menu-toggle-btn" onClick={onMenuToggle} aria-label="Open menu"><i className="fa-solid fa-bars" /></button><i aria-hidden="true" className={`page-icon fa-solid fa-${icon}`} /><h1>{title}</h1><span className="header-caption">Your business, at a glance</span></header>;
}
