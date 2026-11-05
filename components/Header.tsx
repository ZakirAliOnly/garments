"use client";
import { useEffect, useRef, useState } from "react";
import type { Page } from "@/types";

const titles: Record<Page, [string, string]> = {
  activity: ["Activity Log", "wave-square"],
  "user-management": ["User Management", "user-shield"],
  dashboard: ["Dashboard", "house"],
  stock: ["Stock / Inventory", "boxes-stacked"],
  purchase: ["Purchase", "cart-shopping"],
  invoice: ["Invoice", "file-invoice"],
  refund: ["Refund & Replace", "rotate-left"],
  cashbook: ["Cashbook", "book-open"],
  expenses: ["Expenses", "receipt"],
  workers: ["Workers", "users"],
  "payment-methods": ["Payment Method", "wallet"],
  reports: ["Reports", "chart-line"],
  settings: ["Settings", "gear"],
};
interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  query: string;
  page: Page;
}
interface StockAlert {
  id: string;
  name: string;
  quantity: number;
  lowStockThreshold: number;
}
interface Props {
  activePage: Page | null;
  allowedPages: Page[];
  onMenuToggle?: () => void;
  onNavigate: (page: Page, query?: string) => void;
}

export default function Header({
  activePage,
  allowedPages,
  onMenuToggle,
  onNavigate,
}: Props) {
  const [title, icon] = activePage ? titles[activePage] : ["Access", "lock"];
  const invoiceAccess = allowedPages.includes("invoice"),
    stockAccess = allowedPages.includes("stock"),
    searchAccess = invoiceAccess || stockAccess;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const visibleResults = results.filter((result) =>
    allowedPages.includes(result.page),
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState<StockAlert[] | null>(null);
  const [alertsError, setAlertsError] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setAlertsOpen(false);
      }
    };
    const outside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
        setAlertsOpen(false);
      }
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("mousedown", outside);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("mousedown", outside);
    };
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearchLoading(false);
      return;
    }
    const controller = new AbortController();
    setSearchLoading(true);
    setSearchError(false);
    const timeout = setTimeout(async () => {
      try {
        const [invoiceResponse, stockResponse] = await Promise.all([
          invoiceAccess
            ? fetch("/api/invoices", { signal: controller.signal })
            : null,
          stockAccess
            ? fetch("/api/stock?lean=1", { signal: controller.signal })
            : null,
        ]);
        if (
          (invoiceResponse && !invoiceResponse.ok) ||
          (stockResponse && !stockResponse.ok)
        )
          throw Error();
        const [invoices, stock] = await Promise.all([
          invoiceResponse ? invoiceResponse.json() : [],
          stockResponse ? stockResponse.json() : [],
        ]);
        const term = query.toLowerCase().trim();
        const matches: SearchResult[] = [
          ...invoices
            .filter((i: { invNumber: string; customerName: string }) =>
              `${i.invNumber} ${i.customerName}`.toLowerCase().includes(term),
            )
            .slice(0, 5)
            .map(
              (i: { id: string; invNumber: string; customerName: string }) => ({
                id: i.id,
                title: i.invNumber,
                subtitle: i.customerName || "Walk-in Customer",
                query: i.invNumber,
                page: "invoice" as Page,
              }),
            ),
          ...stock
            .filter((s: { name: string; code: string; sku: string }) =>
              `${s.name} ${s.code} ${s.sku}`.toLowerCase().includes(term),
            )
            .slice(0, 4)
            .map((s: { id: string; name: string; code: string }) => ({
              id: s.id,
              title: s.name,
              subtitle: s.code || "Stock / Inventory",
              query: "",
              page: "stock" as Page,
            })),
        ];
        setResults(matches);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setSearchError(true);
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, invoiceAccess, stockAccess]);

  const toggleAlerts = async () => {
    setSearchOpen(false);
    setAlertsOpen(!alertsOpen);
    if (alertsOpen) return;
    setAlerts(null);
    setAlertsError(false);
    try {
      const response = await fetch("/api/stock");
      if (!response.ok) throw Error();
      const stock: StockAlert[] = await response.json();
      setAlerts(stock.filter((s) => s.quantity <= s.lowStockThreshold));
    } catch {
      setAlertsError(true);
    }
  };
  const openResult = (result: SearchResult) => {
    onNavigate(result.page, result.query);
    setSearchOpen(false);
    setQuery("");
  };

  return (
    <header className="app-header">
      <button
        className="menu-toggle-btn"
        onClick={onMenuToggle}
        aria-label="Open menu"
      >
        <i aria-hidden="true" className="fa-solid fa-bars" />
      </button>
      <i aria-hidden="true" className={`page-icon fa-solid fa-${icon}`} />
      <h1>{title}</h1>
      <div className="header-tools" ref={containerRef}>
        {searchAccess && (
          <form
            className="header-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (visibleResults[0]) openResult(visibleResults[0]);
              else if (query.trim() && invoiceAccess) {
                onNavigate("invoice", query);
                setSearchOpen(false);
              }
            }}
          >
            <i aria-hidden="true" className="fa-solid fa-magnifying-glass" />
            <input
              ref={searchRef}
              aria-label="Search customer, invoice, product"
              placeholder={
                activePage === "invoice"
                  ? "Search Invoice…"
                  : "Search customer, invoice, product…"
              }
              value={query}
              onFocus={() => {
                setSearchOpen(true);
                setAlertsOpen(false);
              }}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
            />
            <kbd>Ctrl + K</kbd>
          </form>
        )}
        {searchAccess && searchOpen && query.trim() && (
          <div className="header-popover search-popover" aria-live="polite">
            {searchLoading ? (
              <p>Searching…</p>
            ) : searchError ? (
              <p role="alert">Search unavailable. Please try again.</p>
            ) : visibleResults.length ? (
              visibleResults.map((r) => (
                <button key={`${r.page}-${r.id}`} onClick={() => openResult(r)}>
                  <i
                    aria-hidden="true"
                    className={`fa-solid fa-${r.page === "invoice" ? "file-invoice" : "box"}`}
                  />
                  <span>
                    <strong>{r.title}</strong>
                    <small>{r.subtitle}</small>
                  </span>
                  <i aria-hidden="true" className="fa-solid fa-arrow-right" />
                </button>
              ))
            ) : (
              <p>No matching invoices, customers, or products.</p>
            )}
          </div>
        )}
        {stockAccess && (
          <button
            className="notification-button"
            aria-label="Inventory notifications"
            aria-expanded={alertsOpen}
            onClick={toggleAlerts}
          >
            <i aria-hidden="true" className="fa-regular fa-bell" />
            {alerts && alerts.length > 0 && (
              <span className="notification-dot" />
            )}
          </button>
        )}
        {stockAccess && alertsOpen && (
          <div className="header-popover notification-popover">
            <h2>Inventory alerts</h2>
            {alertsError ? (
              <p role="alert">Unable to load alerts.</p>
            ) : alerts === null ? (
              <p>Loading alerts…</p>
            ) : !alerts.length ? (
              <p>You’re all caught up. No low-stock items.</p>
            ) : (
              alerts.slice(0, 8).map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    onNavigate("stock");
                    setAlertsOpen(false);
                  }}
                >
                  <span>
                    <strong>{a.name}</strong>
                    <small>
                      {a.quantity <= 0
                        ? "Out of stock"
                        : `${a.quantity} remaining`}
                    </small>
                  </span>
                  <i aria-hidden="true" className="fa-solid fa-arrow-right" />
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </header>
  );
}
