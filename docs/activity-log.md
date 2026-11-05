# Activity Log

The Activity Log follows the supplied reference: five summary cards, Today / 7 Days / 30 Days / 3 Months / All Time filters, an activity-type selector, Refresh, and a table of date/time, type, description, user, amount and status/payment method. The User column includes the actor's name and email. Times use Asia/Karachi. Results are paginated in groups of 50 and the table scrolls horizontally on smaller screens.

Administrators have access automatically. Regular users need the **Activity Log** module allowed in User Management. This permission exposes the business-wide activity history, including users and transaction amounts; it does not grant permission to change those records. The API enforces this permission on every request. There are no edit/delete activity endpoints.

Database triggers capture committed insert, update and delete operations for invoices, cashbook entries (including expenses and payments), workers, tasks, payroll, payroll adjustments, refunds/replacements, stock, purchases, suppliers, payment methods, transfers, users and customers. The actor is set transaction-locally by the application. Interactive finance transactions reuse one actor context; direct model writes atomically set the actor and perform the write. Failed transactions roll back their activity entries, and idempotent retries that reuse an existing record create no duplicate event. No-op updates are ignored. Stock batch/variant implementation changes are represented by their parent business records rather than separate activity categories.

Actor details, descriptions, statuses and payment method names are snapshots, so later renames or deletions do not rewrite history. Only selected display fields are recorded; password hashes, passwords, full request bodies and freeform notes are never copied. Actions performed outside the application without an actor are labelled **System / unavailable**. Login attempts and page views are not recorded.

Logging begins when migration `20261105020000_activity_log` is applied. Older records are not backfilled because their actor cannot be established. During the interval before the new application code is deployed, existing code can produce events labelled System / unavailable. User attribution begins with the new deployment.

The cards summarize recorded events within both selected filters. Invoice totals count creation events. Cash In and Cash Out sum payment creation events, including internal transfer entries and entries subsequently edited, deleted or reversed. They are activity totals, not account balances. Task totals count task events. Current balances remain on Payment Method and Cashbook.

## Migration and verification

The migration adds ActivityEvent, its date/type indexes and transactional audit triggers to 14 business tables. It was applied and exercised on an expiring Neon branch cloned from production before being applied to the Garments production branch on 5 November 2026. The production migration record and all 14 triggers were verified. No production fixtures or user records are changed by the migration.

Validation includes the production build, TypeScript, targeted ESLint, browser checks on desktop/mobile, `scripts/smoke-activity.mjs`, and the existing permission, expense and finance smoke suites against an isolated local database. The activity script checks actor attribution, API permission denial/revocation, insufficient-funds rollback, idempotency, amount/method fields, filtered totals, safe response fields and pagination.
