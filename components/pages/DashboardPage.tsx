"use client";
import { useEffect, useState } from "react";
import type { Page } from "@/types";

interface MonthlySales {
  walkIn: number;
  walkInCount: number;
  regular: number;
  regularCount: number;
  total: number;
}

interface DashboardStats {
  totalCustomers: number;
  lowStock: number;
  outOfStock: number;
  stockValue: number;
  recentCustomers: { cid: string; name: string; createdAt: string }[];
  monthlySales?: MonthlySales;
}

const iconBg: Record<string, string> = { bl: "var(--blue5)", gn: "#e6f9f2", am: "#fff8e6", rd: "#fff0f0" };
const iconColor: Record<string, string> = { bl: "var(--blue)", gn: "var(--green)", am: "var(--gold)", rd: "var(--red)" };

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

const quickActions = [
  { icon: "fa-boxes-stacked", label: "Add Stock", page: "stock" as Page },
  { icon: "fa-file-invoice", label: "New Invoice", page: "invoice" as Page },
  { icon: "fa-book-open", label: "Cashbook", page: "cashbook" as Page },
  { icon: "fa-rotate-left", label: "Refund/Replace", page: "refund" as Page },
];

export default function DashboardPage({ setActivePage }: { setActivePage: (p: Page) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const statCards = [
    { icon: "fa-users", colorClass: "bl", value: loading ? "—" : String(stats?.totalCustomers ?? 0), label: "Total Customers" },
    { icon: "fa-file-invoice-dollar", colorClass: "gn", value: loading ? "—" : `Rs ${(stats?.stockValue ?? 0).toLocaleString()}`, label: "Stock Value" },
    { icon: "fa-triangle-exclamation", colorClass: "am", value: loading ? "—" : String((stats?.lowStock ?? 0)), label: "Low Stock Items" },
    { icon: "fa-box-open", colorClass: "rd", value: loading ? "—" : String(stats?.outOfStock ?? 0), label: "Out of Stock" },
  ];

  const ms = stats?.monthlySales;
  const monthName = new Date().toLocaleString("en-PK", { month: "long" });

  return (
    <div style={{ animation: "pgIn .3s cubic-bezier(.16,1,.3,1)" }}>
      {/* Stats Row */}
      <div className="dash-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }}>
        {statCards.map((s) => (
          <div key={s.label} style={{ background: "white", borderRadius: "var(--r)", padding: "18px 20px", border: "1px solid rgba(205,216,236,.5)", boxShadow: "var(--sh)", display: "flex", alignItems: "center", gap: 15 }}>
            {loading ? (
              <>
                <div className="skl" style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skl" style={{ width: 60, height: 22, marginBottom: 8 }} />
                  <div className="skl" style={{ width: 95, height: 11 }} />
                </div>
              </>
            ) : (
              <>
                <div style={{ width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, background: iconBg[s.colorClass], color: iconColor[s.colorClass] }}>
                  <i className={`fa-solid ${s.icon}`}></i>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, fontWeight: 500 }}>{s.label}</div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Monthly Sales Row */}
      <div className="dash-sales" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
        {[
          {
            label: `${monthName} — Walk-in Sales`,
            value: loading ? "—" : `Rs ${(ms?.walkIn ?? 0).toLocaleString()}`,
            sub: loading ? "" : `${ms?.walkInCount ?? 0} invoices`,
            icon: "fa-person-walking",
            bg: "linear-gradient(135deg,#1a8f5a,#22c57c)",
          },
          {
            label: `${monthName} — Regular Sales`,
            value: loading ? "—" : `Rs ${(ms?.regular ?? 0).toLocaleString()}`,
            sub: loading ? "" : `${ms?.regularCount ?? 0} invoices`,
            icon: "fa-user-check",
            bg: "linear-gradient(135deg,var(--blue),var(--blue2))",
          },
          {
            label: `${monthName} — Total Sales`,
            value: loading ? "—" : `Rs ${(ms?.total ?? 0).toLocaleString()}`,
            sub: loading ? "" : `${(ms?.walkInCount ?? 0) + (ms?.regularCount ?? 0)} invoices`,
            icon: "fa-chart-line",
            bg: "linear-gradient(135deg,#c07800,#f0c040)",
          },
        ].map((s) => (
          <div key={s.label} style={{ borderRadius: "var(--r)", padding: "18px 20px", color: "white", background: s.bg, position: "relative", overflow: "hidden", boxShadow: "var(--sh)" }}>
            <div style={{ position: "absolute", top: -24, right: -24, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,.07)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, position: "relative", zIndex: 1 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                <i className={`fa-solid ${s.icon}`}></i>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.9, letterSpacing: ".2px" }}>{s.label}</div>
            </div>
            {loading ? (
              <div style={{ width: 140, height: 28, borderRadius: 8, background: "rgba(255,255,255,.2)" }} />
            ) : (
              <>
                <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, position: "relative", zIndex: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, opacity: 0.75, marginTop: 3, position: "relative", zIndex: 1 }}>{s.sub}</div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="dash-main" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* Recent Customers */}
        <div style={{ background: "white", borderRadius: "var(--r)", boxShadow: "var(--sh)", padding: 20, border: "1px solid rgba(205,216,236,.5)", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, paddingBottom: 14, borderBottom: "1.5px solid var(--bg2)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 9 }}>
              <i className="fa-solid fa-clock-rotate-left" style={{ color: "var(--blue2)", fontSize: 15 }}></i> Recent Customers
            </div>
            
          </div>

          {loading ? (
            <ul style={{ listStyle: "none" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 0", borderBottom: i < 4 ? "1px solid var(--bg2)" : "none" }}>
                  <div className="skl" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skl" style={{ width: "52%", height: 13, marginBottom: 7 }} />
                    <div className="skl" style={{ width: "32%", height: 11 }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : !stats?.recentCustomers?.length ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--muted)", fontSize: 13 }}>
              <i className="fa-solid fa-users-slash" style={{ fontSize: 28, display: "block", marginBottom: 8, opacity: .3 }}></i>
              No customers yet. 
            </div>
          ) : (
            <ul style={{ listStyle: "none" }}>
              {stats.recentCustomers.map((c, i) => (
                <li key={c.cid} style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 0", borderBottom: i < stats.recentCustomers.length - 1 ? "1px solid var(--bg2)" : "none" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, background: "var(--blue5)", color: "var(--blue)" }}>
                    <i className="fa-solid fa-user-plus"></i>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{c.cid} · {timeAgo(c.createdAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ background: "white", borderRadius: "var(--r)", boxShadow: "var(--sh)", padding: 20, border: "1px solid rgba(205,216,236,.5)", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 9, marginBottom: 18, paddingBottom: 14, borderBottom: "1.5px solid var(--bg2)" }}>
            <i className="fa-solid fa-bolt" style={{ color: "var(--blue2)", fontSize: 15 }}></i> Quick Actions
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {quickActions.map((qa) => (
              <div
                key={qa.label}
                onClick={() => qa.page && setActivePage(qa.page)}
                style={{ padding: "15px 12px", borderRadius: 12, background: "var(--bg)", border: "1.5px solid var(--bg2)", cursor: qa.page ? "pointer" : "default", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, transition: "all var(--tr)", opacity: qa.page ? 1 : 0.45 }}
                onMouseEnter={e => { if (qa.page) { (e.currentTarget as HTMLElement).style.background = "var(--blue5)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--blue3)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--bg2)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
              >
                <i className={`fa-solid ${qa.icon}`} style={{ fontSize: 22, color: "var(--blue)" }}></i>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink3)", textAlign: "center" }}>{qa.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

