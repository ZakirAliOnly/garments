# Payment methods and monthly payroll

Balances are derived from each method's opening balance plus its cashbook credits minus its cashbook debits. Credit means money received; debit means money paid. Amounts are rounded to two decimal places. New opening balances and payroll/transfer records use Postgres decimal columns; existing cashbook amount columns retain their compatible numeric representation.

## Transaction behavior

- Invoice receipts increase the selected method. Applying a customer's existing advance does not create another receipt. Subsequent invoice payment updates post only the newly received amount, including walk-in invoices.
- Purchase advances and later supplier payments decrease the selected method. Multi-item orders post their advance once, distributed across uniquely numbered purchase records. Supplier returns recorded through the single-purchase API receive money back into the chosen method.
- Refunds cancel unpaid invoice debt before returning cash. Cash payouts decrease the chosen method; an additional replacement payment increases it. An account-only adjustment changes the customer's balance without moving cash. Refund values are checked against the quantities and discounted prices on the original invoice.
- Manual cashbook entries change the selected method. Editing a manual entry automatically reverses its old method/type/amount and applies the replacement; deleting it removes its effect. System-managed entries cannot be edited or deleted through Cashbook.
- Transfers create linked debit/credit entries in one transaction and are excluded from income and expense totals. Request keys prevent a transfer from being posted twice. Transfers require sufficient funds. Other outgoing transactions can produce a negative balance, so an incomplete opening balance does not prevent recording a real payment.
- Payment method names can change without losing their cashbook links. Methods can be archived, but history and balances remain visible. Opening balances are locked after the first entry; corrections use an explicit Cashbook adjustment.

Money-writing endpoints use serializable database transactions with retries on serialization conflicts. Stock changes, document creation, customer/supplier balances, and cashbook movements commit together.

## Workers

Each worker/month pair has a unique payroll record. A month snapshots the worker's monthly wage when its first adjustment or payment is recorded; later worker wage edits apply only to months without an existing snapshot. Legacy workers using daily/per-piece pay must be explicitly changed to monthly pay before monthly payroll is available.

Net pay = monthly wage + recorded extra hours − (monthly wage ÷ 30 × absent days) − advances already paid for that month. Extra hours store both hours and rate. Advances create a cashbook debit immediately, and final wages post only the remaining net amount. New months start with their own adjustments and unpaid state; earlier records are retained. Paid months are locked against additional advances, extra hours, or wage payment. Worker deletion is blocked after payroll history exists; use Inactive instead.

## Migration

`20261105000000_payment_methods_payroll` adds payment methods, transfers, payroll months, adjustments, worker extra-hour rates, and cashbook method/source links. Seeded channels start with zero opening balances; no payroll or business-payment fixtures are inserted into production.

Historical amounts are preserved. Entries use their invoice's saved method or a method recorded in the existing `via …` notes suffix; entries with no historical channel information use Cash. A compatibility trigger fills only missing method IDs for writes from the older deployed application. New endpoints supply validated active method IDs explicitly. The migration is tracked in `_prisma_migrations` so future `prisma migrate deploy` runs do not reapply it.

The migration was applied and verified on the Garments production branch on 2026-11-05 after local fresh-database, historical-fixture, and Neon branch checks. Deploying the application code is a separate step.

## Verification

`scripts/smoke-finance.mjs` must target a local isolated server and requires `ADMIN_EMAIL` and `ADMIN_PASSWORD`. It creates labelled test records and preserves their history. It tests authentication, balance signs, transfer retries, cashbook reversals, invoice payment deltas, customer advances, refunds and replacements, purchase payments, monthly payroll, duplicate protection, concurrent transfers, archived methods, and rollback when stock operations fail.
