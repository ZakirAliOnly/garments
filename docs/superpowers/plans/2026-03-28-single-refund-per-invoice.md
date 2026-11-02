# Single Refund Per Invoice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent an invoice from being refunded or replaced more than once, generate a printable refund invoice with a REFUNDED stamp, and surface it in the refund history list.

**Architecture:** Add `isRefunded` boolean to the Invoice model. The POST /api/refunds API checks this flag before processing and sets it atomically in the same transaction. RefundPage disables the form when `isRefunded` is true and adds a Print button to each refund history row that fetches the full invoice and renders it with a REFUNDED stamp matching the original format (thermal or A4). The "Return" type is removed throughout.

**Tech Stack:** Next.js 14 App Router, Prisma ORM (PostgreSQL), React (client components), inline HTML string printing via hidden iframe.

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `isRefunded Boolean @default(false)` to Invoice model |
| `app/api/refunds/route.ts` | Guard on `isRefunded`, set flag in transaction, remove `return` type |
| `components/pages/RefundPage.tsx` | Extend interfaces, blocked-state UI, remove return references, add print functions + Print button |

---

### Task 1: Add `isRefunded` to Invoice schema and migrate

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the field to the Invoice model**

In `prisma/schema.prisma`, add `isRefunded` after the `status` field (line 100):

```prisma
  status      String        @default("pending") // "pending" | "partial" | "paid"
  isRefunded  Boolean       @default(false)
  refunds     RefundRequest[]
```

- [ ] **Step 2: Run the migration**

```bash
npx prisma migrate dev --name add-invoice-is-refunded
```

Expected output:
```
✔ Generated Prisma Client (...)
The following migration(s) have been applied:
  migrations/..._add_invoice_is_refunded/migration.sql
```

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add isRefunded flag to Invoice model"
```

---

### Task 2: Update POST /api/refunds — guard, mark refunded, remove return type

**Files:**
- Modify: `app/api/refunds/route.ts`

- [ ] **Step 1: Replace the type validation and add the isRefunded guard**

Replace lines 41–51 (type check + invoice lookup) with:

```typescript
    if (type !== "refund" && type !== "replace") {
      return NextResponse.json({ error: "Type must be refund or replace" }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { invNumber: invNumber.trim() },
      include: { customer: { select: { id: true, name: true } } },
    });
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    if (invoice.isRefunded) {
      return NextResponse.json({ error: "This invoice has already been refunded and cannot be refunded again." }, { status: 400 });
    }
```

- [ ] **Step 2: Remove the "return" type branch (lines 84–87)**

Delete this block entirely:

```typescript
    // For return type: no financial adjustment, just restock
    if (type === "return") {
      // netAmount is 0, no balance change
    }
```

- [ ] **Step 3: Remove "return" from the netAmount calculation (line 93–98)**

Replace:

```typescript
    const netAmount =
      type === "refund"
        ? Math.max(0, Number(amount) || returnAmount)
        : type === "return"
        ? 0
        : replacementAmount - returnAmount;
```

With:

```typescript
    const netAmount =
      type === "refund"
        ? Math.max(0, Number(amount) || returnAmount)
        : replacementAmount - returnAmount;
```

- [ ] **Step 4: Mark the invoice as refunded inside the transaction**

Inside the `prisma.$transaction` callback, after the `tx.refundRequest.create(...)` call (after line 205 `return created;` but before it), add:

```typescript
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { isRefunded: true },
      });

      return created;
```

So the end of the transaction block becomes:

```typescript
      const created = await tx.refundRequest.create({
        data: {
          rrNumber,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invNumber,
          customerId: invoice.customerId,
          customerName: invoice.customerName,
          type,
          reason: reason?.trim() || null,
          amount: netAmount,
          items:
            type === "replace"
              ? { returns: normalizedReturns, replacements: normalizedReplacements }
              : normalizedReturns,
        },
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { isRefunded: true },
      });

      return created;
```

- [ ] **Step 5: Verify the file compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/refunds/route.ts
git commit -m "feat: block duplicate refunds and mark invoice as refunded on processing"
```

---

### Task 3: Update RefundPage — blocked state, remove return type, add print

**Files:**
- Modify: `components/pages/RefundPage.tsx`

#### Step group A — Interface & state updates

- [ ] **Step 1: Extend the `LookupInvoice` interface**

Replace the existing `LookupInvoice` interface (lines 15–22) with:

```typescript
interface LookupInvoice {
  id: string;
  invNumber: string;
  type: string; // "walk" | "regular"
  customerName: string;
  phone: string | null;
  address: string | null;
  cid?: string;
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
```

#### Step group B — Print utilities

- [ ] **Step 2: Add `doPrint`, `printed`, and both refund HTML builders after the style constants (after line 102, before `export default function RefundPage()`)**

```typescript
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
  <div style="background:#c00;color:#fff;text-align:center;font-size:13px;font-weight:900;padding:5px 0;letter-spacing:3px;">★ REFUNDED ★</div>
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
    <div style="margin-top:4px;text-align:left;font-size:10px;font-weight:700;color:#c00;border:1px solid #c00;padding:5px 8px;border-radius:4px;">
      This invoice has been refunded.<br>No further refunds or exchanges are accepted.
    </div>
    <div style="margin-top:5px;font-size:9px;letter-spacing:2px;color:#000;">✦ &nbsp; ✦ &nbsp; ✦</div>
    <div style="font-size:9px;margin-top:4px;color:#000;">Software Developed By: AddsMint.com</div>
    <div style="font-size:10px;color:#000;">Printed: ${printedOn()}</div>
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
    <span style="font-size:12px;color:#c00;">— Refund Reference: <strong>${rrNumber}</strong> &nbsp;|&nbsp; Original Invoice: <strong>${inv.invNumber}</strong></span>
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
```

#### Step group C — Blocked state UI

- [ ] **Step 3: Show "Already Refunded" banner and disable the form**

In the JSX where `lookupInvoice` details are shown (the grid div after line 355), add the banner immediately after the 4-column info grid closes (after the closing `</div>` of the `gridTemplateColumns: "repeat(4,1fr)"` div):

```tsx
        {lookupInvoice.isRefunded && (
          <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, background: "#fff0f0", border: "1.5px solid #c00", display: "flex", alignItems: "center", gap: 10 }}>
            <i className="fa-solid fa-ban" style={{ color: "#c00", fontSize: 15 }}></i>
            <div>
              <span style={{ fontWeight: 700, color: "#c00", fontSize: 13 }}>Already Refunded</span>
              <span style={{ fontSize: 12, color: "#c00", marginLeft: 8 }}>This invoice has been refunded and cannot be refunded again.</span>
            </div>
          </div>
        )}
```

- [ ] **Step 4: Hide the refund/replace form when already refunded**

The entire refund form card is wrapped in `{lookupInvoice && (` at line 379. Change it to:

```tsx
      {lookupInvoice && !lookupInvoice.isRefunded && (
```

#### Step group D — Clean up "return" type references in history table

- [ ] **Step 5: Update the type color logic in the history table**

Find the type cell in the requests table (around line 660):

```tsx
                    <td style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: r.type === "refund" ? "var(--red)" : r.type === "return" ? "var(--blue)" : "var(--gold)" }}>
                      {r.type === "refund" ? "Refund" : r.type === "return" ? "Return" : "Replace"}
                    </td>
```

Replace with:

```tsx
                    <td style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: r.type === "refund" ? "var(--red)" : "var(--gold)" }}>
                      {r.type === "refund" ? "Refund" : "Replace"}
                    </td>
```

#### Step group E — Print button in history table

- [ ] **Step 6: Add `printLoading` state and `printRefundInvoice` handler**

After the existing state declarations (around line 123, after `const [toast, setToast] = useState("")`), add:

```typescript
  const [printLoading, setPrintLoading] = useState<string | null>(null); // stores rrNumber being printed
```

After `const showToast` function, add:

```typescript
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
```

- [ ] **Step 7: Add a Print column header to the history table**

Find the `<thead>` row in the history table (around line 645):

```tsx
                <tr style={{ background: "var(--ink)" }}>
                  <th style={th}>RR #</th>
                  <th style={th}>Invoice</th>
                  <th style={th}>Customer</th>
                  <th style={th}>Type</th>
                  <th style={{ ...th, textAlign: "right" }}>Amount</th>
                  <th style={th}>Date</th>
                </tr>
```

Replace with:

```tsx
                <tr style={{ background: "var(--ink)" }}>
                  <th style={th}>RR #</th>
                  <th style={th}>Invoice</th>
                  <th style={th}>Customer</th>
                  <th style={th}>Type</th>
                  <th style={{ ...th, textAlign: "right" }}>Amount</th>
                  <th style={th}>Date</th>
                  <th style={{ ...th, width: 80, textAlign: "center" }}>Print</th>
                </tr>
```

- [ ] **Step 8: Add the Print button cell to each history row**

Find the closing `</tr>` of each row in the tbody (after the `Date` cell, around line 668):

```tsx
                    <td style={{ padding: "9px 12px", fontSize: 12, color: "var(--muted)" }}>
                      {new Date(r.createdAt).toLocaleDateString("en-GB")}
                    </td>
                  </tr>
```

Replace with:

```tsx
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
```

- [ ] **Step 9: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add components/pages/RefundPage.tsx
git commit -m "feat: block duplicate refunds in UI, add REFUNDED stamp print to history"
```

---

### Task 4: Manual verification checklist

- [ ] Start the dev server: `npm run dev`
- [ ] Create a new invoice (walk-in or regular)
- [ ] Go to Refunds, look up the invoice — form should appear normally
- [ ] Process a refund — success toast appears, history list updates
- [ ] Look up the same invoice again — red "Already Refunded" banner appears, form is hidden
- [ ] Try to submit via API directly: `POST /api/refunds` with the same `invNumber` — expect `400` with message "This invoice has already been refunded and cannot be refunded again."
- [ ] Click Print on the refund row in history — print dialog opens with REFUNDED stamp
- [ ] Verify thermal invoices show the thermal format; regular invoices show the A4 format

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: single-refund-per-invoice — complete implementation"
```
