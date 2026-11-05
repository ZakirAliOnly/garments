# User management and module access

Administrators open **User Management**, create an account with an email and password, and select **Allow** or **Deny** for each module before saving permissions. New regular accounts have no module access. Administrators always have full access, including User Management; regular users cannot grant themselves permissions.

Permissions control navigation, quick actions, search and the corresponding server APIs. Module access includes the actions within that module, rather than separate read/write permissions. Invoice, purchase, refund and payment forms use limited lookup APIs for their dependencies without granting access to the separate management pages. Denied users receive HTTP 403 even if they call APIs directly.

Permission changes take effect on the next API request. The interface refreshes access on window focus and every 30 seconds. Accounts with no permissions see an access message and can still sign out. Disabling an account, changing its role or resetting its password invalidates existing sessions. Re-enabling an account requires a fresh login. Administrators cannot disable themselves or remove their own administrator role, and the final active administrator is protected. Concurrent edits return a refresh-required error rather than overwrite another update.

The app retains its existing custom email/password login. Passwords are hashed on the server and never included in user-management responses. Accounts are disabled rather than deleted.

## Migration

`20261105010000_user_module_access` adds role, active status, allowed module IDs and a session version to the existing `AdminUser` table. It preserves all existing accounts as active administrators. Future accounts default to regular users with no permissions. Existing administrator passwords and sessions remain valid.

Applied on 5 November 2026 to an isolated Neon branch first, then the Garments production branch, with the migration checksum recorded in `_prisma_migrations`. No synthetic users were created in production. The application changes still require merging and deploying the PR.

## Validation

- Production build and TypeScript checks.
- `scripts/smoke-users.mjs` against an isolated local database: deny-by-default, endpoint permissions, privilege escalation prevention, limited lookups, live revocation, stale edits, disabled accounts, password resets, role changes and safe response fields.
- Browser flow: administrator creates a user and grants/revokes Expenses; mobile staff navigation follows those permissions.
- Existing expense and finance smoke tests cover balances, insufficient funds, payroll, invoices, refunds and transfers after adding authorization.

To rerun the integration checks, use a local test server and isolated database, with `APP_URL`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` set for a test administrator. These scripts create labelled synthetic records and refuse remote URLs.
