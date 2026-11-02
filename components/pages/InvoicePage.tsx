"use client";
import { useEffect, useRef, useState } from "react";

/* ─── Types ─────────────────────────────────────── */
type InvType = "regular" | "walk";

interface InvItem {
  dt: string; q: number; r: number; a: number;
  stockId?: string;    // which StockItem is selected (for variant lookup)
  variantId?: string;  // which StockVariant is selected
}

interface Invoice {
  id: string; invNumber: string; type: string;
  customerName: string; phone: string | null; address: string | null;
  invoiceDate: string; deliveryDate: string | null; description: string | null;
  items: InvItem[]; subtotal: number; discount: number; total: number;
  amountPaid: number; balanceDue: number; paymentMethod: string | null; status: string; createdAt: string;
  customer?: { cid: string; name: string } | null;
  accountHeader?: { id: string; name: string; prefix: string } | null;
}

interface CustomerRow {
  id: string; cid: string; name: string; phone: string; address: string | null; balance?: number;
}

interface StockVariantRow {
  id: string; sku: string; size: string | null; color: string | null; quantity: number;
  salesPrice: number | null; purchasePrice: number | null;
}

interface StockRow {
  id: string; name: string; salesPrice: number; unit: string;
  hasVariants: boolean; variants: StockVariantRow[];
}

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
const roInp: React.CSSProperties = { ...inp, background: "var(--bg)", color: "var(--muted)" };
const th: React.CSSProperties = {
  padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600,
  color: "white", letterSpacing: ".5px", textTransform: "uppercase",
};

/* ─── Helpers ────────────────────────────────────── */
const fmtDate = (iso: string) => {
  if (!iso) return "";
  const dateOnly = iso.split("T")[0]; // strip time portion if stored as ISO datetime
  const [y, m, d] = dateOnly.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString("en-PK", { day: "2-digit", month: "long", year: "numeric" });
};
const today = () => new Date().toISOString().split("T")[0];
const todayPlus = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split("T")[0]; };
const printed = () => new Date().toLocaleDateString("en-GB");

/* Print via hidden iframe — no popup window, sends straight to print dialog */
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

function nextNum(invoices: Invoice[]) {
  const nums = invoices.map(inv => { const m = inv.invNumber.match(/INV-(\d+)/); return m ? parseInt(m[1]) : 0; }).filter(n => n > 0);
  return `INV-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, "0")}`;
}

/* ═══ WALK-IN RECEIPT HTML ════════════════════════ */
function buildWalkHTML(d: { logoUrl: string; invNumber: string; customerName: string; phone: string; invDate: string; description: string; items: InvItem[]; sub: number; dis: number; tot: number; paid: number; due: number; paymentMethod: string; }) {
  const t = new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
  const rows = d.items.map(r => `<tr>
    <td style="padding:4px 0;font-size:11px;">${r.dt}</td>
    <td style="padding:4px 0;font-size:11px;text-align:center;">${r.q}</td>
    <td style="padding:4px 0;font-size:11px;text-align:right;">Rs&nbsp;${r.r.toLocaleString()}</td>
    <td style="padding:4px 0;font-size:11px;text-align:right;font-weight:700;">Rs&nbsp;${r.a.toLocaleString()}</td>
  </tr>`).join("");

  return `<div style="width:72mm;box-sizing:border-box;background:#fff;font-family:Arial,sans-serif;color:#000;font-weight:700;padding:0 4mm;margin:0;border:1px solid #000;">
  <div style="text-align:center;padding:14px 10px 8px;border-bottom:2px dashed #222;">
    <img src="${d.logoUrl}" alt="Logo" style="width:130px;height:130px;object-fit:contain;display:block;margin:0 auto 6px;" />
    <div style="font-size:17px;font-weight:900;letter-spacing:.5px;color:#000;">GARMENTS</div>
    <div style="font-size:10px;color:#000;margin-top:4px;font-weight:700;">Archer Road, Quetta</div>
    <div style="font-size:10px;color:#000;font-weight:700;">0333-7826435 / 0322-8152991</div>
    <div style="background:#000;font-size:13px;font-weight:900;letter-spacing:2px;text-align:center;padding:5px 0;margin:8px -10px -8px -10px;"><span style="color:#fff !important;">SALES RECEIPT</span></div>
  </div>
  <div style="padding:7px 10px;border-bottom:1px dashed #aaa;font-size:10px;line-height:2;color:#000;font-weight:700;">
    <div style="display:flex;justify-content:space-between;"><span style="color:#000;font-weight:700;">Receipt #:</span><span style="font-weight:700;color:#000;">${d.invNumber}</span></div>
    <div style="display:flex;justify-content:space-between;"><span style="color:#000;font-weight:700;">Date:</span><span style="color:#000;font-weight:700;">${d.invDate}</span></div>
    <div style="display:flex;justify-content:space-between;"><span style="color:#000;font-weight:700;">Time:</span><span style="color:#000;font-weight:700;">${t}</span></div>
  </div>
  <div style="padding:7px 10px;border-bottom:1px dashed #aaa;font-size:10px;color:#000;font-weight:700;">
    <div style="font-weight:700;font-size:9px;letter-spacing:.8px;color:#000;margin-bottom:4px;">CUSTOMER</div>
    <div style="font-weight:700;font-size:12px;color:#000;">${d.customerName || "Walk-in Customer"}</div>
    ${d.phone ? `<div style="font-size:10px;color:#000;font-weight:700;">Tel: ${d.phone}</div>` : ""}
    <div style="display:inline-block;font-size:9px;background:#000;color:#fff;padding:2px 8px;margin-top:4px;letter-spacing:1px;font-weight:700;">WALK-IN</div>
  </div>
  ${d.description ? `<div style="padding:5px 10px;border-bottom:1px dashed #aaa;font-size:10px;color:#000;line-height:1.5;font-weight:700;"><span style="font-weight:700;color:#000;">Description: </span>${d.description}</div>` : ""}
  <div style="padding:6px 10px;border-bottom:1px dashed #aaa;">
    <div style="font-weight:700;font-size:9px;letter-spacing:.8px;color:#000;margin-bottom:5px;">ITEMS</div>
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
  <div style="padding:7px 10px;border-bottom:2px dashed #222;font-size:11px;line-height:2;color:#000;font-weight:700;">
    <div style="display:flex;justify-content:space-between;"><span style="color:#000;font-weight:700;">Subtotal:</span><span style="color:#000;font-weight:700;">Rs ${d.sub.toLocaleString()}</span></div>
    ${d.dis > 0 ? `<div style="display:flex;justify-content:space-between;"><span style="color:#000;font-weight:700;">Discount:</span><span style="color:#000;font-weight:700;">- Rs ${d.dis.toLocaleString()}</span></div>` : ""}
    <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:900;border-top:1px solid #000;margin-top:3px;padding-top:4px;"><span>TOTAL:</span><span>Rs ${d.tot.toLocaleString()}</span></div>
    ${d.paid > 0 ? `<div style="display:flex;justify-content:space-between;"><span style="color:#000;font-weight:700;">Advance Paid:</span><span style="color:#000;font-weight:700;">Rs ${d.paid.toLocaleString()}</span></div>` : ""}
    <div style="display:flex;justify-content:space-between;font-weight:700;color:#000;"><span>BALANCE DUE:</span><span>Rs ${Math.abs(d.due).toLocaleString()}${d.due < 0 ? " (CR)" : ""}</span></div>
    <div style="display:flex;justify-content:space-between;font-weight:700;color:#000;margin-top:4px;padding-top:4px;border-top:1px dashed #aaa;"><span>Payment Received By:</span><span>${d.paymentMethod || "Cash"}</span></div>
  </div>
  <div style="text-align:center;padding:10px 10px 14px;font-size:10px;color:#000;line-height:1.8;font-weight:700;">
    <div style="font-size:12px;font-weight:700;color:#000;margin-bottom:3px;">Thank You for Shopping!</div>
    <div style="margin-top:6px;text-align:left;font-size:10px;font-weight:700;color:#000;line-height:1.9;border-top:1px dashed #aaa;padding-top:6px;">
      <div>No Return or Exchange Without Receipt</div>
      <div>No Return or Exchange After 3 Days</div>
    </div>
    <div style="margin-top:5px;font-size:9px;letter-spacing:2px;color:#000;">✦ &nbsp; ✦ &nbsp; ✦</div>
    <div style="font-size:10px;margin-top:5px;color:#000;font-weight:900;">Software Developed By: AddsMint.com</div>
    <div style="font-size:11px;color:#000;font-weight:700;">Printed: ${printed()}</div>
  </div>
</div>`;
}

/* ═══ REGULAR A4 INVOICE HTML ═════════════════════ */
function buildRegularHTML(d: { logoUrl: string; invNumber: string; customerName: string; cid: string; phone: string; address: string; invDate: string; delDate: string; description: string; items: InvItem[]; sub: number; dis: number; tot: number; paid: number; due: number; paymentMethod: string; }) {
  const rows = d.items.map((r, i) => `<tr style="${i % 2 === 1 ? "background:#f8fafd;" : ""}">
    <td style="padding:11px 14px;font-size:13px;">${r.dt}</td>
    <td style="padding:11px 14px;font-size:13px;text-align:center;">${r.q}</td>
    <td style="padding:11px 14px;font-size:13px;text-align:right;">Rs ${r.r.toLocaleString()}</td>
    <td style="padding:11px 14px;font-size:13px;text-align:right;font-weight:700;">Rs ${r.a.toLocaleString()}</td>
  </tr>`).join("");

  return `<div style="width:794px;background:#fff;font-family:'Arial',sans-serif;display:flex;flex-direction:column;position:relative;">
  <div style="height:6px;background:linear-gradient(90deg,#0a1628,#1057a0,#2e8fe0);"></div>
  <div style="padding:32px 48px 24px;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid #e8eef7;">
    <div style="display:flex;align-items:center;gap:18px;">
      <img src="${d.logoUrl}" alt="Logo" style="width:72px;height:72px;object-fit:contain;flex-shrink:0;" />
      <div>
        <div style="font-size:22px;font-weight:900;color:#0a1628;letter-spacing:.3px;">GARMENTS</div>
        <div style="font-size:12px;color:#7a8baa;margin-top:3px;">Archer Road, Quetta</div>
        <div style="font-size:12px;color:#1057a0;margin-top:7px;display:flex;gap:18px;flex-wrap:wrap;"><span>📞 0333-7826435 / 0322-8152991</span></div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:32px;font-weight:900;color:#0a1628;letter-spacing:2px;line-height:1;">INVOICE</div>
      <div style="font-size:16px;font-weight:700;color:#1057a0;margin-top:4px;font-family:monospace;">#${d.invNumber}</div>
      <div style="margin-top:10px;background:#f4f7fc;border-radius:8px;padding:9px 16px;text-align:right;border:1px solid #e8eef7;">
        <div style="font-size:10px;color:#7a8baa;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Payment Status</div>
        <div style="font-size:14px;font-weight:700;margin-top:3px;${d.due > 0 ? "color:#e03c3c;" : "color:#22a86e;"}">${d.due > 0 ? "BALANCE DUE" : "FULLY PAID"}</div>
      </div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr;background:#f4f7fc;border-bottom:2px solid #e8eef7;">
    <div style="padding:20px 48px;border-right:1px solid #e8eef7;">
      <div style="font-size:10px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px;">Bill To</div>
      <div style="font-size:17px;font-weight:800;color:#0a1628;">${d.customerName}</div>
      ${d.cid ? `<div style="font-size:11px;color:#1057a0;font-weight:700;font-family:monospace;background:#e0f0ff;display:inline-block;padding:2px 9px;border-radius:5px;margin-top:5px;">${d.cid}</div>` : ""}
      ${d.phone ? `<div style="font-size:12px;color:#555;margin-top:6px;">📞 ${d.phone}</div>` : ""}
      ${d.address ? `<div style="font-size:12px;color:#555;margin-top:3px;">📍 ${d.address}</div>` : ""}
    </div>
    <div style="padding:20px 24px;border-right:1px solid #e8eef7;">
      <div style="font-size:10px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-bottom:6px;">Invoice Date</div>
      <div style="font-size:14px;font-weight:700;color:#0a1628;">${d.invDate}</div>
      <div style="font-size:10px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-top:12px;margin-bottom:6px;">Delivery Date</div>
      <div style="font-size:14px;font-weight:700;color:#0a1628;">${d.delDate}</div>
      <div style="font-size:10px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-top:12px;margin-bottom:6px;">Payment Method</div>
      <div style="font-size:14px;font-weight:700;color:#0a1628;">${d.paymentMethod || "Cash"}</div>
    </div>
    <div style="padding:20px 24px;">
      <div style="font-size:10px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-bottom:6px;">Invoice Total</div>
      <div style="font-size:24px;font-weight:900;color:#0a1628;">Rs ${d.tot.toLocaleString()}</div>
      <div style="font-size:10px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-top:10px;margin-bottom:5px;">Amount Paid</div>
      <div style="font-size:15px;font-weight:700;color:#22a86e;">Rs ${d.paid.toLocaleString()}</div>
    </div>
  </div>
  ${d.description ? `<div style="margin:18px 48px 0;background:#fffbf0;border-left:4px solid #f0a500;border-radius:0 8px 8px 0;padding:10px 16px;font-size:12px;color:#0a1628;"><span style="font-weight:700;color:#c07800;">Order Details: </span>${d.description}</div>` : ""}
  <div style="padding:20px 48px;">
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#0a1628;">
        <th style="padding:12px 14px;color:white;font-size:11px;font-weight:700;letter-spacing:.5px;text-align:left;text-transform:uppercase;">Item Description</th>
        <th style="padding:12px 14px;color:white;font-size:11px;font-weight:700;text-align:center;text-transform:uppercase;width:80px;">Qty</th>
        <th style="padding:12px 14px;color:white;font-size:11px;font-weight:700;text-align:right;text-transform:uppercase;width:120px;">Rate (Rs)</th>
        <th style="padding:12px 14px;color:white;font-size:11px;font-weight:700;text-align:right;text-transform:uppercase;width:130px;">Amount (Rs)</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-top:16px;">
      <div style="min-width:300px;">
        <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;border-bottom:1px solid #e8eef7;"><span style="color:#7a8baa;">Subtotal:</span><span style="font-weight:600;">Rs ${d.sub.toLocaleString()}</span></div>
        ${d.dis > 0 ? `<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;border-bottom:1px solid #e8eef7;"><span style="color:#7a8baa;">Discount:</span><span style="font-weight:600;color:#e03c3c;">— Rs ${d.dis.toLocaleString()}</span></div>` : ""}
        <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:18px;font-weight:900;color:#0a1628;border-top:2px solid #1057a0;"><span>Total:</span><span>Rs ${d.tot.toLocaleString()}</span></div>
        <div style="background:#f4f7fc;border-radius:8px;padding:10px 14px;margin-top:4px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px;"><span style="color:#7a8baa;">Amount Paid:</span><span style="font-weight:700;color:#22a86e;">Rs ${d.paid.toLocaleString()}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900;${d.due > 0 ? "color:#e03c3c;" : "color:#22a86e;"}"><span>Balance Due:</span><span>Rs ${Math.abs(d.due).toLocaleString()}${d.due < 0 ? " (CR)" : ""}</span></div>
        </div>
      </div>
    </div>
  </div>
  <div style="margin:0 48px;border-top:1.5px solid #e8eef7;padding:16px 0;display:flex;justify-content:space-between;align-items:flex-end;">
    <div style="font-size:11px;color:#7a8baa;max-width:320px;line-height:1.6;"><strong style="color:#0a1628;">Terms &amp; Conditions:</strong><br>Payment due on delivery. Items not collected within 30 days incur storage charges. Alterations must be reported within 7 days of delivery.</div>
    <div style="text-align:center;min-width:160px;"><div style="height:44px;border-bottom:1.5px solid #0a1628;margin-bottom:5px;"></div><div style="font-size:10px;font-weight:700;color:#0a1628;">Authorized Signature</div><div style="font-size:9px;color:#7a8baa;">Garments</div></div>
  </div>
  <div style="margin:0 48px 12px;font-size:11px;color:#0a1628;font-weight:700;">
    <div>No Return or Exchange Without Receipt</div>
    <div style="margin-top:3px;">No Return or Exchange After 3 Days</div>
  </div>
  <div style="background:#0a1628;padding:9px 48px;display:flex;justify-content:space-between;align-items:center;margin-top:16px;">
    <div style="font-size:10px;color:#5aabf0;">Thank you for shopping &bull; Garments &bull; Archer Road, Quetta &bull; 0333-7826435 / 0322-8152991</div>
    <div style="font-size:8px;color:#5aabf0;">Software Developed By: <strong style="color:#f0a500;">AddsMint.com</strong> &bull; Printed: ${printed()}</div>
  </div>
</div>`;
}

/* ═══ INVOICE REPORT HTML ════════════════════════ */
function buildReportHTML(d: {
  logoUrl: string; fromDate: string; toDate: string; typeFilter: string; customerFilter: string;
  invoices: Invoice[]; totalIncome: number; totalReceived: number; totalDue: number; totalRefunded: number; refundedCount: number;
}) {
  const rows = d.invoices.map((inv, i) => {
    const sc = inv.status === "paid" ? "#22a86e" : inv.status === "partial" ? "#d97706" : inv.status === "returned" ? "#7c3aed" : "#e03c3c";
    const sl = inv.status === "paid" ? "PAID" : inv.status === "partial" ? "PARTIAL" : inv.status === "returned" ? "RETURNED" : "DUE";
    return `<tr style="${i % 2 === 1 ? "background:#f8fafd;" : ""}">
      <td style="padding:9px 12px;font-family:monospace;font-size:11px;font-weight:700;color:#1057a0;">${inv.invNumber}</td>
      <td style="padding:9px 12px;font-size:12px;font-weight:600;color:#0a1628;">${inv.customerName}</td>
      <td style="padding:9px 12px;font-size:11px;color:#7a8baa;white-space:nowrap;">${fmtDate(inv.invoiceDate.split("T")[0])}</td>
      <td style="padding:9px 12px;font-size:10px;font-weight:700;color:${inv.type === "regular" ? "#1057a0" : "#22a86e"};">${inv.type === "regular" ? "Regular" : "Walk-in"}</td>
      <td style="padding:9px 12px;font-size:12px;font-weight:700;text-align:right;color:#0a1628;">Rs ${inv.total.toLocaleString()}</td>
      <td style="padding:9px 12px;font-size:12px;font-weight:600;text-align:right;color:#22a86e;">Rs ${inv.amountPaid.toLocaleString()}</td>
      <td style="padding:9px 12px;font-size:12px;font-weight:700;text-align:right;color:${inv.balanceDue > 0 ? "#e03c3c" : "#22a86e"};">Rs ${inv.balanceDue.toLocaleString()}</td>
      <td style="padding:9px 12px;text-align:center;"><span style="display:inline-block;padding:2px 9px;border-radius:10px;font-size:9px;font-weight:700;background:${sc}22;color:${sc};">${sl}</span></td>
    </tr>`;
  }).join("");

  const dateRangeStr = d.fromDate && d.toDate
    ? `${fmtDate(d.fromDate)} &ndash; ${fmtDate(d.toDate)}`
    : d.fromDate ? `From ${fmtDate(d.fromDate)}` : d.toDate ? `Until ${fmtDate(d.toDate)}` : "All Dates";
  const typeStr = d.typeFilter === "regular" ? "Regular Only" : d.typeFilter === "walk" ? "Walk-in Only" : "All Types";
  const customerStr = d.customerFilter.trim() || "All Customers";

  return `<div style="width:1050px;background:#fff;font-family:'Arial',sans-serif;">
  <div style="height:6px;background:linear-gradient(90deg,#0a1628,#1057a0,#2e8fe0);"></div>
  <div style="padding:28px 48px 22px;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid #e8eef7;">
    <div style="display:flex;align-items:center;gap:18px;">
      <img src="${d.logoUrl}" alt="Logo" style="width:68px;height:68px;object-fit:contain;flex-shrink:0;" />
      <div>
        <div style="font-size:21px;font-weight:900;color:#0a1628;letter-spacing:.3px;">GARMENTS</div>
        <div style="font-size:12px;color:#7a8baa;margin-top:3px;">Archer Road, Quetta</div>
        <div style="font-size:12px;color:#1057a0;margin-top:6px;">&#128222; 0333-7826435 / 0322-8152991</div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:26px;font-weight:900;color:#0a1628;letter-spacing:2px;line-height:1;">INVOICE REPORT</div>
      <div style="font-size:12px;color:#7a8baa;margin-top:6px;">Generated: ${printed()}</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr;background:#f4f7fc;border-bottom:2px solid #e8eef7;">
    <div style="padding:13px 48px;border-right:1px solid #e8eef7;">
      <div style="font-size:9px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-bottom:4px;">Date Range</div>
      <div style="font-size:13px;font-weight:700;color:#0a1628;">${dateRangeStr}</div>
    </div>
    <div style="padding:13px 24px;border-right:1px solid #e8eef7;">
      <div style="font-size:9px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-bottom:4px;">Invoice Type</div>
      <div style="font-size:13px;font-weight:700;color:#0a1628;">${typeStr}</div>
    </div>
    <div style="padding:13px 24px;">
      <div style="font-size:9px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-bottom:4px;">Customer Filter</div>
      <div style="font-size:13px;font-weight:700;color:#0a1628;">${customerStr}</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);border-bottom:2px solid #e8eef7;">
    <div style="padding:14px 24px;border-right:1px solid #e8eef7;text-align:center;">
      <div style="font-size:9px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-bottom:3px;">Total Invoices</div>
      <div style="font-size:24px;font-weight:900;color:#0a1628;">${d.invoices.length}</div>
    </div>
    <div style="padding:14px 24px;border-right:1px solid #e8eef7;text-align:center;">
      <div style="font-size:9px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-bottom:3px;">Total Income</div>
      <div style="font-size:18px;font-weight:900;color:#7c3aed;">Rs ${d.totalIncome.toLocaleString()}</div>
    </div>
    <div style="padding:14px 24px;border-right:1px solid #e8eef7;text-align:center;">
      <div style="font-size:9px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-bottom:3px;">Amount Received</div>
      <div style="font-size:18px;font-weight:900;color:#22a86e;">Rs ${d.totalReceived.toLocaleString()}</div>
    </div>
    <div style="padding:14px 24px;border-right:1px solid #e8eef7;text-align:center;">
      <div style="font-size:9px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-bottom:3px;">Balance Due</div>
      <div style="font-size:18px;font-weight:900;color:${d.totalDue > 0 ? "#e03c3c" : "#22a86e"};">Rs ${d.totalDue.toLocaleString()}</div>
    </div>
    <div style="padding:14px 24px;text-align:center;">
      <div style="font-size:9px;font-weight:700;color:#7a8baa;letter-spacing:.8px;text-transform:uppercase;margin-bottom:3px;">Refunded (${d.refundedCount})</div>
      <div style="font-size:18px;font-weight:900;color:#c00;">Rs ${d.totalRefunded.toLocaleString()}</div>
    </div>
  </div>
  <div style="padding:18px 48px 24px;">
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#0a1628;">
        <th style="padding:10px 12px;color:white;font-size:10px;font-weight:700;letter-spacing:.5px;text-align:left;text-transform:uppercase;">Invoice #</th>
        <th style="padding:10px 12px;color:white;font-size:10px;font-weight:700;text-align:left;text-transform:uppercase;">Customer</th>
        <th style="padding:10px 12px;color:white;font-size:10px;font-weight:700;text-align:left;text-transform:uppercase;">Date</th>
        <th style="padding:10px 12px;color:white;font-size:10px;font-weight:700;text-align:left;text-transform:uppercase;">Type</th>
        <th style="padding:10px 12px;color:white;font-size:10px;font-weight:700;text-align:right;text-transform:uppercase;">Total (Rs)</th>
        <th style="padding:10px 12px;color:white;font-size:10px;font-weight:700;text-align:right;text-transform:uppercase;">Received (Rs)</th>
        <th style="padding:10px 12px;color:white;font-size:10px;font-weight:700;text-align:right;text-transform:uppercase;">Due (Rs)</th>
        <th style="padding:10px 12px;color:white;font-size:10px;font-weight:700;text-align:center;text-transform:uppercase;">Status</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f4f7fc;border-top:2px solid #1057a0;">
          <td colspan="4" style="padding:10px 12px;font-size:12px;font-weight:800;color:#0a1628;letter-spacing:.3px;">TOTALS &mdash; ${d.invoices.length} invoice${d.invoices.length !== 1 ? "s" : ""}</td>
          <td style="padding:10px 12px;text-align:right;font-size:14px;font-weight:900;color:#0a1628;">Rs ${d.totalIncome.toLocaleString()}</td>
          <td style="padding:10px 12px;text-align:right;font-size:14px;font-weight:900;color:#22a86e;">Rs ${d.totalReceived.toLocaleString()}</td>
          <td style="padding:10px 12px;text-align:right;font-size:14px;font-weight:900;color:${d.totalDue > 0 ? "#e03c3c" : "#22a86e"};">Rs ${d.totalDue.toLocaleString()}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  </div>
  <div style="background:#0a1628;padding:9px 48px;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:10px;color:#5aabf0;">Garments &bull; Archer Road, Quetta &bull; 0333-7826435 / 0322-8152991</div>
    <div style="font-size:8px;color:#5aabf0;">Software Developed By: <strong style="color:#f0a500;">AddsMint.com</strong> &bull; Printed: ${printed()}</div>
  </div>
</div>`;
}

/* ═══ WHATSAPP MESSAGE BUILDER ══════════════════════ */
function buildWhatsAppMessage(inv: Invoice): string {
  const line  = "─────────────────────";
  const items = Array.isArray(inv.items) ? inv.items : [];

  const itemLines = items
    .map(it => {
      const desc  = it.dt.padEnd(22, " ").slice(0, 22);
      const qty   = `x${it.q}`;
      const amt   = `Rs ${it.a.toLocaleString()}`;
      return `  ${desc} ${qty.padStart(3)}   ${amt}`;
    })
    .join("\n");

  const dateStr     = fmtDate(inv.invoiceDate.split("T")[0]);
  const deliveryStr = inv.deliveryDate ? `\n*Delivery:* ${fmtDate(inv.deliveryDate.split("T")[0])}` : "";
  const discountStr = inv.discount > 0 ? `\nDiscount:   - Rs ${inv.discount.toLocaleString()}` : "";
  const dueColor    = inv.balanceDue > 0 ? "⚠️ " : "✅ ";

  return (
`🧾 *INVOICE — ${inv.invNumber}*
Garments
Archer Road, Quetta | 0333-7826435

${line}
*Customer:* ${inv.customerName}${inv.phone ? `\n*Phone:*    ${inv.phone}` : ""}${inv.address ? `\n*Address:*  ${inv.address}` : ""}
*Date:*     ${dateStr}${deliveryStr}
${line}

*ITEMS*
${itemLines}

${line}
Subtotal:   Rs ${inv.subtotal.toLocaleString()}${discountStr}
*TOTAL:     Rs ${inv.total.toLocaleString()}*
${line}
Paid:       Rs ${inv.amountPaid.toLocaleString()}
${dueColor}*Balance:   Rs ${Math.abs(inv.balanceDue).toLocaleString()}${inv.balanceDue < 0 ? " (CR)" : inv.balanceDue === 0 ? " (Clear)" : " Due"}*
${inv.paymentMethod ? `Payment:    ${inv.paymentMethod}` : ""}
${line}

🙏 *Thank you for your business!*
We appreciate your trust in Garments.
We look forward to serving you again.

_Software developed by AddsMint.com_`
  );
}

function formatWhatsAppPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("92") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return "92" + digits.slice(1);
  return "92" + digits;
}

function openWhatsApp(inv: Invoice) {
  const phone = formatWhatsAppPhone(inv.phone);
  const text  = encodeURIComponent(buildWhatsAppMessage(inv));
  const url   = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/* ═══ PDF DOWNLOAD FOR REPORT ════════════════════════ */
async function downloadReportPDF(params: {
  filtered: Invoice[];
  totalIncome: number; totalReceived: number; totalDue: number;
  totalRefunded: number; refundedCount: number;
  rptFrom: string; rptTo: string; rptType: string; rptCustomer: string;
}) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const { filtered, totalIncome, totalReceived, totalDue, totalRefunded, refundedCount, rptFrom, rptTo, rptType, rptCustomer } = params;

  const doc = new jsPDF({ orientation: "landscape" });

  // Header
  doc.setFontSize(18);
  doc.setTextColor(16, 87, 160);
  doc.text("Garments — Invoice Report", 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (rptFrom || rptTo) doc.text(`Period: ${rptFrom || "—"} to ${rptTo || "—"}`, 14, 25);
  const typeLabel = rptType === "regular" ? "Regular Only" : rptType === "walk" ? "Walk-in Only" : "All Types";
  doc.text(`Type: ${typeLabel}  |  Customer: ${rptCustomer.trim() || "All"}  |  Generated: ${new Date().toLocaleDateString("en-GB")}`, 14, 31);

  // Summary line
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.text(
    `Invoices: ${filtered.length}  |  Income: Rs ${totalIncome.toLocaleString()}  |  Received: Rs ${totalReceived.toLocaleString()}  |  Due: Rs ${totalDue.toLocaleString()}  |  Refunded (${refundedCount}): Rs ${totalRefunded.toLocaleString()}`,
    14, 38,
  );

  autoTable(doc, {
    startY: 42,
    head: [["Invoice #", "Customer", "Phone", "Date", "Type", "Total (Rs)", "Received (Rs)", "Due (Rs)", "Status"]],
    body: filtered.map(inv => [
      inv.invNumber,
      inv.customerName,
      inv.phone || "—",
      fmtDate(inv.invoiceDate.split("T")[0]),
      inv.type === "regular" ? "Regular" : "Walk-in",
      `Rs ${inv.total.toLocaleString()}`,
      `Rs ${inv.amountPaid.toLocaleString()}`,
      inv.balanceDue > 0 ? `Rs ${inv.balanceDue.toLocaleString()}` : "—",
      inv.status.toUpperCase(),
    ]),
    foot: [["", "", "", "", "TOTALS",
      `Rs ${totalIncome.toLocaleString()}`,
      `Rs ${totalReceived.toLocaleString()}`,
      totalDue > 0 ? `Rs ${totalDue.toLocaleString()}` : "—",
      "",
    ]],
    styles: { fontSize: 7 },
    headStyles: { fillColor: [16, 87, 160] },
    footStyles: { fillColor: [244, 247, 252], textColor: [10, 22, 40], fontStyle: "bold" },
    columnStyles: { 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } },
  });

  const dateTag = new Date().toISOString().slice(0, 10);
  doc.save(`Invoice-Report-${dateTag}.pdf`);
}

/* ═══════════════════════════════════════════════════════
   SEARCHABLE DROPDOWN COMPONENT
═══════════════════════════════════════════════════════ */
function SearchDropdown<T>({ options, value, placeholder, renderOption, renderValue, onSelect, getKey, filterFn, disabled }: {
  options: T[];
  value: T | null;
  placeholder: string;
  renderOption: (o: T) => React.ReactNode;
  renderValue: (o: T) => string;
  onSelect: (o: T) => void;
  getKey: (o: T) => string;
  filterFn: (o: T, q: string) => boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  // close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = q.trim() ? options.filter(o => filterFn(o, q.trim().toLowerCase())) : options;

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <div
        onClick={() => { if (!disabled) { setOpen(o => !o); setQ(""); } }}
        style={{
          ...inp,
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: value ? "white" : "white",
          color: value ? "var(--ink)" : "var(--muted)",
          userSelect: "none",
          opacity: disabled ? .55 : 1,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value ? renderValue(value) : placeholder}
        </span>
        <i className={`fa-solid fa-chevron-${open ? "up" : "down"}`} style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0, marginLeft: 6 }}></i>
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
          background: "white", border: "1.5px solid var(--bg2)", borderRadius: "var(--r2)",
          boxShadow: "0 8px 28px rgba(10,22,40,.14)", overflow: "hidden",
        }}>
          {/* Search input */}
          <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--bg2)", position: "relative" }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 11, pointerEvents: "none" }}></i>
            <input
              autoFocus
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search..."
              onClick={e => e.stopPropagation()}
              style={{ ...inp, padding: "6px 10px 6px 28px", fontSize: 12, border: "1px solid var(--bg2)" }}
            />
          </div>
          {/* Options list */}
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>No results</div>
            ) : (
              filtered.map(o => (
                <div
                  key={getKey(o)}
                  onMouseDown={e => { e.preventDefault(); onSelect(o); setOpen(false); setQ(""); }}
                  style={{
                    padding: "9px 14px", fontSize: 13, cursor: "pointer",
                    borderBottom: "1px solid var(--bg2)",
                    background: value && getKey(value) === getKey(o) ? "var(--blue5)" : "white",
                    color: value && getKey(value) === getKey(o) ? "var(--blue)" : "var(--ink)",
                  }}
                  onMouseEnter={e => { if (!(value && getKey(value) === getKey(o))) (e.currentTarget as HTMLElement).style.background = "var(--bg)"; }}
                  onMouseLeave={e => { if (!(value && getKey(value) === getKey(o))) (e.currentTarget as HTMLElement).style.background = "white"; }}
                >
                  {renderOption(o)}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════ */
export default function InvoicePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [stockItems, setStockItems] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  /* view invoice modal */
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  /* edit invoice modal */
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [editItems, setEditItems] = useState<InvItem[]>([]);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editAmountPaid, setEditAmountPaid] = useState(0);
  const [editDesc, setEditDesc] = useState("");
  const [editInvDate, setEditInvDate] = useState("");
  const [editDelDate, setEditDelDate] = useState("");
  const [editWalkName, setEditWalkName] = useState("");
  const [editWalkPhone, setEditWalkPhone] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState("Cash");
  const [editSaving, setEditSaving] = useState(false);

  /* form */
  const [formType] = useState<InvType>("walk");
  // regular — customer dropdown
  const [regCustomer, setRegCustomer] = useState<CustomerRow | null>(null);
  // walk-in
  const [walkName, setWalkName] = useState("");
  const [walkPhone, setWalkPhone] = useState("");
  // common
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [invDate, setInvDate] = useState(today());
  const [delDate, setDelDate] = useState(todayPlus(10));
  const [desc, setDesc] = useState("");
  const [items, setItems] = useState<InvItem[]>([{ dt: "", q: 1, r: 0, a: 0 }]);
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [toast, setToast] = useState("");
  // Advance available from the selected customer's credit balance
  const customerAdvance = Math.max(0, -(regCustomer?.balance ?? 0));
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  /* tabs */
  const [activeTab, setActiveTab] = useState<"invoice" | "report">("invoice");

  /* report filters — default to today */
  const [rptFrom, setRptFrom] = useState(today());
  const [rptTo, setRptTo] = useState(today());
  const [rptType, setRptType] = useState<"" | "regular" | "walk">("");
  const [rptCustomer, setRptCustomer] = useState("");

  const pdfRef = useRef<HTMLDivElement>(null);

  /* load data */
  const loadInvoices = () => {
    setLoading(true);
    fetch("/api/invoices").then(r => r.json()).then(d => { setInvoices(Array.isArray(d) ? d : []); setPage(1); setLoading(false); }).catch(() => setLoading(false));
  };

  const deleteInvoice = async (inv: Invoice) => {
    if (!window.confirm(`Delete invoice ${inv.invNumber}? This cannot be undone.`)) return;
    const res = await fetch(`/api/invoices/${inv.id}`, { method: "DELETE" });
    if (res.ok) {
      setInvoices(prev => prev.filter(i => i.id !== inv.id));
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to delete invoice");
    }
  };
  useEffect(() => {
    loadInvoices();
    fetch("/api/customers?lean=1").then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/stock?lean=1").then(r => r.json()).then(d => setStockItems(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  // Auto-fill amountPaid with available advance when a customer is selected
  useEffect(() => {
    if (!regCustomer) { setAmountPaid(0); return; }
    const advance = Math.max(0, -(regCustomer.balance ?? 0));
    if (advance > 0) setAmountPaid(advance);
    else setAmountPaid(0);
  }, [regCustomer]);

  /* calcs */
  const subtotal = items.reduce((s, i) => s + i.a, 0);
  const total = Math.max(0, subtotal - discount);
  const balanceDue = total - amountPaid;

  /* item helpers */
  const updateItem = (idx: number, field: keyof InvItem, val: string | number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const u = { ...item, [field]: val };
      if (field === "q" || field === "r") u.a = (field === "q" ? Number(val) : item.q) * (field === "r" ? Number(val) : item.r);
      return u;
    }));
  };
  const selectProduct = (idx: number, stock: StockRow) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      // For variant products hold off on price until a variant is chosen
      const r = stock.hasVariants ? 0 : stock.salesPrice;
      return { ...item, dt: stock.name, r, a: item.q * r, stockId: stock.id, variantId: undefined };
    }));
  };

  const selectVariant = (idx: number, variant: StockVariantRow, stockName: string) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const parts = [variant.size, variant.color].filter(Boolean);
      const label = parts.length ? ` (${parts.join(" / ")})` : "";
      // Prefer the variant's own salesPrice; fall back to the parent item's salesPrice
      const stock = stockItems.find(s => s.id === item.stockId);
      const r = (variant.salesPrice != null && variant.salesPrice > 0)
        ? variant.salesPrice
        : (stock ? stock.salesPrice : item.r);
      return { ...item, dt: `${stockName}${label}`, variantId: variant.id, r, a: item.q * r };
    }));
  };
  const addItem = () => setItems(prev => [...prev, { dt: "", q: 1, r: 0, a: 0 }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  /* Start a fresh walk-in invoice. */
  const resetForm = () => {
    setRegCustomer(null); setWalkName(""); setWalkPhone("");
    setPaymentMethod("Cash");
    setInvDate(today()); setDelDate(todayPlus(10)); setDesc("");
    setItems([{ dt: "", q: 1, r: 0, a: 0 }]);
    setDiscount(0); setAmountPaid(0);
  };

  /* toast */
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  /* shared — validates, posts to API, returns the saved invoice or null on failure */
  const persistInvoice = async (opts?: { amountPaidOverride?: number; balanceDueOverride?: number }): Promise<{ invNumber: string; id: string } | null> => {
    if (formType === "regular" && !regCustomer) { showToast("Please select a customer"); return null; }
    const validItems = items.filter(i => i.dt.trim());
    if (!validItems.length) { showToast("Add at least one item"); return null; }
    const effectiveAmountPaid = opts?.amountPaidOverride ?? amountPaid;
    const effectiveBalanceDue = opts?.balanceDueOverride ?? balanceDue;
    const body = {
      type: formType,
      customerId: formType === "regular" ? regCustomer?.id : null,
      customerName: formType === "regular" ? regCustomer!.name : walkName,
      phone: formType === "regular" ? regCustomer?.phone : walkPhone,
      address: formType === "regular" ? regCustomer?.address : null,
      invoiceDate: invDate,
      deliveryDate: formType === "regular" ? (delDate || null) : null,
      description: desc, items: validItems,
      subtotal, discount, total, amountPaid: effectiveAmountPaid, balanceDue: effectiveBalanceDue,
      paymentMethod,
    };
    const res = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { showToast("Failed to save invoice"); return null; }
    const saved = await res.json();
    loadInvoices();
    return { invNumber: saved.invNumber as string, id: saved.id as string };
  };

  /* save — walk-in saves as Due (amountPaid = 0) */
  const saveInvoice = async () => {
    setSaving(true);
    const result = await persistInvoice();
    if (result) showToast(`Invoice ${result.invNumber} saved!`);
    setSaving(false);
  };

  /* print — walk-in prints as Paid (amountPaid = total, balanceDue = 0) */
  const printInvoice = async () => {
    const validItems = items.filter(i => i.dt.trim());
    if (!validItems.length) { showToast("Add at least one item"); return; }
    setPdfLoading(true);
    await new Promise(r => setTimeout(r, 50));

    // For walk-in: save as Paid; for regular: save with whatever amountPaid is set
    const opts = formType === "walk" ? { amountPaidOverride: total, balanceDueOverride: 0 } : undefined;
    const result = await persistInvoice(opts);
    if (!result) { setPdfLoading(false); return; }

    showToast(`Invoice ${result.invNumber} saved!`);

    const logoUrl = `${window.location.origin}/logo.svg`;
    const effectivePaid = formType === "walk" ? total : amountPaid;
    const effectiveDue = formType === "walk" ? 0 : balanceDue;
    const base = {
      logoUrl, invNumber: result.invNumber, description: desc,
      items: validItems, sub: subtotal, dis: discount, tot: total, paid: effectivePaid, due: effectiveDue,
    };
    const html = formType === "walk"
      ? buildWalkHTML({ ...base, customerName: walkName, phone: walkPhone, invDate: fmtDate(invDate), paymentMethod })
      : buildRegularHTML({ ...base, customerName: regCustomer?.name ?? "", cid: regCustomer?.cid ?? "", phone: regCustomer?.phone ?? "", address: regCustomer?.address ?? "", invDate: fmtDate(invDate), delDate: fmtDate(delDate), paymentMethod });

    const pageStyle = formType === "walk"
      ? `@page{size:80mm auto;margin:0;}*{box-sizing:border-box;}html,body{width:72mm;margin:0;padding:0;}`
      : `@page{size:auto;margin:0;}html,body{margin:0;padding:0;}`;
    doPrint(html, pageStyle, `Invoice ${result.invNumber}`);
    setPdfLoading(false);
  };

  /* print existing invoice copy only (no status update) */
  const printInvoiceCopy = async (inv: Invoice) => {
    setPdfLoading(true);
    const logoUrl = `${window.location.origin}/logo.svg`;
    const validItems = Array.isArray(inv.items) ? inv.items : [];
    const base = {
      logoUrl, invNumber: inv.invNumber, description: inv.description ?? "",
      items: validItems, sub: inv.subtotal, dis: inv.discount, tot: inv.total,
      paid: inv.amountPaid, due: inv.balanceDue,
    };
    const html = inv.type === "walk"
      ? buildWalkHTML({ ...base, customerName: inv.customerName, phone: inv.phone ?? "", invDate: fmtDate(inv.invoiceDate), paymentMethod: inv.paymentMethod ?? "Cash" })
      : buildRegularHTML({ ...base, customerName: inv.customerName, cid: inv.customer?.cid ?? "", phone: inv.phone ?? "", address: inv.address ?? "", invDate: fmtDate(inv.invoiceDate), delDate: fmtDate(inv.deliveryDate ?? ""), paymentMethod: inv.paymentMethod ?? "Cash" });

    const pageStyle = inv.type === "walk"
      ? `@page{size:80mm auto;margin:0;}*{box-sizing:border-box;}html,body{width:72mm;margin:0;padding:0;}`
      : `@page{size:auto;margin:0;}html,body{margin:0;padding:0;}`;
    doPrint(html, pageStyle, `Invoice ${inv.invNumber}`);
    setPdfLoading(false);
  };

  /* print existing invoice from recent list — marks as Paid & prints */
  const printExistingInvoice = async (inv: Invoice) => {
    setPdfLoading(true);

    const res = await fetch(`/api/invoices/${inv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountPaid: inv.total, balanceDue: 0, status: "paid" }),
    });
    if (!res.ok) { showToast("Failed to update invoice status"); setPdfLoading(false); return; }

    loadInvoices();
    showToast(`Invoice ${inv.invNumber} marked as Paid`);

    const logoUrl = `${window.location.origin}/logo.svg`;
    const validItems = Array.isArray(inv.items) ? inv.items : [];
    const base = {
      logoUrl, invNumber: inv.invNumber, description: inv.description ?? "",
      items: validItems, sub: inv.subtotal, dis: inv.discount, tot: inv.total,
      paid: inv.total, due: 0,
    };
    const html = inv.type === "walk"
      ? buildWalkHTML({ ...base, customerName: inv.customerName, phone: inv.phone ?? "", invDate: fmtDate(inv.invoiceDate), paymentMethod: inv.paymentMethod ?? "Cash" })
      : buildRegularHTML({ ...base, customerName: inv.customerName, cid: inv.customer?.cid ?? "", phone: inv.phone ?? "", address: inv.address ?? "", invDate: fmtDate(inv.invoiceDate), delDate: fmtDate(inv.deliveryDate ?? ""), paymentMethod: inv.paymentMethod ?? "Cash" });

    const pageStyle = inv.type === "walk"
      ? `@page{size:80mm auto;margin:0;}*{box-sizing:border-box;}html,body{width:72mm;margin:0;padding:0;}`
      : `@page{size:auto;margin:0;}html,body{margin:0;padding:0;}`;
    doPrint(html, pageStyle, `Invoice ${inv.invNumber}`);
    setPdfLoading(false);
  };

  /* open edit modal — seed all state from the invoice */
  const openEditModal = (inv: Invoice) => {
    setEditInvoice(inv);
    setEditItems(inv.items?.length ? inv.items.map(i => ({ ...i })) : [{ dt: "", q: 1, r: 0, a: 0 }]);
    setEditDiscount(inv.discount);
    setEditAmountPaid(inv.amountPaid);
    setEditDesc(inv.description ?? "");
    setEditInvDate(inv.invoiceDate.split("T")[0]);
    setEditDelDate(inv.deliveryDate ? inv.deliveryDate.split("T")[0] : "");
    setEditWalkName(inv.customerName);
    setEditWalkPhone(inv.phone ?? "");
    setEditPaymentMethod(inv.paymentMethod ?? "Cash");
  };

  const updateEditItem = (idx: number, field: keyof InvItem, val: string | number) => {
    setEditItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const u = { ...item, [field]: val };
      if (field === "q" || field === "r") u.a = (field === "q" ? Number(val) : item.q) * (field === "r" ? Number(val) : item.r);
      return u;
    }));
  };

  const selectEditProduct = (idx: number, stock: StockRow) => {
    setEditItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const r = stock.hasVariants ? 0 : stock.salesPrice;
      return { ...item, dt: stock.name, r, a: item.q * r, stockId: stock.id, variantId: undefined };
    }));
  };

  const selectEditVariant = (idx: number, variant: StockVariantRow, stockName: string) => {
    setEditItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const parts = [variant.size, variant.color].filter(Boolean);
      const label = parts.length ? ` (${parts.join(" / ")})` : "";
      const stock = stockItems.find(s => s.id === item.stockId);
      const r = (variant.salesPrice != null && variant.salesPrice > 0)
        ? variant.salesPrice
        : (stock ? stock.salesPrice : item.r);
      return { ...item, dt: `${stockName}${label}`, variantId: variant.id, r, a: item.q * r };
    }));
  };

  const saveEditInvoice = async () => {
    if (!editInvoice) return;
    const validItems = editItems.filter(i => i.dt.trim());
    if (!validItems.length) { showToast("Add at least one item"); return; }
    const editSubtotal = validItems.reduce((s, i) => s + i.a, 0);
    const editTotal = Math.max(0, editSubtotal - editDiscount);
    const editBalanceDue = editTotal - editAmountPaid;
    const status = editBalanceDue <= 0 ? "paid" : editAmountPaid > 0 ? "partial" : "pending";
    setEditSaving(true);
    const body = {
      customerName: editInvoice.type === "walk" ? editWalkName : editInvoice.customerName,
      phone: editInvoice.type === "walk" ? editWalkPhone : editInvoice.phone,
      paymentMethod: editPaymentMethod,
      invoiceDate: editInvDate,
      deliveryDate: editInvoice.type === "regular" ? (editDelDate || null) : null,
      description: editDesc,
      items: validItems,
      subtotal: editSubtotal,
      discount: editDiscount,
      total: editTotal,
      amountPaid: editAmountPaid,
      balanceDue: editBalanceDue,
      status,
    };
    const res = await fetch(`/api/invoices/${editInvoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEditSaving(false);
    if (!res.ok) { showToast("Failed to update invoice"); return; }
    showToast(`Invoice ${editInvoice.invNumber} updated!`);
    setEditInvoice(null);
    loadInvoices();
  };

  const statusBadge = (s: string) => s === "paid" ? { bg: "#e6f9f2", color: "var(--green)", label: "Paid" } : s === "partial" ? { bg: "#fff8e6", color: "var(--gold)", label: "Part" } : s === "returned" ? { bg: "#f3eeff", color: "#7c3aed", label: "Returned" } : { bg: "#fff0f0", color: "var(--red)", label: "Due" };
  const invNumber = nextNum(invoices);

  return (
    <div style={{ animation: "pgIn .3s cubic-bezier(.16,1,.3,1)" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 9999, background: "var(--ink)", color: "white", padding: "12px 20px", borderRadius: 12, fontSize: 13, fontWeight: 500, boxShadow: "var(--shm)", display: "flex", alignItems: "center", gap: 10 }}>
          <i className="fa-solid fa-circle-check" style={{ color: "var(--blue4)" }}></i> {toast}
        </div>
      )}

      {/* Print loading */}
      {pdfLoading && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,.7)", backdropFilter: "blur(6px)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
          <div style={{ width: 48, height: 48, border: "4px solid rgba(255,255,255,.2)", borderTopColor: "var(--blue4)", borderRadius: "50%", animation: "spin .7s linear infinite" }}></div>
          <p style={{ color: "white", fontSize: 14, fontWeight: 600 }}>Preparing invoice...</p>
        </div>
      )}

      <div ref={pdfRef} style={{ position: "fixed", left: -9999, top: 0, zIndex: -1 }}></div>

      {/* ── Tab Bar ── */}
      <div style={{ display: "flex", borderBottom: "2px solid var(--bg2)", marginBottom: 20, gap: 4 }}>
        {(["invoice", "report"] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: "10px 22px", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              border: "none", borderBottom: activeTab === t ? "3px solid var(--blue2)" : "3px solid transparent",
              background: "none", color: activeTab === t ? "var(--blue2)" : "var(--muted)",
              cursor: "pointer", transition: "all .2s", marginBottom: -2,
              display: "flex", alignItems: "center", gap: 7,
            }}
          >
            <i className={`fa-solid ${t === "invoice" ? "fa-file-invoice" : "fa-chart-bar"}`}></i>
            {t === "invoice" ? "Invoices" : "Invoice Report"}
          </button>
        ))}
      </div>

      {/* ── Invoice Tab ── */}
      {activeTab === "invoice" && (
      <div className="inv-grid" style={{ display: "flex", flexDirection: "row", gap: 20, alignItems: "flex-start" }}>

        {/* ─── LEFT: Invoice Form ─── */}
        <div style={{ ...card, width: 480, flexShrink: 0, marginBottom: 0 }}>

          {/* Form */}
          {formType && (
            <div>
              {/* Form header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, paddingBottom: 14, borderBottom: "1.5px solid var(--bg2)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 13px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: formType === "regular" ? "var(--blue5)" : "#e6f9f2", color: formType === "regular" ? "var(--blue)" : "var(--green)" }}>
                    <i className={`fa-solid ${formType === "regular" ? "fa-user-check" : "fa-person-walking"}`}></i>
                    {formType === "regular" ? "Regular Customer" : "Walk-in Customer"}
                  </span>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 9 }}>
                    <i className="fa-solid fa-file-invoice" style={{ color: "var(--blue2)", fontSize: 15 }}></i> Create Invoice
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>Invoice: <strong style={{ color: "var(--blue)", fontFamily: "monospace" }}>#{invNumber}</strong></span>
                  <button onClick={resetForm} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: "transparent", color: "var(--blue)", border: "1.5px solid var(--bg3)", display: "flex", alignItems: "center", gap: 6 }}>
                    <i className="fa-solid fa-rotate-left"></i> New Invoice
                  </button>
                </div>
              </div>

              {/* ── Regular: customer name dropdown ── */}
              {formType === "regular" && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {/* Customer name dropdown */}
                    <div style={{ gridColumn: "span 2" }}>
                      <label style={lbl}>Customer Name *</label>
                      <SearchDropdown<CustomerRow>
                        options={customers}
                        value={regCustomer}
                        placeholder="Select a customer..."
                        getKey={c => c.id}
                        filterFn={(c, q) => c.name.toLowerCase().includes(q) || c.cid.toLowerCase().includes(q) || c.phone.includes(q)}
                        renderValue={c => c.name}
                        renderOption={c => (
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 10, marginTop: 2 }}>
                              <span style={{ fontFamily: "monospace", color: "var(--blue)", fontWeight: 700 }}>{c.cid}</span>
                              {c.phone && <span>{c.phone}</span>}
                            </div>
                          </div>
                        )}
                        onSelect={c => setRegCustomer(c)}
                      />
                    </div>
                    {/* Auto-filled readonly fields */}
                    <div>
                      <label style={lbl}>Customer ID</label>
                      <input type="text" value={regCustomer?.cid ?? ""} readOnly placeholder="Auto-filled" style={{ ...roInp, fontFamily: "monospace", fontWeight: 700, color: regCustomer ? "var(--blue)" : "var(--muted)" }} />
                    </div>
                    <div>
                      <label style={lbl}>Phone</label>
                      <input type="text" value={regCustomer?.phone ?? ""} readOnly placeholder="Auto-filled" style={{ ...roInp, fontSize: 12 }} />
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <label style={lbl}>Address</label>
                      <input type="text" value={regCustomer?.address ?? ""} readOnly placeholder="Auto-filled" style={{ ...roInp, fontSize: 12 }} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Walk-in: name + phone (both optional) ── */}
              {formType === "walk" && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={lbl}>Customer Name <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--muted)" }}>(Optional)</span></label>
                      <input type="text" placeholder="Walk-in Customer" value={walkName} onChange={e => setWalkName(e.target.value)} style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Phone <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--muted)" }}>(Optional)</span></label>
                      <input type="text" placeholder="03XX-XXXXXXX" value={walkPhone} onChange={e => setWalkPhone(e.target.value)} style={inp} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Common date / description fields ── */}
              <div style={{ display: "grid", gridTemplateColumns: formType === "regular" ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>Invoice Date</label>
                  <input type="date" value={invDate} onChange={e => setInvDate(e.target.value)} style={inp} />
                </div>
                {/* Delivery date only for Regular */}
                {formType === "regular" && (
                  <div>
                    <label style={lbl}>Delivery Date</label>
                    <input type="date" value={delDate} onChange={e => setDelDate(e.target.value)} style={inp} />
                  </div>
                )}
                <div style={{ gridColumn: formType === "regular" ? "span 2" : "span 1" }}>
                  <label style={lbl}>Order Description</label>
                  <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="e.g. Qameez Shalwar x2 (White Lawn), Waistcoat x1 (Black)" style={{ ...inp, resize: "vertical" }} />
                </div>
              </div>

              <div style={{ height: 1, background: "var(--bg2)", margin: "14px 0" }}></div>

              {/* ── Items table with product dropdown ── */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10 }}>
                <thead>
                  <tr style={{ background: "var(--ink)" }}>
                    <th style={th}>Product</th>
                    <th style={{ ...th, textAlign: "right", width: 60 }}>Qty</th>
                    <th style={{ ...th, textAlign: "right", width: 95 }}>Rate (Rs)</th>
                    <th style={{ ...th, textAlign: "right", width: 95 }}>Amount</th>
                    <th style={{ ...th, width: 32 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    // Match by stockId first (more reliable), fallback to name match
                    const matchedStock = item.stockId
                      ? (stockItems.find(s => s.id === item.stockId) ?? null)
                      : (stockItems.find(s => s.name === item.dt) ?? null);

                    const matchedVariant = (matchedStock?.hasVariants && item.variantId)
                      ? (matchedStock.variants.find(v => v.id === item.variantId) ?? null)
                      : null;

                    return (
                      <tr key={idx} style={{ borderBottom: "1px solid var(--bg2)" }}>
                        {/* Product dropdown + optional variant picker */}
                        <td style={{ padding: "6px 8px", minWidth: 180 }}>
                          <SearchDropdown<StockRow>
                            options={stockItems}
                            value={matchedStock}
                            placeholder="Select or type product..."
                            getKey={s => s.id}
                            filterFn={(s, q) => s.name.toLowerCase().includes(q)}
                            renderValue={s => s.name}
                            renderOption={s => (
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 12 }}>{s.name}</div>
                                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1, display: "flex", gap: 8 }}>
                                  <span>Rs {s.salesPrice.toLocaleString()} / {s.unit}</span>
                                  {s.hasVariants && <span style={{ color: "var(--blue)", fontWeight: 700 }}>· {s.variants.length} variants</span>}
                                </div>
                              </div>
                            )}
                            onSelect={s => selectProduct(idx, s)}
                          />

                          {/* Variant picker — shown when selected product has variants */}
                          {matchedStock?.hasVariants && matchedStock.variants.length > 0 && (
                            <div style={{ marginTop: 5 }}>
                              <select
                                value={item.variantId ?? ""}
                                onChange={e => {
                                  const v = matchedStock.variants.find(v => v.id === e.target.value);
                                  if (v) selectVariant(idx, v, matchedStock.name);
                                }}
                                style={{ ...inp, fontSize: 11, padding: "5px 8px", color: item.variantId ? "var(--ink)" : "var(--muted)" }}
                              >
                                <option value="">— Select variant (size / colour) —</option>
                                {matchedStock.variants.map(v => {
                                  const parts = [v.size, v.color].filter(Boolean);
                                  const label = parts.join(" / ");
                                  const avail = v.quantity > 0 ? `qty: ${v.quantity}` : "out of stock";
                                  const priceTag = v.salesPrice != null
                                    ? `Rs ${v.salesPrice.toLocaleString()}`
                                    : `Rs ${matchedStock.salesPrice.toLocaleString()} (base)`;
                                  return (
                                    <option key={v.id} value={v.id} disabled={v.quantity <= 0}>
                                      {label} — {priceTag} · {avail}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          )}

                          {/* Custom text override if no stock matched and dt is set */}
                          {!matchedStock && item.dt && (
                            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3, paddingLeft: 2 }}>
                              Custom: {item.dt}
                            </div>
                          )}
                          {/* Manual entry when nothing selected */}
                          {!item.dt && (
                            <input
                              type="text"
                              placeholder="or type manually..."
                              style={{ marginTop: 4, border: "none", background: "transparent", fontFamily: "inherit", fontSize: 11, color: "var(--muted)", width: "100%", outline: "none" }}
                              onChange={e => updateItem(idx, "dt", e.target.value)}
                            />
                          )}
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>
                          <input type="number" value={item.q} min={1} onChange={e => updateItem(idx, "q", e.target.value)} style={{ border: "none", background: "transparent", fontFamily: "inherit", fontSize: 13, width: 50, textAlign: "right", outline: "none" }} />
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>
                          <input type="number" value={item.r} min={0} onChange={e => updateItem(idx, "r", e.target.value)} style={{ border: "none", background: "transparent", fontFamily: "inherit", fontSize: 13, width: 80, textAlign: "right", outline: "none" }} />
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, fontSize: 13 }}>
                          Rs {item.a.toLocaleString()}
                        </td>
                        <td style={{ padding: "6px 4px", textAlign: "center" }}>
                          <button onClick={() => removeItem(idx)} disabled={items.length === 1} style={{ background: "none", border: "none", color: "var(--red)", cursor: items.length === 1 ? "not-allowed" : "pointer", fontSize: 13, padding: 4, opacity: items.length === 1 ? .3 : .6 }}
                            onMouseEnter={e => { if (items.length > 1) (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = items.length === 1 ? ".3" : ".6"; }}>
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <button onClick={addItem} style={{ marginBottom: 14, padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: "transparent", color: "var(--blue)", border: "1.5px solid var(--bg3)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <i className="fa-solid fa-plus"></i> Add Item
              </button>

              {/* ── Totals ── */}
              <div style={{ background: "var(--bg)", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <div style={{ display: "flex", gap: 30, fontSize: 13 }}>
                  <span style={{ color: "var(--muted)" }}>Subtotal:</span>
                  <span style={{ fontWeight: 600 }}>Rs {subtotal.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", gap: 30, fontSize: 13, alignItems: "center" }}>
                  <span style={{ color: "var(--muted)" }}>Discount (Rs):</span>
                  <input type="number" min={0} value={discount} onChange={e => setDiscount(Number(e.target.value))} style={{ width: 90, padding: "5px 9px", border: "1.5px solid var(--bg2)", borderRadius: 7, fontFamily: "inherit", fontSize: 13, outline: "none", textAlign: "right" }} />
                </div>
                <div style={{ display: "flex", gap: 30, fontSize: 16, fontWeight: 700, color: "var(--blue)", borderTop: "2px solid var(--bg2)", paddingTop: 8, marginTop: 4, width: "100%", justifyContent: "flex-end" }}>
                  <span>Total:</span><span>Rs {total.toLocaleString()}</span>
                </div>
              </div>

              {formType === "regular" ? (
                <div style={{ marginTop: 14 }}>
                  {/* ── Advance banner ── */}
                  {customerAdvance > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: "var(--r2)", background: "var(--blue5)", border: "1.5px solid var(--blue2)", marginBottom: 10, fontSize: 12, color: "var(--blue)", fontWeight: 600 }}>
                      <i className="fa-solid fa-circle-check" style={{ fontSize: 14, flexShrink: 0 }}></i>
                      <span>
                        Advance on account: <strong>Rs {customerAdvance.toLocaleString()}</strong>
                        {amountPaid > 0 && amountPaid <= customerAdvance
                          ? <span style={{ marginLeft: 8, color: "var(--green)" }}>— Rs {Math.min(amountPaid, customerAdvance).toLocaleString()} will be applied from advance</span>
                          : amountPaid > customerAdvance
                          ? <span style={{ marginLeft: 8, color: "var(--ink3)" }}>— Full advance applied + Rs {(amountPaid - customerAdvance).toLocaleString()} fresh cash</span>
                          : null}
                      </span>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={lbl}>Amount Paid (Rs)</label>
                      <input type="number" min={0} value={amountPaid} onChange={e => setAmountPaid(Number(e.target.value))} style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Balance Due (Rs)</label>
                      <input type="number" value={balanceDue} readOnly style={{ ...roInp, color: balanceDue > 0 ? "var(--red)" : "var(--green)", fontWeight: 700 }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--bg)", borderRadius: "var(--r2)", border: "1.5px solid var(--bg2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>Total Due</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>Rs {total.toLocaleString()}</span>
                </div>
              )}

              {/* ── Payment Method ── */}
              <div style={{ marginTop: 14 }}>
                <label style={lbl}>Payment Received By</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={inp}>
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank</option>
                  <option value="Mobile Wallet">Mobile Wallet</option>
                </select>
              </div>

              {/* ── Actions ── */}
              <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                <button onClick={saveInvoice} disabled={saving} style={{ padding: "9px 20px", borderRadius: 24, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 7, background: "linear-gradient(135deg,var(--blue),var(--blue2))", color: "white", border: "none", opacity: saving ? .7 : 1 }}>
                  <i className={`fa-solid ${saving ? "fa-spinner fa-spin" : "fa-floppy-disk"}`}></i>
                  {saving ? "Saving..." : "Save Invoice"}
                </button>
                <button onClick={printInvoice} style={{ padding: "9px 20px", borderRadius: 24, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, background: "linear-gradient(135deg,#22a86e,#1a8f5a)", color: "white", border: "none", boxShadow: "0 4px 16px rgba(34,168,110,.3)" }}>
                  <i className="fa-solid fa-print"></i>
                  {formType === "walk" ? "Print Receipt" : "Print Invoice"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT: Recent Invoices ─── */}
        <div style={{ ...card, flex: 1, minWidth: 0, marginBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 18, paddingBottom: 14, borderBottom: "1.5px solid var(--bg2)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 9 }}>
              <i className="fa-solid fa-list" style={{ color: "var(--blue2)", fontSize: 15 }}></i> Recent Invoices
            </div>
          </div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--muted)", fontSize: 13 }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 22, marginBottom: 10, display: "block" }}></i>
              Loading...
            </div>
          ) : invoices.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)" }}>
              <i className="fa-solid fa-file-invoice" style={{ fontSize: 28, marginBottom: 10, display: "block", opacity: .3 }}></i>
              <div style={{ fontWeight: 600, fontSize: 14 }}>No invoices yet</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Create your first invoice above</div>
            </div>
          ) : (
            (() => {
              const totalPages = Math.ceil(invoices.length / PAGE_SIZE);
              const pageInvoices = invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
              return (
                <>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "var(--ink)" }}>
                          <th style={{ ...th, width: 130 }}>Invoice</th>
                          <th style={th}>Customer</th>
                          <th style={{ ...th, textAlign: "right" }}>Amount</th>
                          <th style={th}>Type</th>
                          <th style={th}>Status</th>
                          <th style={{ ...th, width: 160, textAlign: "center" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageInvoices.map((inv, i) => {
                          const badge = statusBadge(inv.status);
                          return (
                            <tr key={inv.id} style={{ borderBottom: i < pageInvoices.length - 1 ? "1px solid var(--bg2)" : "none" }}>
                              <td style={{ padding: "10px 12px" }}>
                                <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, background: "var(--ink)", color: "var(--blue4)", padding: "3px 10px", borderRadius: 5, whiteSpace: "nowrap", display: "inline-block" }}>{inv.invNumber}</span>
                              </td>
                              <td style={{ padding: "10px 12px" }}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{inv.customerName}</div>
                                {inv.accountHeader && (
                                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, fontFamily: "monospace" }}>
                                    {inv.accountHeader.prefix}-HEAD
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13, fontWeight: 600 }}>Rs {inv.total.toLocaleString()}</td>
                              <td style={{ padding: "10px 12px" }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: inv.type === "regular" ? "var(--blue)" : "var(--green)" }}>
                                  {inv.type === "regular" ? "Regular" : "Walk-in"}
                                </span>
                              </td>
                              <td style={{ padding: "10px 12px" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.label}</span>
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, flexWrap: "wrap", justifyContent: "center" }}>
                                  <button
                                    onClick={() => setViewInvoice(inv)}
                                    title="View Invoice"
                                    style={{ padding: "4px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "linear-gradient(135deg,var(--blue),var(--blue2))", color: "white", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, boxShadow: "0 2px 6px rgba(16,87,160,.3)" }}
                                  >
                                    <i className="fa-solid fa-eye" style={{ fontSize: 9 }}></i> View
                                  </button>
                                  <button
                                    onClick={() => openWhatsApp(inv)}
                                    title="Send via WhatsApp"
                                    style={{ padding: "4px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "linear-gradient(135deg,#25d366,#128c7e)", color: "white", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, boxShadow: "0 2px 6px rgba(37,211,102,.3)" }}
                                  >
                                    <i className="fa-brands fa-whatsapp" style={{ fontSize: 11 }}></i> WA
                                  </button>
                                  <button
                                    onClick={() => deleteInvoice(inv)}
                                    title="Delete Invoice"
                                    style={{ padding: "4px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "linear-gradient(135deg,#e03c3c,#c02020)", color: "white", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, boxShadow: "0 2px 6px rgba(224,60,60,.3)" }}
                                  >
                                    <i className="fa-solid fa-trash" style={{ fontSize: 9 }}></i> Delete
                                  </button>
                                  {inv.status === "pending" && (
                                    <button
                                      onClick={() => openEditModal(inv)}
                                      title="Edit Invoice"
                                      style={{ padding: "4px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "white", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, boxShadow: "0 2px 6px rgba(245,158,11,.3)" }}
                                    >
                                      <i className="fa-solid fa-pen" style={{ fontSize: 9 }}></i> Edit
                                    </button>
                                  )}
                                  {inv.status !== "paid" && (
                                    <button
                                      onClick={() => printExistingInvoice(inv)}
                                      title="Mark as Paid & Print"
                                      style={{ padding: "4px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "linear-gradient(135deg,#22a86e,#1a8f5a)", color: "white", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, boxShadow: "0 2px 6px rgba(34,168,110,.3)" }}
                                    >
                                      <i className="fa-solid fa-print" style={{ fontSize: 9 }}></i> Print
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingTop: 14, borderTop: "1.5px solid var(--bg2)" }}>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, invoices.length)} of {invoices.length}
                      </span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                          style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: page === 1 ? "not-allowed" : "pointer", background: "transparent", color: page === 1 ? "var(--muted)" : "var(--blue)", border: "1.5px solid var(--bg3)", opacity: page === 1 ? .5 : 1 }}
                        >
                          <i className="fa-solid fa-chevron-left" style={{ fontSize: 10 }}></i> Prev
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                          <button
                            key={n}
                            onClick={() => setPage(n)}
                            style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "1.5px solid", borderColor: n === page ? "var(--blue)" : "var(--bg3)", background: n === page ? "var(--blue)" : "transparent", color: n === page ? "white" : "var(--ink3)" }}
                          >
                            {n}
                          </button>
                        ))}
                        <button
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                          style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: page === totalPages ? "not-allowed" : "pointer", background: "transparent", color: page === totalPages ? "var(--muted)" : "var(--blue)", border: "1.5px solid var(--bg3)", opacity: page === totalPages ? .5 : 1 }}
                        >
                          Next <i className="fa-solid fa-chevron-right" style={{ fontSize: 10 }}></i>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()
          )}
        </div>
      </div>
      )} {/* end invoice tab */}

      {/* ── Report Tab ── */}
      {activeTab === "report" && (() => {
        const from = rptFrom ? new Date(rptFrom + "T00:00:00") : null;
        const to   = rptTo   ? new Date(rptTo   + "T23:59:59") : null;
        const filtered = invoices.filter(inv => {
          const d = new Date(inv.invoiceDate);
          if (from && d < from) return false;
          if (to   && d > to)   return false;
          if (rptType && inv.type !== rptType) return false;
          if (rptCustomer.trim()) {
            const q = rptCustomer.trim().toLowerCase();
            if (!inv.customerName.toLowerCase().includes(q) && !(inv.customer?.cid ?? "").toLowerCase().includes(q)) return false;
          }
          return true;
        });

        const totalIncome   = filtered.reduce((s, i) => s + (i.status === "returned" ? i.amountPaid : i.total), 0);
        const totalReceived = filtered.reduce((s, i) => s + (i.status === "returned" ? 0 : i.amountPaid), 0);
        const totalDue      = filtered.reduce((s, i) => s + i.balanceDue, 0);
        const totalRefunded = filtered.reduce((s, i) => s + (i.status === "returned" ? Math.max(0, i.total - i.amountPaid) : 0), 0);
        const refundedCount = filtered.filter(i => i.status === "returned").length;

        const statCard = (icon: string, label: string, value: string, color: string, bg: string) => (
          <div style={{ background: bg, border: `1.5px solid ${color}33`, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color, flexShrink: 0 }}>
              <i className={`fa-solid ${icon}`}></i>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink3)", letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", lineHeight: 1 }}>{value}</div>
            </div>
          </div>
        );

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Filters */}
            <div style={{ ...card, marginBottom: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 16, display: "flex", alignItems: "center", gap: 9 }}>
                <i className="fa-solid fa-filter" style={{ color: "var(--blue2)", fontSize: 14 }}></i> Filters
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 12, alignItems: "flex-end" }}>
                <div>
                  <label style={lbl}>From Date</label>
                  <input type="date" value={rptFrom} onChange={e => setRptFrom(e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={lbl}>To Date</label>
                  <input type="date" value={rptTo} onChange={e => setRptTo(e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Invoice Type</label>
                  <select value={rptType} onChange={e => setRptType(e.target.value as "" | "regular" | "walk")} style={inp}>
                    <option value="">All Types</option>
                    <option value="regular">Regular</option>
                    <option value="walk">Walk-in</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Customer</label>
                  <input type="text" placeholder="Name or ID..." value={rptCustomer} onChange={e => setRptCustomer(e.target.value)} style={inp} />
                </div>
                <div>
                  <button
                    onClick={() => { setRptFrom(today()); setRptTo(today()); setRptType(""); setRptCustomer(""); }}
                    style={{ padding: "9px 16px", border: "1.5px solid var(--bg2)", borderRadius: "var(--r2)", background: "white", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "var(--ink3)", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
                  >
                    <i className="fa-solid fa-rotate-left" style={{ fontSize: 11 }}></i> Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
              {statCard("fa-file-invoice", "Total Invoices", filtered.length.toString(), "var(--blue)", "var(--blue5)")}
              {statCard("fa-circle-dollar-to-slot", "Total Income", `Rs ${totalIncome.toLocaleString()}`, "#7c3aed", "#f3eeff")}
              {statCard("fa-arrow-down-to-bracket", "Received", `Rs ${totalReceived.toLocaleString()}`, "var(--green)", "#e6f9f2")}
              {statCard("fa-clock-rotate-left", "Balance Due", `Rs ${totalDue.toLocaleString()}`, totalDue > 0 ? "var(--red)" : "var(--green)", totalDue > 0 ? "#fff0f0" : "#e6f9f2")}
              {statCard("fa-rotate-left", `Refunded (${refundedCount})`, `Rs ${totalRefunded.toLocaleString()}`, "#c00", "#fff0f0")}
            </div>

            {/* Report Table */}
            <div style={card}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <i className="fa-solid fa-table-list" style={{ color: "var(--blue2)", fontSize: 14 }}></i>
                  Invoice List
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)" }}>{filtered.length} invoice{filtered.length !== 1 ? "s" : ""}</span>
                  <button
                    onClick={() => downloadReportPDF({ filtered, totalIncome, totalReceived, totalDue, totalRefunded, refundedCount, rptFrom, rptTo, rptType, rptCustomer })}
                    style={{ padding: "7px 14px", border: "none", borderRadius: "var(--r2)", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "white", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 8px rgba(124,58,237,.3)" }}
                  >
                    <i className="fa-solid fa-file-pdf" style={{ fontSize: 11 }}></i> Download PDF
                  </button>
                  <button
                    onClick={() => {
                      const logoUrl = `${window.location.origin}/logo.svg`;
                      const html = buildReportHTML({ logoUrl, fromDate: rptFrom, toDate: rptTo, typeFilter: rptType, customerFilter: rptCustomer, invoices: filtered, totalIncome, totalReceived, totalDue, totalRefunded, refundedCount });
                      doPrint(html, `@page{size:A4 landscape;margin:8mm;}html,body{margin:0;padding:0;}`, "Invoice Report");
                    }}
                    style={{ padding: "7px 14px", border: "none", borderRadius: "var(--r2)", background: "var(--blue2)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "white", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <i className="fa-solid fa-print" style={{ fontSize: 11 }}></i> Print Report
                  </button>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)" }}>
                  <i className="fa-solid fa-file-invoice" style={{ fontSize: 28, display: "block", marginBottom: 10, opacity: .25 }}></i>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>No invoices match your filters</div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "var(--ink)" }}>
                        <th style={{ ...th, width: 130 }}>Invoice #</th>
                        <th style={th}>Customer</th>
                        <th style={th}>Date</th>
                        <th style={th}>Type</th>
                        <th style={{ ...th, textAlign: "right" }}>Total</th>
                        <th style={{ ...th, textAlign: "right" }}>Received</th>
                        <th style={{ ...th, textAlign: "right" }}>Due</th>
                        <th style={th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((inv, i) => {
                        const badge = statusBadge(inv.status);
                        return (
                          <tr key={inv.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--bg2)" : "none" }}>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, background: "var(--ink)", color: "var(--blue4)", padding: "3px 10px", borderRadius: 5, whiteSpace: "nowrap", display: "inline-block" }}>{inv.invNumber}</span>
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>{inv.customerName}</td>
                            <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtDate(inv.invoiceDate.split("T")[0])}</td>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: inv.type === "regular" ? "var(--blue)" : "var(--green)" }}>
                                {inv.type === "regular" ? "Regular" : "Walk-in"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13, fontWeight: 600 }}>Rs {inv.total.toLocaleString()}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13, color: "var(--green)", fontWeight: 600 }}>Rs {inv.amountPaid.toLocaleString()}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13, color: inv.balanceDue > 0 ? "var(--red)" : "var(--green)", fontWeight: 600 }}>Rs {inv.balanceDue.toLocaleString()}</td>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "var(--bg)", borderTop: "2px solid var(--bg2)" }}>
                        <td colSpan={4} style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "var(--ink3)" }}>TOTALS</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>Rs {totalIncome.toLocaleString()}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13, fontWeight: 800, color: "var(--green)" }}>Rs {totalReceived.toLocaleString()}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13, fontWeight: 800, color: totalDue > 0 ? "var(--red)" : "var(--green)" }}>Rs {totalDue.toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ═══ EDIT INVOICE MODAL ═══ */}
      {editInvoice && (() => {
        const editSubtotal = editItems.reduce((s, i) => s + i.a, 0);
        const editTotal = Math.max(0, editSubtotal - editDiscount);
        const editBalanceDue = editTotal - editAmountPaid;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,.6)", backdropFilter: "blur(4px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
            onClick={e => { if (e.target === e.currentTarget) setEditInvoice(null); }}>
            <div style={{ background: "white", borderRadius: 18, width: 680, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shm)", animation: "slideUp .3s cubic-bezier(.16,1,.3,1)" }}>
              {/* Header */}
              <div style={{ padding: "18px 24px", borderBottom: "1.5px solid var(--bg2)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg,#92400e,#d97706)", borderRadius: "18px 18px 0 0", position: "sticky", top: 0, zIndex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: "white", display: "flex", alignItems: "center", gap: 10 }}>
                  <i className="fa-solid fa-pen-to-square" style={{ color: "#fde68a" }}></i>
                  Edit Invoice <span style={{ fontFamily: "monospace", fontSize: 14, opacity: .9 }}>#{editInvoice.invNumber}</span>
                </div>
                <button onClick={() => setEditInvoice(null)} style={{ background: "none", border: "none", fontSize: 16, color: "rgba(255,255,255,.6)", cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>

                {/* Customer (walk-in editable, regular read-only) */}
                {editInvoice.type === "walk" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={lbl}>Customer Name</label>
                      <input type="text" value={editWalkName} onChange={e => setEditWalkName(e.target.value)} placeholder="Walk-in Customer" style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Phone</label>
                      <input type="text" value={editWalkPhone} onChange={e => setEditWalkPhone(e.target.value)} placeholder="03XX-XXXXXXX" style={inp} />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label style={lbl}>Customer</label>
                    <input type="text" value={editInvoice.customerName} readOnly style={roInp} />
                  </div>
                )}

                {/* Dates */}
                <div style={{ display: "grid", gridTemplateColumns: editInvoice.type === "regular" ? "1fr 1fr" : "1fr", gap: 12 }}>
                  <div>
                    <label style={lbl}>Invoice Date</label>
                    <input type="date" value={editInvDate} onChange={e => setEditInvDate(e.target.value)} style={inp} />
                  </div>
                  {editInvoice.type === "regular" && (
                    <div>
                      <label style={lbl}>Delivery Date</label>
                      <input type="date" value={editDelDate} onChange={e => setEditDelDate(e.target.value)} style={inp} />
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label style={lbl}>Order Description</label>
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} placeholder="e.g. Qameez Shalwar x2..." style={{ ...inp, resize: "vertical" }} />
                </div>

                {/* Items */}
                <div>
                  <label style={lbl}>Items</label>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
                    <thead>
                      <tr style={{ background: "var(--ink)" }}>
                        <th style={th}>Product / Description</th>
                        <th style={{ ...th, textAlign: "right", width: 60 }}>Qty</th>
                        <th style={{ ...th, textAlign: "right", width: 100 }}>Rate (Rs)</th>
                        <th style={{ ...th, textAlign: "right", width: 100 }}>Amount</th>
                        <th style={{ ...th, width: 36 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editItems.map((item, idx) => {
                        const matchedStock = item.stockId
                          ? (stockItems.find(s => s.id === item.stockId) ?? null)
                          : (stockItems.find(s => s.name === item.dt) ?? null);
                        const matchedVariant = (matchedStock?.hasVariants && item.variantId)
                          ? (matchedStock.variants.find(v => v.id === item.variantId) ?? null)
                          : null;
                        return (
                          <tr key={idx} style={{ borderBottom: "1px solid var(--bg2)" }}>
                            <td style={{ padding: "6px 8px", minWidth: 200 }}>
                              <SearchDropdown<StockRow>
                                options={stockItems}
                                value={matchedStock}
                                placeholder="Select or type product..."
                                getKey={s => s.id}
                                filterFn={(s, q) => s.name.toLowerCase().includes(q)}
                                renderValue={s => s.name}
                                renderOption={s => (
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: 12 }}>{s.name}</div>
                                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1, display: "flex", gap: 8 }}>
                                      <span>Rs {s.salesPrice.toLocaleString()} / {s.unit}</span>
                                      {s.hasVariants && <span style={{ color: "var(--blue)", fontWeight: 700 }}>· {s.variants.length} variants</span>}
                                    </div>
                                  </div>
                                )}
                                onSelect={s => selectEditProduct(idx, s)}
                              />
                              {matchedStock?.hasVariants && matchedStock.variants.length > 0 && (
                                <div style={{ marginTop: 5 }}>
                                  <select
                                    value={item.variantId ?? ""}
                                    onChange={e => {
                                      const v = matchedStock.variants.find(v => v.id === e.target.value);
                                      if (v) selectEditVariant(idx, v, matchedStock.name);
                                    }}
                                    style={{ ...inp, fontSize: 11, padding: "5px 8px", color: item.variantId ? "var(--ink)" : "var(--muted)" }}
                                  >
                                    <option value="">— Select variant —</option>
                                    {matchedStock.variants.map(v => {
                                      const parts = [v.size, v.color].filter(Boolean);
                                      const label = parts.join(" / ");
                                      const priceTag = v.salesPrice != null ? `Rs ${v.salesPrice.toLocaleString()}` : `Rs ${matchedStock.salesPrice.toLocaleString()} (base)`;
                                      return (
                                        <option key={v.id} value={v.id} disabled={v.quantity <= 0}>
                                          {label} — {priceTag} · {v.quantity > 0 ? `qty: ${v.quantity}` : "out of stock"}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                              )}
                              {!matchedStock && item.dt && (
                                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3, paddingLeft: 2 }}>Custom: {item.dt}</div>
                              )}
                              {!item.dt && (
                                <input
                                  type="text"
                                  placeholder="or type manually..."
                                  style={{ marginTop: 4, border: "none", background: "transparent", fontFamily: "inherit", fontSize: 11, color: "var(--muted)", width: "100%", outline: "none" }}
                                  onChange={e => updateEditItem(idx, "dt", e.target.value)}
                                />
                              )}
                            </td>
                            <td style={{ padding: "6px 8px", textAlign: "right" }}>
                              <input type="number" value={item.q} min={1} onChange={e => updateEditItem(idx, "q", e.target.value)} style={{ border: "none", background: "transparent", fontFamily: "inherit", fontSize: 13, width: 50, textAlign: "right", outline: "none" }} />
                            </td>
                            <td style={{ padding: "6px 8px", textAlign: "right" }}>
                              <input type="number" value={item.r} min={0} onChange={e => updateEditItem(idx, "r", e.target.value)} style={{ border: "none", background: "transparent", fontFamily: "inherit", fontSize: 13, width: 80, textAlign: "right", outline: "none" }} />
                            </td>
                            <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>
                              Rs {item.a.toLocaleString()}
                            </td>
                            <td style={{ padding: "6px 4px", textAlign: "center" }}>
                              <button onClick={() => setEditItems(prev => prev.filter((_, i) => i !== idx))} disabled={editItems.length === 1} style={{ background: "none", border: "none", color: "var(--red)", cursor: editItems.length === 1 ? "not-allowed" : "pointer", fontSize: 13, padding: 4, opacity: editItems.length === 1 ? .3 : .6 }}>
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <button onClick={() => setEditItems(prev => [...prev, { dt: "", q: 1, r: 0, a: 0 }])} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: "var(--bg)", color: "var(--blue)", border: "1.5px solid var(--bg3)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <i className="fa-solid fa-plus" style={{ fontSize: 10 }}></i> Add Item
                  </button>
                </div>

                {/* Totals & payment */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ minWidth: 260, background: "var(--bg)", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                      <label style={{ ...lbl, marginBottom: 0 }}>Discount (Rs)</label>
                      <input type="number" min={0} value={editDiscount} onChange={e => setEditDiscount(Number(e.target.value))} style={{ ...inp, width: 110, padding: "6px 10px", textAlign: "right" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: "var(--ink)", borderTop: "1.5px solid var(--bg2)", paddingTop: 10 }}>
                      <span>Total</span><span>Rs {editTotal.toLocaleString()}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                      <label style={{ ...lbl, marginBottom: 0 }}>Amount Paid (Rs)</label>
                      <input type="number" min={0} value={editAmountPaid} onChange={e => setEditAmountPaid(Number(e.target.value))} style={{ ...inp, width: 110, padding: "6px 10px", textAlign: "right" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: editBalanceDue > 0 ? "var(--red)" : "var(--green)" }}>
                      <span>Balance Due</span><span>Rs {editBalanceDue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <label style={lbl}>Payment Received By</label>
                  <select value={editPaymentMethod} onChange={e => setEditPaymentMethod(e.target.value)} style={inp}>
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank</option>
                    <option value="Mobile Wallet">Mobile Wallet</option>
                  </select>
                </div>

                {/* Footer actions */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1.5px solid var(--bg2)" }}>
                  <button onClick={() => setEditInvoice(null)} style={{ padding: "9px 20px", borderRadius: 24, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: "transparent", color: "var(--ink3)", border: "1.5px solid var(--bg3)", display: "flex", alignItems: "center", gap: 7 }}>
                    <i className="fa-solid fa-xmark"></i> Cancel
                  </button>
                  <button onClick={saveEditInvoice} disabled={editSaving} style={{ padding: "11px 28px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: editSaving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "white", border: "none", borderRadius: 24, opacity: editSaving ? .6 : 1, boxShadow: "0 4px 16px rgba(245,158,11,.3)" }}>
                    {editSaving ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving…</> : <><i className="fa-solid fa-floppy-disk"></i> Update Invoice</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ VIEW INVOICE MODAL ═══ */}
      {viewInvoice && (() => {
        const inv = viewInvoice;
        const badge = statusBadge(inv.status);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,.6)", backdropFilter: "blur(4px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
            onClick={e => { if (e.target === e.currentTarget) setViewInvoice(null); }}>
            <div style={{ background: "white", borderRadius: 18, width: 620, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shm)", animation: "slideUp .3s cubic-bezier(.16,1,.3,1)" }}>
              {/* Header */}
              <div style={{ padding: "18px 24px", borderBottom: "1.5px solid var(--bg2)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg,var(--ink),#0e3460)", borderRadius: "18px 18px 0 0", position: "sticky", top: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: "white", display: "flex", alignItems: "center", gap: 10 }}>
                  <i className="fa-solid fa-file-invoice" style={{ color: "var(--gold)" }}></i> Invoice Details
                </div>
                <button onClick={() => setViewInvoice(null)} style={{ background: "none", border: "none", fontSize: 16, color: "rgba(255,255,255,.6)", cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              {/* Body */}
              <div style={{ padding: 24 }}>
                {/* Invoice meta */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                  <div style={{ background: "var(--bg)", borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>Invoice #</div>
                    <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 15, color: "var(--blue)" }}>{inv.invNumber}</div>
                  </div>
                  <div style={{ background: "var(--bg)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>Status</div>
                      <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.label}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: inv.type === "regular" ? "var(--blue)" : "var(--green)", background: inv.type === "regular" ? "var(--blue5)" : "#e6f9f2", padding: "4px 10px", borderRadius: 20 }}>
                      {inv.type === "regular" ? "Regular" : "Walk-in"}
                    </span>
                  </div>
                  <div style={{ background: "var(--bg)", borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>Customer</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{inv.customerName}</div>
                    {inv.phone && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{inv.phone}</div>}
                    {inv.address && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{inv.address}</div>}
                  </div>
                  <div style={{ background: "var(--bg)", borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>Dates</div>
                    <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>Invoice: {fmtDate(inv.invoiceDate.split("T")[0])}</div>
                    {inv.deliveryDate && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Delivery: {fmtDate(inv.deliveryDate.split("T")[0])}</div>}
                  </div>
                </div>
                {inv.description && (
                  <div style={{ background: "#fffbea", border: "1.5px solid #ffe08a", borderRadius: 10, padding: "10px 16px", marginBottom: 20, fontSize: 13, color: "var(--ink)" }}>
                    <span style={{ fontWeight: 700, color: "var(--ink3)" }}>Order: </span>{inv.description}
                  </div>
                )}
                {/* Items table */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink3)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>Items</div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "var(--ink)" }}>
                        <th style={th}>Product / Description</th>
                        <th style={{ ...th, textAlign: "right", width: 55 }}>Qty</th>
                        <th style={{ ...th, textAlign: "right", width: 100 }}>Rate</th>
                        <th style={{ ...th, textAlign: "right", width: 100 }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(inv.items || []).map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid var(--bg2)" }}>
                          <td style={{ padding: "8px 12px", fontSize: 13 }}>{item.dt}</td>
                          <td style={{ padding: "8px 12px", fontSize: 13, textAlign: "right" }}>{item.q}</td>
                          <td style={{ padding: "8px 12px", fontSize: 13, textAlign: "right" }}>Rs {item.r.toLocaleString()}</td>
                          <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600, textAlign: "right" }}>Rs {item.a.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Totals */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ minWidth: 240, background: "var(--bg)", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)" }}>
                      <span>Subtotal</span><span>Rs {inv.subtotal.toLocaleString()}</span>
                    </div>
                    {inv.discount > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--red)" }}>
                        <span>Discount</span><span>- Rs {inv.discount.toLocaleString()}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: "var(--ink)", borderTop: "1.5px solid var(--bg2)", paddingTop: 8 }}>
                      <span>Total</span><span>Rs {inv.total.toLocaleString()}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--green)", fontWeight: 600 }}>
                      <span>Paid</span><span>Rs {inv.amountPaid.toLocaleString()}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: inv.balanceDue > 0 ? "var(--red)" : "var(--green)" }}>
                      <span>Balance Due</span><span>Rs {inv.balanceDue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, paddingTop: 12, borderTop: "1.5px solid var(--bg2)", flexWrap: "wrap", gap: 10 }}>
                  <button onClick={() => setViewInvoice(null)} style={{ padding: "9px 20px", borderRadius: 24, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: "transparent", color: "var(--ink3)", border: "1.5px solid var(--bg3)", display: "flex", alignItems: "center", gap: 7 }}>
                    <i className="fa-solid fa-xmark"></i> Close
                  </button>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={() => openWhatsApp(inv)} style={{ padding: "9px 20px", borderRadius: 24, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, background: "linear-gradient(135deg,#25d366,#128c7e)", color: "white", border: "none", boxShadow: "0 4px 16px rgba(37,211,102,.3)" }}>
                      <i className="fa-brands fa-whatsapp" style={{ fontSize: 15 }}></i> Send via WhatsApp
                    </button>
                    <button onClick={() => printInvoiceCopy(inv)} style={{ padding: "9px 20px", borderRadius: 24, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, background: "linear-gradient(135deg,#22a86e,#1a8f5a)", color: "white", border: "none", boxShadow: "0 4px 16px rgba(34,168,110,.3)" }}>
                      <i className="fa-solid fa-print"></i> Print Invoice
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
