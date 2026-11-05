"use client";
import PaymentMethodSelect from "@/components/finance/PaymentMethodSelect";
import { usePaymentMethods } from "@/lib/hooks/usePaymentMethods";
import { useEffect, useState, useCallback } from "react";
import { useCustomersLean } from "@/lib/hooks/useQueries";

/* ─── Types ─────────────────────────────────────── */
interface InvItem { dt: string; q: number; r: number; a: number; }

interface InvoicePreview {
  invNumber: string; total: number; amountPaid: number; balanceDue: number;
  status: string; customerName: string; invoiceDate: string;
  subtotal: number; discount: number; phone: string | null; address: string | null;
  items: InvItem[];
}

interface CashEntry {
  paymentMethod?: {id:string;name:string}; sourceType?: string;
  id: string;
  entryDate: string;
  createdAt: string;
  type: "credit" | "debit";
  description: string;
  amount: number;
  balance: number;
  notes: string | null;
  customerId: string | null;
  invoiceId: string | null;
  customer: { cid: string; name: string } | null;
  invoice: InvoicePreview | null;
}

interface Totals { totalIncome: number; totalExpense: number; netBalance: number; }

/* ─── Style helpers ──────────────────────────────── */
const card: React.CSSProperties = {
  background: "white", borderRadius: "var(--r)", boxShadow: "var(--sh)",
  padding: 20, marginBottom: 20, border: "1px solid rgba(205,216,236,.5)",
};
const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "var(--ink3)",
  letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 4, display: "block",
};
const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1.5px solid var(--bg2)",
  borderRadius: "var(--r2)", fontSize: 13, fontFamily: "inherit",
  outline: "none", background: "white", color: "var(--ink)",
};
const th: React.CSSProperties = {
  padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600,
  color: "white", letterSpacing: ".5px", textTransform: "uppercase",
};
const td: React.CSSProperties = {
  padding: "11px 14px", fontSize: 13, borderBottom: "1px solid var(--bg2)",
};
const actionBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 7, cursor: "pointer", fontSize: 12,
  display: "flex", alignItems: "center", justifyContent: "center",
};

/* ─── Helpers ────────────────────────────────────── */
const Rs = (n: number) => `Rs ${n.toLocaleString("en-PK")}`;
const fmtDate = (iso: string) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
};
const fmtTime = (iso: string) => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true });
};
const today = () => new Date().toISOString().split("T")[0];


/* ─── Invoice Viewer Modal ────────────────────────── */
function InvoiceModal({ inv, onClose }: { inv: InvoicePreview; onClose: () => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,.6)", backdropFilter: "blur(4px)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "white", borderRadius: "var(--r)", width: 640, maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shm)" }}>
        {/* Header */}
        <div style={{ padding: "18px 22px", borderBottom: "1.5px solid var(--bg2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <i className="fa-solid fa-file-invoice" style={{ color: "var(--blue2)", fontSize: 16 }}></i>
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Invoice — {inv.invNumber}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--muted)", padding: "4px 8px" }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div style={{ padding: "20px 22px" }}>
          {/* Status badge */}
          <div style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700,
              padding: "4px 12px", borderRadius: 20, letterSpacing: ".5px", textTransform: "uppercase",
              background: inv.status === "paid" ? "#e6f9f2" : inv.status === "partial" ? "#fff8e6" : "#fff0f0",
              color: inv.status === "paid" ? "var(--green)" : inv.status === "partial" ? "var(--gold)" : "var(--red)",
            }}>
              <i className={`fa-solid ${inv.status === "paid" ? "fa-circle-check" : inv.status === "partial" ? "fa-circle-half-stroke" : "fa-clock"}`}></i>
              {inv.status === "paid" ? "Paid" : inv.status === "partial" ? "Partial" : "Pending"}
            </span>
          </div>

          {/* Customer info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <span style={lbl}>Customer</span>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{inv.customerName}</div>
              {inv.phone && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{inv.phone}</div>}
              {inv.address && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{inv.address}</div>}
            </div>
            <div>
              <span style={lbl}>Invoice Date</span>
              <div style={{ fontSize: 13, color: "var(--ink)" }}>{fmtDate(inv.invoiceDate)}</div>
            </div>
          </div>

          {/* Items table */}
          {Array.isArray(inv.items) && inv.items.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <span style={lbl}>Items</span>
              <div style={{ border: "1px solid var(--bg2)", borderRadius: "var(--r2)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--ink3)" }}>
                      <th style={th}>Description</th>
                      <th style={{ ...th, textAlign: "center" }}>Qty</th>
                      <th style={{ ...th, textAlign: "right" }}>Rate</th>
                      <th style={{ ...th, textAlign: "right" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.items.map((item, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "white" : "var(--bg)" }}>
                        <td style={td}>{item.dt}</td>
                        <td style={{ ...td, textAlign: "center" }}>{item.q}</td>
                        <td style={{ ...td, textAlign: "right" }}>{Rs(item.r)}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{Rs(item.a)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Totals */}
          <div style={{ background: "var(--bg)", borderRadius: "var(--r2)", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: "var(--muted)" }}>Subtotal</span>
              <span>{Rs(inv.subtotal)}</span>
            </div>
            {inv.discount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: "var(--muted)" }}>Discount</span>
                <span style={{ color: "var(--red)" }}>- {Rs(inv.discount)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14, fontWeight: 700, paddingTop: 8, borderTop: "1.5px solid var(--bg2)" }}>
              <span>Total</span>
              <span>{Rs(inv.total)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
              <span style={{ color: "var(--green)" }}>Amount Paid</span>
              <span style={{ color: "var(--green)", fontWeight: 600 }}>+ {Rs(inv.amountPaid)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: inv.balanceDue > 0 ? "var(--red)" : "var(--muted)" }}>Balance Due</span>
              <span style={{ color: inv.balanceDue > 0 ? "var(--red)" : "var(--muted)", fontWeight: 600 }}>
                {inv.balanceDue > 0 ? Rs(inv.balanceDue) : "Nil"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Entry Form Modal (shared by New + Edit) ────── */
interface EntryFormData {
  entryDate: string; type: string; description: string;
  amount: string; notes: string; customerId: string; paymentMethod: string;
}

function EntryFormModal({ title, icon, initial, onClose, onSave }: {
  title: string; icon: string;
  initial: EntryFormData;
  onClose: () => void;
  onSave: (form: EntryFormData) => Promise<string | null>;
}) {
  const { data: customers = [], isLoading: customersLoading } = useCustomersLean();
  const [form, setForm] = useState<EntryFormData>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: keyof EntryFormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.description.trim()) { setErr("Description is required."); return; }
    if (!form.amount || Number(form.amount) <= 0) { setErr("Please enter a valid amount."); return; }
    setSaving(true);
    setErr("");
    const error = await onSave(form);
    setSaving(false);
    if (error) setErr(error);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,.6)", backdropFilter: "blur(4px)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "white", borderRadius: "var(--r)", width: 520, boxShadow: "var(--shm)" }}>
        {/* Header */}
        <div style={{ padding: "18px 22px", borderBottom: "1.5px solid var(--bg2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <i className={`fa-solid ${icon}`} style={{ color: "var(--blue2)", fontSize: 15 }}></i>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{title}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--muted)", padding: "4px 8px" }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div style={{ padding: "20px 22px" }}>
          {err && (
            <div style={{ background: "#fff0f0", color: "var(--red)", fontSize: 12, padding: "9px 13px", borderRadius: 8, marginBottom: 14, border: "1px solid #ffdada", fontWeight: 500 }}>
              {err}
            </div>
          )}

          {/* 1. Account */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Account (optional)</label>
            <select
              value={form.customerId}
              onChange={e => set("customerId", e.target.value)}
              style={inp}
              disabled={customersLoading}
            >
              <option value="">— {customersLoading ? "Loading accounts..." : "Select Account"} —</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.cid} — {c.name}{c.phone ? ` (${c.phone})` : ""}</option>
              ))}
            </select>
          </div>

          {/* 2. Date */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Date *</label>
            <input type="date" value={form.entryDate} onChange={e => set("entryDate", e.target.value)} style={inp} />
          </div>

          {/* 3. Description */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Description *</label>
            <input
              type="text" placeholder="e.g. Payment Received, Fabric Purchase..."
              value={form.description} onChange={e => set("description", e.target.value)} style={inp}
            />
          </div>

          {/* 4. Amount + 5. Credit / Debit */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Amount (Rs) *</label>
              <input type="number" min="0" placeholder="0" value={form.amount} onChange={e => set("amount", e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Type *</label>
              <select value={form.type} onChange={e => set("type", e.target.value)} style={inp}>
                <option value="credit">Credit (Income)</option>
                <option value="debit">Debit (Expense)</option>
              </select>
            </div>
          </div>

          {/* Notes (optional) */}
          <div style={{ marginBottom: 20 }}>
            <label style={lbl}>Payment method</label><PaymentMethodSelect value={form.paymentMethod} onChange={v => set("paymentMethod",v)} style={inp}/>
            <label style={lbl}>Notes <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
            <textarea
              rows={2} placeholder="Additional notes..."
              value={form.notes} onChange={e => set("notes", e.target.value)}
              style={{ ...inp, resize: "vertical", minHeight: 56 }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "9px 20px", border: "1.5px solid var(--bg2)", borderRadius: 8, background: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "var(--ink3)" }}>
              Cancel
            </button>
            <button
              onClick={handleSave} disabled={saving}
              style={{ padding: "9px 20px", background: "linear-gradient(135deg,var(--blue),var(--blue2))", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", gap: 7 }}
            >
              <i className="fa-solid fa-floppy-disk"></i> {saving ? "Saving..." : "Save Entry"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────── */
export default function CashbookPage() {
  const {data: methodData}=usePaymentMethods();
  const [filterMethodId,setFilterMethodId]=useState("");
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [totals, setTotals] = useState<Totals>({ totalIncome: 0, totalExpense: 0, netBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [editEntry, setEditEntry] = useState<CashEntry | null>(null);
  const [viewInv, setViewInv] = useState<InvoicePreview | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if(filterMethodId)params.set("paymentMethodId",filterMethodId);
    if (filterType !== "all") params.set("type", filterType);
    if (filterFrom) params.set("dateFrom", filterFrom);
    if (filterTo) params.set("dateTo", filterTo);
    const res = await fetch(`/api/cashbook?${params}`);
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries);
      setTotals(data.totals);
    }
    setLoading(false);
  }, [filterType, filterFrom, filterTo,filterMethodId]);

  useEffect(() => { load(); }, [load]);

  async function deleteEntry(id: string) {
    if (!confirm("Delete this cashbook entry?")) return;
    setDeleting(id);
    const response=await fetch(`/api/cashbook/${id}`, { method: "DELETE" });
    if(!response.ok){const data=await response.json().catch(()=>({}));alert(data.error||"Unable to delete entry");}
    setDeleting(null);
    load();
  }

  async function handleNewSave(form: EntryFormData): Promise<string | null> {
    const res = await fetch("/api/cashbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethod: form.paymentMethod,
        entryDate: form.entryDate,
        type: form.type,
        description: form.description.trim(),
        amount: Number(form.amount),
        notes: form.notes.trim() || null,
        customerId: form.customerId || null,
      }),
    });
    if (res.ok) { load(); setShowNewEntry(false); return null; }
    const data = await res.json().catch(() => ({}));
    return data.error || "Failed to save entry. Please try again.";
  }

  async function handleEditSave(form: EntryFormData): Promise<string | null> {
    if (!editEntry) return "No entry selected";
    const res = await fetch(`/api/cashbook/${editEntry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethod: form.paymentMethod,
        entryDate: form.entryDate,
        type: form.type,
        description: form.description.trim(),
        amount: Number(form.amount),
        notes: form.notes.trim() || null,
        customerId: form.customerId || null,
      }),
    });
    if (res.ok) { load(); setEditEntry(null); return null; }
    const data = await res.json().catch(() => ({}));
    return data.error || "Failed to update entry. Please try again.";
  }

  const summaryCards = [
    { label: "Total Income", value: Rs(totals.totalIncome), icon: "fa-arrow-down", bg: "linear-gradient(135deg,#1a8f5a,#22c57c)" },
    { label: "Total Expense", value: Rs(totals.totalExpense), icon: "fa-arrow-up", bg: "linear-gradient(135deg,#b03030,#e05050)" },
    { label: "Net Balance", value: Rs(totals.netBalance), icon: "fa-scale-balanced", bg: "linear-gradient(135deg,var(--ink3),var(--blue2))" },
  ];

  /* Derive entry type label */
  const entryTypeLabel = (e: CashEntry) => e.sourceType === "expense" ? "Expense" : e.invoiceId ? "Invoice" : "Ledger";
  const entryTypeBg = (e: CashEntry) => e.invoiceId ? "#e6f9f2" : "#f0eaff";
  const entryTypeColor = (e: CashEntry) => e.invoiceId ? "var(--green)" : "#7c5cbf";

  return (
    <div style={{ animation: "pgIn .3s cubic-bezier(.16,1,.3,1)" }}>
      {/* ── Summary Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        {summaryCards.map((s) => (
          <div
            key={s.label}
            style={{
              borderRadius: "var(--r)", padding: 20, color: "white", position: "relative",
              overflow: "hidden", background: s.bg, transition: "transform var(--tr)",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = "translateY(0)"}
          >
            <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,.07)" }} />
            <div style={{ position: "absolute", bottom: -20, left: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,.05)" }} />
            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6, fontWeight: 600, letterSpacing: ".3px", position: "relative", zIndex: 1 }}>
              <i className={`fa-solid ${s.icon}`} style={{ marginRight: 6 }}></i>{s.label}
            </div>
            {loading ? (
              <div style={{ width: 120, height: 32, borderRadius: 8, background: "rgba(255,255,255,.2)", position: "relative", zIndex: 1 }} />
            ) : (
              <div style={{ fontSize: 26, fontWeight: 700, position: "relative", zIndex: 1 }}>{s.value}</div>
            )}
          </div>
        ))}
      </div>

      {/* ── Entries Table ── */}
      <div style={card}>
        {/* Card header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, paddingBottom: 14, borderBottom: "1.5px solid var(--bg2)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 9 }}>
            <i className="fa-solid fa-book-open" style={{ color: "var(--blue2)", fontSize: 14 }}></i>
            Cashbook Entries
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <select aria-label="Filter by payment method" value={filterMethodId} onChange={e=>setFilterMethodId(e.target.value)} style={{padding:"7px 12px",border:"1px solid var(--bg3)",borderRadius:10,fontSize:12}}><option value="">All payment methods</option>{methodData?.methods.map(m=><option key={m.id} value={m.id}>{m.name}{m.active?"":" (archived)"}</option>)}</select>
            <select
              value={filterType} onChange={e => setFilterType(e.target.value)}
              style={{ padding: "7px 12px", border: "1.5px solid var(--bg2)", borderRadius: 20, fontFamily: "inherit", fontSize: 12, outline: "none", cursor: "pointer", background: "white", color: "var(--ink)" }}
            >
              <option value="all">All Entries</option>
              <option value="credit">Credit (Income)</option>
              <option value="debit">Debit (Expense)</option>
            </select>
            <input
              type="date" value={filterFrom} max={today()} onChange={e => setFilterFrom(e.target.value)}
              style={{ padding: "7px 12px", border: "1.5px solid var(--bg2)", borderRadius: 20, fontFamily: "inherit", fontSize: 12, outline: "none", background: "white", color: "var(--ink)" }}
              title="From date"
            />
            <input
              type="date" value={filterTo} max={today()} onChange={e => setFilterTo(e.target.value)}
              style={{ padding: "7px 12px", border: "1.5px solid var(--bg2)", borderRadius: 20, fontFamily: "inherit", fontSize: 12, outline: "none", background: "white", color: "var(--ink)" }}
              title="To date"
            />
            {(filterFrom || filterTo || filterMethodId || filterType !== "all") && (
              <button
                onClick={() => { setFilterType("all"); setFilterFrom(""); setFilterTo(""); setFilterMethodId(""); }}
                style={{ padding: "7px 12px", border: "1.5px solid var(--bg2)", borderRadius: 20, fontFamily: "inherit", fontSize: 12, background: "white", color: "var(--muted)", cursor: "pointer" }}
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setShowNewEntry(true)}
              style={{ padding: "8px 16px", background: "linear-gradient(135deg,var(--blue),var(--blue2))", color: "white", border: "none", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 10px rgba(16,87,160,.3)" }}
            >
              <i className="fa-solid fa-plus"></i> New Entry
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--ink3)" }}>
                <th style={th}>Date</th>
                <th style={th}>Time</th>
                <th style={th}>Account</th>
                <th style={th}>Description</th>
                <th style={th}>Entry Type</th>
                <th style={th}>Type</th>
                <th style={{ ...th, textAlign: "right" }}>Amount</th>
                <th style={{ ...th, textAlign: "right" }}>Balance</th>
                <th style={{ ...th, textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} style={td}>
                        <div className="skl" style={{ height: 13, width: j === 3 ? "80%" : "55%", borderRadius: 6 }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: "48px 0", textAlign: "center", color: "var(--muted)" }}>
                    <i className="fa-solid fa-book-open" style={{ fontSize: 32, display: "block", marginBottom: 10, opacity: 0.25 }}></i>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No entries yet</div>
                    <div style={{ fontSize: 12 }}>Create invoices or add manual entries — they&apos;ll appear here.</div>
                  </td>
                </tr>
              ) : (
                entries.map((entry, i) => (
                  <tr
                    key={entry.id}
                    style={{ background: i % 2 === 0 ? "white" : "var(--bg)", transition: "background var(--tr)" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--blue5)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? "white" : "var(--bg)"}
                  >
                    {/* Date */}
                    <td style={{ ...td, color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(entry.entryDate)}</td>
                    {/* Time */}
                    <td style={{ ...td, color: "var(--muted)", fontSize: 11, whiteSpace: "nowrap" }}>{fmtTime(entry.createdAt)}</td>
                    {/* Account (Customer) */}
                    <td style={td}>
                      {entry.customer ? (
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "var(--blue5)", color: "var(--blue2)" }}>
                            {entry.customer.cid}
                          </span>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{entry.customer.name}</div>
                        </div>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                      )}
                    </td>
                    {/* Description */}
                    <td style={{ ...td, fontWeight: 600 }}>
                      {entry.description}<small style={{display:"block",color:"var(--muted)",fontSize:11}}>{entry.paymentMethod?.name || "Cash"}{entry.sourceType==="transfer"?" · Internal transfer":""}</small>
                      {entry.notes && <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400, marginTop: 1 }}>{entry.notes}</div>}
                    </td>
                    {/* Entry Type (Invoice / Ledger) */}
                    <td style={td}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                        background: entryTypeBg(entry), color: entryTypeColor(entry),
                        letterSpacing: ".3px", textTransform: "uppercase",
                        display: "inline-flex", alignItems: "center", gap: 4,
                      }}>
                        <i className={`fa-solid ${entry.invoiceId ? "fa-file-invoice" : "fa-book"}`} style={{ fontSize: 9 }}></i>
                        {entryTypeLabel(entry)}
                      </span>
                      {entry.invoice && (
                        <button
                          onClick={() => setViewInv(entry.invoice)}
                          style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--blue2)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", marginTop: 3, padding: 0 }}
                        >
                          {entry.invoice.invNumber}
                        </button>
                      )}
                    </td>
                    {/* Type badge (Credit/Debit) */}
                    <td style={td}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                        background: entry.type === "credit" ? "#e6f9f2" : "#fff0f0",
                        color: entry.type === "credit" ? "var(--green)" : "var(--red)",
                        letterSpacing: ".3px",
                      }}>
                        {entry.type === "credit" ? "Credit" : "Debit"}
                      </span>
                    </td>
                    {/* Amount */}
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: entry.type === "credit" ? "var(--green)" : "var(--red)", whiteSpace: "nowrap" }}>
                      {entry.type === "credit" ? "+" : "-"} {Rs(entry.amount)}
                    </td>
                    {/* Balance */}
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                      {Rs(entry.balance)}
                    </td>
                    {/* Actions */}
                    <td style={{ ...td, textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        {/* Edit — only for manual (ledger) entries */}
                        {!entry.invoiceId && (!entry.sourceType || entry.sourceType === "manual") && (
                          <button
                            onClick={() => setEditEntry(entry)}
                            title="Edit Entry"
                            style={{ ...actionBtn, border: "1.5px solid var(--bg2)", background: "white", color: "var(--blue2)" }}
                          >
                            <i className="fa-solid fa-pen"></i>
                          </button>
                        )}
                        {/* View Invoice */}
                        {entry.invoice && (
                          <button
                            onClick={() => setViewInv(entry.invoice)}
                            title="View Invoice"
                            style={{ ...actionBtn, border: "1.5px solid var(--bg2)", background: "white", color: "var(--blue2)" }}
                          >
                            <i className="fa-solid fa-eye"></i>
                          </button>
                        )}
                        {/* Delete — only for manual (ledger) entries */}
                        {!entry.invoiceId && (!entry.sourceType || entry.sourceType === "manual") && (
                          <button
                            onClick={() => deleteEntry(entry.id)}
                            disabled={deleting === entry.id}
                            title="Delete Entry"
                            style={{ ...actionBtn, border: "1.5px solid #ffdada", background: "#fff0f0", color: "var(--red)", opacity: deleting === entry.id ? 0.5 : 1 }}
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer summary */}
        {!loading && entries.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 24, paddingTop: 14, marginTop: 10, borderTop: "1.5px solid var(--bg2)", fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
            <span>
              <span style={{ color: "var(--green)" }}>↑ {Rs(totals.totalIncome)}</span>
              &nbsp; income
            </span>
            <span>
              <span style={{ color: "var(--red)" }}>↓ {Rs(totals.totalExpense)}</span>
              &nbsp; expense
            </span>
            <span>
              Net: <span style={{ color: "var(--ink)", fontWeight: 700 }}>{Rs(totals.netBalance)}</span>
            </span>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showNewEntry && (
        <EntryFormModal
          title="New Cashbook Entry"
          icon="fa-book-open"
          initial={{ entryDate: today(), type: "credit", description: "", amount: "", notes: "", customerId: "", paymentMethod: "Cash" }}
          onClose={() => setShowNewEntry(false)}
          onSave={handleNewSave}
        />
      )}
      {editEntry && (
        <EntryFormModal
          title="Edit Cashbook Entry"
          icon="fa-pen"
          initial={{
            entryDate: editEntry.entryDate.split("T")[0],
            type: editEntry.type,
            description: editEntry.description,
            amount: String(editEntry.amount),
            notes: editEntry.notes || "",
            customerId: editEntry.customerId || "",
            paymentMethod: editEntry.paymentMethod?.name || "Cash",
          }}
          onClose={() => setEditEntry(null)}
          onSave={handleEditSave}
        />
      )}
      {viewInv && (
        <InvoiceModal inv={viewInv} onClose={() => setViewInv(null)} />
      )}
    </div>
  );
}
