"use client";
import PaymentMethodSelect from "@/components/finance/PaymentMethodSelect";
import { useEffect, useState } from "react";

interface Customer {
  id: string;
  cid: string;
  name: string;
  phone: string;
  address: string | null;
  whatsapp: string | null;
  reference: string | null;
  notes: string | null;
  balance: number;
  createdAt: string;
}

const card: React.CSSProperties = {
  background: "white", borderRadius: "var(--r)", boxShadow: "var(--sh)",
  padding: 20, marginBottom: 20, border: "1px solid rgba(205,216,236,.5)",
};

const th: React.CSSProperties = {
  padding: "11px 14px", textAlign: "left", fontSize: 11,
  fontWeight: 600, color: "white", letterSpacing: ".6px",
  textTransform: "uppercase", whiteSpace: "nowrap",
};

const actionBtn = (bg: string, color: string): React.CSSProperties => ({
  width: 30, height: 30, borderRadius: 8, border: "none", cursor: "pointer",
  fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: bg, color,
});

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1.5px solid var(--bg2)",
  borderRadius: "var(--r2)", fontSize: 13, fontFamily: "inherit",
  outline: "none", background: "white", color: "var(--ink)",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "var(--ink3)",
  letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 4, display: "block",
};

function getBalanceDisplay(balance: number) {
  if (balance === 0) return { text: "Settled", color: "var(--green)", status: "Clear", sc: "gn" };
  if (balance > 0) return { text: `Rs ${balance.toLocaleString()} DR`, color: "var(--red)", status: "Due", sc: "am" };
  return { text: `Rs ${Math.abs(balance).toLocaleString()} CR`, color: "var(--green)", status: "Advance", sc: "gn" };
}

const badgeBg: Record<string, string> = { gn: "#e6f9f2", am: "#fff8e6" };
const badgeColor: Record<string, string> = { gn: "var(--green)", am: "var(--gold)" };

const INITIAL_FORM = { name: "", phone: "", address: "", whatsapp: "", reference: "", notes: "", balance: "0" };
type Filter = "all" | "dr" | "cr" | "clear";
type BalanceType = "dr" | "cr";

export default function CustomersPage() {
  const [openingMethod,setOpeningMethod]=useState("Cash");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [nextCid, setNextCid] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [balanceType, setBalanceType] = useState<BalanceType>("dr");

  const load = () => {
    setLoading(true);
    fetch("/api/customers")
      .then((r) => r.json())
      .then((data) => { setCustomers(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const openModal = () => {
    fetch("/api/customers", { method: "HEAD" }).then((r) => {
      setNextCid(r.headers.get("x-next-cid"));
    });
    setBalanceType("dr");
    setModal(true);
  };

  useEffect(() => { load(); }, []);

  // Ledger totals computed client-side
  const totalReceivable = customers.filter(c => c.balance > 0).reduce((s, c) => s + c.balance, 0);
  const totalPayable = customers.filter(c => c.balance < 0).reduce((s, c) => s + Math.abs(c.balance), 0);
  const netBalance = totalReceivable - totalPayable;

  const filtered = customers.filter((c) => {
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.cid.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "dr" ? c.balance > 0 :
      filter === "cr" ? c.balance < 0 :
      filter === "clear" ? c.balance === 0 :
      true;
    return matchSearch && matchFilter;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    // Apply sign: Debit = positive (customer owes), Credit = negative (advance paid)
    const rawAmount = Math.abs(Number(form.balance) || 0);
    const signedBalance = balanceType === "cr" ? -rawAmount : rawAmount;
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, balance: String(signedBalance), paymentMethod: openingMethod }),
    });
    if (res.ok) {
      setModal(false);
      setForm(INITIAL_FORM);
      setBalanceType("dr");
      load();
    } else {
      const d = await res.json();
      setError(d.error || "Something went wrong");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete customer "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div style={{ animation: "pgIn .3s cubic-bezier(.16,1,.3,1)" }}>

      {/* Ledger Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Total Receivable (DR)", value: `Rs ${totalReceivable.toLocaleString()}`, sub: "Customers owe the shop", bg: "var(--gradient-danger)", icon: "fa-arrow-trend-up" },
          { label: "Total Payable (CR)", value: `Rs ${totalPayable.toLocaleString()}`, sub: "Advance payments held", bg: "var(--gradient-primary)", icon: "fa-arrow-trend-down" },
          { label: "Net Receivable", value: `Rs ${Math.abs(netBalance).toLocaleString()}`, sub: netBalance >= 0 ? "Net owed to shop" : "Net advance balance", bg: "var(--gradient-primary)", icon: "fa-scale-balanced" },
        ].map((s) => (
          <div key={s.label} style={{ background: loading ? "var(--bg2)" : s.bg, color: "white", borderRadius: "var(--r)", padding: 20, position: "relative", overflow: "hidden", transition: "background var(--tr)" }}>
            <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,.07)" }}></div>
            <div style={{ fontSize: 11, opacity: .85, marginBottom: 6, fontWeight: 600, letterSpacing: ".3px", position: "relative", zIndex: 1 }}>
              <i className={`fa-solid ${s.icon}`} style={{ marginRight: 6 }}></i>{s.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, position: "relative", zIndex: 1 }}>{loading ? "—" : s.value}</div>
            <div style={{ fontSize: 10, opacity: .75, marginTop: 4, position: "relative", zIndex: 1 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Customer Table */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, paddingBottom: 14, borderBottom: "1.5px solid var(--bg2)", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 9 }}>
            <i className="fa-solid fa-users" style={{ color: "var(--blue2)", fontSize: 15 }}></i>
            Customers &amp; Accounts
            {!loading && <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>({filtered.length})</span>}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 12, pointerEvents: "none" }}></i>
              <input
                type="text"
                placeholder="Search name or CID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ padding: "7px 12px 7px 30px", border: "1.5px solid var(--bg2)", borderRadius: 20, fontFamily: "inherit", fontSize: 12, outline: "none", width: 170 }}
              />
            </div>

            {/* Filter pills */}
            {(["all", "dr", "cr", "clear"] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "6px 13px", borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", border: "1.5px solid",
                borderColor: filter === f ? "var(--blue2)" : "var(--bg3)",
                background: filter === f ? "var(--blue5)" : "transparent",
                color: filter === f ? "var(--blue)" : "var(--muted)",
              }}>
                {f === "all" ? "All" : f === "dr" ? "Due (DR)" : f === "cr" ? "Advance (CR)" : "Settled"}
              </button>
            ))}

            <button data-ui-action="primary"
              onClick={openModal}
              style={{ padding: "8px 16px", borderRadius: 24, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, background: "var(--gradient-primary)", color: "white", border: "none", boxShadow: "0 4px 16px rgba(16,87,160,.3)" }}
            >
              <i className="fa-solid fa-user-plus"></i> Add Customer
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)", fontSize: 13 }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 20, marginBottom: 8, display: "block" }}></i>
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted)" }}>
            <i className="fa-solid fa-users-slash" style={{ fontSize: 32, marginBottom: 12, display: "block", opacity: .3 }}></i>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{customers.length === 0 ? "No customers yet" : "No results"}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>{customers.length === 0 ? 'Click "Add Customer" to register the first one' : "Try a different filter or search"}</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--ink)" }}>
                  {["Customer ID", "Name", "Phone", "Address", "Debit (DR)", "Credit (CR)", "Status", "Actions"].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const bal = getBalanceDisplay(c.balance);
                  const dr = c.balance > 0 ? `Rs ${c.balance.toLocaleString()}` : "—";
                  const cr = c.balance < 0 ? `Rs ${Math.abs(c.balance).toLocaleString()}` : "—";
                  return (
                    <tr key={c.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--bg2)" : "none" }}>
                      <td style={{ padding: "11px 14px" }}>
                        <span style={{ display: "inline-block", background: "var(--ink)", color: "var(--blue4)", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, fontFamily: "inherit", letterSpacing: ".6px" }}>{c.cid}</span>
                      </td>
                      <td style={{ padding: "11px 14px", fontWeight: 600, fontSize: 13 }}>{c.name}</td>
                      <td style={{ padding: "11px 14px", fontSize: 13 }}>{c.phone || <span style={{ color: "var(--muted)", fontSize: 11 }}>—</span>}</td>
                      <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--muted)" }}>{c.address || "—"}</td>
                      <td style={{ padding: "11px 14px", fontWeight: 600, fontSize: 13, color: c.balance > 0 ? "var(--red)" : "var(--muted)" }}>{dr}</td>
                      <td style={{ padding: "11px 14px", fontWeight: 600, fontSize: 13, color: c.balance < 0 ? "var(--green)" : "var(--muted)" }}>{cr}</td>
                      <td style={{ padding: "11px 14px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: ".4px", textTransform: "uppercase", background: badgeBg[bal.sc], color: badgeColor[bal.sc] }}>{bal.status}</span>
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button data-ui-action="icon" title="View" style={actionBtn("var(--blue5)", "var(--blue)")}><i className="fa-solid fa-eye"></i></button>
                          <button data-ui-action="icon" title="Edit" style={actionBtn("#fff8e6", "var(--gold)")}><i className="fa-solid fa-pen"></i></button>
                          <button data-ui-action="icon" title="Delete" style={actionBtn("#fff0f0", "var(--red)")} onClick={() => handleDelete(c.id, c.name)}><i className="fa-solid fa-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals footer row */}
              {filtered.length > 0 && (
                <tfoot>
                  <tr style={{ background: "var(--bg)", borderTop: "2px solid var(--bg2)" }}>
                    <td colSpan={4} style={{ padding: "10px 14px", fontWeight: 700, fontSize: 12, color: "var(--muted)" }}>
                      Showing {filtered.length} of {customers.length} customers
                    </td>
                    <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13, color: "var(--red)" }}>
                      Rs {filtered.filter(c => c.balance > 0).reduce((s, c) => s + c.balance, 0).toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13, color: "var(--green)" }}>
                      Rs {filtered.filter(c => c.balance < 0).reduce((s, c) => s + Math.abs(c.balance), 0).toLocaleString()}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,.6)", backdropFilter: "blur(4px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 18, width: 600, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shm)" }}>

            {/* Header */}
            <div style={{ padding: "18px 24px", borderBottom: "1.5px solid var(--bg2)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "white", zIndex: 2, borderRadius: "18px 18px 0 0" }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 10 }}>
                <i className="fa-solid fa-user-plus" style={{ color: "var(--blue2)" }}></i> Add New Customer
              </div>
              <button onClick={() => { setModal(false); setNextCid(null); setError(""); setForm(INITIAL_FORM); setBalanceType("dr"); }} style={{ background: "none", border: "none", fontSize: 16, color: "var(--muted)", cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleAdd} style={{ padding: 24 }}>
              {/* Auto-assigned CID banner */}
              <div style={{ background: "var(--blue5)", borderRadius: "var(--r2)", padding: "11px 15px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "var(--blue)" }}>
                <i className="fa-solid fa-id-badge" style={{ fontSize: 16, flexShrink: 0 }}></i>
                <span>
                  Auto-assigned Customer ID: <strong style={{ fontFamily: "inherit", fontSize: 14 }}>{nextCid ?? "…"}</strong>
                </span>
              </div>

              {error && (
                <div style={{ background: "#fff0f0", color: "var(--red)", fontSize: 12, padding: "9px 13px", borderRadius: 8, marginBottom: 16, border: "1px solid #ffdada", fontWeight: 500 }}>
                  <i className="fa-solid fa-circle-exclamation"></i> {error}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* Full Name */}
                <div>
                  <label style={labelStyle}>Full Name *</label>
                  <input style={inputStyle} placeholder="Customer full name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>

                {/* Phone */}
                <div>
                  <label style={labelStyle}>Phone Number *</label>
                  <input style={inputStyle} placeholder="03XX-XXXXXXX" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required />
                </div>

                {/* Address — full width */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>Address</label>
                  <input style={inputStyle} placeholder="Street / Area / City" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                </div>

                {/* WhatsApp */}
                <div>
                  <label style={labelStyle}>WhatsApp</label>
                  <input style={inputStyle} placeholder="03XX-XXXXXXX" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
                </div>

                {/* Reference */}
                <div>
                  <label style={labelStyle}>Reference (Optional)</label>
                  <input style={inputStyle} placeholder="Who referred?" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
                </div>

                {/* Opening Balance — full width */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>Opening Balance (Rs)</label>

                  {/* Amount input + Debit / Credit toggle */}
                  <div style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
                    {/* Amount number input */}
                    <input
                      style={{
                        ...inputStyle,
                        borderRadius: "var(--r2) 0 0 var(--r2)",
                        borderRight: "none",
                        fontWeight: 700, fontSize: 14,
                        color: balanceType === "dr" ? "var(--red)" : "var(--green)",
                        flex: 1,
                      }}
                      type="number"
                      min="0"
                      placeholder="0"
                      value={form.balance}
                      onChange={e => setForm(f => ({ ...f, balance: e.target.value }))}
                    />
            {balanceType==="cr"&&Number(form.balance)>0&&<PaymentMethodSelect value={openingMethod} onChange={setOpeningMethod}/>}

                    {/* DR button */}
                    <button
                      type="button"
                      onClick={() => setBalanceType("dr")}
                      style={{
                        padding: "0 16px", border: "1.5px solid", borderRight: "none",
                        borderRadius: 0, fontFamily: "inherit",
                        fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                        transition: "all .15s",
                        borderColor: balanceType === "dr" ? "var(--red)" : "var(--bg2)",
                        background: balanceType === "dr" ? "#fff0f0" : "white",
                        color: balanceType === "dr" ? "var(--red)" : "var(--muted)",
                      }}
                    >
                      <i className="fa-solid fa-arrow-trend-up" style={{ marginRight: 5, fontSize: 11 }}></i>
                      Debit (DR)
                    </button>

                    {/* CR button */}
                    <button
                      type="button"
                      onClick={() => setBalanceType("cr")}
                      style={{
                        padding: "0 16px", border: "1.5px solid",
                        borderRadius: "0 var(--r2) var(--r2) 0", fontFamily: "inherit",
                        fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                        transition: "all .15s",
                        borderColor: balanceType === "cr" ? "var(--green)" : "var(--bg2)",
                        background: balanceType === "cr" ? "#e6f9f2" : "white",
                        color: balanceType === "cr" ? "var(--green)" : "var(--muted)",
                      }}
                    >
                      Credit (CR)
                      <i className="fa-solid fa-arrow-trend-down" style={{ marginLeft: 5, fontSize: 11 }}></i>
                    </button>
                  </div>

                  {/* Live preview hint */}
                  {Number(form.balance) > 0 ? (
                    <div style={{
                      fontSize: 11, marginTop: 6, padding: "6px 10px", borderRadius: 7, fontWeight: 600,
                      background: balanceType === "dr" ? "#fff0f0" : "#e6f9f2",
                      color: balanceType === "dr" ? "var(--red)" : "var(--green)",
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
                      <i className={`fa-solid ${balanceType === "dr" ? "fa-circle-exclamation" : "fa-circle-check"}`}></i>
                      {balanceType === "dr"
                        ? `Customer will owe Rs ${Number(form.balance).toLocaleString()} to the shop`
                        : `Rs ${Number(form.balance).toLocaleString()} advance credited to customer`}
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                      Enter amount then choose Debit (customer owes shop) or Credit (advance paid). Leave 0 if none.
                    </div>
                  )}
                </div>

                {/* Notes — full width */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>Notes</label>
                  <textarea
                    style={{ ...inputStyle, resize: "vertical", minHeight: 70 }}
                    placeholder="Any extra info..."
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button data-ui-action="primary" type="submit" disabled={saving} style={{ padding: "10px 24px", borderRadius: 24, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 7, background: "var(--gradient-primary)", color: "white", border: "none", opacity: saving ? .7 : 1 }}>
                  <i className={`fa-solid ${saving ? "fa-spinner fa-spin" : "fa-user-plus"}`}></i>
                  {saving ? "Saving..." : "Add Customer"}
                </button>
                <button type="button" onClick={() => { setModal(false); setNextCid(null); setError(""); setForm(INITIAL_FORM); setBalanceType("dr"); }} style={{ padding: "10px 20px", borderRadius: 24, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: "transparent", color: "var(--blue)", border: "1.5px solid var(--bg3)" }}>
                  <i className="fa-solid fa-xmark"></i> Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
