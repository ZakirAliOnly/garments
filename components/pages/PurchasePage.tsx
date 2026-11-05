"use client";
import PaymentMethodSelect from "@/components/finance/PaymentMethodSelect";
import { useEffect, useState } from "react";

/* ─── Types ──────────────────────────────────────────── */
interface Supplier {
  id: string;
  supplierId: string;
  name: string;
  phone: string | null;
  city: string | null;
  category: string | null;
  notes: string | null;
  totalPurchased: number;
  balanceDue: number;
  createdAt: string;
}

interface Purchase {
  id: string;
  poNumber: string;
  supplierId: string;
  supplier: { name: string; supplierId: string };
  stockName: string;
  stockCode: string | null;
  qty: number;
  unitPrice: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  transactionType: string;
  dateTime: string;
  status: string;
  notes: string | null;
}

interface StockItem {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  purchasePrice: number;
}

interface PoItem {
  _id: string;
  mode: "free" | "stock";
  stockItemId: string;
  stockName: string;
  category: string;
  qty: string;
  unit: string;
  unitPrice: string;
}

/* ─── Constants ──────────────────────────────────────── */
const CITIES = ["Quetta", "Pishin", "Mastung", "Khuzdar", "Turbat", "Karachi", "Lahore", "Other"];
const CATEGORIES = ["Fabric", "Thread", "Lining", "Accessories", "Buttons & Hooks", "Embroidery", "Other"];
const UNITS = ["Meter", "Yard", "Piece", "Roll", "KG", "Set"];

const INIT_SUPPLIER = { name: "", phone: "", city: "Quetta", category: "Fabric", notes: "" };
const INIT_PO = {
  supplierId: "",
  poDate: new Date().toISOString().slice(0, 10),
  advancePaid: "",
  paymentMode: "Cash",
  notes: "",
};

const makeItem = (): PoItem => ({
  _id: Math.random().toString(36).slice(2),
  mode: "free",
  stockItemId: "",
  stockName: "",
  category: "Fabric",
  qty: "1",
  unit: "Meter",
  unitPrice: "",
});

/* ─── Style helpers ──────────────────────────────────── */
const card: React.CSSProperties = {
  background: "white", borderRadius: "var(--r)", boxShadow: "var(--sh)",
  padding: 20, marginBottom: 20, border: "1px solid rgba(205,216,236,.5)",
};
const th: React.CSSProperties = {
  padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 600,
  color: "white", letterSpacing: ".6px", textTransform: "uppercase", whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "11px 14px", fontSize: 13, borderBottom: "1px solid var(--bg2)", verticalAlign: "middle",
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
const sel: React.CSSProperties = { ...inp };

function Badge({ label, color }: { label: string; color: "gn" | "am" | "rd" | "bl" }) {
  const map = {
    gn: { bg: "#e6f9f2", col: "var(--green)" },
    am: { bg: "#fff8e6", col: "var(--gold)" },
    rd: { bg: "#fff0f0", col: "var(--red)" },
    bl: { bg: "#e8f3ff", col: "var(--blue2)" },
  };
  return (
    <span style={{
      background: map[color].bg, color: map[color].col,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
    }}>{label}</span>
  );
}

function StatCard({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) {
  const colorMap: Record<string, { bg: string; col: string }> = {
    am: { bg: "#fff8e6", col: "var(--gold)" },
    bl: { bg: "#e8f3ff", col: "var(--blue2)" },
    rd: { bg: "#fff0f0", col: "var(--red)" },
    gn: { bg: "#e6f9f2", col: "var(--green)" },
  };
  const c = colorMap[color] ?? colorMap.bl;
  return (
    <div style={{
      background: "white", borderRadius: "var(--r)", boxShadow: "var(--sh)",
      border: "1px solid rgba(205,216,236,.5)", padding: "16px 20px",
      display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: 180,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: c.bg, color: c.col, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
      }}>
        <i className={`fa-solid ${icon}`} />
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

/* ─── Modal wrapper ──────────────────────────────────── */
function Modal({ open, onClose, title, icon, width, children }: {
  open: boolean; onClose: () => void; title: string; icon: string;
  width?: number; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(10,22,40,.55)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: "white", borderRadius: "var(--r)", boxShadow: "var(--shm)",
        width: "100%", maxWidth: width ?? 540, maxHeight: "90vh",
        overflow: "hidden", display: "flex", flexDirection: "column",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--bg2)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--ink)", color: "white",
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <i className={`fa-solid ${icon}`} style={{ color: "var(--blue4)" }} />
            {title}
          </h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "rgba(255,255,255,.6)",
            cursor: "pointer", fontSize: 16, padding: 4, lineHeight: 1,
          }}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────── */
/* ─── Print helpers ──────────────────────────────── */
const printed = () => new Date().toLocaleDateString("en-GB");

function doPrint(html: string, pageStyle: string, title: string) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${pageStyle}</style></head><body>${html}</body></html>`);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow!.print();
    setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* already removed */ } }, 2000);
  }, 500);
}

function buildPOHTML(d: {
  logoUrl: string;
  poNumber: string;
  supplierName: string;
  supplierId: string;
  poDate: string;
  items: Array<{ name: string; qty: number; unitPrice: number; total: number }>;
  grandTotal: number;
  totalPaid: number;
  totalDue: number;
  notes: string | null;
  batchNumbers: string[];
}) {
  const rows = d.items.map((r, i) => `<tr style="${i % 2 === 1 ? "background:#f8fafd;" : ""}">
    <td style="padding:11px 14px;font-size:13px;">${r.name}</td>
    <td style="padding:11px 14px;font-size:13px;text-align:center;">${r.qty}</td>
    <td style="padding:11px 14px;font-size:13px;text-align:right;">Rs ${r.unitPrice.toLocaleString()}</td>
    <td style="padding:11px 14px;font-size:13px;text-align:right;font-weight:700;">Rs ${r.total.toLocaleString()}</td>
  </tr>`).join("");

  return `<div style="width:794px;background:#fff;font-family:'Arial',sans-serif;display:flex;flex-direction:column;position:relative;">
  <div style="height:6px;background:linear-gradient(90deg,#0a1628,#1057a0,#2e8fe0);"></div>
  <div style="padding:32px 48px 24px;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid #e8eef7;">
    <div style="display:flex;align-items:center;gap:18px;">
      <img src="${d.logoUrl}" alt="Logo" style="width:72px;height:72px;object-fit:contain;flex-shrink:0;" />
      <div>
        <div style="font-size:22px;font-weight:900;color:#0a1628;letter-spacing:.3px;">GARMENTS</div>
        <div style="font-size:12px;color:#7a8baa;margin-top:3px;">Archer Road, Quetta</div>
        <div style="font-size:12px;color:#1057a0;margin-top:7px;">&#128222; 0333-7826435 / 0322-8152991</div>
        <div style="margin-top:14px;">
          <div style="font-size:28px;font-weight:900;color:#0a1628;letter-spacing:2px;line-height:1;">PURCHASE ORDER</div>
          <div style="font-size:15px;font-weight:700;color:#1057a0;margin-top:4px;font-family:monospace;">#${d.poNumber}</div>
        </div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="background:#f4f7fc;border-radius:8px;padding:9px 16px;border:1px solid #e8eef7;">
        <div style="font-size:10px;color:#7a8baa;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Payment Status</div>
        <div style="font-size:14px;font-weight:700;margin-top:3px;${d.totalDue > 0 ? "color:#e03c3c;" : "color:#22a86e;"}">${d.totalDue > 0 ? "BALANCE DUE" : "FULLY PAID"}</div>
      </div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr;background:#f4f7fc;border-bottom:2px solid #e8eef7;">
    <div style="padding:20px 48px;border-right:1px solid #e8eef7;">
      <div style="font-size:10px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px;">Supplier</div>
      <div style="font-size:17px;font-weight:800;color:#0a1628;">${d.supplierName}</div>
      <div style="font-size:11px;color:#1057a0;font-weight:700;font-family:monospace;background:#e0f0ff;display:inline-block;padding:2px 9px;border-radius:5px;margin-top:5px;">${d.supplierId}</div>
    </div>
    <div style="padding:20px 24px;border-right:1px solid #e8eef7;">
      <div style="font-size:10px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-bottom:6px;">PO Date</div>
      <div style="font-size:14px;font-weight:700;color:#0a1628;">${d.poDate}</div>
      <div style="font-size:10px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-top:12px;margin-bottom:6px;">Line Items</div>
      <div style="font-size:14px;font-weight:700;color:#0a1628;">${d.items.length} item${d.items.length !== 1 ? "s" : ""}</div>
      ${d.batchNumbers.length > 0 ? `<div style="font-size:10px;font-weight:700;color:#7c3aed;letter-spacing:.8px;text-transform:uppercase;margin-top:12px;margin-bottom:4px;">FIFO Batch(es)</div><div style="font-family:monospace;font-size:11px;color:#5b21b6;font-weight:700;">${d.batchNumbers.join(", ")}</div>` : ""}
    </div>
    <div style="padding:20px 24px;">
      <div style="font-size:10px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-bottom:6px;">Order Total</div>
      <div style="font-size:24px;font-weight:900;color:#0a1628;">Rs ${d.grandTotal.toLocaleString()}</div>
      <div style="font-size:10px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-top:10px;margin-bottom:5px;">Advance Paid</div>
      <div style="font-size:15px;font-weight:700;color:#22a86e;">Rs ${d.totalPaid.toLocaleString()}</div>
    </div>
  </div>
  <div style="padding:20px 48px;">
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#0a1628;">
        <th style="padding:12px 14px;color:white;font-size:11px;font-weight:700;letter-spacing:.5px;text-align:left;text-transform:uppercase;">Item Description</th>
        <th style="padding:12px 14px;color:white;font-size:11px;font-weight:700;text-align:center;text-transform:uppercase;width:80px;">Qty</th>
        <th style="padding:12px 14px;color:white;font-size:11px;font-weight:700;text-align:right;text-transform:uppercase;width:120px;">Rate (Rs)</th>
        <th style="padding:12px 14px;color:white;font-size:11px;font-weight:700;text-align:right;text-transform:uppercase;width:130px;">Amount (Rs)</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f4f7fc;">
          <td colspan="3" style="padding:11px 14px;font-size:13px;font-weight:800;color:#0a1628;text-align:right;border-top:2px solid #1057a0;">Total:</td>
          <td style="padding:11px 14px;font-size:15px;font-weight:900;color:#0a1628;text-align:right;border-top:2px solid #1057a0;">Rs ${d.grandTotal.toLocaleString()}</td>
        </tr>
      </tfoot>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-top:12px;">
      <div style="min-width:300px;">
        <div style="background:#f4f7fc;border-radius:8px;padding:10px 14px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px;"><span style="color:#7a8baa;">Advance Paid:</span><span style="font-weight:700;color:#22a86e;">Rs ${d.totalPaid.toLocaleString()}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900;${d.totalDue > 0 ? "color:#e03c3c;" : "color:#22a86e;"}"><span>Balance Due:</span><span>Rs ${d.totalDue.toLocaleString()}</span></div>
        </div>
      </div>
    </div>
  </div>
  ${d.notes ? `<div style="margin:0 48px 16px;background:#fffbf0;border-left:4px solid #f0a500;border-radius:0 8px 8px 0;padding:10px 16px;font-size:12px;color:#0a1628;"><span style="font-weight:700;color:#c07800;">Notes / Delivery Instructions: </span>${d.notes}</div>` : ""}
  <div style="margin:0 48px;border-top:1.5px solid #e8eef7;padding:16px 0;display:flex;justify-content:space-between;align-items:flex-end;">
    <div style="font-size:11px;color:#7a8baa;max-width:320px;line-height:1.6;"><strong style="color:#0a1628;">Purchase Terms:</strong><br>This document confirms the purchase order placed with the above supplier. Payment terms as agreed. All goods must match the specifications stated above.</div>
    <div style="text-align:center;min-width:160px;"><div style="height:44px;border-bottom:1.5px solid #0a1628;margin-bottom:5px;"></div><div style="font-size:10px;font-weight:700;color:#0a1628;">Authorized Signature</div><div style="font-size:9px;color:#7a8baa;">Garments</div></div>
  </div>
  <div style="background:#0a1628;padding:9px 48px;display:flex;justify-content:space-between;align-items:center;margin-top:16px;">
    <div style="font-size:10px;color:#5aabf0;">Garments &bull; Archer Road, Quetta &bull; 0333-7826435 / 0322-8152991</div>
    <div style="font-size:8px;color:#5aabf0;">Software Developed By: <strong style="color:#f0a500;">AddsMint.com</strong> &bull; Printed: ${printed()}</div>
  </div>
</div>`;
}

export default function PurchasePage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  // purchaseId → batchNumber lookup for display
  const [batchMap, setBatchMap] = useState<Record<string, string>>({});
  const [filterStatus, setFilterStatus] = useState("all");

  /* modal state */
  const [supplierModal, setSupplierModal] = useState(false);
  const [poModal, setPoModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [editSupplierModal, setEditSupplierModal] = useState(false);

  /* form state */
  const [supplierForm, setSupplierForm] = useState(INIT_SUPPLIER);
  const [poForm, setPoForm] = useState(INIT_PO);
  const [viewPo, setViewPo] = useState<Purchase | null>(null);
  const [payTarget, setPayTarget] = useState<Purchase | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod,setPayMethod]=useState("Cash");
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [editSupForm, setEditSupForm] = useState(INIT_SUPPLIER);

  const [poItems, setPoItems] = useState<PoItem[]>([makeItem()]);

  const [saving, setSaving] = useState(false);
  const [printingPo, setPrintingPo] = useState(false);
  const [downloadingPo, setDownloadingPo] = useState(false);
  const [error, setError] = useState("");

  /* ── Load data ── */
  const load = () => {
    setLoading(true);
    Promise.allSettled([
      fetch("/api/suppliers").then(r => r.ok ? r.json() : []),
      fetch("/api/purchases").then(r => r.ok ? r.json() : []),
      fetch("/api/batches").then(r => r.ok ? r.json() : []),
    ]).then(([supsResult, posResult, batchResult]) => {
      const sups = supsResult.status === "fulfilled" ? supsResult.value : [];
      const pos = posResult.status === "fulfilled" ? posResult.value : [];
      const batchList: { purchaseId: string; batchNumber: string }[] =
        batchResult.status === "fulfilled" && Array.isArray(batchResult.value) ? batchResult.value : [];
      setSuppliers(Array.isArray(sups) ? sups : []);
      setPurchases(Array.isArray(pos) ? pos : []);
      const map: Record<string, string> = {};
      for (const b of batchList) map[b.purchaseId] = b.batchNumber;
      setBatchMap(map);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
    fetch("/api/lookups/stock?purpose=purchase").then(r => r.ok ? r.json() : []).then(data => {
      if (Array.isArray(data)) setStockItems(data);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Summary stats ── */
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyPurchases = purchases
    .filter(p => p.transactionType === "sold" && new Date(p.dateTime) >= monthStart)
    .reduce((s, p) => s + p.total, 0);
  const pendingPayments = purchases
    .filter(p => p.status !== "paid")
    .reduce((s, p) => s + p.balanceDue, 0);
  const activeSuppliers = suppliers.length;
  const totalPos = purchases.length;

  /* ── Add Supplier ── */
  const handleAddSupplier = async () => {
    setError("");
    if (!supplierForm.name.trim()) { setError("Supplier name is required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplierForm),
      });
      if (!res.ok) throw new Error(await res.text());
      setSupplierModal(false);
      setSupplierForm(INIT_SUPPLIER);
      load();
    } catch {
      setError("Failed to save supplier");
    } finally {
      setSaving(false);
    }
  };

  /* ── Edit Supplier ── */
  const openEditSupplier = (s: Supplier) => {
    setEditSupplier(s);
    setEditSupForm({ name: s.name, phone: s.phone ?? "", city: s.city ?? "Quetta", category: s.category ?? "Fabric", notes: s.notes ?? "" });
    setEditSupplierModal(true);
  };
  const handleEditSupplier = async () => {
    if (!editSupplier) return;
    setError("");
    if (!editSupForm.name.trim()) { setError("Supplier name is required"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/suppliers/${editSupplier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editSupForm),
      });
      if (!res.ok) throw new Error(await res.text());
      setEditSupplierModal(false);
      load();
    } catch {
      setError("Failed to update supplier");
    } finally {
      setSaving(false);
    }
  };

  /* ── New Purchase Order ── */
  const grandTotal = poItems.reduce((s, it) => s + Number(it.qty || 0) * Number(it.unitPrice || 0), 0);
  const balance = grandTotal - Number(poForm.advancePaid || 0);

  const updateItem = (id: string, changes: Partial<PoItem>) =>
    setPoItems(items => items.map(it => it._id === id ? { ...it, ...changes } : it));
  const removeItem = (id: string) =>
    setPoItems(items => items.filter(it => it._id !== id));

  const handleAddPo = async () => {
    setError("");
    if (!poForm.supplierId) { setError("Please select a supplier"); return; }
    for (const item of poItems) {
      if (!item.stockName.trim()) { setError("All items require a name"); return; }
      if (!item.unitPrice) { setError("All items require a rate"); return; }
    }
    setSaving(true);
    try {
      const res = await fetch("/api/purchases/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: poForm.supplierId,
          dateTime: new Date(poForm.poDate).toISOString(),
          items: poItems.map(it => ({
            stockItemId: it.stockItemId || null,
            stockName: it.stockName,
            qty: Number(it.qty),
            unitPrice: Number(it.unitPrice),
            category: it.category,
            unit: it.unit,
          })),
          advancePaid: Number(poForm.advancePaid || 0),
          paymentMode: poForm.paymentMode,
          notes: poForm.notes || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setPoModal(false);
      setPoForm(INIT_PO);
      setPoItems([makeItem()]);
      load();
    } catch {
      setError("Failed to create purchase order");
    } finally {
      setSaving(false);
    }
  };

  const getPoRenderData = (p: Purchase) => {
    const poGroup = purchases.filter(x => x.poNumber === p.poNumber);
    const grandTotal = poGroup.reduce((s, x) => s + x.total, 0);
    const totalPaid = poGroup.reduce((s, x) => s + x.amountPaid, 0);
    const totalDue = poGroup.reduce((s, x) => s + x.balanceDue, 0);
    const batchNumbers = poGroup.map(x => batchMap[x.id]).filter(Boolean) as string[];

    return {
      logoUrl: `${window.location.origin}/logo.svg`,
      poNumber: p.poNumber,
      supplierName: p.supplier?.name ?? "",
      supplierId: p.supplier?.supplierId ?? "",
      poDate: new Date(p.dateTime).toLocaleDateString("en-PK", { day: "2-digit", month: "long", year: "numeric" }),
      items: poGroup.map(x => ({ name: x.stockName, qty: x.qty, unitPrice: x.unitPrice, total: x.total })),
      grandTotal,
      totalPaid,
      totalDue,
      notes: p.notes,
      batchNumbers,
    };
  };

  const poPageStyle = "@page{size:A4;margin:0;}html,body{margin:0;padding:0;}";

  /* ── Print Purchase Order ── */
  const handlePrintPo = (p: Purchase) => {
    setPrintingPo(true);
    try {
      const renderData = getPoRenderData(p);
      const html = buildPOHTML(renderData);
      doPrint(html, poPageStyle, `Purchase Order ${renderData.poNumber}`);
    } finally {
      setPrintingPo(false);
    }
  };

  /* ── Download Purchase Order PDF ── */
  const handleDownloadPo = async (p: Purchase) => {
    setDownloadingPo(true);
    let container: HTMLDivElement | null = null;
    try {
      const { jsPDF } = await import("jspdf");
      const { default: html2canvas } = await import("html2canvas");
      const renderData = getPoRenderData(p);
      const html = buildPOHTML(renderData);

      container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "0";
      container.style.top = "0";
      container.style.width = "794px";
      container.style.opacity = "0";
      container.style.pointerEvents = "none";
      container.style.zIndex = "-1";
      container.innerHTML = html;
      document.body.appendChild(container);

      const poRoot = container.firstElementChild as HTMLElement | null;
      if (!poRoot) throw new Error("Could not render PO content");

      const canvas = await html2canvas(poRoot, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: 794,
        windowWidth: 794,
      });

      const doc = new jsPDF({ orientation: "p", unit: "px", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const canvasRatio = canvas.width / canvas.height;
      const pageRatio = pageW / pageH;

      let imgW = pageW;
      let imgH = pageW / canvasRatio;
      let imgX = 0;
      let imgY = 0;

      // Fit image inside A4 while preserving aspect ratio to avoid stretching.
      if (canvasRatio > pageRatio) {
        imgW = pageW;
        imgH = pageW / canvasRatio;
        imgX = 0;
        imgY = (pageH - imgH) / 2;
      } else {
        imgH = pageH;
        imgW = pageH * canvasRatio;
        imgX = (pageW - imgW) / 2;
        imgY = 0;
      }

      doc.addImage(canvas.toDataURL("image/png"), "PNG", imgX, imgY, imgW, imgH);

      const normalizedPoNumber = renderData.poNumber.toUpperCase().startsWith("PO-")
        ? renderData.poNumber
        : `PO-${renderData.poNumber}`;
      doc.save(`${normalizedPoNumber}.pdf`);
    } catch (err) {
      console.error("Failed to download PO PDF", err);
      setError("Failed to download purchase order PDF");
    } finally {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
      setDownloadingPo(false);
    }
  };

  /* ── Record Payment ── */
  const handleRecordPayment = async () => {
    if (!payTarget) return;
    setError("");
    const amt = Number(payAmount);
    if (!amt || amt <= 0) { setError("Enter a valid payment amount"); return; }
    if (amt > payTarget.balanceDue) { setError(`Amount exceeds balance due (Rs ${payTarget.balanceDue.toLocaleString()})`); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/purchases/${payTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ additionalPayment: amt, paymentMethod: payMethod }),
      });
      if (!res.ok) throw new Error(await res.text());
      setPayModal(false);
      setPayAmount("");
      setPayTarget(null);
      load();
    } catch {
      setError("Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  /* ── Filter purchases ── */
  const filteredPurchases = purchases.filter(p => {
    if (filterStatus === "all") return true;
    return p.status === filterStatus;
  });

  /* ── Status badge helper ── */
  function statusBadge(status: string) {
    if (status === "paid") return <Badge label="Paid" color="gn" />;
    if (status === "partial") return <Badge label="Partial" color="am" />;
    return <Badge label="Pending" color="rd" />;
  }

  /* ── Category badge color ── */
  function catColor(cat: string | null): "gn" | "am" | "rd" | "bl" {
    if (!cat) return "bl";
    if (cat === "Fabric") return "am";
    if (cat === "Thread") return "bl";
    if (cat === "Lining") return "bl";
    if (cat === "Accessories") return "gn";
    return "bl";
  }

  const btnPrimary: React.CSSProperties = {
    padding: "9px 18px", background: "linear-gradient(135deg,var(--blue),var(--blue2))",
    color: "white", border: "none", borderRadius: "var(--r2)", cursor: "pointer",
    fontSize: 13, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7,
  };
  const btnSecondary: React.CSSProperties = {
    padding: "9px 18px", background: "var(--bg)", color: "var(--ink3)",
    border: "1.5px solid var(--bg2)", borderRadius: "var(--r2)", cursor: "pointer",
    fontSize: 13, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7,
  };
  const actionBtn = (color: string): React.CSSProperties => ({
    width: 30, height: 30, border: "none", borderRadius: 7, cursor: "pointer",
    background: color === "blue" ? "#e8f3ff" : color === "green" ? "#e6f9f2" : color === "red" ? "#fff0f0" : "#f5f6fa",
    color: color === "blue" ? "var(--blue2)" : color === "green" ? "var(--green)" : color === "red" ? "var(--red)" : "var(--muted)",
    fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center",
  });

  /* ── Skeleton helpers ── */
  const SklBox = ({ w, h, r = 6 }: { w: number | string; h: number; r?: number }) => (
    <span className="skl" style={{ width: w, height: h, borderRadius: r, display: "block" }} />
  );

  const SkeletonStatCards = () => (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{
          background: "white", borderRadius: "var(--r)", boxShadow: "var(--sh)",
          border: "1px solid rgba(205,216,236,.5)", padding: "16px 20px",
          display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: 180,
        }}>
          <SklBox w={44} h={44} r={10} />
          <div style={{ flex: 1 }}>
            <SklBox w="60%" h={22} r={6} />
            <div style={{ marginTop: 6 }}><SklBox w="80%" h={11} r={4} /></div>
          </div>
        </div>
      ))}
    </div>
  );

  const SkeletonTableRows = ({ cols, rows = 5 }: { cols: number[]; rows?: number }) => (
    <tbody>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr key={ri} style={{ borderBottom: "1px solid var(--bg2)" }}>
          {cols.map((w, ci) => (
            <td key={ci} style={{ padding: "13px 12px" }}>
              <SklBox w={`${w}%`} h={13} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );

  const SkeletonSupplierTable = () => (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <SklBox w={160} h={18} />
        <SklBox w={120} h={34} r={8} />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--ink)" }}>
              {["Supplier ID", "Name / Company", "Phone", "City", "Category", "Total Purchased", "Balance Due", "Status", "Actions"]
                .map(h => <th key={h} style={th}>{h}</th>)}
            </tr>
          </thead>
          <SkeletonTableRows cols={[55, 70, 60, 50, 55, 65, 60, 45, 40]} rows={4} />
        </table>
      </div>
    </div>
  );

  const SkeletonPurchaseTable = () => (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <SklBox w={180} h={18} />
        <div style={{ display: "flex", gap: 10 }}>
          <SklBox w={110} h={34} r={20} />
          <SklBox w={160} h={34} r={8} />
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--ink)" }}>
              {["PO No.", "Supplier", "Item", "Total", "Paid", "Balance", "Date", "Status", "Actions"]
                .map(h => <th key={h} style={th}>{h}</th>)}
            </tr>
          </thead>
          <SkeletonTableRows cols={[50, 65, 70, 55, 50, 55, 60, 45, 35]} rows={5} />
        </table>
      </div>
    </div>
  );

  return (
    <div>
      {/* ── Summary Cards ── */}
      {loading ? <SkeletonStatCards /> : (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <StatCard icon="fa-cart-flatbed" value={`Rs ${monthlyPurchases.toLocaleString()}`} label="Total Purchases (Month)" color="am" />
          <StatCard icon="fa-truck-fast" value={String(totalPos)} label="Purchase Orders" color="bl" />
          <StatCard icon="fa-clock" value={`Rs ${pendingPayments.toLocaleString()}`} label="Pending Payments" color="rd" />
          <StatCard icon="fa-building-columns" value={String(activeSuppliers)} label="Active Suppliers" color="gn" />
        </div>
      )}

      {loading && (
        <>
          <SkeletonSupplierTable />
          <SkeletonPurchaseTable />
        </>
      )}

      {!loading && (
        <>
          {/* ── Supplier Ledger ── */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                <i className="fa-solid fa-address-book" style={{ color: "var(--blue)" }} />
                Supplier Ledger
              </div>
              <button style={btnSecondary} onClick={() => { setSupplierModal(true); setError(""); setSupplierForm(INIT_SUPPLIER); }}>
                <i className="fa-solid fa-user-plus" /> Add Supplier
              </button>
            </div>

            {suppliers.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "var(--muted)", fontSize: 13 }}>
                <i className="fa-solid fa-address-book" style={{ fontSize: 28, marginBottom: 8, display: "block", opacity: 0.3 }} />
                No suppliers yet. Add your first supplier.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--ink)" }}>
                      {["Supplier ID", "Name / Company", "Phone", "City", "Category", "Total Purchased", "Balance Due", "Status", "Actions"]
                        .map(h => <th key={h} style={th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map(s => (
                      <tr key={s.id} style={{ transition: "background .15s" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "white"}>
                        <td style={td}>
                          <span style={{ fontFamily: "monospace", fontSize: 12, background: "var(--bg)", padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>
                            {s.supplierId}
                          </span>
                        </td>
                        <td style={{ ...td, fontWeight: 600 }}>{s.name}</td>
                        <td style={{ ...td, color: "var(--muted)" }}>{s.phone || "—"}</td>
                        <td style={{ ...td, color: "var(--muted)" }}>{s.city || "—"}</td>
                        <td style={td}><Badge label={s.category || "Other"} color={catColor(s.category)} /></td>
                        <td style={{ ...td, fontWeight: 600 }}>Rs {s.totalPurchased.toLocaleString()}</td>
                        <td style={{ ...td, fontWeight: 600, color: s.balanceDue > 0 ? "var(--red)" : "var(--green)" }}>
                          {s.balanceDue > 0 ? `Rs ${s.balanceDue.toLocaleString()}` : "Paid"}
                        </td>
                        <td style={td}>
                          {s.balanceDue > 0 ? <Badge label="Due" color="am" /> : <Badge label="Clear" color="gn" />}
                        </td>
                        <td style={td}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button title="New PO" style={actionBtn("blue")} onClick={() => {
                              setPoForm({ ...INIT_PO, supplierId: s.id });
                              setPoItems([makeItem()]);
                              setError("");
                              setPoModal(true);
                            }}>
                              <i className="fa-solid fa-file-invoice" />
                            </button>
                            <button title="Edit" style={actionBtn("gray")} onClick={() => openEditSupplier(s)}>
                              <i className="fa-solid fa-pen" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Purchase Orders ── */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                <i className="fa-solid fa-file-invoice-dollar" style={{ color: "var(--blue)" }} />
                Purchase Orders
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <select style={{ padding: "7px 12px", border: "1.5px solid var(--bg2)", borderRadius: 20, fontFamily: "inherit", fontSize: 12, outline: "none", cursor: "pointer" }}
                  value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                </select>
                <button style={btnPrimary} onClick={() => { setPoModal(true); setError(""); setPoForm(INIT_PO); setPoItems([makeItem()]); }}>
                  <i className="fa-solid fa-plus" /> New Purchase Order
                </button>
              </div>
            </div>

            {filteredPurchases.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "var(--muted)", fontSize: 13 }}>
                <i className="fa-solid fa-file-invoice-dollar" style={{ fontSize: 28, marginBottom: 8, display: "block", opacity: 0.3 }} />
                No purchase orders found.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--ink)" }}>
                      {["PO No.", "Supplier", "Item", "Total", "Paid", "Balance", "Date", "Status", "Actions"]
                        .map(h => <th key={h} style={th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPurchases.map(p => (
                      <tr key={p.id} style={{ transition: "background .15s" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "white"}>
                        <td style={td}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontFamily: "monospace", fontSize: 12, background: "var(--bg)", padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>
                              {p.poNumber}
                            </span>
                            {batchMap[p.id] && (
                              <span style={{ fontFamily: "monospace", fontSize: 10, background: "#f5f3ff", color: "#7c3aed", padding: "2px 7px", borderRadius: 5, fontWeight: 700, border: "1px solid #ddd6fe", display: "inline-block" }}>
                                <i className="fa-solid fa-layer-group" style={{ fontSize: 8, marginRight: 4 }}></i>
                                {batchMap[p.id]}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ ...td, fontWeight: 600 }}>{p.supplier?.name}</td>
                        <td style={{ ...td, fontSize: 12, color: "var(--muted)", maxWidth: 200 }}>
                          {p.stockName} &times; {p.qty}
                        </td>
                        <td style={{ ...td, fontWeight: 600 }}>Rs {p.total.toLocaleString()}</td>
                        <td style={{ ...td, fontWeight: 600, color: "var(--green)" }}>Rs {p.amountPaid.toLocaleString()}</td>
                        <td style={{ ...td, fontWeight: 600, color: p.balanceDue > 0 ? "var(--red)" : "var(--green)" }}>
                          {p.balanceDue > 0 ? `Rs ${p.balanceDue.toLocaleString()}` : "Rs 0"}
                        </td>
                        <td style={{ ...td, color: "var(--muted)", fontSize: 12 }}>
                          {new Date(p.dateTime).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td style={td}>{statusBadge(p.status)}</td>
                        <td style={td}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button title="View" style={actionBtn("blue")} onClick={() => { setViewPo(p); setViewModal(true); }}>
                              <i className="fa-solid fa-eye" />
                            </button>
                            <button title="Print PO" style={actionBtn("gray")} onClick={() => handlePrintPo(p)} disabled={printingPo}>
                              <i className="fa-solid fa-print" />
                            </button>
                            <button title="Download PDF" style={actionBtn("blue")} onClick={() => handleDownloadPo(p)} disabled={downloadingPo}>
                              <i className="fa-solid fa-download" />
                            </button>
                            {p.status !== "paid" && (
                              <button title="Record Payment" style={actionBtn("green")} onClick={() => {
                                setPayTarget(p); setPayAmount(""); setError(""); setPayModal(true);
                              }}>
                                <i className="fa-solid fa-money-bill-wave" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════ ADD SUPPLIER MODAL ══════════ */}
      <Modal open={supplierModal} onClose={() => setSupplierModal(false)} title="Add New Supplier" icon="fa-user-tie">
        <div style={{ background: "#e8f3ff", border: "1px solid #bdd6f5", borderRadius: "var(--r2)", padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "var(--blue2)", display: "flex", alignItems: "center", gap: 8 }}>
          <i className="fa-solid fa-id-badge" />
          <span>Supplier ID will be auto-assigned on save.</span>
        </div>
        {error && <div style={{ background: "#fff0f0", color: "var(--red)", padding: "9px 13px", borderRadius: "var(--r2)", marginBottom: 12, fontSize: 12, fontWeight: 500 }}>{error}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "span 2" }}>
            <label style={lbl}>Supplier / Company Name *</label>
            <input style={inp} placeholder="e.g. Baloch Fabric House" value={supplierForm.name} onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Phone</label>
            <input style={inp} placeholder="03XX-XXXXXXX" value={supplierForm.phone} onChange={e => setSupplierForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>City</label>
            <select style={sel} value={supplierForm.city} onChange={e => setSupplierForm(f => ({ ...f, city: e.target.value }))}>
              {CITIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Supply Category</label>
            <select style={sel} value={supplierForm.category} onChange={e => setSupplierForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label style={lbl}>Address / Notes</label>
            <textarea style={{ ...inp, height: 72, resize: "vertical" }} placeholder="Supplier address or additional notes..." value={supplierForm.notes} onChange={e => setSupplierForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button style={btnSecondary} onClick={() => setSupplierModal(false)}><i className="fa-solid fa-xmark" /> Cancel</button>
          <button style={btnPrimary} onClick={handleAddSupplier} disabled={saving}>
            <i className="fa-solid fa-floppy-disk" /> {saving ? "Saving…" : "Save Supplier"}
          </button>
        </div>
      </Modal>

      {/* ══════════ EDIT SUPPLIER MODAL ══════════ */}
      <Modal open={editSupplierModal} onClose={() => setEditSupplierModal(false)} title={`Edit Supplier — ${editSupplier?.supplierId}`} icon="fa-user-tie">
        {error && <div style={{ background: "#fff0f0", color: "var(--red)", padding: "9px 13px", borderRadius: "var(--r2)", marginBottom: 12, fontSize: 12, fontWeight: 500 }}>{error}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "span 2" }}>
            <label style={lbl}>Supplier / Company Name *</label>
            <input style={inp} value={editSupForm.name} onChange={e => setEditSupForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Phone</label>
            <input style={inp} value={editSupForm.phone} onChange={e => setEditSupForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>City</label>
            <select style={sel} value={editSupForm.city} onChange={e => setEditSupForm(f => ({ ...f, city: e.target.value }))}>
              {CITIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Supply Category</label>
            <select style={sel} value={editSupForm.category} onChange={e => setEditSupForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label style={lbl}>Address / Notes</label>
            <textarea style={{ ...inp, height: 72, resize: "vertical" }} value={editSupForm.notes} onChange={e => setEditSupForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button style={btnSecondary} onClick={() => setEditSupplierModal(false)}><i className="fa-solid fa-xmark" /> Cancel</button>
          <button style={btnPrimary} onClick={handleEditSupplier} disabled={saving}>
            <i className="fa-solid fa-floppy-disk" /> {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </Modal>

      {/* ══════════ NEW PURCHASE ORDER MODAL ══════════ */}
      <Modal open={poModal} onClose={() => { setPoModal(false); setPoItems([makeItem()]); }} title="New Purchase Order" icon="fa-file-invoice-dollar" width={620}>
        <div style={{ background: "#e8f3ff", border: "1px solid #bdd6f5", borderRadius: "var(--r2)", padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "var(--blue2)", display: "flex", alignItems: "center", gap: 8 }}>
          <i className="fa-solid fa-hashtag" />
          <span>PO number will be auto-assigned on save.</span>
        </div>
        {error && <div style={{ background: "#fff0f0", color: "var(--red)", padding: "9px 13px", borderRadius: "var(--r2)", marginBottom: 12, fontSize: 12, fontWeight: 500 }}>{error}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div>
            <label style={lbl}>Supplier *</label>
            <select style={sel} value={poForm.supplierId} onChange={e => setPoForm(f => ({ ...f, supplierId: e.target.value }))}>
              <option value="">— Select Supplier —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplierId} — {s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>PO Date *</label>
            <input type="date" style={inp} value={poForm.poDate} onChange={e => setPoForm(f => ({ ...f, poDate: e.target.value }))} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", background: "var(--bg)", borderRadius: "var(--r2)", border: "1px solid var(--bg2)", padding: "8px 12px" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>Total</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>Rs {grandTotal.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: balance > 0 ? "var(--red)" : "var(--green)", fontWeight: 600 }}>
              Balance: Rs {balance.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Item rows */}
        <div style={{ background: "var(--bg)", borderRadius: "var(--r2)", border: "1px solid var(--bg2)", padding: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink3)", display: "flex", alignItems: "center", gap: 6 }}>
              <i className="fa-solid fa-boxes-stacked" style={{ color: "var(--blue)" }} /> Item Details
            </div>
            <button type="button" style={{ ...btnPrimary, padding: "5px 12px", fontSize: 11 }}
              onClick={() => setPoItems(items => [...items, makeItem()])}>
              <i className="fa-solid fa-plus" /> Add Item
            </button>
          </div>

          {poItems.map((item, idx) => (
            <div key={item._id} style={{
              background: "white", borderRadius: "var(--r2)", border: "1px solid var(--bg2)",
              padding: 12, marginBottom: idx < poItems.length - 1 ? 10 : 0,
            }}>
              {/* Row header: label + mode toggle + remove */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
                  Item {idx + 1}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ display: "flex", background: "var(--bg)", border: "1.5px solid var(--bg2)", borderRadius: 20, padding: 2, gap: 2 }}>
                    {(["free", "stock"] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => updateItem(item._id, {
                          mode,
                          stockItemId: "", stockName: "", category: "Fabric", unitPrice: "", unit: "Meter",
                        })}
                        style={{
                          padding: "3px 10px", borderRadius: 16, border: "none", cursor: "pointer",
                          fontSize: 10, fontWeight: 600, fontFamily: "inherit", transition: "all .15s",
                          background: item.mode === mode ? "linear-gradient(135deg,var(--blue),var(--blue2))" : "transparent",
                          color: item.mode === mode ? "white" : "var(--muted)",
                        }}
                      >
                        <i className={`fa-solid ${mode === "free" ? "fa-pencil" : "fa-list"}`} style={{ marginRight: 4 }} />
                        {mode === "free" ? "New Product" : "From Stock"}
                      </button>
                    ))}
                  </div>
                  {poItems.length > 1 && (
                    <button type="button" onClick={() => removeItem(item._id)} style={{
                      width: 26, height: 26, border: "none", borderRadius: 6, cursor: "pointer",
                      background: "#fff0f0", color: "var(--red)", fontSize: 12,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <i className="fa-solid fa-trash-can" />
                    </button>
                  )}
                </div>
              </div>

              {/* Stock dropdown */}
              {item.mode === "stock" && (
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Select Stock Item *</label>
                  <select
                    style={sel}
                    value={item.stockItemId}
                    onChange={e => {
                      const si = stockItems.find(s => s.id === e.target.value);
                      updateItem(item._id, {
                        stockItemId: e.target.value,
                        stockName: si ? si.name : "",
                        category: si ? si.category : item.category,
                        unitPrice: si ? String(si.purchasePrice) : "",
                        unit: si ? si.unit : item.unit,
                      });
                    }}
                  >
                    <option value="">— Select a stock item —</option>
                    {stockItems.map(s => (
                      <option key={s.id} value={s.id}>{s.code} — {s.name} ({s.unit})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Fields */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lbl}>Item Name *</label>
                  {item.mode === "free" ? (
                    <input style={inp} placeholder="e.g. White Lawn Fabric" value={item.stockName}
                      onChange={e => updateItem(item._id, { stockName: e.target.value })} />
                  ) : (
                    <input style={{ ...inp, background: "var(--bg)", color: "var(--muted)" }}
                      value={item.stockName} readOnly placeholder="Auto-filled from stock" />
                  )}
                </div>
                <div>
                  <label style={lbl}>Category</label>
                  <select style={sel} value={item.category}
                    onChange={e => updateItem(item._id, { category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Qty *</label>
                  <input type="number" style={inp} value={item.qty} min="0"
                    onChange={e => updateItem(item._id, { qty: e.target.value })} />
                </div>
                <div>
                  <label style={lbl}>Unit</label>
                  <select style={sel} value={item.unit}
                    onChange={e => updateItem(item._id, { unit: e.target.value })}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Rate (Rs) *</label>
                  <input type="number" style={inp} placeholder="0" value={item.unitPrice} min="0"
                    onChange={e => updateItem(item._id, { unitPrice: e.target.value })} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Payment */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={lbl}>Advance Paid (Rs)</label>
            <input type="number" style={inp} placeholder="0" value={poForm.advancePaid} min="0" onChange={e => setPoForm(f => ({ ...f, advancePaid: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Payment Mode</label>
            <PaymentMethodSelect value={poForm.paymentMode} onChange={v => setPoForm(f => ({...f,paymentMode:v}))} style={sel}/>
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label style={lbl}>Notes</label>
            <textarea style={{ ...inp, height: 60, resize: "vertical" }} placeholder="Delivery instructions, quality specs..." value={poForm.notes} onChange={e => setPoForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button style={btnSecondary} onClick={() => { setPoModal(false); setPoItems([makeItem()]); }}><i className="fa-solid fa-xmark" /> Cancel</button>
          <button style={btnPrimary} onClick={handleAddPo} disabled={saving}>
            <i className="fa-solid fa-floppy-disk" /> {saving ? "Saving…" : "Save Purchase Order"}
          </button>
        </div>
      </Modal>

      {/* ══════════ VIEW PO MODAL ══════════ */}
      {viewPo && (
        <Modal open={viewModal} onClose={() => setViewModal(false)} title={`Purchase Order — ${viewPo.poNumber}`} icon="fa-file-invoice-dollar" width={620}>
          {batchMap[viewPo.id] && (
            <div style={{ background: "#f5f3ff", border: "1.5px solid #ddd6fe", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <i className="fa-solid fa-layer-group" style={{ color: "#7c3aed", fontSize: 15 }}></i>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: ".4px" }}>FIFO Batch Created</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#5b21b6", fontFamily: "monospace" }}>{batchMap[viewPo.id]}</div>
              </div>
              <div style={{ marginLeft: "auto", fontSize: 11, color: "#7c3aed" }}>Stock will be consumed from this batch first (oldest → newest)</div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Supplier", main: viewPo.supplier?.name, sub: viewPo.supplier?.supplierId },
              { label: "PO Date", main: new Date(viewPo.dateTime).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }), sub: `Status: ${viewPo.status}` },
              { label: "Payment", main: `Rs ${viewPo.balanceDue.toLocaleString()} Due`, sub: `Rs ${viewPo.amountPaid.toLocaleString()} Paid` },
            ].map(item => (
              <div key={item.label} style={{ background: "var(--bg)", borderRadius: "var(--r2)", padding: "12px 14px", border: "1px solid var(--bg2)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{item.main}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{item.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--ink)" }}>
                  {["Item", "Category", "Qty", "Unit Price", "Amount"].map(h => (
                    <th key={h} style={{ ...th, padding: "9px 12px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...td, fontWeight: 600 }}>{viewPo.stockName}</td>
                  <td style={td}><Badge label={viewPo.transactionType === "sold" ? "Purchase" : viewPo.transactionType} color="am" /></td>
                  <td style={td}>{viewPo.qty}</td>
                  <td style={td}>Rs {viewPo.unitPrice.toLocaleString()}</td>
                  <td style={{ ...td, fontWeight: 700 }}>Rs {viewPo.total.toLocaleString()}</td>
                </tr>
                <tr style={{ background: "var(--bg)" }}>
                  <td colSpan={4} style={{ ...td, textAlign: "right", fontWeight: 700 }}>Total:</td>
                  <td style={{ ...td, fontWeight: 700 }}>Rs {viewPo.total.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {viewPo.notes && (
            <div style={{ background: "var(--bg)", borderRadius: "var(--r2)", padding: "10px 14px", fontSize: 12, color: "var(--muted)", marginBottom: 16, border: "1px solid var(--bg2)" }}>
              <strong>Notes:</strong> {viewPo.notes}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            {viewPo.status !== "paid" && (
              <button style={{ ...btnPrimary, background: "linear-gradient(135deg,var(--green),#1a8f5d)" }} onClick={() => {
                setViewModal(false);
                setPayTarget(viewPo);
                setPayAmount("");
                setError("");
                setPayModal(true);
              }}>
                <i className="fa-solid fa-money-bill-wave" /> Record Payment
              </button>
            )}
            <button style={btnPrimary} onClick={() => handlePrintPo(viewPo)} disabled={printingPo}>
              <i className="fa-solid fa-print" /> {printingPo ? "Printing…" : "Print PO"}
            </button>
            <button style={btnSecondary} onClick={() => setViewModal(false)}><i className="fa-solid fa-xmark" /> Close</button>
          </div>
        </Modal>
      )}

      {/* ══════════ RECORD PAYMENT MODAL ══════════ */}
      {payTarget && (
        <Modal open={payModal} onClose={() => setPayModal(false)} title={`Record Payment — ${payTarget.poNumber}`} icon="fa-money-bill-wave">
          {error && <div style={{ background: "#fff0f0", color: "var(--red)", padding: "9px 13px", borderRadius: "var(--r2)", marginBottom: 12, fontSize: 12, fontWeight: 500 }}>{error}</div>}
          <div style={{ background: "var(--bg)", borderRadius: "var(--r2)", padding: "12px 16px", marginBottom: 16, border: "1px solid var(--bg2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: "var(--muted)" }}>Total Amount:</span>
              <span style={{ fontWeight: 700 }}>Rs {payTarget.total.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: "var(--muted)" }}>Already Paid:</span>
              <span style={{ fontWeight: 700, color: "var(--green)" }}>Rs {payTarget.amountPaid.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, borderTop: "1px solid var(--bg2)", paddingTop: 8, marginTop: 4 }}>
              <span style={{ fontWeight: 700 }}>Balance Due:</span>
              <span style={{ fontWeight: 700, color: "var(--red)" }}>Rs {payTarget.balanceDue.toLocaleString()}</span>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Payment Amount (Rs) *</label>
            <input type="number" style={inp} placeholder={`Max: Rs ${payTarget.balanceDue.toLocaleString()}`} value={payAmount} min="0" max={payTarget.balanceDue} onChange={e => setPayAmount(e.target.value)} />
            <label style={lbl}>Payment method</label><PaymentMethodSelect value={payMethod} onChange={setPayMethod} style={sel}/>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button style={btnSecondary} onClick={() => setPayModal(false)}><i className="fa-solid fa-xmark" /> Cancel</button>
            <button style={{ ...btnPrimary, background: "linear-gradient(135deg,var(--green),#1a8f5d)" }} onClick={handleRecordPayment} disabled={saving}>
              <i className="fa-solid fa-check" /> {saving ? "Saving…" : "Record Payment"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
