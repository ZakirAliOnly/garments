"use client";
import { useEffect, useMemo, useState } from "react";

type RequestType = "refund" | "replace";

interface InvoiceItem {
  dt: string;
  q: number;
  r: number;
  a: number;
  stockId?: string;
  variantId?: string;
}

interface LookupInvoice {
  id: string;
  invNumber: string;
  type: string; // "walk" | "regular"
  customerName: string;
  phone: string | null;
  address: string | null;
  invoiceDate: string;
  deliveryDate: string | null;
  description: string | null;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paymentMethod: string | null;
  isRefunded: boolean;
  customer?: { id: string; cid: string; name: string; balance: number } | null;
}

interface RefundRow {
  id: string;
  rrNumber: string;
  invoiceNumber: string;
  customerName: string;
  type: string;
  amount: number;
  createdAt: string;
}

interface ReturnRow extends InvoiceItem {
  selected: boolean;
  returnQty: number;
}

interface StockVariantRow {
  id: string;
  size: string | null;
  color: string | null;
  quantity: number;
  salesPrice: number | null;
}

interface StockRow {
  id: string;
  name: string;
  salesPrice: number;
  unit: string;
  hasVariants: boolean;
  variants: StockVariantRow[];
}

interface ReplacementRow {
  stockId: string;
  variantId: string;
  qty: number;
  rate: number;
}

const card: React.CSSProperties = {
  background: "white",
  borderRadius: "var(--r)",
  boxShadow: "var(--sh)",
  padding: 20,
  marginBottom: 20,
  border: "1px solid rgba(205,216,236,.5)",
};

const th: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 600,
  color: "white",
  letterSpacing: ".6px",
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1.5px solid var(--bg2)",
  borderRadius: "var(--r2)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  background: "white",
  color: "var(--ink)",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--ink3)",
  letterSpacing: ".4px",
  textTransform: "uppercase",
  marginBottom: 4,
  display: "block",
};

/* ── Print helpers ── */
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

const fmtPrintDate = (iso: string) => {
  const dateOnly = iso.split("T")[0];
  const [y, m, d] = dateOnly.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString("en-PK", { day: "2-digit", month: "long", year: "numeric" });
};

const printedOn = () => new Date().toLocaleDateString("en-GB");

function buildRefundWalkHTML(inv: LookupInvoice, rrNumber: string) {
  const logoUrl = `${window.location.origin}/logo.svg`;
  const rows = (Array.isArray(inv.items) ? inv.items : []).map(r => `<tr>
    <td style="padding:4px 0;font-size:11px;">${r.dt}</td>
    <td style="padding:4px 0;font-size:11px;text-align:center;">${r.q}</td>
    <td style="padding:4px 0;font-size:11px;text-align:right;">Rs&nbsp;${r.r.toLocaleString()}</td>
    <td style="padding:4px 0;font-size:11px;text-align:right;font-weight:700;">Rs&nbsp;${r.a.toLocaleString()}</td>
  </tr>`).join("");

  return `<div style="width:72mm;box-sizing:border-box;background:#fff;font-family:Arial,sans-serif;color:#000;font-weight:700;padding:0 4mm;margin:0;border:1px solid #000;">
  <div style="background:#c00;color:#fff;text-align:center;font-size:13px;font-weight:900;padding:5px 0;letter-spacing:3px;margin:0 -4mm;">★ REFUNDED ★</div>
  <div style="text-align:center;padding:10px 10px 6px;border-bottom:2px dashed #222;">
    <img src="${logoUrl}" alt="Logo" style="width:100px;height:100px;object-fit:contain;display:block;margin:0 auto 4px;" />
    <div style="font-size:15px;font-weight:900;letter-spacing:.5px;color:#000;">GARMENTS</div>
    <div style="font-size:10px;color:#000;margin-top:3px;font-weight:700;">Archer Road, Quetta</div>
    <div style="font-size:10px;color:#000;font-weight:700;">0333-7826435 / 0322-8152991</div>
    <div style="background:#000;font-size:11px;font-weight:900;letter-spacing:2px;text-align:center;padding:4px 0;margin:6px -10px -6px -10px;"><span style="color:#fff;">REFUND RECEIPT</span></div>
  </div>
  <div style="padding:6px 10px;border-bottom:1px dashed #aaa;font-size:10px;line-height:2;color:#000;font-weight:700;">
    <div style="display:flex;justify-content:space-between;"><span>Receipt #:</span><span>${inv.invNumber}</span></div>
    <div style="display:flex;justify-content:space-between;"><span>RR #:</span><span>${rrNumber}</span></div>
    <div style="display:flex;justify-content:space-between;"><span>Date:</span><span>${fmtPrintDate(inv.invoiceDate)}</span></div>
  </div>
  <div style="padding:6px 10px;border-bottom:1px dashed #aaa;font-size:10px;color:#000;font-weight:700;">
    <div style="font-size:9px;letter-spacing:.8px;color:#000;margin-bottom:3px;">CUSTOMER</div>
    <div style="font-size:12px;font-weight:700;">${inv.customerName || "Walk-in Customer"}</div>
    ${inv.phone ? `<div style="font-size:10px;">Tel: ${inv.phone}</div>` : ""}
  </div>
  <div style="padding:6px 10px;border-bottom:1px dashed #aaa;">
    <div style="font-size:9px;letter-spacing:.8px;color:#000;margin-bottom:4px;">ITEMS</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="border-bottom:1px solid #999;">
        <th style="font-size:9px;padding:2px 0;text-align:left;font-weight:700;color:#000;width:40%;">DESC</th>
        <th style="font-size:9px;padding:2px 0;text-align:center;font-weight:700;color:#000;width:12%;">QTY</th>
        <th style="font-size:9px;padding:2px 0;text-align:right;font-weight:700;color:#000;width:22%;">RATE</th>
        <th style="font-size:9px;padding:2px 0;text-align:right;font-weight:700;color:#000;width:26%;">AMT</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div style="padding:6px 10px;border-bottom:2px dashed #222;font-size:11px;line-height:2;color:#000;font-weight:700;">
    <div style="display:flex;justify-content:space-between;"><span>Subtotal:</span><span>Rs ${inv.subtotal.toLocaleString()}</span></div>
    ${inv.discount > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Discount:</span><span>- Rs ${inv.discount.toLocaleString()}</span></div>` : ""}
    <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:900;border-top:1px solid #000;margin-top:2px;padding-top:3px;"><span>TOTAL:</span><span>Rs ${inv.total.toLocaleString()}</span></div>
  </div>
  <div style="text-align:center;padding:8px 10px 10px;font-size:10px;color:#000;line-height:1.8;font-weight:700;">
    <div style="text-align:left;font-size:10px;font-weight:700;color:#c00;border:1px solid #c00;padding:5px 8px;border-radius:4px;">
      This invoice has been refunded.<br>No further refunds or exchanges are accepted.
    </div>
    <div style="margin-top:5px;font-size:9px;letter-spacing:2px;color:#000;">✦ &nbsp; ✦ &nbsp; ✦</div>
    <div style="font-size:9px;margin-top:4px;color:#000;">Software Developed By: AddsMint.com</div>
    <div style="font-size:10px;color:#000;font-weight:700;">Printed: ${printedOn()}</div>
  </div>
</div>`;
}

function buildRefundRegularHTML(inv: LookupInvoice, rrNumber: string) {
  const logoUrl = `${window.location.origin}/logo.svg`;
  const rows = (Array.isArray(inv.items) ? inv.items : []).map((r, i) => `<tr style="${i % 2 === 1 ? "background:#f8fafd;" : ""}">
    <td style="padding:11px 14px;font-size:13px;">${r.dt}</td>
    <td style="padding:11px 14px;font-size:13px;text-align:center;">${r.q}</td>
    <td style="padding:11px 14px;font-size:13px;text-align:right;">Rs ${r.r.toLocaleString()}</td>
    <td style="padding:11px 14px;font-size:13px;text-align:right;font-weight:700;">Rs ${r.a.toLocaleString()}</td>
  </tr>`).join("");

  return `<div style="width:794px;background:#fff;font-family:'Arial',sans-serif;display:flex;flex-direction:column;position:relative;">
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-40deg);font-size:80px;font-weight:900;color:rgba(192,0,0,0.1);letter-spacing:8px;pointer-events:none;white-space:nowrap;z-index:0;">REFUNDED</div>
  <div style="height:6px;background:linear-gradient(90deg,#8b0000,#c00,#e05050);position:relative;z-index:1;"></div>
  <div style="background:#fff0f0;border-bottom:2px solid #c00;padding:8px 48px;display:flex;align-items:center;gap:12px;position:relative;z-index:1;">
    <span style="font-size:18px;font-weight:900;color:#c00;letter-spacing:2px;">★ REFUNDED</span>
    <span style="font-size:12px;color:#c00;">Refund Ref: <strong>${rrNumber}</strong> &nbsp;|&nbsp; Original Invoice: <strong>${inv.invNumber}</strong></span>
  </div>
  <div style="padding:24px 48px 18px;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid #e8eef7;position:relative;z-index:1;">
    <div style="display:flex;align-items:center;gap:18px;">
      <img src="${logoUrl}" alt="Logo" style="width:64px;height:64px;object-fit:contain;flex-shrink:0;" />
      <div>
        <div style="font-size:20px;font-weight:900;color:#0a1628;letter-spacing:.3px;">GARMENTS</div>
        <div style="font-size:12px;color:#7a8baa;margin-top:3px;">Archer Road, Quetta</div>
        <div style="font-size:12px;color:#1057a0;margin-top:5px;">📞 0333-7826435 / 0322-8152991</div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:28px;font-weight:900;color:#c00;letter-spacing:2px;line-height:1;">REFUND INVOICE</div>
      <div style="font-size:14px;font-weight:700;color:#1057a0;margin-top:4px;font-family:monospace;">#${inv.invNumber}</div>
      <div style="margin-top:8px;background:#fff0f0;border-radius:8px;padding:8px 14px;border:1px solid #f5c6c6;">
        <div style="font-size:10px;color:#c00;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Status</div>
        <div style="font-size:14px;font-weight:700;color:#c00;margin-top:2px;">REFUNDED</div>
      </div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr;background:#f4f7fc;border-bottom:2px solid #e8eef7;position:relative;z-index:1;">
    <div style="padding:18px 48px;border-right:1px solid #e8eef7;">
      <div style="font-size:10px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-bottom:6px;">Bill To</div>
      <div style="font-size:16px;font-weight:800;color:#0a1628;">${inv.customerName}</div>
      ${inv.customer?.cid ? `<div style="font-size:11px;color:#1057a0;font-weight:700;font-family:monospace;background:#e0f0ff;display:inline-block;padding:2px 9px;border-radius:5px;margin-top:4px;">${inv.customer.cid}</div>` : ""}
      ${inv.phone ? `<div style="font-size:12px;color:#555;margin-top:5px;">📞 ${inv.phone}</div>` : ""}
      ${inv.address ? `<div style="font-size:12px;color:#555;margin-top:2px;">📍 ${inv.address}</div>` : ""}
    </div>
    <div style="padding:18px 24px;border-right:1px solid #e8eef7;">
      <div style="font-size:10px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-bottom:5px;">Invoice Date</div>
      <div style="font-size:13px;font-weight:700;color:#0a1628;">${fmtPrintDate(inv.invoiceDate)}</div>
      ${inv.deliveryDate ? `<div style="font-size:10px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-top:10px;margin-bottom:5px;">Delivery Date</div><div style="font-size:13px;font-weight:700;color:#0a1628;">${fmtPrintDate(inv.deliveryDate)}</div>` : ""}
      <div style="font-size:10px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-top:10px;margin-bottom:5px;">Payment Method</div>
      <div style="font-size:13px;font-weight:700;color:#0a1628;">${inv.paymentMethod || "Cash"}</div>
    </div>
    <div style="padding:18px 24px;">
      <div style="font-size:10px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-bottom:5px;">Invoice Total</div>
      <div style="font-size:22px;font-weight:900;color:#0a1628;">Rs ${inv.total.toLocaleString()}</div>
      <div style="font-size:10px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-top:8px;margin-bottom:4px;">Amount Paid</div>
      <div style="font-size:14px;font-weight:700;color:#22a86e;">Rs ${inv.amountPaid.toLocaleString()}</div>
    </div>
  </div>
  ${inv.description ? `<div style="margin:14px 48px 0;background:#fffbf0;border-left:4px solid #f0a500;border-radius:0 8px 8px 0;padding:10px 16px;font-size:12px;color:#0a1628;position:relative;z-index:1;"><span style="font-weight:700;color:#c07800;">Order Details: </span>${inv.description}</div>` : ""}
  <div style="padding:18px 48px;position:relative;z-index:1;">
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#0a1628;">
        <th style="padding:11px 14px;color:white;font-size:11px;font-weight:700;letter-spacing:.5px;text-align:left;text-transform:uppercase;">Item Description</th>
        <th style="padding:11px 14px;color:white;font-size:11px;font-weight:700;text-align:center;text-transform:uppercase;width:80px;">Qty</th>
        <th style="padding:11px 14px;color:white;font-size:11px;font-weight:700;text-align:right;text-transform:uppercase;width:120px;">Rate (Rs)</th>
        <th style="padding:11px 14px;color:white;font-size:11px;font-weight:700;text-align:right;text-transform:uppercase;width:130px;">Amount (Rs)</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-top:14px;">
      <div style="min-width:280px;">
        <div style="display:flex;justify-content:space-between;padding:7px 0;font-size:13px;border-bottom:1px solid #e8eef7;"><span style="color:#7a8baa;">Subtotal:</span><span style="font-weight:600;">Rs ${inv.subtotal.toLocaleString()}</span></div>
        ${inv.discount > 0 ? `<div style="display:flex;justify-content:space-between;padding:7px 0;font-size:13px;border-bottom:1px solid #e8eef7;"><span style="color:#7a8baa;">Discount:</span><span style="font-weight:600;color:#e03c3c;">— Rs ${inv.discount.toLocaleString()}</span></div>` : ""}
        <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:17px;font-weight:900;color:#0a1628;border-top:2px solid #1057a0;"><span>Total:</span><span>Rs ${inv.total.toLocaleString()}</span></div>
      </div>
    </div>
  </div>
  <div style="margin:0 48px;border-top:1px solid #e8eef7;padding:12px 0;position:relative;z-index:1;">
    <div style="background:#fff0f0;border:1.5px solid #c00;border-radius:8px;padding:12px 16px;font-size:12px;color:#c00;font-weight:700;">
      ★ This invoice has been refunded (${rrNumber}). No further refunds or exchanges are accepted.
    </div>
  </div>
  <div style="background:#0a1628;padding:8px 48px;display:flex;justify-content:space-between;align-items:center;margin-top:12px;position:relative;z-index:1;">
    <div style="font-size:10px;color:#5aabf0;">Garments &bull; Archer Road, Quetta &bull; 0333-7826435 / 0322-8152991</div>
    <div style="font-size:8px;color:#5aabf0;">Software Developed By: <strong style="color:#f0a500;">AddsMint.com</strong> &bull; Printed: ${printedOn()}</div>
  </div>
</div>`;
}

export default function RefundPage() {
  const [requests, setRequests] = useState<RefundRow[]>([]);
  const [stockItems, setStockItems] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [invNumber, setInvNumber] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [lookupInvoice, setLookupInvoice] = useState<LookupInvoice | null>(null);
  const [existingRefundAmount, setExistingRefundAmount] = useState(0);
  const [existingRefundCount, setExistingRefundCount] = useState(0);

  const [reqType, setReqType] = useState<RequestType>("refund");
  const [reason, setReason] = useState("");
  const [returnItems, setReturnItems] = useState<ReturnRow[]>([]);
  const [replacementRows, setReplacementRows] = useState<ReplacementRow[]>([
    { stockId: "", variantId: "", qty: 1, rate: 0 },
  ]);
  const [toast, setToast] = useState("");
  const [printLoading, setPrintLoading] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const printRefundInvoice = async (rrNumber: string, invoiceNumber: string) => {
    setPrintLoading(rrNumber);
    try {
      const res = await fetch(`/api/refunds/lookup?invNumber=${encodeURIComponent(invoiceNumber)}`);
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Failed to load invoice"); return; }
      const inv: LookupInvoice = data.invoice;
      const html = inv.type === "walk"
        ? buildRefundWalkHTML(inv, rrNumber)
        : buildRefundRegularHTML(inv, rrNumber);
      const pageStyle = inv.type === "walk"
        ? `@page{size:80mm auto;margin:0;}*{box-sizing:border-box;}html,body{width:72mm;margin:0;padding:0;}`
        : `@page{size:auto;margin:0;}html,body{margin:0;padding:0;}`;
      doPrint(html, pageStyle, `Refund ${rrNumber}`);
    } finally {
      setPrintLoading(null);
    }
  };

  const loadRequests = () => {
    setLoading(true);
    fetch("/api/refunds")
      .then((r) => r.json())
      .then((d) => {
        setRequests(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadRequests();
    fetch("/api/stock?lean=1")
      .then((r) => r.json())
      .then((d) => setStockItems(Array.isArray(d) ? d : []))
      .catch(() => setStockItems([]));
  }, []);

  const lookupInvoiceByNumber = async () => {
    const inv = invNumber.trim().toUpperCase();
    if (!inv) return;
    setLookupLoading(true);
    setLookupError("");
    setLookupInvoice(null);
    setReturnItems([]);
    setReplacementRows([{ stockId: "", variantId: "", qty: 1, rate: 0 }]);

    const res = await fetch(`/api/refunds/lookup?invNumber=${encodeURIComponent(inv)}`);
    const data = await res.json();
    if (!res.ok) {
      setLookupError(data.error || "Invoice not found");
      setLookupLoading(false);
      return;
    }

    setLookupInvoice(data.invoice);
    setExistingRefundAmount(data.refundStats?.totalAmount ?? 0);
    setExistingRefundCount(data.refundStats?.totalRequests ?? 0);
    const rows: ReturnRow[] = Array.isArray(data.invoice?.items)
      ? data.invoice.items.map((i: InvoiceItem) => ({
          ...i,
          q: Number(i.q) || 0,
          r: Number(i.r) || 0,
          a: Number(i.a) || 0,
          selected: false,
          returnQty: 0,
        }))
      : [];
    setReturnItems(rows);
    setLookupLoading(false);
  };

  const selectedReturnItems = useMemo(
    () =>
      returnItems
        .filter((i) => i.selected && i.returnQty > 0)
        .map((i) => ({
          dt: i.dt,
          q: i.returnQty,
          r: i.r,
          a: i.returnQty * i.r,
          stockId: i.stockId,
          variantId: i.variantId,
        })),
    [returnItems],
  );

  const replacementItems = useMemo(
    () =>
      replacementRows
        .filter((r) => r.stockId && r.qty > 0)
        .map((r) => {
          const stock = stockItems.find((s) => s.id === r.stockId);
          const variant = stock?.variants.find((v) => v.id === r.variantId);
          const labelPart = variant
            ? ` (${[variant.size, variant.color].filter(Boolean).join(" / ")})`
            : "";
          return {
            dt: `${stock?.name ?? "Item"}${labelPart}`,
            q: r.qty,
            r: r.rate,
            a: r.qty * r.rate,
            stockId: r.stockId,
            variantId: r.variantId || undefined,
          };
        }),
    [replacementRows, stockItems],
  );

  const returnAmount = useMemo(
    () => selectedReturnItems.reduce((s, i) => s + (Number(i.a) || 0), 0),
    [selectedReturnItems],
  );
  const replacementAmount = useMemo(
    () => replacementItems.reduce((s, i) => s + (Number(i.a) || 0), 0),
    [replacementItems],
  );
  const replaceDifference = replacementAmount - returnAmount;

  const updateReplacementRow = (idx: number, patch: Partial<ReplacementRow>) => {
    setReplacementRows((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const next = { ...row, ...patch };
        if (patch.stockId !== undefined) {
          const st = stockItems.find((s) => s.id === patch.stockId);
          if (!st) return { stockId: "", variantId: "", qty: 1, rate: 0 };
          if (st.hasVariants) {
            return { ...next, variantId: "", rate: 0 };
          }
          return { ...next, variantId: "", rate: st.salesPrice };
        }
        if (patch.variantId !== undefined) {
          const st = stockItems.find((s) => s.id === next.stockId);
          const vr = st?.variants.find((v) => v.id === patch.variantId);
          const rate =
            vr && vr.salesPrice != null && vr.salesPrice > 0
              ? vr.salesPrice
              : (st?.salesPrice ?? 0);
          return { ...next, rate };
        }
        return next;
      }),
    );
  };

  const submitRequest = async () => {
    if (!lookupInvoice) return;
    if (selectedReturnItems.length === 0) {
      showToast("Select at least one sold item to return");
      return;
    }
    if (reqType === "replace" && replacementItems.length === 0) {
      showToast("Select at least one replacement item");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/refunds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invNumber: lookupInvoice.invNumber,
        type: reqType,
        reason,
        amount: reqType === "refund" ? returnAmount : replaceDifference,
        items: selectedReturnItems,
        replacementItems: reqType === "replace" ? replacementItems : [],
      }),
    });

    const data = await res.json();
    if (res.ok) {
      showToast(`Request ${data.rrNumber} processed`);
      setReason("");
      setReturnItems((prev) => prev.map((p) => ({ ...p, selected: false, returnQty: 0 })));
      setReplacementRows([{ stockId: "", variantId: "", qty: 1, rate: 0 }]);
      loadRequests();
      await lookupInvoiceByNumber();
    } else {
      showToast(data.error || "Failed to process request");
    }
    setSaving(false);
  };

  return (
    <div style={{ animation: "pgIn .3s cubic-bezier(.16,1,.3,1)" }}>
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            right: 28,
            zIndex: 9999,
            background: "var(--ink)",
            color: "white",
            padding: "12px 20px",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "var(--shm)",
          }}
        >
          {toast}
        </div>
      )}

      {/* Lookup */}
      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 14, display: "flex", alignItems: "center", gap: 9 }}>
          <i className="fa-solid fa-rotate-left" style={{ color: "var(--blue2)", fontSize: 15 }}></i>
          Refund & Replace
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 1fr", gap: 10, alignItems: "end" }}>
          <div>
            <label style={labelStyle}>Invoice Number</label>
            <input
              style={{ ...inputStyle, fontFamily: "monospace", fontWeight: 700 }}
              placeholder="INV-0001"
              value={invNumber}
              onChange={(e) => setInvNumber(e.target.value)}
            />
          </div>
          <button
            onClick={lookupInvoiceByNumber}
            disabled={lookupLoading}
            style={{
              padding: "10px 16px",
              borderRadius: 24,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: lookupLoading ? "not-allowed" : "pointer",
              background: "linear-gradient(135deg,var(--blue),var(--blue2))",
              color: "white",
              border: "none",
              opacity: lookupLoading ? 0.7 : 1,
            }}
          >
            {lookupLoading ? "Looking..." : "Lookup Invoice"}
          </button>
          <div>{lookupError && <div style={{ fontSize: 12, color: "var(--red)", fontWeight: 600 }}>{lookupError}</div>}</div>
        </div>

        {lookupInvoice && (
          <>
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "var(--bg)", border: "1px solid var(--bg2)", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Customer</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{lookupInvoice.customerName}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Invoice Total</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Rs {lookupInvoice.total.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Already Refunded</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--red)" }}>Rs {existingRefundAmount.toLocaleString()} ({existingRefundCount})</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Current Balance</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--blue)" }}>
                  {lookupInvoice.customer ? `Rs ${lookupInvoice.customer.balance.toLocaleString()}` : "Walk-in"}
                </div>
              </div>
            </div>
            {lookupInvoice.isRefunded && (
              <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, background: "#fff0f0", border: "1.5px solid #c00", display: "flex", alignItems: "center", gap: 10 }}>
                <i className="fa-solid fa-ban" style={{ color: "#c00", fontSize: 15 }}></i>
                <div>
                  <span style={{ fontWeight: 700, color: "#c00", fontSize: 13 }}>Already Refunded</span>
                  <span style={{ fontSize: 12, color: "#c00", marginLeft: 8 }}>This invoice has been refunded and cannot be refunded again.</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {lookupInvoice && !lookupInvoice.isRefunded && (
        <div style={card}>
          <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 240px", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Request Type</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={reqType} onChange={(e) => setReqType(e.target.value as RequestType)}>
                <option value="refund">Refund (Money Back)</option>
                <option value="replace">Replace (Exchange)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Reason</label>
              <input style={inputStyle} placeholder="Reason for refund / replacement" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div style={{ background: "var(--bg)", borderRadius: 10, padding: "10px 12px", border: "1px solid var(--bg2)" }}>
              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                {reqType === "refund" ? "Refund Amount" : "Difference"}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: reqType === "refund" ? "var(--red)" : replaceDifference > 0 ? "var(--gold)" : "var(--green)" }}>
                {`Rs ${(reqType === "refund" ? returnAmount : Math.abs(replaceDifference)).toLocaleString()}`}
              </div>
              {reqType === "replace" && (
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  {replaceDifference > 0
                    ? "Customer has to pay this extra amount"
                    : replaceDifference < 0
                    ? "Customer will get this credit/refund"
                    : "Even exchange"}
                </div>
              )}
            </div>
          </div>

          {/* Return selection */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
              Select sold items to return
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--ink)" }}>
                    <th style={{ ...th, width: 74 }}>Select</th>
                    <th style={th}>Item</th>
                    <th style={{ ...th, width: 95 }}>Bought Qty</th>
                    <th style={{ ...th, width: 95 }}>Rate</th>
                    <th style={{ ...th, width: 115 }}>Return Qty</th>
                    <th style={{ ...th, width: 115 }}>Return Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {returnItems.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid var(--bg2)" }}>
                      <td style={{ padding: "9px 12px" }}>
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(e) =>
                            setReturnItems((prev) =>
                              prev.map((p, i) =>
                                i === idx
                                  ? { ...p, selected: e.target.checked, returnQty: e.target.checked ? Math.max(1, p.returnQty) : 0 }
                                  : p,
                              ),
                            )
                          }
                        />
                      </td>
                      <td style={{ padding: "9px 12px", fontSize: 13, fontWeight: 600 }}>{row.dt}</td>
                      <td style={{ padding: "9px 12px", fontSize: 13 }}>{row.q}</td>
                      <td style={{ padding: "9px 12px", fontSize: 13 }}>Rs {row.r.toLocaleString()}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="number"
                            min={0}
                            max={row.q}
                            step={1}
                            disabled={!row.selected}
                            value={row.returnQty}
                            onChange={(e) =>
                              setReturnItems((prev) =>
                                prev.map((p, i) =>
                                  i === idx
                                    ? { ...p, returnQty: Math.max(0, Math.min(p.q, Math.floor(Number(e.target.value) || 0))) }
                                    : p,
                                ),
                              )
                            }
                            style={{ ...inputStyle, width: 70, padding: "6px 8px", opacity: row.selected ? 1 : 0.6 }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setReturnItems((prev) =>
                                prev.map((p, i) => (i === idx ? { ...p, selected: true, returnQty: p.q } : p)),
                              )
                            }
                            style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid var(--bg3)", background: "white", cursor: "pointer", fontSize: 11 }}
                          >
                            Full
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: "9px 12px", fontSize: 13, color: "var(--red)", fontWeight: 700 }}>
                        Rs {(row.returnQty * row.r).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Replacement selection */}
          {reqType === "replace" && (
            <div style={{ marginBottom: 14, borderTop: "1px solid var(--bg2)", paddingTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
                Select replacement item(s)
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--ink)" }}>
                      <th style={th}>Replacement Product</th>
                      <th style={{ ...th, width: 230 }}>Variant</th>
                      <th style={{ ...th, width: 85 }}>Qty</th>
                      <th style={{ ...th, width: 100 }}>Rate</th>
                      <th style={{ ...th, width: 115 }}>Amount</th>
                      <th style={{ ...th, width: 60 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {replacementRows.map((row, idx) => {
                      const selectedStock = stockItems.find((s) => s.id === row.stockId) ?? null;
                      const selectedVariant = selectedStock?.variants.find((v) => v.id === row.variantId) ?? null;
                      return (
                        <tr key={idx} style={{ borderBottom: "1px solid var(--bg2)" }}>
                          <td style={{ padding: "8px 10px" }}>
                            <select
                              value={row.stockId}
                              onChange={(e) => updateReplacementRow(idx, { stockId: e.target.value })}
                              style={{ ...inputStyle, cursor: "pointer", padding: "7px 10px" }}
                            >
                              <option value="">Select stock item...</option>
                              {stockItems.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            {selectedStock?.hasVariants ? (
                              <select
                                value={row.variantId}
                                onChange={(e) => updateReplacementRow(idx, { variantId: e.target.value })}
                                style={{ ...inputStyle, cursor: "pointer", padding: "7px 10px" }}
                              >
                                <option value="">Select variant...</option>
                                {selectedStock.variants.map((v) => {
                                  const label = [v.size, v.color].filter(Boolean).join(" / ");
                                  return (
                                    <option key={v.id} value={v.id} disabled={v.quantity <= 0}>
                                      {label} ({v.quantity} left)
                                    </option>
                                  );
                                })}
                              </select>
                            ) : (
                              <input
                                value={selectedVariant ? [selectedVariant.size, selectedVariant.color].filter(Boolean).join(" / ") : "No variant"}
                                readOnly
                                style={{ ...inputStyle, background: "var(--bg)" }}
                              />
                            )}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={row.qty}
                              onChange={(e) => updateReplacementRow(idx, { qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                              style={{ ...inputStyle, width: 74, padding: "6px 8px" }}
                            />
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={row.rate}
                              onChange={(e) => updateReplacementRow(idx, { rate: Math.max(0, Number(e.target.value) || 0) })}
                              style={{ ...inputStyle, width: 88, padding: "6px 8px" }}
                            />
                          </td>
                          <td style={{ padding: "8px 10px", fontWeight: 700, color: "var(--gold)" }}>
                            Rs {(row.qty * row.rate).toLocaleString()}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <button
                              type="button"
                              onClick={() =>
                                setReplacementRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)))
                              }
                              style={{ border: "none", background: "transparent", color: "var(--red)", cursor: "pointer", fontSize: 14 }}
                            >
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() => setReplacementRows((prev) => [...prev, { stockId: "", variantId: "", qty: 1, rate: 0 }])}
                style={{ marginTop: 8, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--bg3)", background: "white", color: "var(--blue)", cursor: "pointer", fontWeight: 600 }}
              >
                <i className="fa-solid fa-plus" style={{ marginRight: 6 }}></i>Add Replacement Item
              </button>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              Refund updates stock + customer balance. Replace updates returned stock, issued replacement stock, and only adjusts balance by the net difference.
            </div>
            <button
              onClick={submitRequest}
              disabled={saving}
              style={{
                padding: "10px 18px",
                borderRadius: 24,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: saving ? "not-allowed" : "pointer",
                background: "linear-gradient(135deg,#b03030,#e05050)",
                color: "white",
                border: "none",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Processing..." : reqType === "refund" ? "Process Refund" : "Process Replacement"}
            </button>
          </div>
        </div>
      )}

      {/* History */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
          Processed Refund / Replace Requests
        </div>
        {loading ? (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Loading...</div>
        ) : requests.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>No requests yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--ink)" }}>
                  <th style={th}>RR #</th>
                  <th style={th}>Invoice</th>
                  <th style={th}>Customer</th>
                  <th style={th}>Type</th>
                  <th style={{ ...th, textAlign: "right" }}>Amount</th>
                  <th style={th}>Date</th>
                  <th style={{ ...th, width: 80, textAlign: "center" }}>Print</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: i < requests.length - 1 ? "1px solid var(--bg2)" : "none" }}>
                    <td style={{ padding: "9px 12px", fontFamily: "monospace", fontWeight: 700 }}>{r.rrNumber}</td>
                    <td style={{ padding: "9px 12px", fontFamily: "monospace", fontWeight: 700 }}>{r.invoiceNumber}</td>
                    <td style={{ padding: "9px 12px", fontSize: 13 }}>{r.customerName}</td>
                    <td style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: r.type === "refund" ? "var(--red)" : "var(--gold)" }}>
                      {r.type === "refund" ? "Refund" : "Replace"}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13, fontWeight: 700 }}>
                      Rs {Math.abs(r.amount).toLocaleString()}
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: 12, color: "var(--muted)" }}>
                      {new Date(r.createdAt).toLocaleDateString("en-GB")}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "center" }}>
                      <button
                        onClick={() => printRefundInvoice(r.rrNumber, r.invoiceNumber)}
                        disabled={printLoading === r.rrNumber}
                        style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--bg3)", background: "white", color: "var(--blue)", cursor: printLoading === r.rrNumber ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, opacity: printLoading === r.rrNumber ? 0.6 : 1 }}
                      >
                        {printLoading === r.rrNumber ? "..." : <><i className="fa-solid fa-print" style={{ marginRight: 4 }}></i>Print</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

