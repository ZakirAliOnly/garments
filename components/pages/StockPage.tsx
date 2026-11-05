"use client";
import React, { useEffect, useMemo, useState } from "react";
import StockBarcode from "@/components/StockBarcode";

interface StockVariant {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  quantity: number;
  salesPrice: number | null;
  purchasePrice: number | null;
}

interface StockItem {
  id: string;
  code: string;
  sku: string | null;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
  salesPrice: number;
  lowStockThreshold: number;
  hasVariants: boolean;
  variants: StockVariant[];
  createdAt: string;
}

interface StockBatch {
  id: string;
  batchNumber: string;
  purchaseId: string;
  stockItemId: string;
  qty: number;
  remaining: number;
  costPrice: number;
  purchasedAt: string;
  stockItem: { name: string; code: string; unit: string };
}

interface ReportInvoice {
  id: string;
  invNumber: string;
  type: "regular" | "walk";
  customerName: string;
  invoiceDate: string;
  items: unknown;
}

interface SoldRow {
  id: string;
  invoiceId: string;
  invNumber: string;
  invoiceDate: string;
  type: "regular" | "walk";
  customerName: string;
  product: string;
  qty: number;
  rate: number;
  salesAmount: number;
  costAmount: number;
  profit: number;
}

const CATEGORIES = ["Fabric", "Lining", "Thread", "Accessories", "Buttons", "Zips", "Padding", "Uniform", "Other"];
const UNITS = ["mtr", "yard", "pcs", "doz", "roll", "kg", "set"];
const PRESET_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "18", "20", "22", "24", "26", "28", "30", "32", "34", "36", "38", "40", "42"];
const PRESET_SIZE_ORDER = new Map(PRESET_SIZES.map((size, index) => [size, index]));

function compareSizeText(a: string, b: string): number {
  const aSize = a.trim().toUpperCase();
  const bSize = b.trim().toUpperCase();
  const aOrder = PRESET_SIZE_ORDER.get(aSize);
  const bOrder = PRESET_SIZE_ORDER.get(bSize);

  if (aOrder != null && bOrder != null && aOrder !== bOrder) return aOrder - bOrder;
  if (aOrder != null && bOrder == null) return -1;
  if (aOrder == null && bOrder != null) return 1;

  const aNum = Number(aSize);
  const bNum = Number(bSize);
  const aIsNum = aSize !== "" && !Number.isNaN(aNum);
  const bIsNum = bSize !== "" && !Number.isNaN(bNum);
  if (aIsNum && bIsNum && aNum !== bNum) return aNum - bNum;
  if (aIsNum && !bIsNum) return -1;
  if (!aIsNum && bIsNum) return 1;

  return aSize.localeCompare(bSize, undefined, { numeric: true, sensitivity: "base" });
}

function compareVariantsBySize(a: StockVariant, b: StockVariant): number {
  const aSize = a.size ?? "";
  const bSize = b.size ?? "";
  const sizeCmp = compareSizeText(aSize, bSize);
  if (sizeCmp !== 0) return sizeCmp;

  return (a.color ?? "").localeCompare(b.color ?? "", undefined, { sensitivity: "base" });
}

function sortVariants(variants: StockVariant[]): StockVariant[] {
  return [...variants].sort(compareVariantsBySize);
}

const card: React.CSSProperties = {
  background: "white", borderRadius: "var(--r)", boxShadow: "var(--sh)",
  padding: 20, marginBottom: 20, border: "1px solid rgba(205,216,236,.5)",
};
const th: React.CSSProperties = {
  padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 600,
  color: "white", letterSpacing: ".6px", textTransform: "uppercase", whiteSpace: "nowrap",
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1.5px solid var(--bg2)",
  borderRadius: "var(--r2)", fontSize: 13, fontFamily: "inherit",
  outline: "none", background: "white", color: "var(--ink)",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "var(--ink3)",
  letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 4, display: "block",
};

function getStatus(qty: number, threshold: number) {
  if (qty <= 0) return { label: "Out", sc: "rd" };
  if (qty <= threshold) return { label: "Low", sc: "am" };
  return { label: "OK", sc: "gn" };
}
function todayIsoDate() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
}
const badgeBg: Record<string, string> = { gn: "#e6f9f2", am: "#fff8e6", rd: "#fff0f0" };
const badgeColor: Record<string, string> = { gn: "var(--green)", am: "var(--gold)", rd: "var(--red)" };

function getStockValue(item: StockItem): number {
  if (!item.hasVariants || item.variants.length === 0) return item.quantity * item.purchasePrice;
  return item.variants.reduce((s, v) => s + v.quantity * (v.purchasePrice ?? item.purchasePrice), 0);
}
function getEffectivePurchasePrice(item: StockItem): number {
  if (!item.hasVariants || item.variants.length === 0) return item.purchasePrice;
  const totalQty = item.variants.reduce((s, v) => s + v.quantity, 0);
  if (totalQty === 0) return item.purchasePrice;
  return getStockValue(item) / totalQty;
}
function getEffectiveSalesPrice(item: StockItem): number {
  if (!item.hasVariants || item.variants.length === 0) return item.salesPrice;
  const totalQty = item.variants.reduce((s, v) => s + v.quantity, 0);
  if (totalQty === 0) return item.salesPrice;
  const totalSalesValue = item.variants.reduce((s, v) => s + v.quantity * (v.salesPrice ?? item.salesPrice), 0);
  return totalSalesValue / totalQty;
}

interface VariantRow { size: string; color: string; quantity: string; salesPrice: string; purchasePrice: string; }

const INITIAL_FORM = {
  name: "", category: "Fabric", quantity: "", unit: "mtr", purchasePrice: "", salesPrice: "", lowStockThreshold: "5",
  hasVariants: false,
  selectedSizes: [] as string[],
  customSizeInput: "",
  colors: [] as string[],
  colorInput: "",
};

function buildVariants(sizes: string[], colors: string[]): VariantRow[] {
  const blank = (): VariantRow => ({ size: "", color: "", quantity: "0", salesPrice: "", purchasePrice: "" });
  const orderedSizes = [...sizes].sort(compareSizeText);
  if (sizes.length === 0 && colors.length === 0) return [];
  if (sizes.length === 0) return colors.map(c => ({ ...blank(), color: c }));
  if (colors.length === 0) return orderedSizes.map(s => ({ ...blank(), size: s }));
  return orderedSizes.flatMap(s => colors.map(c => ({ ...blank(), size: s, color: c })));
}

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [reportInvoices, setReportInvoices] = useState<ReportInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"stock" | "report" | "batches">("stock");
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchSearch, setBatchSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; sku: string | null } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState<StockItem | null>(null);
  const [editForm, setEditForm] = useState({ name: "", category: "Fabric", unit: "mtr", purchasePrice: "", salesPrice: "", lowStockThreshold: "5", quantity: "" });
  const [editVariantQtys, setEditVariantQtys] = useState<Record<string, string>>({});
  const [editVariantPrices, setEditVariantPrices] = useState<Record<string, { sales: string; purchase: string }>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editNewVariants, setEditNewVariants] = useState<VariantRow[]>([]);
  const [editNewVarInput, setEditNewVarInput] = useState({ size: "", color: "", quantity: "0", salesPrice: "", purchasePrice: "" });
  const [rptFrom, setRptFrom] = useState(todayIsoDate());
  const [rptTo, setRptTo] = useState(todayIsoDate());
  const [rptType, setRptType] = useState<"" | "regular" | "walk">("");
  const [rptProduct, setRptProduct] = useState("");
  const [rptCustomer, setRptCustomer] = useState("");
  const [batchExpanded, setBatchExpanded] = useState<Set<string>>(new Set());
  const [itemBatches, setItemBatches] = useState<Record<string, StockBatch[]>>({});

  const load = () => {
    setLoading(true);
    fetch("/api/stock").then(r => r.json())
      .then(d => {
        const normalized = Array.isArray(d)
          ? d.map((item) => ({ ...item, variants: sortVariants(item.variants ?? []) }))
          : [];
        setItems(normalized);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };
  const loadReport = () => {
    fetch("/api/lookups/stock-sales")
      .then(r => r.json())
      .then(d => {
        setReportInvoices(Array.isArray(d) ? d : []);
      })
      .catch(() => undefined);
  };
  const loadBatches = () => {
    setBatchesLoading(true);
    fetch("/api/batches")
      .then(r => r.json())
      .then(d => { setBatches(Array.isArray(d) ? d : []); setBatchesLoading(false); })
      .catch(() => setBatchesLoading(false));
  };

  useEffect(() => { load(); loadReport(); loadBatches(); }, []);

  // Rebuild variant grid whenever sizes/colors change
  useEffect(() => {
    if (!form.hasVariants) return;
    setVariants(buildVariants(form.selectedSizes, form.colors));
  }, [form.selectedSizes, form.colors, form.hasVariants]);

  const openModal = () => { setForm(INITIAL_FORM); setVariants([]); setError(""); setModal(true); };
  const closeModal = () => { setModal(false); setVariants([]); setError(""); setForm(INITIAL_FORM); };

  const toggleSize = (s: string) => setForm(f => ({
    ...f, selectedSizes: f.selectedSizes.includes(s) ? f.selectedSizes.filter(x => x !== s) : [...f.selectedSizes, s],
  }));

  const addCustomSize = () => {
    const s = form.customSizeInput.trim().toUpperCase();
    if (s && !form.selectedSizes.includes(s)) setForm(f => ({ ...f, selectedSizes: [...f.selectedSizes, s], customSizeInput: "" }));
    else setForm(f => ({ ...f, customSizeInput: "" }));
  };

  const addColor = () => {
    const c = form.colorInput.trim();
    if (c && !form.colors.includes(c)) setForm(f => ({ ...f, colors: [...f.colors, c], colorInput: "" }));
    else setForm(f => ({ ...f, colorInput: "" }));
  };

  const totalItems = items.length;
  const lowStockCount = items.filter(i => i.quantity > 0 && i.quantity <= i.lowStockThreshold).length;
  const outCount = items.filter(i => i.quantity <= 0).length;
  const stockValue = items.reduce((s, i) => s + getStockValue(i), 0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.hasVariants && variants.length === 0) { setError("Add at least one size or color to generate variants"); return; }
    setSaving(true); setError("");
    const payload = {
      name: form.name, category: form.category, unit: form.unit,
      purchasePrice: form.purchasePrice, salesPrice: form.salesPrice,
      lowStockThreshold: form.lowStockThreshold,
      quantity: form.quantity,
      hasVariants: form.hasVariants,
      variants: form.hasVariants ? variants.map(v => ({
        size: v.size, color: v.color,
        quantity: parseFloat(v.quantity) || 0,
        salesPrice: v.salesPrice !== "" ? v.salesPrice : null,
        purchasePrice: v.purchasePrice !== "" ? v.purchasePrice : null,
      })) : [],
    };
    const res = await fetch("/api/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { closeModal(); load(); }
    else { const d = await res.json(); setError(d.error || "Something went wrong"); }
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/stock/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    setDeleting(false);
    load();
  };

  const openEdit = (item: StockItem) => {
    setEditTarget({ ...item, variants: sortVariants(item.variants) });
    setEditForm({ name: item.name, category: item.category, unit: item.unit, purchasePrice: String(item.purchasePrice), salesPrice: String(item.salesPrice), lowStockThreshold: String(item.lowStockThreshold), quantity: String(item.quantity) });
    const qtys: Record<string, string> = {};
    const prices: Record<string, { sales: string; purchase: string }> = {};
    item.variants.forEach(v => {
      qtys[v.id] = String(v.quantity);
      prices[v.id] = {
        sales: v.salesPrice != null ? String(v.salesPrice) : "",
        purchase: v.purchasePrice != null ? String(v.purchasePrice) : "",
      };
    });
    setEditVariantQtys(qtys);
    setEditVariantPrices(prices);
    setEditError("");
    setEditNewVariants([]);
    setEditNewVarInput({ size: "", color: "", quantity: "0", salesPrice: "", purchasePrice: "" });
  };

  const closeEdit = () => {
    setEditTarget(null);
    setEditNewVariants([]);
    setEditNewVarInput({ size: "", color: "", quantity: "0", salesPrice: "", purchasePrice: "" });
  };

  const addEditVariant = () => {
    const size = editNewVarInput.size.trim();
    const color = editNewVarInput.color.trim();
    if (!size && !color) return;
    setEditNewVariants(prev => [...prev, { size, color, quantity: editNewVarInput.quantity || "0", salesPrice: editNewVarInput.salesPrice, purchasePrice: editNewVarInput.purchasePrice }]);
    setEditNewVarInput({ size: "", color: "", quantity: "0", salesPrice: "", purchasePrice: "" });
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true); setEditError("");
    const payload = {
      ...editForm,
      variantQuantities: editVariantQtys,
      variantPrices: editVariantPrices,
      newVariants: editNewVariants.map(v => ({
        size: v.size || null,
        color: v.color || null,
        quantity: parseFloat(v.quantity) || 0,
        salesPrice: v.salesPrice !== "" ? v.salesPrice : null,
        purchasePrice: v.purchasePrice !== "" ? v.purchasePrice : null,
      })),
    };
    const res = await fetch(`/api/stock/${editTarget.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { closeEdit(); load(); }
    else { const d = await res.json(); setEditError(d.error || "Failed to update"); }
    setEditSaving(false);
  };

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleBatchExpand = (itemId: string) => {
    setBatchExpanded(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
        if (!itemBatches[itemId]) {
          fetch(`/api/batches?stockItemId=${itemId}`)
            .then(r => r.json())
            .then(d => setItemBatches(prev2 => ({ ...prev2, [itemId]: Array.isArray(d) ? d : [] })))
            .catch(() => {});
        }
      }
      return next;
    });
  };

  const skuPreview = form.name
    ? `${form.name.replace(/[^A-Za-z0-9]/g, "").substring(0, 3).toUpperCase().padEnd(3, "X")}-XXXXX`
    : null;

  const editVariantTotals = editTarget ? editTarget.variants.reduce((acc, v) => {
    const qty = parseFloat(editVariantQtys[v.id] ?? "0") || 0;
    const purchase = editVariantPrices[v.id]?.purchase !== "" && editVariantPrices[v.id]?.purchase != null
      ? parseFloat(editVariantPrices[v.id].purchase) || 0
      : editTarget.purchasePrice;
    const sales = editVariantPrices[v.id]?.sales !== "" && editVariantPrices[v.id]?.sales != null
      ? parseFloat(editVariantPrices[v.id].sales) || 0
      : editTarget.salesPrice;
    const costValue = qty * purchase;
    const salesValue = qty * sales;
    acc.qty += qty;
    acc.cost += costValue;
    acc.selling += salesValue;
    acc.profit += salesValue - costValue;
    return acc;
  }, { qty: 0, cost: 0, selling: 0, profit: 0 }) : { qty: 0, cost: 0, selling: 0, profit: 0 };

  const productMeta = useMemo(() => {
    const map = new Map<string, { label: string; costRate: number }>();
    items.forEach(item => {
      map.set(`stock:${item.id}`, { label: item.name, costRate: item.purchasePrice });
      item.variants.forEach(variant => {
        const details = [variant.size, variant.color].filter(Boolean).join(" / ");
        map.set(`variant:${variant.id}`, {
          label: details ? `${item.name} (${details})` : item.name,
          costRate: variant.purchasePrice ?? item.purchasePrice,
        });
      });
    });
    return map;
  }, [items]);

  const soldRows = useMemo<SoldRow[]>(() => {
    const rows: SoldRow[] = [];
    reportInvoices.forEach(inv => {
      const lineItems = Array.isArray(inv.items) ? inv.items : [];
      lineItems.forEach((raw, idx) => {
        if (!raw || typeof raw !== "object") return;
        const line = raw as Record<string, unknown>;
        const qty = Number(line.q) || 0;
        if (qty <= 0) return;

        const variantId = typeof line.variantId === "string" ? line.variantId : "";
        const stockId = typeof line.stockId === "string" ? line.stockId : "";
        const key = variantId ? `variant:${variantId}` : stockId ? `stock:${stockId}` : "";
        const meta = key ? productMeta.get(key) : null;

        const rate = Number(line.r) || 0;
        const salesAmount = Number(line.a) || (qty * rate);
        const fallbackName = typeof line.dt === "string" && line.dt.trim() ? line.dt : "Unknown Item";
        const costRate = meta?.costRate ?? 0;
        const costAmount = qty * costRate;

        rows.push({
          id: `${inv.id}-${idx}`,
          invoiceId: inv.id,
          invNumber: inv.invNumber,
          invoiceDate: inv.invoiceDate,
          type: inv.type,
          customerName: inv.customerName,
          product: meta?.label ?? fallbackName,
          qty,
          rate,
          salesAmount,
          costAmount,
          profit: salesAmount - costAmount,
        });
      });
    });
    return rows;
  }, [productMeta, reportInvoices]);

  const productOptions = useMemo(() => Array.from(new Set(soldRows.map(r => r.product))).sort((a, b) => a.localeCompare(b)), [soldRows]);

  const filteredSoldRows = useMemo(() => {
    const from = rptFrom ? new Date(`${rptFrom}T00:00:00`) : null;
    const to = rptTo ? new Date(`${rptTo}T23:59:59`) : null;
    return soldRows.filter(row => {
      const date = new Date(row.invoiceDate);
      if (from && date < from) return false;
      if (to && date > to) return false;
      if (rptType && row.type !== rptType) return false;
      if (rptProduct && row.product !== rptProduct) return false;
      if (rptCustomer.trim()) {
        const q = rptCustomer.trim().toLowerCase();
        if (!row.customerName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rptFrom, rptTo, rptType, rptProduct, rptCustomer, soldRows]);

  const soldTotals = useMemo(() => filteredSoldRows.reduce((acc, row) => {
    acc.qty += row.qty;
    acc.sales += row.salesAmount;
    acc.cost += row.costAmount;
    acc.profit += row.profit;
    return acc;
  }, { qty: 0, sales: 0, cost: 0, profit: 0 }), [filteredSoldRows]);

  return (
    <div style={{ animation: "pgIn .3s cubic-bezier(.16,1,.3,1)" }}>
      <div className="page-tabs" style={{ display: "flex", borderBottom: "2px solid var(--bg2)", marginBottom: 20, gap: 4 }}>
        {([
          { id: "stock", icon: "fa-boxes-stacked", label: "Stock / Inventory" },
          { id: "batches", icon: "fa-layer-group", label: "Batches" },
          { id: "report", icon: "fa-chart-line", label: "Stock Report" },
        ] as const).map(t => (
          <button
            key={t.id}
            className="module-tab" aria-pressed={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "10px 22px", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              border: "none", borderBottom: activeTab === t.id ? "3px solid var(--blue2)" : "3px solid transparent",
              background: "none", color: activeTab === t.id ? "var(--blue2)" : "var(--muted)",
              cursor: "pointer", transition: "all .2s", marginBottom: -2,
              display: "flex", alignItems: "center", gap: 7,
            }}
          >
            <i className={`fa-solid ${t.icon}`}></i>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "stock" && (
      <>
      {/* Stats */}
      <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
        {[
          { bg: "var(--blue5)", color: "var(--blue)", icon: "fa-boxes-stacked", value: String(totalItems), label: "Total Items" },
          { bg: "#fff8e6", color: "var(--gold)", icon: "fa-triangle-exclamation", value: String(lowStockCount + outCount), label: "Low / Out of Stock" },
          { bg: "#e6f9f2", color: "var(--green)", icon: "fa-money-bill", value: `Rs ${stockValue.toLocaleString()}`, label: "Stock Value" },
        ].map((s) => (
          <div key={s.label} style={{ background: "white", borderRadius: "var(--r)", padding: "18px 20px", border: "1px solid rgba(205,216,236,.5)", boxShadow: "var(--sh)", display: "flex", alignItems: "center", gap: 15 }}>
            {loading ? (
              <>
                <div className="skl" style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skl" style={{ width: 56, height: 22, marginBottom: 8 }} />
                  <div className="skl" style={{ width: 100, height: 11 }} />
                </div>
              </>
            ) : (
              <>
                <div style={{ width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, background: s.bg, color: s.color }}>
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
      </>
      )}

      {activeTab === "batches" && (() => {
        const filtered = batches.filter(b => {
          if (!batchSearch.trim()) return true;
          const q = batchSearch.toLowerCase();
          return (
            b.batchNumber.toLowerCase().includes(q) ||
            b.stockItem.name.toLowerCase().includes(q) ||
            b.stockItem.code.toLowerCase().includes(q)
          );
        });
        const totalBatches = batches.length;
        const activeBatches = batches.filter(b => b.remaining > 0).length;
        const totalValue = batches.reduce((s, b) => s + b.remaining * b.costPrice, 0);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Summary cards */}
            <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
              {[
                { bg: "var(--blue5)", border: "var(--blue3)", color: "var(--blue)", icon: "fa-layer-group", value: String(totalBatches), label: "Total Batches" },
                { bg: "#e6f9f2", border: "#b7ebd5", color: "var(--green)", icon: "fa-circle-check", value: String(activeBatches), label: "Active Batches" },
                { bg: "#fff0f0", border: "#ffdada", color: "var(--red)", icon: "fa-coins", value: `Rs ${Math.round(totalValue).toLocaleString()}`, label: "Batch Stock Value" },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: s.color, flexShrink: 0 }}>
                    <i className={`fa-solid ${s.icon}`}></i>
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, fontWeight: 500 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Table */}
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 9 }}>
                  <i className="fa-solid fa-layer-group" style={{ color: "var(--blue2)", fontSize: 14 }}></i>
                  All Batches <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>({filtered.length})</span>
                </div>
                <input
                  type="text"
                  placeholder="Search batch or product..."
                  value={batchSearch}
                  onChange={e => setBatchSearch(e.target.value)}
                  style={{ ...inputStyle, width: 220 }}
                />
              </div>
              {batchesLoading ? (
                <div style={{ textAlign: "center", padding: "36px 0", color: "var(--muted)" }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 22, marginBottom: 8, display: "block" }}></i>
                  Loading batches…
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)" }}>
                  <i className="fa-solid fa-layer-group" style={{ fontSize: 30, marginBottom: 10, display: "block", opacity: .2 }}></i>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>No batches found</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Batches are created automatically when you record a purchase</div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "var(--ink)" }}>
                        {["Batch #", "Product", "Code", "Purchase Date", "Original Qty", "Remaining", "Depleted", "Cost Price", "Remaining Value", "Status"].map(h => (
                          <th key={h} style={{ ...th, textAlign: ["Original Qty", "Remaining", "Depleted", "Cost Price", "Remaining Value"].includes(h) ? "right" : "left" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((b, i) => {
                        const depleted = b.qty - b.remaining;
                        const depPct = b.qty > 0 ? (depleted / b.qty) * 100 : 0;
                        const isActive = b.remaining > 0;
                        const isLast = i === filtered.length - 1;
                        return (
                          <tr key={b.id} style={{ borderBottom: isLast ? "none" : "1px solid var(--bg2)", background: isActive ? "white" : "#fafafa" }}>
                            <td style={{ padding: "10px 14px" }}>
                              <span style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 700, background: isActive ? "var(--ink)" : "var(--bg3)", color: isActive ? "var(--blue4)" : "var(--muted)", padding: "3px 9px", borderRadius: 5, display: "inline-block" }}>
                                {b.batchNumber}
                              </span>
                            </td>
                            <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: 13 }}>{b.stockItem.name}</td>
                            <td style={{ padding: "10px 14px" }}>
                              <span style={{ fontFamily: "inherit", fontSize: 10, color: "var(--muted)", background: "var(--bg2)", padding: "2px 6px", borderRadius: 4 }}>{b.stockItem.code}</span>
                            </td>
                            <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                              {new Date(b.purchasedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, fontWeight: 600 }}>{b.qty} <span style={{ fontSize: 11, color: "var(--muted)" }}>{b.stockItem.unit}</span></td>
                            <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, fontWeight: 700, color: isActive ? "var(--green)" : "var(--muted)" }}>{b.remaining}</td>
                            <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 12 }}>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                                <span>{depleted}</span>
                                <div style={{ width: 64, height: 5, borderRadius: 3, background: "var(--bg2)", overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${depPct}%`, background: depPct >= 100 ? "var(--red)" : "var(--blue2)", borderRadius: 3, transition: "width .3s" }} />
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, color: "var(--red)", fontWeight: 600 }}>Rs {b.costPrice.toLocaleString()}</td>
                            <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, fontWeight: 700 }}>Rs {Math.round(b.remaining * b.costPrice).toLocaleString()}</td>
                            <td style={{ padding: "10px 14px" }}>
                              {isActive ? (
                                <span style={{ background: "#e6f9f2", color: "var(--green)", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: ".3px" }}>ACTIVE</span>
                              ) : (
                                <span style={{ background: "var(--bg2)", color: "var(--muted)", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: ".3px" }}>DEPLETED</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {activeTab === "report" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 16, display: "flex", alignItems: "center", gap: 9 }}>
              <i className="fa-solid fa-filter" style={{ color: "var(--blue2)", fontSize: 14 }}></i> Filters
            </div>
            <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr auto", gap: 12, alignItems: "flex-end" }}>
              <div>
                <label style={labelStyle}>From Date</label>
                <input type="date" value={rptFrom} onChange={e => setRptFrom(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>To Date</label>
                <input type="date" value={rptTo} onChange={e => setRptTo(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Invoice Type</label>
                <select value={rptType} onChange={e => setRptType(e.target.value as "" | "regular" | "walk")} style={inputStyle}>
                  <option value="">All Types</option>
                  <option value="regular">Regular</option>
                  <option value="walk">Walk-in</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Product</label>
                <select value={rptProduct} onChange={e => setRptProduct(e.target.value)} style={inputStyle}>
                  <option value="">All Products</option>
                  {productOptions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Customer</label>
                <input type="text" placeholder="Customer name..." value={rptCustomer} onChange={e => setRptCustomer(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <button data-ui-action="secondary"
                  onClick={() => { setRptFrom(todayIsoDate()); setRptTo(todayIsoDate()); setRptType(""); setRptProduct(""); setRptCustomer(""); }}
                  style={{ padding: "9px 16px", border: "1.5px solid var(--bg2)", borderRadius: "var(--r2)", background: "white", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "var(--ink3)", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
                >
                  <i className="fa-solid fa-rotate-left" style={{ fontSize: 11 }}></i> Reset
                </button>
              </div>
            </div>
          </div>

          <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            <div style={{ background: "var(--blue5)", border: "1.5px solid var(--blue3)", borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>Sold Qty</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", marginTop: 4 }}>{soldTotals.qty}</div>
            </div>
            <div style={{ background: "#eef2ff", border: "1.5px solid #c7d2fe", borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>Sales</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", marginTop: 4 }}>Rs {Math.round(soldTotals.sales).toLocaleString()}</div>
            </div>
            <div style={{ background: "#fff0f0", border: "1.5px solid #ffdada", borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>Cost</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", marginTop: 4 }}>Rs {Math.round(soldTotals.cost).toLocaleString()}</div>
            </div>
            <div style={{ background: soldTotals.profit >= 0 ? "#e6f9f2" : "#fff0f0", border: soldTotals.profit >= 0 ? "1.5px solid #b7ebd5" : "1.5px solid #ffdada", borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>Profit</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: soldTotals.profit >= 0 ? "var(--green)" : "var(--red)", marginTop: 4 }}>Rs {Math.round(soldTotals.profit).toLocaleString()}</div>
            </div>
          </div>

          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 9 }}>
                <i className="fa-solid fa-table-list" style={{ color: "var(--blue2)", fontSize: 14 }}></i>
                Sold Stock Lines
              </div>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{filteredSoldRows.length} line{filteredSoldRows.length !== 1 ? "s" : ""}</span>
            </div>
            {filteredSoldRows.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px 0", color: "var(--muted)" }}>
                <i className="fa-solid fa-box-open" style={{ fontSize: 30, marginBottom: 10, display: "block", opacity: .25 }}></i>
                <div style={{ fontSize: 13, fontWeight: 600 }}>No sold stock lines match your filters</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--ink)" }}>
                      {["Invoice", "Date", "Customer", "Type", "Product", "Qty", "Rate", "Sales", "Cost", "Profit"].map(h => (
                        <th key={h} style={{ ...th, textAlign: ["Qty", "Rate", "Sales", "Cost", "Profit"].includes(h) ? "right" : "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSoldRows.map((row, i) => (
                      <tr key={row.id} style={{ borderBottom: i < filteredSoldRows.length - 1 ? "1px solid var(--bg2)" : "none" }}>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 700, background: "var(--ink)", color: "var(--blue4)", padding: "3px 10px", borderRadius: 5, whiteSpace: "nowrap", display: "inline-block" }}>{row.invNumber}</span>
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{new Date(row.invoiceDate).toLocaleDateString()}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>{row.customerName}</td>
                        <td style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: row.type === "regular" ? "var(--blue)" : "var(--green)" }}>{row.type === "regular" ? "Regular" : "Walk-in"}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12 }}>{row.product}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 700 }}>{row.qty}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12 }}>Rs {Math.round(row.rate).toLocaleString()}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, color: "var(--green)", fontWeight: 700 }}>Rs {Math.round(row.salesAmount).toLocaleString()}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, color: "var(--red)", fontWeight: 700 }}>Rs {Math.round(row.costAmount).toLocaleString()}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, color: row.profit >= 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>Rs {Math.round(row.profit).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {activeTab === "stock" && (
      <>
      {/* Table */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, paddingBottom: 14, borderBottom: "1.5px solid var(--bg2)" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 9 }}>
            <i className="fa-solid fa-boxes-stacked" style={{ color: "var(--blue2)", fontSize: 15 }}></i>
            Stock / Inventory {!loading && <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>({items.length})</span>}
          </div>
          <button data-ui-action="primary" onClick={openModal} style={{ padding: "8px 16px", borderRadius: 24, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, background: "var(--gradient-primary)", color: "white", border: "none", boxShadow: "0 4px 16px rgba(16,87,160,.3)" }}>
            <i className="fa-solid fa-plus"></i> Add Stock Item
          </button>
        </div>

        {loading ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--ink)" }}>
                  {["SKU", "Item Name", "Category", "Qty / Unit", "Purchase Price", "Sales Price", "Stock Value", "Status", "Actions"].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--bg2)" }}>
                    <td style={{ padding: "11px 14px" }}><span className="skl" style={{ width: 68, height: 20 }} /></td>
                    <td style={{ padding: "11px 14px" }}><span className="skl" style={{ width: 120, height: 13 }} /></td>
                    <td style={{ padding: "11px 14px" }}><span className="skl" style={{ width: 65, height: 13 }} /></td>
                    <td style={{ padding: "11px 14px" }}><span className="skl" style={{ width: 60, height: 13 }} /></td>
                    <td style={{ padding: "11px 14px" }}><span className="skl" style={{ width: 55, height: 13 }} /></td>
                    <td style={{ padding: "11px 14px" }}><span className="skl" style={{ width: 55, height: 13 }} /></td>
                    <td style={{ padding: "11px 14px" }}><span className="skl" style={{ width: 70, height: 13 }} /></td>
                    <td style={{ padding: "11px 14px" }}><span className="skl" style={{ width: 44, height: 20, borderRadius: 20 }} /></td>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {[0,1].map(j => <span key={j} className="skl" style={{ width: 30, height: 30, borderRadius: 8 }} />)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted)" }}>
            <i className="fa-solid fa-box-open" style={{ fontSize: 32, marginBottom: 12, display: "block", opacity: .3 }}></i>
            <div style={{ fontWeight: 600, fontSize: 15 }}>No stock items yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Click "Add Stock Item" to start tracking inventory</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--ink)" }}>
                  {["SKU", "Item Name", "Category", "Qty / Unit", "Purchase Price", "Sales Price", "Stock Value", "Status", "Actions"].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const st = getStatus(item.quantity, item.lowStockThreshold);
                  const isExpanded = expanded.has(item.id);
                  const isLast = i === items.length - 1;
                  return (
                    <React.Fragment key={item.id}>
                      {(() => {
                        const isBatchOpen = batchExpanded.has(item.id);
                        const thisBatches = itemBatches[item.id] ?? [];
                        const hasMoreRows = isExpanded && item.variants.length > 0;
                        return (
                          <>
                            <tr style={{ borderBottom: !hasMoreRows && !isBatchOpen && !isLast ? "1px solid var(--bg2)" : "none", background: isExpanded || isBatchOpen ? "var(--bg)" : "white" }}>
                              <td style={{ padding: "11px 14px" }}>
                                <span style={{ fontFamily: "inherit", fontSize: 10, fontWeight: 700, background: "var(--ink)", color: "var(--blue4)", padding: "2px 7px", borderRadius: 5, letterSpacing: ".5px", display: "inline-block" }}>
                                  {item.sku ?? item.code}
                                </span>
                                {!item.hasVariants && <StockBarcode itemId={item.id} sku={item.sku ?? item.code} quantity={item.quantity} />}
                              </td>
                              <td style={{ padding: "11px 14px", fontWeight: 600, fontSize: 13 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                  {item.name}
                                  {item.hasVariants && (
                                    <button onClick={() => toggleExpand(item.id)} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "var(--blue5)", color: "var(--blue)", border: "1px solid var(--blue3)50", cursor: "pointer" }}>
                                      <i className={`fa-solid fa-chevron-${isExpanded ? "up" : "down"}`} style={{ fontSize: 8 }}></i>
                                      {item.variants.length} variant{item.variants.length !== 1 ? "s" : ""}
                                    </button>
                                  )}
                                  <button onClick={() => toggleBatchExpand(item.id)} title="View batches" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: isBatchOpen ? "#f0fdf4" : "#f5f3ff", color: isBatchOpen ? "var(--green)" : "#7c3aed", border: `1px solid ${isBatchOpen ? "#b7ebd5" : "#ddd6fe"}`, cursor: "pointer" }}>
                                    <i className={`fa-solid fa-layer-group`} style={{ fontSize: 8 }}></i>
                                    Batches
                                  </button>
                                </div>
                              </td>
                              <td style={{ padding: "11px 14px", fontSize: 13 }}>{item.category}</td>
                              <td style={{ padding: "11px 14px", fontSize: 13 }}>{item.quantity} <span style={{ color: "var(--muted)", fontSize: 12 }}>{item.unit}</span></td>
                              <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--red)" }}>
                                Rs {Math.round(getEffectivePurchasePrice(item)).toLocaleString()}
                                {item.hasVariants && item.variants.length > 0 && <span style={{ fontSize: 9, color: "var(--muted)", marginLeft: 3 }}>avg</span>}
                              </td>
                              <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--green)" }}>
                                Rs {Math.round(getEffectiveSalesPrice(item)).toLocaleString()}
                                {item.hasVariants && item.variants.length > 0 && <span style={{ fontSize: 9, color: "var(--muted)", marginLeft: 3 }}>avg</span>}
                              </td>
                              <td style={{ padding: "11px 14px", fontWeight: 600, fontSize: 13 }}>Rs {Math.round(getStockValue(item)).toLocaleString()}</td>
                              <td style={{ padding: "11px 14px" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: ".4px", textTransform: "uppercase", background: badgeBg[st.sc], color: badgeColor[st.sc] }}>{st.label}</span>
                              </td>
                              <td style={{ padding: "11px 14px" }}>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button title="Edit" onClick={() => openEdit(item)} style={{ width: 30, height: 30, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff8e6", color: "var(--gold)" }}>
                                    <i className="fa-solid fa-pen"></i>
                                  </button>
                                  <button data-ui-action="icon" title="Delete" onClick={() => setDeleteTarget({ id: item.id, name: item.name, sku: item.sku })} style={{ width: 30, height: 30, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff0f0", color: "var(--red)" }}>
                                    <i className="fa-solid fa-trash"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {/* Variant sub-rows */}
                            {isExpanded && item.variants.map((v, vi) => (
                              <tr key={`${item.id}-var-${v.id}`} style={{ background: "#f8faff", borderBottom: vi < item.variants.length - 1 || isBatchOpen || !isLast ? "1px solid var(--bg2)" : "none" }}>
                                <td style={{ padding: "8px 14px 8px 24px" }}>
                                  <span style={{ fontFamily: "inherit", fontSize: 9, fontWeight: 700, background: "#e0e7ff", color: "#3730a3", padding: "2px 6px", borderRadius: 4, letterSpacing: ".4px", display: "inline-block" }}>
                                    {v.sku}
                                  </span>
                                  <StockBarcode itemId={item.id} variantId={v.id} sku={v.sku} quantity={v.quantity} />
                                </td>
                                <td style={{ padding: "8px 14px", fontSize: 12, color: "var(--ink3)" }}>
                                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <i className="fa-solid fa-turn-up fa-rotate-90" style={{ fontSize: 9, color: "var(--muted)", opacity: .5 }}></i>
                                    {v.size && <span style={{ background: "var(--bg2)", padding: "1px 7px", borderRadius: 5, fontSize: 11, fontWeight: 700 }}>{v.size}</span>}
                                    {v.color && <span style={{ padding: "1px 9px", borderRadius: 5, fontSize: 11, fontWeight: 600, background: "var(--bg)", border: "1px solid var(--bg3)" }}>{v.color}</span>}
                                  </span>
                                </td>
                                <td colSpan={2} style={{ padding: "8px 14px", fontSize: 12, color: "var(--muted)" }}>
                                  {v.quantity} <span>{item.unit}</span>
                                </td>
                                <td style={{ padding: "8px 14px", fontSize: 11, color: "var(--red)" }}>
                                  {v.purchasePrice != null
                                    ? <span>Rs {v.purchasePrice.toLocaleString()}</span>
                                    : <span style={{ opacity: .5 }}>Rs {item.purchasePrice.toLocaleString()} <span style={{ fontSize: 9 }}>(base)</span></span>}
                                </td>
                                <td style={{ padding: "8px 14px", fontSize: 11, color: "var(--green)" }}>
                                  {v.salesPrice != null
                                    ? <span>Rs {v.salesPrice.toLocaleString()}</span>
                                    : <span style={{ opacity: .5 }}>Rs {item.salesPrice.toLocaleString()} <span style={{ fontSize: 9 }}>(base)</span></span>}
                                </td>
                                <td colSpan={2} style={{ padding: "8px 14px", fontSize: 11, color: "var(--muted)" }}>
                                  Rs {(v.quantity * (v.purchasePrice ?? item.purchasePrice)).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                            {/* Batch sub-rows */}
                            {isBatchOpen && (
                              <tr key={`${item.id}-batches`} style={{ background: "#f5f3ff" }}>
                                <td colSpan={9} style={{ padding: "12px 20px", borderBottom: !isLast ? "1px solid var(--bg2)" : "none" }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                    <i className="fa-solid fa-layer-group" style={{ fontSize: 10 }}></i>
                                    FIFO Batch Breakdown — {item.name}
                                  </div>
                                  {thisBatches.length === 0 ? (
                                    <div style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>No batches yet — create a purchase to start tracking.</div>
                                  ) : (
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                      <thead>
                                        <tr style={{ background: "#ede9fe" }}>
                                          {["Batch #", "Purchase Date", "Orig. Qty", "Remaining", "Depleted", "Cost / Unit", "Remaining Value", "Status"].map(h => (
                                            <th key={h} style={{ padding: "6px 10px", textAlign: ["Orig. Qty", "Remaining", "Depleted", "Cost / Unit", "Remaining Value"].includes(h) ? "right" : "left", fontWeight: 700, color: "#5b21b6", fontSize: 10, letterSpacing: ".3px", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {thisBatches.map((b, bi) => {
                                          const active = b.remaining > 0;
                                          const depleted = b.qty - b.remaining;
                                          return (
                                            <tr key={b.id} style={{ borderBottom: bi < thisBatches.length - 1 ? "1px solid #ddd6fe" : "none", background: active ? "white" : "#faf9ff", opacity: active ? 1 : 0.6 }}>
                                              <td style={{ padding: "6px 10px" }}>
                                                <span style={{ fontFamily: "inherit", fontWeight: 700, fontSize: 10, background: active ? "#7c3aed" : "var(--bg3)", color: active ? "white" : "var(--muted)", padding: "2px 7px", borderRadius: 4 }}>{b.batchNumber}</span>
                                              </td>
                                              <td style={{ padding: "6px 10px", color: "var(--muted)", whiteSpace: "nowrap" }}>{new Date(b.purchasedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                                              <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>{b.qty}</td>
                                              <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700, color: active ? "#059669" : "var(--muted)" }}>{b.remaining}</td>
                                              <td style={{ padding: "6px 10px", textAlign: "right", color: "var(--ink3)" }}>{depleted}</td>
                                              <td style={{ padding: "6px 10px", textAlign: "right", color: "var(--red)", fontWeight: 600 }}>Rs {b.costPrice.toLocaleString()}</td>
                                              <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>Rs {Math.round(b.remaining * b.costPrice).toLocaleString()}</td>
                                              <td style={{ padding: "6px 10px" }}>
                                                {active
                                                  ? <span style={{ background: "#d1fae5", color: "#065f46", padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 700 }}>ACTIVE</span>
                                                  : <span style={{ background: "var(--bg2)", color: "var(--muted)", padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 700 }}>DEPLETED</span>}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  )}
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })()}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* Add Stock Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,.6)", backdropFilter: "blur(4px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 18, width: 620, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto", boxShadow: "var(--shm)" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1.5px solid var(--bg2)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "white", zIndex: 2, borderRadius: "18px 18px 0 0" }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 10 }}>
                <i className="fa-solid fa-boxes-stacked" style={{ color: "var(--blue2)" }}></i> Add Stock Item
              </div>
              <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 16, color: "var(--muted)", cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleAdd} style={{ padding: 24 }}>
              {error && (
                <div style={{ background: "#fff0f0", color: "var(--red)", fontSize: 12, padding: "9px 13px", borderRadius: 8, marginBottom: 16, border: "1px solid #ffdada", fontWeight: 500 }}>
                  <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 6 }}></i>{error}
                </div>
              )}

              {/* Item Name + Has Variants toggle */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Item Name *</label>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input style={{ ...inputStyle, flex: 1 }} placeholder='e.g. BUITEMS Uniform' value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", whiteSpace: "nowrap", padding: "9px 14px", border: `1.5px solid ${form.hasVariants ? "var(--blue2)" : "var(--bg2)"}`, borderRadius: "var(--r2)", background: form.hasVariants ? "var(--blue5)" : "white", transition: "all .15s", flexShrink: 0 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${form.hasVariants ? "var(--blue2)" : "var(--bg3)"}`, background: form.hasVariants ? "var(--blue2)" : "white", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s", flexShrink: 0 }}>
                      {form.hasVariants && <i className="fa-solid fa-check" style={{ fontSize: 10, color: "white" }}></i>}
                    </div>
                    <input type="checkbox" checked={form.hasVariants} onChange={e => setForm(f => ({ ...f, hasVariants: e.target.checked, selectedSizes: [], colors: [], colorInput: "", customSizeInput: "" }))} style={{ display: "none" }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: form.hasVariants ? "var(--blue)" : "var(--ink3)" }}>Has Variants?</span>
                  </label>
                </div>
                {/* SKU preview */}
                {skuPreview && (
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <i className="fa-solid fa-barcode"></i>
                    Auto SKU: <span style={{ fontFamily: "inherit", fontWeight: 700, color: "var(--blue)", background: "var(--blue5)", padding: "1px 7px", borderRadius: 4 }}>{skuPreview}</span>
                    <span style={{ opacity: .6 }}>(unique, generated on save)</span>
                  </div>
                )}
              </div>

              {/* Variants builder */}
              {form.hasVariants && (
                <div style={{ background: "var(--blue5)", border: "1.5px solid var(--blue3)40", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--blue)", marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
                    <i className="fa-solid fa-layer-group"></i> Variant Options
                  </div>

                  {/* Sizes */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ ...labelStyle, color: "var(--blue)", marginBottom: 8 }}>Sizes</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                      {PRESET_SIZES.map(s => {
                        const on = form.selectedSizes.includes(s);
                        return (
                          <button key={s} type="button" onClick={() => toggleSize(s)} style={{ padding: "5px 13px", borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", border: `1.5px solid ${on ? "var(--blue2)" : "var(--bg3)"}`, background: on ? "var(--blue2)" : "white", color: on ? "white" : "var(--ink3)", transition: "all .12s" }}>
                            {s}
                          </button>
                        );
                      })}
                      {/* Custom sizes already selected */}
                      {form.selectedSizes.filter(s => !PRESET_SIZES.includes(s)).map(s => (
                        <button key={s} type="button" onClick={() => toggleSize(s)} style={{ padding: "5px 11px", borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", border: "1.5px solid var(--blue2)", background: "var(--blue2)", color: "white", display: "flex", alignItems: "center", gap: 5 }}>
                          {s} <i className="fa-solid fa-xmark" style={{ fontSize: 9 }}></i>
                        </button>
                      ))}
                      {/* Custom size input */}
                      <div style={{ display: "flex", gap: 5 }}>
                        <input
                          type="text" placeholder="Custom…" value={form.customSizeInput}
                          onChange={e => setForm(f => ({ ...f, customSizeInput: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustomSize())}
                          style={{ padding: "5px 10px", border: "1.5px solid var(--bg3)", borderRadius: 20, fontSize: 12, fontFamily: "inherit", outline: "none", width: 80, background: "white" }}
                        />
                        <button data-ui-action="secondary" type="button" onClick={addCustomSize} style={{ padding: "5px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", border: "1.5px solid var(--bg3)", background: "white", color: "var(--blue)" }}>+ Add</button>
                      </div>
                    </div>
                  </div>

                  {/* Colors */}
                  <div style={{ marginBottom: variants.length > 0 ? 14 : 0 }}>
                    <label style={{ ...labelStyle, color: "var(--blue)", marginBottom: 8 }}>Colors</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                      {form.colors.map(c => (
                        <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "var(--ink)", color: "white" }}>
                          {c}
                          <button type="button" onClick={() => setForm(f => ({ ...f, colors: f.colors.filter(x => x !== c) }))} style={{ background: "none", border: "none", color: "rgba(255,255,255,.7)", cursor: "pointer", padding: 0, fontSize: 11, lineHeight: 1 }}>
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </span>
                      ))}
                      <div style={{ display: "flex", gap: 5 }}>
                        <input
                          type="text" placeholder="e.g. Navy Blue" value={form.colorInput}
                          onChange={e => setForm(f => ({ ...f, colorInput: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addColor())}
                          style={{ padding: "5px 10px", border: "1.5px solid var(--bg3)", borderRadius: 20, fontSize: 12, fontFamily: "inherit", outline: "none", width: 120, background: "white" }}
                        />
                        <button data-ui-action="secondary" type="button" onClick={addColor} style={{ padding: "5px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", border: "1.5px solid var(--bg3)", background: "white", color: "var(--blue)" }}>+ Add</button>
                      </div>
                    </div>
                  </div>

                  {/* Variant grid */}
                  {variants.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        <i className="fa-solid fa-table-cells"></i>
                        {variants.length} variant{variants.length !== 1 ? "s" : ""} generated — set qty &amp; prices:
                      </div>
                      <div style={{ background: "white", borderRadius: 10, overflow: "hidden", border: "1px solid var(--bg2)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ background: "var(--ink)" }}>
                              <th style={{ ...th, fontSize: 10, padding: "8px 12px" }}>Variant</th>
                              {form.selectedSizes.length > 0 && <th style={{ ...th, fontSize: 10, padding: "8px 12px" }}>Size</th>}
                              {form.colors.length > 0 && <th style={{ ...th, fontSize: 10, padding: "8px 12px" }}>Color</th>}
                              <th style={{ ...th, fontSize: 10, padding: "8px 12px" }}>Qty</th>
                              <th style={{ ...th, fontSize: 10, padding: "8px 12px", color: "#fca5a5" }}>Cost (Rs)</th>
                              <th style={{ ...th, fontSize: 10, padding: "8px 12px", color: "#86efac" }}>Price (Rs)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {variants.map((v, vi) => {
                              const prefix = form.name.replace(/[^A-Za-z0-9]/g, "").substring(0, 3).toUpperCase().padEnd(3, "X");
                              const sizePart = v.size ? `-${v.size.substring(0, 4)}` : "";
                              const colorPart = v.color ? `-${v.color.replace(/[^A-Za-z0-9]/g, "").toUpperCase().substring(0, 4)}` : "";
                              const varSku = `${prefix}-XXXXX${sizePart}${colorPart}`;
                              const upd = (field: keyof VariantRow, val: string) =>
                                setVariants(prev => prev.map((x, xi) => xi === vi ? { ...x, [field]: val } : x));
                              return (
                                <tr key={vi} style={{ borderBottom: vi < variants.length - 1 ? "1px solid var(--bg2)" : "none" }}>
                                  <td style={{ padding: "8px 12px" }}>
                                    <span style={{ fontFamily: "inherit", fontSize: 9, fontWeight: 700, color: "#3730a3", background: "#e0e7ff", padding: "2px 6px", borderRadius: 4 }}>{varSku}</span>
                                  </td>
                                  {form.selectedSizes.length > 0 && <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 700 }}>{v.size}</td>}
                                  {form.colors.length > 0 && <td style={{ padding: "8px 12px", fontSize: 12 }}>{v.color}</td>}
                                  <td style={{ padding: "8px 12px" }}>
                                    <input type="number" min="0" step="1" placeholder="0" value={v.quantity}
                                      onChange={e => upd("quantity", e.target.value)}
                                      style={{ width: 62, padding: "5px 7px", border: "1.5px solid var(--bg2)", borderRadius: 7, fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                                  </td>
                                  <td style={{ padding: "8px 12px" }}>
                                    <input type="number" min="0" step="0.01" placeholder="0"
                                      value={v.purchasePrice}
                                      onChange={e => upd("purchasePrice", e.target.value)}
                                      style={{ width: 76, padding: "5px 7px", border: "1.5px solid #fca5a540", borderRadius: 7, fontSize: 12, fontFamily: "inherit", outline: "none", color: "var(--red)" }} />
                                  </td>
                                  <td style={{ padding: "8px 12px" }}>
                                    <input type="number" min="0" step="0.01" placeholder="0"
                                      value={v.salesPrice}
                                      onChange={e => upd("salesPrice", e.target.value)}
                                      style={{ width: 76, padding: "5px 7px", border: "1.5px solid #86efac40", borderRadius: 7, fontSize: 12, fontFamily: "inherit", outline: "none", color: "var(--green)" }} />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--blue)", marginTop: 6, opacity: .8, display: "flex", gap: 14 }}>
                        <span>Total qty: <strong>{variants.reduce((s, v) => s + (parseFloat(v.quantity) || 0), 0)} {form.unit}</strong></span>
                        <span style={{ color: "var(--muted)" }}>Leave blank to use the item&apos;s default price</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Category *</label>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} required>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Unit *</label>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} required>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                {!form.hasVariants && (
                  <div>
                    <label style={labelStyle}>Quantity *</label>
                    <input style={inputStyle} type="number" min="0" step="0.01" placeholder="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required={!form.hasVariants} />
                  </div>
                )}
                {!form.hasVariants && (
                  <div>
                    <label style={labelStyle}>Purchase Price (Rs) *</label>
                    <input style={{ ...inputStyle, borderColor: "var(--red)30" }} type="number" min="0" step="0.01" placeholder="0" value={form.purchasePrice} onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))} required />
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>Cost you paid per {form.unit}</div>
                  </div>
                )}
                {!form.hasVariants && (
                  <div>
                    <label style={labelStyle}>Sales Price (Rs) *</label>
                    <input style={{ ...inputStyle, borderColor: "var(--green)30" }} type="number" min="0" step="0.01" placeholder="0" value={form.salesPrice} onChange={e => setForm(f => ({ ...f, salesPrice: e.target.value }))} required />
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>Price you sell per {form.unit}</div>
                  </div>
                )}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>Low Stock Alert Threshold</label>
                  <input style={inputStyle} type="number" min="0" step="0.01" placeholder="5" value={form.lowStockThreshold} onChange={e => setForm(f => ({ ...f, lowStockThreshold: e.target.value }))} />
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>Marked "Low" when total quantity falls at or below this number</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button data-ui-action="primary" type="submit" disabled={saving} style={{ padding: "10px 24px", borderRadius: 24, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 7, background: "var(--gradient-primary)", color: "white", border: "none", opacity: saving ? .7 : 1 }}>
                  <i className={`fa-solid ${saving ? "fa-spinner fa-spin" : "fa-floppy-disk"}`}></i>
                  {saving ? "Saving..." : "Add to Stock"}
                </button>
                <button type="button" onClick={closeModal} style={{ padding: "10px 20px", borderRadius: 24, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: "transparent", color: "var(--blue)", border: "1.5px solid var(--bg3)" }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,.65)", backdropFilter: "blur(4px)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 16, width: 420, maxWidth: "90vw", boxShadow: "var(--shm)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px 0", display: "flex", alignItems: "flex-start", gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fff0f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <i className="fa-solid fa-trash" style={{ color: "var(--red)", fontSize: 18 }}></i>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>Delete Stock Item</div>
                <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                  Are you sure you want to delete <strong style={{ color: "var(--ink)" }}>{deleteTarget.name}</strong>?
                  {deleteTarget.sku && (
                    <div style={{ marginTop: 6 }}>
                      <span style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 700, background: "var(--ink)", color: "var(--blue4)", padding: "2px 8px", borderRadius: 5 }}>{deleteTarget.sku}</span>
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--red)", fontWeight: 500 }}>This will also delete all variants. Cannot be undone.</div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, padding: 24, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteTarget(null)} style={{ padding: "9px 20px", borderRadius: 24, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: "transparent", color: "var(--ink3)", border: "1.5px solid var(--bg3)" }}>Cancel</button>
              <button onClick={confirmDelete} disabled={deleting} style={{ padding: "9px 20px", borderRadius: 24, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: deleting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 7, background: "var(--red)", color: "white", border: "none", opacity: deleting ? .7 : 1 }}>
                <i className={`fa-solid ${deleting ? "fa-spinner fa-spin" : "fa-trash"}`}></i>
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Stock Modal */}
      {editTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,.6)", backdropFilter: "blur(4px)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 18, width: 560, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shm)" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1.5px solid var(--bg2)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "white", zIndex: 2, borderRadius: "18px 18px 0 0" }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 10 }}>
                <i className="fa-solid fa-pen" style={{ color: "var(--gold)" }}></i> Edit Stock Item
              </div>
              <button onClick={closeEdit} style={{ background: "none", border: "none", fontSize: 16, color: "var(--muted)", cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleEditSave} style={{ padding: 24 }}>
              {/* Locked SKU banner */}
              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: editTarget.hasVariants ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 20, padding: 14, background: "var(--bg)", borderRadius: 12, border: "1.5px solid var(--bg2)" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}>
                    <i className="fa-solid fa-lock" style={{ fontSize: 9 }}></i> SKU (locked)
                  </div>
                  <span style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: "var(--ink)", color: "var(--blue4)", padding: "3px 10px", borderRadius: 6, display: "inline-block" }}>{editTarget.sku ?? editTarget.code}</span>
                </div>
                {!editTarget.hasVariants && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}>
                      <i className="fa-solid fa-lock" style={{ fontSize: 9 }}></i> Variants
                    </div>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>No variants</span>
                  </div>
                )}
                {editTarget.hasVariants && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
                    <i className="fa-solid fa-circle-info" style={{ marginRight: 5, color: "var(--blue)" }}></i>
                    {editTarget.variants.length} variant{editTarget.variants.length !== 1 ? "s" : ""} — edit quantities below.
                  </div>
                )}
              </div>

              {editError && (
                <div style={{ background: "#fff0f0", color: "var(--red)", fontSize: 12, padding: "9px 13px", borderRadius: 8, marginBottom: 16, border: "1px solid #ffdada", fontWeight: 500 }}>
                  <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 6 }}></i>{editError}
                </div>
              )}

              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>Item Name *</label>
                  <input style={inputStyle} placeholder="Item name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label style={labelStyle}>Category *</label>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Unit *</label>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={editForm.unit} onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                {!editTarget.hasVariants && (
                  <div>
                    <label style={labelStyle}>Quantity</label>
                    <input style={inputStyle} type="number" min="0" step="0.01" value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} />
                  </div>
                )}
                <div>
                  <label style={labelStyle}>Purchase Price (Rs) *</label>
                  <input style={{ ...inputStyle, borderColor: "var(--red)30" }} type="number" min="0" step="0.01" value={editForm.purchasePrice} onChange={e => setEditForm(f => ({ ...f, purchasePrice: e.target.value }))} required />
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>Cost you paid per {editForm.unit}</div>
                </div>
                <div>
                  <label style={labelStyle}>Sales Price (Rs) *</label>
                  <input style={{ ...inputStyle, borderColor: "var(--green)30" }} type="number" min="0" step="0.01" value={editForm.salesPrice} onChange={e => setEditForm(f => ({ ...f, salesPrice: e.target.value }))} required />
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>Price you sell per {editForm.unit}</div>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>Low Stock Threshold</label>
                  <input style={inputStyle} type="number" min="0" step="0.01" value={editForm.lowStockThreshold} onChange={e => setEditForm(f => ({ ...f, lowStockThreshold: e.target.value }))} />
                </div>
              </div>

              {/* Variant quantities + prices editor */}
              {editTarget.hasVariants && editTarget.variants.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--blue)", marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
                    <i className="fa-solid fa-layer-group"></i> Variants — Qty &amp; Prices
                  </div>
                  <div style={{ background: "var(--bg)", borderRadius: 12, overflow: "hidden", border: "1.5px solid var(--bg2)" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "var(--ink)" }}>
                          <th style={{ ...th, fontSize: 10, padding: "8px 14px" }}>Variant SKU</th>
                          {editTarget.variants.some(v => v.size) && <th style={{ ...th, fontSize: 10, padding: "8px 14px" }}>Size</th>}
                          {editTarget.variants.some(v => v.color) && <th style={{ ...th, fontSize: 10, padding: "8px 14px" }}>Color</th>}
                          <th style={{ ...th, fontSize: 10, padding: "8px 14px" }}>Qty</th>
                          <th style={{ ...th, fontSize: 10, padding: "8px 14px", color: "#fca5a5" }}>Cost (Rs)</th>
                          <th style={{ ...th, fontSize: 10, padding: "8px 14px", color: "#86efac" }}>Price (Rs)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editTarget.variants.map((v, vi) => (
                          <tr key={v.id} style={{ borderBottom: vi < editTarget.variants.length - 1 ? "1px solid var(--bg2)" : "none", background: "white" }}>
                            <td style={{ padding: "10px 14px" }}>
                              <span style={{ fontFamily: "inherit", fontSize: 9, fontWeight: 700, background: "#e0e7ff", color: "#3730a3", padding: "2px 7px", borderRadius: 4 }}>{v.sku}</span>
                            </td>
                            {editTarget.variants.some(x => x.size) && (
                              <td style={{ padding: "10px 14px" }}>
                                {v.size ? <span style={{ background: "var(--bg2)", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700 }}>{v.size}</span> : <span style={{ color: "var(--muted)" }}>—</span>}
                              </td>
                            )}
                            {editTarget.variants.some(x => x.color) && (
                              <td style={{ padding: "10px 14px", fontSize: 12 }}>
                                {v.color ?? <span style={{ color: "var(--muted)" }}>—</span>}
                              </td>
                            )}
                            <td style={{ padding: "10px 14px" }}>
                              <input type="number" min="0" step="0.01"
                                value={editVariantQtys[v.id] ?? "0"}
                                onChange={e => setEditVariantQtys(prev => ({ ...prev, [v.id]: e.target.value }))}
                                style={{ width: 72, padding: "6px 9px", border: "1.5px solid var(--bg2)", borderRadius: 8, fontSize: 12, fontFamily: "inherit", outline: "none" }}
                                onFocus={e => e.target.style.borderColor = "var(--blue2)"}
                                onBlur={e => e.target.style.borderColor = "var(--bg2)"}
                              />
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <input type="number" min="0" step="0.01"
                                placeholder="0"
                                value={editVariantPrices[v.id]?.purchase ?? ""}
                                onChange={e => setEditVariantPrices(prev => ({ ...prev, [v.id]: { ...prev[v.id], purchase: e.target.value } }))}
                                style={{ width: 80, padding: "6px 9px", border: "1.5px solid #fca5a540", borderRadius: 8, fontSize: 12, fontFamily: "inherit", outline: "none", color: "var(--red)" }}
                                onFocus={e => e.target.style.borderColor = "var(--red)"}
                                onBlur={e => e.target.style.borderColor = "#fca5a540"}
                              />
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <input type="number" min="0" step="0.01"
                                placeholder="0"
                                value={editVariantPrices[v.id]?.sales ?? ""}
                                onChange={e => setEditVariantPrices(prev => ({ ...prev, [v.id]: { ...prev[v.id], sales: e.target.value } }))}
                                style={{ width: 80, padding: "6px 9px", border: "1.5px solid #86efac40", borderRadius: 8, fontSize: 12, fontFamily: "inherit", outline: "none", color: "var(--green)" }}
                                onFocus={e => e.target.style.borderColor = "var(--green)"}
                                onBlur={e => e.target.style.borderColor = "#86efac40"}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <span>Total: <strong>{editVariantTotals.qty} {editForm.unit}</strong></span>
                    <span>Total Cost: <strong style={{ color: "var(--red)" }}>Rs {Math.round(editVariantTotals.cost).toLocaleString()}</strong></span>
                    <span>Total Selling Price: <strong style={{ color: "var(--green)" }}>Rs {Math.round(editVariantTotals.selling).toLocaleString()}</strong></span>
                    <span>Total Profit: <strong style={{ color: editVariantTotals.profit >= 0 ? "var(--green)" : "var(--red)" }}>Rs {Math.round(editVariantTotals.profit).toLocaleString()}</strong></span>
                    <span>Leave blank to use the item&apos;s default price</span>
                  </div>
                </div>
              )}

              {/* Add New Variant section */}
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--blue)", marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
                  <i className="fa-solid fa-circle-plus"></i> Add New Variant
                </div>
                <div style={{ background: "var(--blue5)", border: "1.5px solid rgba(46,143,224,.25)", borderRadius: 12, padding: 14 }}>
                  <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 88px 88px auto", gap: 8, alignItems: "flex-end" }}>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10, color: "var(--blue)", marginBottom: 3 }}>Size</label>
                      <input
                        list="edit-size-list" type="text" placeholder="e.g. M, 32, XL"
                        value={editNewVarInput.size}
                        onChange={e => setEditNewVarInput(f => ({ ...f, size: e.target.value }))}
                        style={{ ...inputStyle, fontSize: 12, padding: "7px 10px" }}
                      />
                      <datalist id="edit-size-list">
                        {PRESET_SIZES.map(s => <option key={s} value={s} />)}
                      </datalist>
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10, color: "var(--blue)", marginBottom: 3 }}>Color</label>
                      <input
                        type="text" placeholder="e.g. Navy Blue"
                        value={editNewVarInput.color}
                        onChange={e => setEditNewVarInput(f => ({ ...f, color: e.target.value }))}
                        style={{ ...inputStyle, fontSize: 12, padding: "7px 10px" }}
                      />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10, marginBottom: 3 }}>Qty</label>
                      <input
                        type="number" min="0" step="0.01" placeholder="0"
                        value={editNewVarInput.quantity}
                        onChange={e => setEditNewVarInput(f => ({ ...f, quantity: e.target.value }))}
                        style={{ ...inputStyle, fontSize: 12, padding: "7px 8px" }}
                      />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10, color: "var(--red)", marginBottom: 3 }}>Cost (Rs)</label>
                      <input
                        type="number" min="0" step="0.01" placeholder="0"
                        value={editNewVarInput.purchasePrice}
                        onChange={e => setEditNewVarInput(f => ({ ...f, purchasePrice: e.target.value }))}
                        style={{ ...inputStyle, fontSize: 12, padding: "7px 8px", borderColor: "rgba(224,60,60,.2)", color: "var(--red)" }}
                      />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10, color: "var(--green)", marginBottom: 3 }}>Price (Rs)</label>
                      <input
                        type="number" min="0" step="0.01" placeholder="0"
                        value={editNewVarInput.salesPrice}
                        onChange={e => setEditNewVarInput(f => ({ ...f, salesPrice: e.target.value }))}
                        style={{ ...inputStyle, fontSize: 12, padding: "7px 8px", borderColor: "rgba(34,168,110,.2)", color: "var(--green)" }}
                      />
                    </div>
                    <div style={{ paddingBottom: 1 }}>
                      <button data-ui-action="primary" type="button" onClick={addEditVariant}
                        style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", background: "var(--blue)", color: "white", border: "none", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
                        <i className="fa-solid fa-plus"></i> Add
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--blue)", marginTop: 8, opacity: .75 }}>
                    Fill at least Size or Color, then click Add. Leave Cost/Price blank to use the item&apos;s default.
                  </div>
                </div>

                {/* Staged new variants */}
                {editNewVariants.length > 0 && (
                  <div style={{ marginTop: 10, background: "var(--bg)", borderRadius: 10, overflow: "hidden", border: "1.5px solid var(--bg2)" }}>
                    <div style={{ padding: "7px 12px", fontSize: 10, fontWeight: 700, color: "var(--ink3)", letterSpacing: ".4px", textTransform: "uppercase", borderBottom: "1px solid var(--bg2)", background: "white" }}>
                      {editNewVariants.length} new variant{editNewVariants.length !== 1 ? "s" : ""} to be added on save
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <tbody>
                        {editNewVariants.map((v, vi) => (
                          <tr key={vi} style={{ borderBottom: vi < editNewVariants.length - 1 ? "1px solid var(--bg2)" : "none", background: "white" }}>
                            <td style={{ padding: "8px 12px", fontSize: 12 }}>
                              {v.size && <span style={{ background: "var(--bg2)", padding: "2px 8px", borderRadius: 5, fontWeight: 700, marginRight: 5, fontSize: 11 }}>{v.size}</span>}
                              {v.color && <span style={{ padding: "2px 8px", borderRadius: 5, background: "var(--ink)", color: "white", fontSize: 11 }}>{v.color}</span>}
                              {!v.size && !v.color && <span style={{ color: "var(--muted)" }}>—</span>}
                            </td>
                            <td style={{ padding: "8px 12px", fontSize: 11, color: "var(--muted)" }}>Qty: <strong style={{ color: "var(--ink)" }}>{v.quantity}</strong></td>
                            <td style={{ padding: "8px 12px", fontSize: 11, color: "var(--red)" }}>{v.purchasePrice ? `Rs ${v.purchasePrice}` : <span style={{ opacity: .5 }}>base</span>}</td>
                            <td style={{ padding: "8px 12px", fontSize: 11, color: "var(--green)" }}>{v.salesPrice ? `Rs ${v.salesPrice}` : <span style={{ opacity: .5 }}>base</span>}</td>
                            <td style={{ padding: "8px 12px" }}>
                              <button data-ui-action="icon" type="button" onClick={() => setEditNewVariants(prev => prev.filter((_, i) => i !== vi))}
                                style={{ background: "#fff0f0", border: "none", color: "var(--red)", borderRadius: 6, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button data-ui-action="primary" type="submit" disabled={editSaving} style={{ padding: "10px 24px", borderRadius: 24, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: editSaving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 7, background: "var(--gradient-primary)", color: "white", border: "none", opacity: editSaving ? .7 : 1 }}>
                  <i className={`fa-solid ${editSaving ? "fa-spinner fa-spin" : "fa-floppy-disk"}`}></i>
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
                <button type="button" onClick={closeEdit} style={{ padding: "10px 20px", borderRadius: 24, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: "transparent", color: "var(--ink3)", border: "1.5px solid var(--bg3)" }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
