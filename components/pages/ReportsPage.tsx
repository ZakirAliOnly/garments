"use client";
import React, { useState, useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ReportType = "invoice" | "refund" | "customer" | "stock" | "stock-by-product" | "batches" | "purchase";
type Phase = "filter" | "report";
type FilterMode = "daily" | "monthly" | "custom";

interface Filters {
  mode: FilterMode;
  date: string;
  month: string;
  from: string;
  to: string;
  productIds: string[];
}

interface InvoiceRow {
  invNumber: string;
  type: string;
  customerName: string;
  phone: string;
  invoiceDate: string;
  items: unknown;
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paymentMethod: string;
  status: string;
}

interface RefundRow {
  rrNumber: string;
  invoiceNumber: string;
  customerName: string;
  type: string;
  reason: string;
  amount: number;
  items: unknown;
  createdAt: string;
}

interface CustomerRow {
  cid: string;
  name: string;
  phone: string;
  address: string;
  totalOrders: number;
  totalSpent: number;
  lastPurchase: string | null;
  outstandingBalance: number;
}

interface StockVariantRow {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  quantity: number;
  openingStock: number;
  stockSold: number;
  stockReturned: number;
  closingStock: number;
  stockValue: number;
  costValue?: number;
  salesValue?: number;
}

interface StockRow {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  purchasePrice: number;
  salesPrice: number;
  hasVariants?: boolean;
  openingStock: number;
  stockAdded: number;
  stockSold: number;
  stockReturned: number;
  closingStock: number;
  stockValue?: number;
  costValue?: number;
  salesValue?: number;
  variants?: StockVariantRow[];
}

interface StockOption {
  id: string;
  code: string;
  name: string;
  category: string;
}

interface BatchRow {
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

interface PurchaseRow {
  id: string;
  poNumber: string;
  supplierName: string;
  supplierId: string;
  stockName: string;
  stockCode: string | null;
  qty: number;
  unitPrice: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
  dateTime: string;
  notes: string | null;
}

type ReportData =
  | { type: "invoice"; invoices: InvoiceRow[]; summary: Record<string, number> }
  | { type: "refund"; refunds: RefundRow[]; summary: Record<string, number> }
  | { type: "customer"; customers: CustomerRow[]; summary: Record<string, number> }
  | { type: "stock"; items: StockRow[]; summary: Record<string, number> }
  | { type: "stock-by-product"; items: StockRow[]; allStockItems: StockOption[]; summary: Record<string, number> }
  | { type: "batches"; batches: BatchRow[]; summary: Record<string, number> }
  | { type: "purchase"; purchases: PurchaseRow[]; summary: Record<string, number> };

// ─── Constants ────────────────────────────────────────────────────────────────

const REPORT_CARDS = [
  {
    id: "invoice" as ReportType,
    icon: "fa-file-invoice-dollar",
    title: "Invoice Report",
    desc: "Track all sales transactions, revenue & payment status",
    color: "#0064d5",
    badge: "Daily / Monthly / Custom",
  },
  {
    id: "refund" as ReportType,
    icon: "fa-rotate-left",
    title: "Refund / Replacement Report",
    desc: "Monitor returned or replaced items and refund amounts",
    color: "#0064d5",
    badge: "Daily / Monthly / Custom",
  },
  {
    id: "customer" as ReportType,
    icon: "fa-users",
    title: "Customer Report",
    desc: "Analyze customer behavior, spending & outstanding balances",
    color: "#0064d5",
    badge: "All-Time Snapshot",
  },
  {
    id: "stock" as ReportType,
    icon: "fa-boxes-stacked",
    title: "Stock Report",
    desc: "Monitor overall inventory movement, additions & sales",
    color: "#0064d5",
    badge: "Daily / Monthly / Custom",
  },
  {
    id: "stock-by-product" as ReportType,
    icon: "fa-chart-line",
    title: "Stock Report by Product",
    desc: "Deep analysis of specific products with date filters",
    color: "#0064d5",
    badge: "Multi-Select + Date",
  },
  {
    id: "batches" as ReportType,
    icon: "fa-layer-group",
    title: "Batch / COGS Report",
    desc: "View all stock batches, cost prices and FIFO consumption status",
    color: "#0064d5",
    badge: "All Batches",
  },
  {
    id: "purchase" as ReportType,
    icon: "fa-cart-flatbed",
    title: "Purchase Report",
    desc: "Track all supplier purchases, payments and outstanding balances",
    color: "#0064d5",
    badge: "Daily / Monthly / Custom",
  },
];

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

function monthRange(m: string): { from: string; to: string } {
  const [y, mo] = m.split("-").map(Number);
  const from = `${m}-01`;
  const last = new Date(y, mo, 0).getDate();
  const to = `${m}-${String(last).padStart(2, "0")}`;
  return { from, to };
}

function getDateRange(f: Filters): { from: string; to: string } | null {
  if (f.mode === "daily") return { from: f.date, to: f.date };
  if (f.mode === "monthly") return monthRange(f.month);
  if (f.mode === "custom" && f.from && f.to) return { from: f.from, to: f.to };
  return null;
}

function fmt(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function money(n: number): string {
  return "PKR " + n.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string }> = {
    paid: { bg: "rgba(34,168,110,.13)", color: "#22a86e" },
    pending: { bg: "rgba(224,60,60,.11)", color: "#e03c3c" },
    partial: { bg: "rgba(217,119,6,.13)", color: "#d97706" },
    refund: { bg: "rgba(224,60,60,.11)", color: "#e03c3c" },
    replace: { bg: "rgba(8,145,178,.13)", color: "#0891b2" },
  };
  const s = map[status] ?? { bg: "rgba(122,139,170,.12)", color: "#7a8baa" };
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      textTransform: "capitalize",
    }}>{status}</span>
  );
}

// ─── PDF Generation ───────────────────────────────────────────────────────────

async function downloadPDF(reportData: ReportData, filters: Filters, reportTitle: string) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape" });
  const range = getDateRange(filters);

  // Header
  doc.setFontSize(18);
  doc.setTextColor(16, 87, 160);
  doc.text("Garments — " + reportTitle, 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (range) doc.text(`Period: ${fmt(range.from)} – ${fmt(range.to)}`, 14, 25);
  doc.text(`Generated: ${fmt(today())}`, 14, 30);

  let startY = 36;

  if (reportData.type === "invoice") {
    const { invoices, summary } = reportData;
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(`Total: ${summary.total}  |  Revenue: ${money(summary.totalRevenue)}  |  Collected: ${money(summary.totalCollected)}  |  Outstanding: ${money(summary.totalOutstanding)}`, 14, startY);
    startY += 6;
    autoTable(doc, {
      startY,
      head: [["Invoice #", "Customer", "Phone", "Date", "Items", "Subtotal", "Discount", "Total", "Paid", "Balance", "Payment", "Status"]],
      body: invoices.map((inv) => {
        const items = Array.isArray(inv.items) ? (inv.items as Array<{ dt: string; q: number; r: number; a: number }>) : [];
        const itemSummary = items.map((it) => `${it.dt} ×${it.q}`).join(", ") || "—";
        return [
          inv.invNumber,
          inv.customerName,
          inv.phone || "—",
          fmt(inv.invoiceDate),
          itemSummary.length > 40 ? itemSummary.slice(0, 40) + "…" : itemSummary,
          money(inv.subtotal),
          inv.discount > 0 ? money(inv.discount) : "—",
          money(inv.total),
          money(inv.amountPaid),
          inv.balanceDue > 0 ? money(inv.balanceDue) : "—",
          inv.paymentMethod || "Cash",
          inv.status.toUpperCase(),
        ];
      }),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [16, 87, 160] },
    });
  } else if (reportData.type === "refund") {
    const { refunds, summary } = reportData;
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(`Total: ${summary.total}  |  Refunds: ${summary.refund}  |  Replacements: ${summary.replace}  |  Total Amount: ${money(summary.totalAmount)}`, 14, startY);
    startY += 6;
    autoTable(doc, {
      startY,
      head: [["RR #", "Invoice #", "Customer", "Type", "Reason", "Amount", "Date"]],
      body: refunds.map((r) => [
        r.rrNumber,
        r.invoiceNumber,
        r.customerName,
        r.type.toUpperCase(),
        r.reason || "—",
        money(r.amount),
        fmt(r.createdAt),
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [217, 119, 6] },
    });
  } else if (reportData.type === "customer") {
    const { customers, summary } = reportData;
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(`Total: ${summary.totalCustomers}  |  Active: ${summary.activeCustomers}  |  Revenue: ${money(summary.totalRevenue)}  |  Outstanding: ${money(summary.totalOutstanding)}`, 14, startY);
    startY += 6;
    autoTable(doc, {
      startY,
      head: [["Customer ID", "Name", "Phone", "Address", "Orders", "Total Spent", "Last Purchase", "Balance"]],
      body: customers.map((c) => [
        c.cid,
        c.name,
        c.phone,
        c.address || "—",
        c.totalOrders,
        money(c.totalSpent),
        fmt(c.lastPurchase),
        c.outstandingBalance > 0 ? money(c.outstandingBalance) + " DR" : c.outstandingBalance < 0 ? money(Math.abs(c.outstandingBalance)) + " CR" : "Clear",
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [34, 168, 110] },
    });
  } else if (reportData.type === "stock" || reportData.type === "stock-by-product") {
    const { items, summary } = reportData;
    const color = reportData.type === "stock" ? [124, 58, 237] : [8, 145, 178];
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(`Products: ${summary.totalItems ?? summary.totalProducts}  |  Total Sold: ${summary.totalSold}  |  Stock Value: ${money(summary.totalStockValue ?? summary.totalSalesValue)}`, 14, startY);
    startY += 6;
    autoTable(doc, {
      startY,
      head: [["Code", "Name", "Category", "Unit", "Opening", "Added", "Sold", "Returned", "Closing", "Value"]],
      body: items.map((s) => [
        s.code,
        s.name,
        s.category,
        s.unit,
        s.openingStock,
        s.stockAdded,
        s.stockSold,
        s.stockReturned,
        s.closingStock,
        money(s.salesValue ?? s.stockValue ?? 0),
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: color as [number, number, number] },
    });
  } else if (reportData.type === "purchase") {
    const { purchases, summary } = reportData;
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(`POs: ${summary.totalOrders}  |  Items: ${summary.totalItems}  |  Total: ${money(summary.grandTotal)}  |  Paid: ${money(summary.totalPaid)}  |  Due: ${money(summary.totalDue)}`, 14, startY);
    startY += 6;
    autoTable(doc, {
      startY,
      head: [["PO #", "Supplier", "Date", "Item", "Code", "Qty", "Rate", "Total", "Paid", "Balance", "Status"]],
      body: purchases.map((p) => [
        p.poNumber,
        p.supplierName,
        fmt(p.dateTime),
        p.stockName,
        p.stockCode || "—",
        p.qty,
        money(p.unitPrice),
        money(p.total),
        money(p.amountPaid),
        p.balanceDue > 0 ? money(p.balanceDue) : "—",
        p.status.toUpperCase(),
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [190, 18, 60] },
    });
  }

  doc.save(`${reportTitle.replace(/ /g, "-")}-${today()}.pdf`);
}

async function downloadSingleInvoicePDF(inv: InvoiceRow) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF();

  // Header
  doc.setFontSize(22);
  doc.setTextColor(16, 87, 160);
  doc.text("Garments", 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Tailor Management System", 14, 27);

  // Invoice info
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text(`Invoice: ${inv.invNumber}`, 140, 20);
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Date: ${fmt(inv.invoiceDate)}`, 140, 27);
  doc.text(`Status: ${inv.status.toUpperCase()}`, 140, 33);

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 36, 196, 36);

  // Customer
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text("Bill To:", 14, 44);
  doc.setFontSize(12);
  doc.text(inv.customerName, 14, 51);
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (inv.phone) doc.text(`Phone: ${inv.phone}`, 14, 57);

  // Items table
  const items = Array.isArray(inv.items) ? (inv.items as Array<{ dt: string; q: number; r: number; a: number }>) : [];
  autoTable(doc, {
    startY: 65,
    head: [["Description", "Qty", "Rate (PKR)", "Amount (PKR)"]],
    body: items.map((it) => [
      it.dt,
      it.q,
      it.r.toLocaleString("en-PK"),
      it.a.toLocaleString("en-PK"),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [16, 87, 160] },
    columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });

  const afterTable = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Totals
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("Subtotal:", 140, afterTable);
  doc.setTextColor(20, 20, 20);
  doc.text(`PKR ${inv.subtotal.toLocaleString("en-PK")}`, 196, afterTable, { align: "right" });

  if (inv.discount > 0) {
    doc.setTextColor(100, 100, 100);
    doc.text("Discount:", 140, afterTable + 7);
    doc.setTextColor(224, 60, 60);
    doc.text(`- PKR ${inv.discount.toLocaleString("en-PK")}`, 196, afterTable + 7, { align: "right" });
  }

  doc.setFontSize(11);
  doc.setTextColor(16, 87, 160);
  doc.text("Total:", 140, afterTable + (inv.discount > 0 ? 16 : 9));
  doc.setFontSize(12);
  doc.text(`PKR ${inv.total.toLocaleString("en-PK")}`, 196, afterTable + (inv.discount > 0 ? 16 : 9), { align: "right" });

  const baseY = afterTable + (inv.discount > 0 ? 25 : 18);
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Amount Paid: PKR ${inv.amountPaid.toLocaleString("en-PK")}`, 14, baseY);
  doc.text(`Balance Due: PKR ${inv.balanceDue.toLocaleString("en-PK")}`, 14, baseY + 7);
  doc.text(`Payment Method: ${inv.paymentMethod || "Cash"}`, 14, baseY + 14);

  doc.save(`Invoice-${inv.invNumber}.pdf`);
}

function printReport(reportData: ReportData, filters: Filters, reportTitle: string) {
  const range = getDateRange(filters);
  let tableHTML = "";

  if (reportData.type === "invoice") {
    const { invoices, summary } = reportData;
    tableHTML = `
      <div class="summary">
        <span>Total: <b>${summary.total}</b></span>
        <span>Revenue: <b>${money(summary.totalRevenue)}</b></span>
        <span>Collected: <b>${money(summary.totalCollected)}</b></span>
        <span>Outstanding: <b>${money(summary.totalOutstanding)}</b></span>
      </div>
      <table>
        <thead><tr>
          <th>Invoice #</th><th>Customer</th><th>Phone</th><th>Date</th>
          <th>Total</th><th>Paid</th><th>Balance</th><th>Payment</th><th>Status</th>
        </tr></thead>
        <tbody>${invoices.map((inv) => `<tr>
          <td>${inv.invNumber}</td><td>${inv.customerName}</td><td>${inv.phone || "—"}</td>
          <td>${fmt(inv.invoiceDate)}</td>
          <td class="num">${money(inv.total)}</td>
          <td class="num">${money(inv.amountPaid)}</td>
          <td class="num">${inv.balanceDue > 0 ? money(inv.balanceDue) : "—"}</td>
          <td>${inv.paymentMethod || "Cash"}</td>
          <td><span class="badge ${inv.status}">${inv.status}</span></td>
        </tr>`).join("")}</tbody>
      </table>`;
  } else if (reportData.type === "refund") {
    const { refunds, summary } = reportData;
    tableHTML = `
      <div class="summary">
        <span>Total: <b>${summary.total}</b></span>
        <span>Refunds: <b>${summary.refund}</b></span>
        <span>Replacements: <b>${summary.replace}</b></span>
        <span>Total Amount: <b>${money(summary.totalAmount)}</b></span>
      </div>
      <table>
        <thead><tr>
          <th>RR #</th><th>Invoice #</th><th>Customer</th><th>Type</th><th>Reason</th><th>Amount</th><th>Date</th>
        </tr></thead>
        <tbody>${refunds.map((r) => `<tr>
          <td>${r.rrNumber}</td><td>${r.invoiceNumber}</td><td>${r.customerName}</td>
          <td><span class="badge ${r.type}">${r.type}</span></td>
          <td>${r.reason || "—"}</td>
          <td class="num">${money(r.amount)}</td>
          <td>${fmt(r.createdAt)}</td>
        </tr>`).join("")}</tbody>
      </table>`;
  } else if (reportData.type === "customer") {
    const { customers, summary } = reportData;
    tableHTML = `
      <div class="summary">
        <span>Customers: <b>${summary.totalCustomers}</b></span>
        <span>Active: <b>${summary.activeCustomers}</b></span>
        <span>Revenue: <b>${money(summary.totalRevenue)}</b></span>
        <span>Outstanding: <b>${money(summary.totalOutstanding)}</b></span>
      </div>
      <table>
        <thead><tr>
          <th>ID</th><th>Name</th><th>Phone</th><th>Address</th><th>Orders</th><th>Total Spent</th><th>Last Purchase</th><th>Balance</th>
        </tr></thead>
        <tbody>${customers.map((c) => `<tr>
          <td>${c.cid}</td><td>${c.name}</td><td>${c.phone}</td><td>${c.address || "—"}</td>
          <td style="text-align:center">${c.totalOrders}</td>
          <td class="num">${money(c.totalSpent)}</td>
          <td>${fmt(c.lastPurchase)}</td>
          <td class="num">${c.outstandingBalance > 0 ? money(c.outstandingBalance) + " DR" : c.outstandingBalance < 0 ? money(Math.abs(c.outstandingBalance)) + " CR" : "Clear"}</td>
        </tr>`).join("")}</tbody>
      </table>`;
  } else if (reportData.type === "stock" || reportData.type === "stock-by-product") {
    const { items, summary } = reportData;
    tableHTML = `
      <div class="summary">
        <span>Products: <b>${summary.totalItems ?? summary.totalProducts}</b></span>
        <span>Total Sold: <b>${summary.totalSold}</b></span>
        <span>Stock Value: <b>${money(summary.totalStockValue ?? summary.totalSalesValue)}</b></span>
      </div>
      <table>
        <thead><tr>
          <th>Code</th><th>Name</th><th>Category</th><th>Unit</th>
          <th>Opening</th><th>Added</th><th>Sold</th><th>Returned</th><th>Closing</th><th>Value</th>
        </tr></thead>
        <tbody>${items.map((s) => `<tr>
          <td>${s.code}</td><td>${s.name}</td><td>${s.category}</td><td>${s.unit}</td>
          <td style="text-align:center">${s.openingStock}</td>
          <td style="text-align:center">${s.stockAdded}</td>
          <td style="text-align:center">${s.stockSold}</td>
          <td style="text-align:center">${s.stockReturned}</td>
          <td style="text-align:center"><b>${s.closingStock}</b></td>
          <td class="num">${money(s.salesValue ?? s.stockValue ?? 0)}</td>
        </tr>`).join("")}</tbody>
      </table>`;
  } else if (reportData.type === "purchase") {
    const { purchases, summary } = reportData;
    tableHTML = `
      <div class="summary">
        <span>POs: <b>${summary.totalOrders}</b></span>
        <span>Items: <b>${summary.totalItems}</b></span>
        <span>Grand Total: <b>${money(summary.grandTotal)}</b></span>
        <span>Paid: <b style="color:#22a86e">${money(summary.totalPaid)}</b></span>
        <span>Balance Due: <b style="color:#e03c3c">${money(summary.totalDue)}</b></span>
      </div>
      <table>
        <thead><tr>
          <th>PO #</th><th>Supplier</th><th>Date</th><th>Item</th><th>Code</th>
          <th>Qty</th><th>Rate</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th>
        </tr></thead>
        <tbody>${purchases.map((p) => `<tr>
          <td style="font-family:monospace;font-weight:700;color:#be123c">${p.poNumber}</td>
          <td>${p.supplierName}</td>
          <td>${fmt(p.dateTime)}</td>
          <td>${p.stockName}</td>
          <td style="font-family:monospace;font-size:10px">${p.stockCode || "—"}</td>
          <td style="text-align:center">${p.qty}</td>
          <td class="num">${money(p.unitPrice)}</td>
          <td class="num"><b>${money(p.total)}</b></td>
          <td class="num" style="color:#22a86e">${money(p.amountPaid)}</td>
          <td class="num" style="color:#e03c3c">${p.balanceDue > 0 ? money(p.balanceDue) : "—"}</td>
          <td><span class="badge ${p.status}">${p.status}</span></td>
        </tr>`).join("")}</tbody>
      </table>`;
  }

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${reportTitle}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a2e; padding: 20px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .co-name { font-size: 20px; font-weight: 700; color: #1057a0; }
  .co-sub { font-size: 10px; color: #666; }
  .report-title { font-size: 15px; font-weight: 700; margin-bottom: 3px; }
  .period { font-size: 10px; color: #666; }
  .summary { display: flex; gap: 24px; background: #f0f4fb; border-radius: 8px; padding: 10px 16px; margin-bottom: 14px; flex-wrap: wrap; }
  .summary span { font-size: 11px; color: #555; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1057a0; color: white; padding: 6px 8px; text-align: left; font-size: 10px; font-weight: 600; }
  td { padding: 5px 8px; border-bottom: 1px solid #e8edf5; font-size: 10px; }
  tr:nth-child(even) td { background: #f8faff; }
  .num { text-align: right; }
  .badge { padding: 2px 7px; border-radius: 10px; font-size: 9px; font-weight: 600; text-transform: capitalize; }
  .badge.paid { background: #d1fae5; color: #065f46; }
  .badge.pending { background: #fee2e2; color: #991b1b; }
  .badge.partial { background: #fef3c7; color: #92400e; }
  .badge.refund { background: #fee2e2; color: #991b1b; }
  .badge.replace { background: #cffafe; color: #155e75; }
  @media print { body { padding: 10px; } }
</style>
</head><body>
  <div class="header">
    <div>
      <div class="co-name">Garments</div>
      <div class="co-sub">Tailor Management System</div>
    </div>
    <div style="text-align:right">
      <div class="report-title">${reportTitle}</div>
      ${range ? `<div class="period">Period: ${fmt(range.from)} – ${fmt(range.to)}</div>` : ""}
      <div class="period">Generated: ${fmt(today())}</div>
    </div>
  </div>
  ${tableHTML}
</body></html>`;

  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType | null>(null);
  const [phase, setPhase] = useState<Phase>("filter");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [stockOptions, setStockOptions] = useState<StockOption[]>([]);
  const [stockSearch, setStockSearch] = useState("");
  const [batchSearch, setBatchSearch] = useState("");
  const [filters, setFilters] = useState<Filters>({
    mode: "monthly",
    date: today(),
    month: thisMonth(),
    from: "",
    to: "",
    productIds: [],
  });

  // Load stock options when stock-by-product report is opened
  useEffect(() => {
    if (activeReport === "stock-by-product" && stockOptions.length === 0) {
      fetch("/api/reports/stock-by-product")
        .then((r) => r.json())
        .then((d) => { if (d.allStockItems) setStockOptions(d.allStockItems); })
        .catch(() => {});
    }
  }, [activeReport, stockOptions.length]);

  function openReport(type: ReportType) {
    setActiveReport(type);
    setPhase("filter");
    setReportData(null);
    setBatchSearch("");
  }

  function closeModal() {
    setActiveReport(null);
    setPhase("filter");
    setReportData(null);
  }

  async function generateReport() {
    if (!activeReport) return;
    const range = activeReport === "customer" ? null : getDateRange(filters);

    const params = new URLSearchParams();
    if (range) { params.set("from", range.from); params.set("to", range.to); }
    if (activeReport === "stock-by-product" && filters.productIds.length > 0) {
      params.set("ids", filters.productIds.join(","));
    }

    // Batches report fetches directly from the batches endpoint (no date filter)
    if (activeReport === "batches") {
      setLoading(true);
      try {
        const batchParams = new URLSearchParams();
        if (batchSearch.trim()) batchParams.set("batchNumber", batchSearch.trim());
        const res = await fetch(`/api/batches${batchParams.toString() ? `?${batchParams}` : ""}`);
        const data: BatchRow[] = await res.json();
        if (res.ok) {
          const batchList = Array.isArray(data) ? data : [];
          const totalValue = batchList.reduce((s, b) => s + b.remaining * b.costPrice, 0);
          const totalCost = batchList.reduce((s, b) => s + b.qty * b.costPrice, 0);
          setReportData({
            type: "batches",
            batches: batchList,
            summary: {
              total: batchList.length,
              active: batchList.filter(b => b.remaining > 0).length,
              depleted: batchList.filter(b => b.remaining <= 0).length,
              totalValue: Math.round(totalValue),
              totalCost: Math.round(totalCost),
            },
          });
          setPhase("report");
        }
      } catch { /* silently fail */ }
      finally { setLoading(false); }
      return;
    }

    const apiPath: Record<Exclude<ReportType, "batches">, string> = {
      "invoice": "invoices",
      "refund": "refunds",
      "customer": "customers",
      "stock": "stock",
      "stock-by-product": "stock-by-product",
      "purchase": "purchases",
    };
    const url = `/api/reports/${apiPath[activeReport as Exclude<ReportType, "batches">]}?${params.toString()}`;
    setLoading(true);
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setReportData({ ...data, type: activeReport } as ReportData);
        setPhase("report");
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  const activeCard = REPORT_CARDS.find((c) => c.id === activeReport);

  // ─── Filter Panel ─────────────────────────────────────────────────────────

  function renderFilterPanel() {
    const isCustomer = activeReport === "customer";
    const isBatches = activeReport === "batches";
    const isStockByProduct = activeReport === "stock-by-product";
    const filteredStockOptions = stockOptions.filter(
      (s) =>
        s.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
        s.code.toLowerCase().includes(stockSearch.toLowerCase()) ||
        s.category.toLowerCase().includes(stockSearch.toLowerCase())
    );

    return (
      <div style={{ padding: "24px" }}>
        {isBatches && (
          <div>
            <div style={{ background: "#f5f3ff", border: "1.5px solid #ddd6fe", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#7c3aed", display: "flex", alignItems: "center", gap: 8 }}>
                <i className="fa-solid fa-layer-group"></i>
                This report shows all batches across all products with current FIFO status.
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>No date filter needed — click Generate to view all batches.</div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                Filter by Batch Number <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. BATCH-0001"
                value={batchSearch}
                onChange={(e) => setBatchSearch(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>
          </div>
        )}
        {!isCustomer && !isBatches && (
          <>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>Select date range for this report</p>
            {/* Mode tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {(["daily", "monthly", "custom"] as FilterMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setFilters((f) => ({ ...f, mode: m }))}
                  style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                    border: "1.5px solid",
                    borderColor: filters.mode === m ? activeCard!.color : "var(--bg2)",
                    background: filters.mode === m ? activeCard!.color : "white",
                    color: filters.mode === m ? "white" : "var(--muted)",
                    cursor: "pointer", transition: "all .2s",
                  }}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>

            {/* Date inputs */}
            {filters.mode === "daily" && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Select Date</label>
                <input type="date" value={filters.date} max={today()}
                  onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
                  style={inputStyle} />
              </div>
            )}
            {filters.mode === "monthly" && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Select Month</label>
                <input type="month" value={filters.month} max={thisMonth()}
                  onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value }))}
                  style={inputStyle} />
              </div>
            )}
            {filters.mode === "custom" && (
              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>From Date</label>
                  <input type="date" value={filters.from} max={today()}
                    onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>To Date</label>
                  <input type="date" value={filters.to} min={filters.from} max={today()}
                    onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                    style={inputStyle} />
                </div>
              </div>
            )}
          </>
        )}

        {isCustomer && (
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, lineHeight: 1.6 }}>
            The Customer Report is an all-time snapshot showing total orders, spending, and outstanding balances for all customers. No date filter needed.
          </p>
        )}

        {/* Product multi-select for stock-by-product */}
        {isStockByProduct && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Select Products (leave empty for all)</label>
            <input
              type="text" placeholder="Search products…" value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
              style={{ ...inputStyle, marginBottom: 8 }}
            />
            <div style={{
              border: "1.5px solid var(--bg2)", borderRadius: 8,
              maxHeight: 200, overflowY: "auto", background: "var(--bg)",
            }}>
              {filteredStockOptions.map((s) => {
                const checked = filters.productIds.includes(s.id);
                return (
                  <label key={s.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 12px", cursor: "pointer",
                    background: checked ? "rgba(8,145,178,.07)" : "transparent",
                    borderBottom: "1px solid var(--bg2)",
                  }}>
                    <input type="checkbox" checked={checked}
                      onChange={() => setFilters((f) => ({
                        ...f,
                        productIds: checked
                          ? f.productIds.filter((id) => id !== s.id)
                          : [...f.productIds, s.id],
                      }))}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{s.code} · {s.category}</div>
                    </div>
                  </label>
                );
              })}
              {filteredStockOptions.length === 0 && (
                <div style={{ padding: "16px", textAlign: "center", color: "var(--muted)", fontSize: 12 }}>No products found</div>
              )}
            </div>
            {filters.productIds.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
                {filters.productIds.length} product(s) selected
                <button data-ui-action="danger" onClick={() => setFilters((f) => ({ ...f, productIds: [] }))}
                  style={{ marginLeft: 8, border: "none", background: "none", color: "var(--red)", cursor: "pointer", fontSize: 11 }}>
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}

        <button data-ui-action="primary"
          onClick={generateReport}
          disabled={loading}
          style={{
            width: "100%", padding: "12px", borderRadius: 10, border: "none",
            background: loading ? "var(--bg2)" : activeCard!.color,
            color: loading ? "var(--muted)" : "white",
            fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {loading ? (
            <><i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 14 }}></i> Generating…</>
          ) : (
            <><i className="fa-solid fa-chart-bar" style={{ fontSize: 14 }}></i> Generate Report</>
          )}
        </button>
      </div>
    );
  }

  // ─── Report Data Panel ────────────────────────────────────────────────────

  function renderReportPanel() {
    if (!reportData) return null;
    const range = getDateRange(filters);

    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        {/* Summary strip (fixed at top of content) */}
        <div style={{ padding: "12px 24px 8px" }}>
          {renderSummary()}
        </div>

        {/* Scrollable table area */}
        <div style={{ flex: 1, minHeight: 0, padding: "0 24px 12px", overflowY: "auto" }}>
          <div style={{ overflowX: "auto", border: "1.5px solid var(--bg2)", borderRadius: 10, marginBottom: 8 }}>
            {renderTable()}
          </div>
        </div>

        {/* Action buttons (fixed at bottom of content) */}
        <div style={{ padding: "8px 24px 16px", borderTop: "1px solid var(--bg2)", display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button data-ui-action="secondary"
            onClick={() => { if (reportData && activeCard) printReport(reportData, filters, activeCard.title); }}
            style={{ ...actionBtn, background: "var(--ink)", color: "white" }}
          >
            <i className="fa-solid fa-print"></i> Print
          </button>
          <button data-ui-action="secondary"
            onClick={() => { if (reportData && activeCard) downloadPDF(reportData, filters, activeCard.title); }}
            style={{ ...actionBtn, background: "#e03c3c", color: "white" }}
          >
            <i className="fa-solid fa-file-pdf"></i> Download PDF
          </button>
          {range && (
            <span style={{ fontSize: 11, color: "var(--muted)", alignSelf: "center", marginLeft: 4 }}>
              {fmt(range.from)} – {fmt(range.to)}
            </span>
          )}
          <button data-ui-action="secondary"
            onClick={() => { setPhase("filter"); setReportData(null); }}
            style={{ ...actionBtn, background: "var(--bg2)", color: "var(--ink)", marginLeft: "auto" }}
          >
            <i className="fa-solid fa-sliders"></i> Change Filters
          </button>
        </div>
      </div>
    );
  }

  function renderSummary() {
    if (!reportData) return null;
    const items: { label: string; value: string; color?: string }[] = [];

    if (reportData.type === "invoice") {
      const s = reportData.summary;
      items.push(
        { label: "Total Invoices", value: String(s.total) },
        { label: "Revenue", value: money(s.totalRevenue), color: "var(--green)" },
        { label: "Collected", value: money(s.totalCollected), color: "var(--blue)" },
        { label: "Outstanding", value: money(s.totalOutstanding), color: "var(--red)" },
        { label: "Paid", value: String(s.paid), color: "var(--green)" },
        { label: "Partial", value: String(s.partial), color: "#d97706" },
        { label: "Pending", value: String(s.pending), color: "var(--red)" },
      );
    } else if (reportData.type === "refund") {
      const s = reportData.summary;
      items.push(
        { label: "Total RRs", value: String(s.total) },
        { label: "Refunds", value: String(s.refund), color: "var(--red)" },
        { label: "Replacements", value: String(s.replace), color: "#0891b2" },
        { label: "Total Amount", value: money(s.totalAmount), color: "var(--red)" },
      );
    } else if (reportData.type === "customer") {
      const s = reportData.summary;
      items.push(
        { label: "Total Customers", value: String(s.totalCustomers) },
        { label: "Active", value: String(s.activeCustomers), color: "var(--green)" },
        { label: "No Orders", value: String(s.newCustomers), color: "var(--muted)" },
        { label: "Total Revenue", value: money(s.totalRevenue), color: "var(--green)" },
        { label: "Outstanding", value: money(s.totalOutstanding), color: "var(--red)" },
      );
    } else if (reportData.type === "stock" || reportData.type === "stock-by-product") {
      const s = reportData.summary;
      items.push(
        { label: "Products", value: String(s.totalItems ?? s.totalProducts) },
        { label: "Total Added", value: String(s.totalAdded ?? "—") },
        { label: "Total Sold", value: String(s.totalSold) },
        { label: "Stock Value", value: money(s.totalStockValue ?? s.totalSalesValue) },
      );
    } else if (reportData.type === "batches") {
      const s = reportData.summary;
      items.push(
        { label: "Total Batches", value: String(s.total) },
        { label: "Active", value: String(s.active), color: "var(--green)" },
        { label: "Depleted", value: String(s.depleted), color: "var(--muted)" },
        { label: "Remaining Value", value: money(s.totalValue), color: "#7c3aed" },
        { label: "Total Cost", value: money(s.totalCost) },
      );
    } else if (reportData.type === "purchase") {
      const s = reportData.summary;
      items.push(
        { label: "Line Items", value: String(s.totalItems) },
        { label: "POs", value: String(s.totalOrders) },
        { label: "Grand Total", value: money(s.grandTotal), color: "var(--ink)" },
        { label: "Total Paid", value: money(s.totalPaid), color: "var(--green)" },
        { label: "Balance Due", value: money(s.totalDue), color: s.totalDue > 0 ? "var(--red)" : "var(--green)" },
        { label: "Paid", value: String(s.paid), color: "var(--green)" },
        { label: "Partial", value: String(s.partial), color: "#d97706" },
        { label: "Pending", value: String(s.pending), color: "var(--red)" },
      );
    }

    return (
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16,
        background: "var(--bg)", borderRadius: 10, padding: "12px 16px",
      }}>
        {items.map((it) => (
          <div key={it.label} style={{ minWidth: 100 }}>
            <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 500 }}>{it.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: it.color ?? "var(--ink)" }}>{it.value}</div>
          </div>
        ))}
      </div>
    );
  }

  function renderTable() {
    if (!reportData) return null;

    const thStyle: React.CSSProperties = {
      padding: "9px 12px", background: "var(--bg)", fontSize: 11, fontWeight: 700,
      color: "var(--muted)", textAlign: "left", whiteSpace: "nowrap",
      borderBottom: "1.5px solid var(--bg2)",
    };
    const tdStyle: React.CSSProperties = {
      padding: "9px 12px", fontSize: 12, color: "var(--ink)",
      borderBottom: "1px solid var(--bg2)", whiteSpace: "nowrap",
    };

    if (reportData.type === "invoice") {
      const { invoices } = reportData;
      return (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={thStyle}>Invoice #</th>
              <th style={thStyle}>Customer</th>
              <th style={thStyle}>Phone</th>
              <th style={thStyle}>Date</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Paid</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Balance</th>
              <th style={thStyle}>Payment</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr><td colSpan={9} style={{ ...tdStyle, textAlign: "center", color: "var(--muted)", padding: 24 }}>No invoices found for this period</td></tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.invNumber} style={{ transition: "background .15s" }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--bg)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "white"}
              >
                <td style={{ ...tdStyle, fontWeight: 600, color: "var(--blue)" }}>{inv.invNumber}</td>
                <td style={tdStyle}>{inv.customerName}</td>
                <td style={{ ...tdStyle, color: "var(--muted)" }}>{inv.phone || "—"}</td>
                <td style={{ ...tdStyle, color: "var(--muted)" }}>{fmt(inv.invoiceDate)}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{money(inv.total)}</td>
                <td style={{ ...tdStyle, textAlign: "right", color: "var(--green)" }}>{money(inv.amountPaid)}</td>
                <td style={{ ...tdStyle, textAlign: "right", color: inv.balanceDue > 0 ? "var(--red)" : "var(--green)" }}>
                  {inv.balanceDue > 0 ? money(inv.balanceDue) : "—"}
                </td>
                <td style={{ ...tdStyle, color: "var(--muted)" }}>{inv.paymentMethod || "Cash"}</td>
                <td style={tdStyle}>{statusBadge(inv.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (reportData.type === "refund") {
      const { refunds } = reportData;
      return (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>RR #</th>
              <th style={thStyle}>Invoice #</th>
              <th style={thStyle}>Customer</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Reason</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
              <th style={thStyle}>Date</th>
            </tr>
          </thead>
          <tbody>
            {refunds.length === 0 && (
              <tr><td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "var(--muted)", padding: 24 }}>No refunds/replacements found for this period</td></tr>
            )}
            {refunds.map((r) => (
              <tr key={r.rrNumber}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--bg)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "white"}
              >
                <td style={{ ...tdStyle, fontWeight: 600, color: "#d97706" }}>{r.rrNumber}</td>
                <td style={{ ...tdStyle, color: "var(--blue)" }}>{r.invoiceNumber}</td>
                <td style={tdStyle}>{r.customerName}</td>
                <td style={tdStyle}>{statusBadge(r.type)}</td>
                <td style={{ ...tdStyle, color: "var(--muted)" }}>{r.reason || "—"}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "var(--red)" }}>{money(r.amount)}</td>
                <td style={{ ...tdStyle, color: "var(--muted)" }}>{fmt(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (reportData.type === "customer") {
      const { customers } = reportData;
      return (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Customer ID</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Phone</th>
              <th style={thStyle}>Address</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Orders</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Total Spent</th>
              <th style={thStyle}>Last Purchase</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr><td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: "var(--muted)", padding: 24 }}>No customers found</td></tr>
            )}
            {customers.map((c) => (
              <tr key={c.cid}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--bg)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "white"}
              >
                <td style={{ ...tdStyle, fontWeight: 600, color: "var(--blue)" }}>{c.cid}</td>
                <td style={tdStyle}>{c.name}</td>
                <td style={{ ...tdStyle, color: "var(--muted)" }}>{c.phone}</td>
                <td style={{ ...tdStyle, color: "var(--muted)" }}>{c.address || "—"}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{c.totalOrders}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "var(--green)" }}>{money(c.totalSpent)}</td>
                <td style={{ ...tdStyle, color: "var(--muted)" }}>{fmt(c.lastPurchase)}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: c.outstandingBalance > 0 ? "var(--red)" : c.outstandingBalance < 0 ? "var(--green)" : "var(--muted)" }}>
                  {c.outstandingBalance > 0 ? money(c.outstandingBalance) + " DR" : c.outstandingBalance < 0 ? money(Math.abs(c.outstandingBalance)) + " CR" : "Clear"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (reportData.type === "stock" || reportData.type === "stock-by-product") {
      const { items } = reportData;
      return (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Code</th>
              <th style={thStyle}>Product Name</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Unit</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Opening</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Added</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Sold</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Returned</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Closing</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Stock Value</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={10} style={{ ...tdStyle, textAlign: "center", color: "var(--muted)", padding: 24 }}>No stock data found</td></tr>
            )}
            {items.map((s) => (
              <React.Fragment key={s.id}>
                <tr
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--bg)"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "white"}
                >
                  <td style={{ ...tdStyle, fontWeight: 600, color: "var(--blue)", fontFamily: "inherit" }}>{s.code}</td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{s.name}{s.hasVariants && <span style={{ fontSize: 10, marginLeft: 6, color: "var(--muted)", background: "var(--bg)", borderRadius: 4, padding: "1px 5px" }}>has variants</span>}</td>
                  <td style={{ ...tdStyle, color: "var(--muted)" }}>{s.category}</td>
                  <td style={{ ...tdStyle, color: "var(--muted)" }}>{s.unit}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{s.openingStock}</td>
                  <td style={{ ...tdStyle, textAlign: "center", color: "var(--green)", fontWeight: 600 }}>{s.stockAdded > 0 ? `+${s.stockAdded}` : "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "center", color: s.stockSold > 0 ? "var(--red)" : "var(--muted)", fontWeight: s.stockSold > 0 ? 600 : 400 }}>{s.stockSold > 0 ? `-${s.stockSold}` : "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "center", color: s.stockReturned > 0 ? "#0891b2" : "var(--muted)" }}>{s.stockReturned > 0 ? `+${s.stockReturned}` : "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, color: s.closingStock <= 5 ? "var(--red)" : "var(--ink)" }}>{s.closingStock}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{money(s.salesValue ?? s.stockValue ?? 0)}</td>
                </tr>
                {s.hasVariants && s.variants && s.variants.map((v) => (
                  <tr key={`variant-${v.id}`}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#f0f9ff"}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "#f8fafc"}
                    style={{ background: "#f8fafc" }}
                  >
                    <td style={{ ...tdStyle, fontFamily: "inherit", fontSize: 11, color: "var(--muted)", paddingLeft: 24 }}>{v.sku}</td>
                    <td style={{ ...tdStyle, paddingLeft: 24, color: "var(--ink)", fontSize: 13 }}>
                      {[v.size && `Size: ${v.size}`, v.color && `Color: ${v.color}`].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td style={{ ...tdStyle, color: "var(--muted)", fontSize: 12 }}>—</td>
                    <td style={{ ...tdStyle, color: "var(--muted)", fontSize: 12 }}>—</td>
                    <td style={{ ...tdStyle, textAlign: "center", fontSize: 13 }}>{v.openingStock}</td>
                    <td style={{ ...tdStyle, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>—</td>
                    <td style={{ ...tdStyle, textAlign: "center", color: v.stockSold > 0 ? "var(--red)" : "var(--muted)", fontWeight: v.stockSold > 0 ? 600 : 400, fontSize: 13 }}>{v.stockSold > 0 ? `-${v.stockSold}` : "—"}</td>
                    <td style={{ ...tdStyle, textAlign: "center", color: v.stockReturned > 0 ? "#0891b2" : "var(--muted)", fontSize: 13 }}>{v.stockReturned > 0 ? `+${v.stockReturned}` : "—"}</td>
                    <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, fontSize: 13, color: v.closingStock <= 5 ? "var(--red)" : "var(--ink)" }}>{v.closingStock}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontSize: 13 }}>{money(v.salesValue ?? v.stockValue ?? 0)}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      );
    }

    if (reportData.type === "batches") {
      const { batches } = reportData;
      return (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Batch #</th>
              <th style={thStyle}>Product</th>
              <th style={thStyle}>Code</th>
              <th style={thStyle}>Unit</th>
              <th style={thStyle}>Purchase Date</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Orig. Qty</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Remaining</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Depleted</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Cost / Unit</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Remaining Value</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 && (
              <tr><td colSpan={11} style={{ ...tdStyle, textAlign: "center", color: "var(--muted)", padding: 24 }}>No batches found. Create a purchase to start tracking.</td></tr>
            )}
            {batches.map((b) => {
              const active = b.remaining > 0;
              const depleted = b.qty - b.remaining;
              return (
                <tr key={b.id}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--bg)"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = active ? "white" : "#fafafa"}
                  style={{ background: active ? "white" : "#fafafa" }}
                >
                  <td style={{ ...tdStyle, fontFamily: "inherit", fontWeight: 700, color: active ? "#7c3aed" : "var(--muted)" }}>{b.batchNumber}</td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{b.stockItem.name}</td>
                  <td style={{ ...tdStyle, color: "var(--muted)", fontFamily: "inherit", fontSize: 11 }}>{b.stockItem.code}</td>
                  <td style={{ ...tdStyle, color: "var(--muted)" }}>{b.stockItem.unit}</td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{new Date(b.purchasedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{b.qty}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: active ? "var(--green)" : "var(--muted)" }}>{b.remaining}</td>
                  <td style={{ ...tdStyle, textAlign: "right", color: "var(--ink3)" }}>{depleted}</td>
                  <td style={{ ...tdStyle, textAlign: "right", color: "var(--red)", fontWeight: 600 }}>{money(b.costPrice)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{money(Math.round(b.remaining * b.costPrice))}</td>
                  <td style={tdStyle}>
                    {active
                      ? <span style={{ background: "rgba(34,168,110,.13)", color: "var(--green)", padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>ACTIVE</span>
                      : <span style={{ background: "var(--bg2)", color: "var(--muted)", padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>DEPLETED</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }

    if (reportData.type === "purchase") {
      const { purchases } = reportData;
      const statusBadge = (s: string) => {
        const map: Record<string, { bg: string; color: string }> = {
          paid: { bg: "rgba(34,168,110,.13)", color: "var(--green)" },
          partial: { bg: "rgba(217,119,6,.13)", color: "#d97706" },
          pending: { bg: "rgba(220,38,38,.13)", color: "var(--red)" },
        };
        const style = map[s] ?? { bg: "var(--bg2)", color: "var(--muted)" };
        return <span style={{ background: style.bg, color: style.color, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const }}>{s}</span>;
      };
      return (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>PO #</th>
              <th style={thStyle}>Supplier</th>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Item</th>
              <th style={thStyle}>Code</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Qty</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Rate</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Paid</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Balance</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 && (
              <tr><td colSpan={11} style={{ ...tdStyle, textAlign: "center", color: "var(--muted)", padding: 24 }}>No purchases found for this period</td></tr>
            )}
            {purchases.map((p) => (
              <tr key={p.id}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--bg)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "white"}
              >
                <td style={{ ...tdStyle, fontWeight: 700, color: "#be123c", fontFamily: "inherit" }}>{p.poNumber}</td>
                <td style={{ ...tdStyle, fontWeight: 500 }}>{p.supplierName}</td>
                <td style={{ ...tdStyle, color: "var(--muted)", whiteSpace: "nowrap" }}>{fmt(p.dateTime)}</td>
                <td style={{ ...tdStyle }}>{p.stockName}</td>
                <td style={{ ...tdStyle, fontFamily: "inherit", fontSize: 11, color: "var(--muted)" }}>{p.stockCode || "—"}</td>
                <td style={{ ...tdStyle, textAlign: "center", fontWeight: 600 }}>{p.qty}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{money(p.unitPrice)}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{money(p.total)}</td>
                <td style={{ ...tdStyle, textAlign: "right", color: "var(--green)", fontWeight: 600 }}>{money(p.amountPaid)}</td>
                <td style={{ ...tdStyle, textAlign: "right", color: p.balanceDue > 0 ? "var(--red)" : "var(--muted)", fontWeight: p.balanceDue > 0 ? 700 : 400 }}>{p.balanceDue > 0 ? money(p.balanceDue) : "—"}</td>
                <td style={tdStyle}>{statusBadge(p.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return null;
  }

  // ─── Shared styles ────────────────────────────────────────────────────────

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 600,
    color: "var(--muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".4px",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "1.5px solid var(--bg2)", fontSize: 13, color: "var(--ink)",
    outline: "none", background: "white", display: "block",
  };
  const actionBtn: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 7,
    padding: "9px 16px", borderRadius: 8, border: "none",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ animation: "pgIn .3s both" }}>
      {/* Page Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", marginBottom: 4 }}>Reports</h1>
        <p style={{ fontSize: 14, color: "var(--muted)" }}>Generate detailed reports for invoices, refunds, customers, and inventory</p>
      </div>

      {/* Report Cards Grid */}
      <div className="responsive-grid" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 18,
      }}>
        {REPORT_CARDS.map((card) => (
          <button type="button" className="report-card"
            key={card.id}
            onClick={() => openReport(card.id)}
            style={{
              background: "white",
              borderRadius: "var(--r)",
              boxShadow: "var(--sh)",
              padding: "22px 24px",
              cursor: "pointer",
              border: "1.5px solid transparent",
              transition: "all .2s",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = "translateY(-2px)";
              el.style.boxShadow = "0 8px 32px rgba(0,0,0,.12)";
              el.style.borderColor = card.color;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = "translateY(0)";
              el.style.boxShadow = "var(--sh)";
              el.style.borderColor = "transparent";
            }}
          >
            {/* Background accent */}
            <div className="report-card-accent" style={{
              position: "absolute", top: -20, right: -20,
              width: 80, height: 80, borderRadius: "50%",
              background: card.color, opacity: .07,
            }} />

            {/* Icon */}
            <div className="report-card-icon" style={{
              width: 44, height: 44, borderRadius: 12,
              background: card.color + "18",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 14,
            }}>
              <i className={`fa-solid ${card.icon}`} style={{ fontSize: 18, color: card.color }}></i>
            </div>

            {/* Badge */}
            <div className="report-card-badge" style={{
              display: "inline-block",
              background: card.color + "12",
              color: card.color,
              fontSize: 10, fontWeight: 700, letterSpacing: ".3px",
              padding: "2px 8px", borderRadius: 20,
              marginBottom: 8, textTransform: "uppercase",
            }}>{card.badge}</div>

            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{card.title}</h3>
            <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{card.desc}</p>

            {/* Generate arrow */}
            <div className="report-card-action" style={{
              marginTop: 16, display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, fontWeight: 600, color: card.color,
            }}>
              <i className="fa-solid fa-arrow-right" style={{ fontSize: 11 }}></i>
              Generate Report
            </div>
          </button>
        ))}
      </div>

      {/* ── Modal ────────────────────────────────────────────────────────── */}
      {activeReport && activeCard && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(10,22,40,.6)",
          backdropFilter: "blur(4px)",
          zIndex: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        }}>
          <div style={{
            background: "white",
            borderRadius: 18,
            width: phase === "report" ? "min(1100px, 96vw)" : 520,
            maxHeight: "88vh",
            overflow: "hidden",
            boxShadow: "0 24px 80px rgba(0,0,0,.25)",
            display: "flex",
            flexDirection: "column",
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "18px 24px",
              borderBottom: "1.5px solid var(--bg2)",
              display: "flex",
              alignItems: "center",
              gap: 14,
              position: "sticky",
              top: 0,
              background: "white",
              zIndex: 2,
              borderRadius: "18px 18px 0 0",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: activeCard.color + "18",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <i className={`fa-solid ${activeCard.icon}`} style={{ fontSize: 17, color: activeCard.color }}></i>
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>{activeCard.title}</h2>
                {phase === "report" && reportData && (
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {activeReport === "invoice" && `${(reportData as { type: "invoice"; invoices: InvoiceRow[]; summary: Record<string, number> }).invoices.length} records`}
                    {activeReport === "refund" && `${(reportData as { type: "refund"; refunds: RefundRow[]; summary: Record<string, number> }).refunds.length} records`}
                    {activeReport === "customer" && `${(reportData as { type: "customer"; customers: CustomerRow[]; summary: Record<string, number> }).customers.length} customers`}
                    {(activeReport === "stock" || activeReport === "stock-by-product") && `${(reportData as { type: "stock" | "stock-by-product"; items: StockRow[]; summary: Record<string, number> } & { allStockItems?: StockOption[] }).items.length} products`}
                    {activeReport === "batches" && `${(reportData as { type: "batches"; batches: BatchRow[]; summary: Record<string, number> }).batches.length} batches`}
                    {activeReport === "purchase" && `${(reportData as { type: "purchase"; purchases: PurchaseRow[]; summary: Record<string, number> }).purchases.length} records`}
                  </div>
                )}
              </div>
              <button
                onClick={closeModal}
                style={{
                  width: 32, height: 32, borderRadius: "50%", border: "none",
                  background: "var(--bg2)", cursor: "pointer", fontSize: 16,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--muted)", flexShrink: 0,
                }}
              >×</button>
            </div>

            {/* Modal Body */}
            {phase === "filter" ? (
              <div style={{ overflowY: "auto" }}>
                {renderFilterPanel()}
              </div>
            ) : (
              renderReportPanel()
            )}
          </div>
        </div>
      )}
    </div>
  );
}
