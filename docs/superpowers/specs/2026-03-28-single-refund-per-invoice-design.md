# Single Refund Per Invoice — Design Spec
Date: 2026-03-28

## Problem
An invoice can currently be refunded multiple times. Refunds should be limited to once per invoice (for Refund and Replace types). A refund invoice must be printable and should display in the refund section.

## Decisions
- Limit applies to **Refund** and **Replace** types only
- **Return** type is removed entirely
- Refund invoice format matches the original invoice (thermal for walk-in, A4 for regular)
- Refund invoice shows original invoice details with a "REFUNDED" stamp
- Refund invoices are displayed and printable from the refund section

## Data Layer

### Schema Change
Add `isRefunded Boolean @default(false)` to the `Invoice` model in `prisma/schema.prisma`.

### API: `POST /api/refunds`
1. After fetching the invoice, check `invoice.isRefunded`
2. If `true`, return `400` with message: `"This invoice has already been refunded."`
3. On successful refund/replace, set `isRefunded: true` on the invoice inside the same Prisma transaction
4. Remove the `"return"` type branch entirely

## UI — RefundPage (`components/pages/RefundPage.tsx`)

### Lookup State
- If looked-up invoice has `isRefunded: true`:
  - Show a red "Already Refunded" badge next to invoice details
  - Disable the form and submit button
  - Show message: *"This invoice has already been refunded and cannot be refunded again."*

### Type Selector
- Remove "Return (Restock Only)" option
- Keep only: "Refund (Money Back)" and "Replace (Exchange)"

### Refund List
- Add a **Print** button to each row in the refund list
- Print handler reads the `RefundRequest` row's linked invoice type (`walk` or `regular`) and prints using the matching format with a "REFUNDED" stamp overlaid

## Print — Refund Invoice
- Reuse `buildThermalHTML` / `buildRegularHTML` from `InvoicePage.tsx` (or extract shared builders)
- Add a "REFUNDED" stamp: large red diagonal text overlay across the invoice
- Add a note at the bottom: *"This invoice has been refunded. No further refunds or exchanges are accepted."*
- Original invoice data (items, totals, customer) is shown as-is

## Out of Scope
- Partial refunds (full invoice refund only per this spec)
- Refund approval workflow
- Email notifications
