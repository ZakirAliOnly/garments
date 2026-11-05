"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import FinanceModal from "@/components/finance/FinanceModal";
import PaymentMethodSelect from "@/components/finance/PaymentMethodSelect";
import { usePaymentMethods } from "@/lib/hooks/usePaymentMethods";
interface Expense {
  id: string;
  entryDate: string;
  description: string;
  amount: number;
  notes: string | null;
  paymentMethodId: string;
  paymentMethod: { id: string; name: string; active: boolean };
  updatedAt: string;
}
interface ExpenseData {
  entries: Expense[];
  summary: { today: number; month: number; filtered: number; count: number };
  limit: number;
}
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
const rs = (n: number) =>
  `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
const insufficient =
  "You can’t record this expense because the selected payment method has insufficient funds.";
export default function ExpensesPage() {
  const cache = useQueryClient(),
    methods = usePaymentMethods();
  const [from, setFrom] = useState(today),
    [to, setTo] = useState(today),
    [filterMethod, setFilterMethod] = useState(""),
    [search, setSearch] = useState(""),
    [searchInput, setSearchInput] = useState("");
  const { data, isLoading, isError, refetch } = useQuery<ExpenseData>({
    queryKey: ["expenses", from, to, filterMethod, search],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to, search });
      if (filterMethod) params.set("methodId", filterMethod);
      const r = await fetch(`/api/expenses?${params}`);
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Unable to load expenses");
      return d;
    },
  });
  const [open, setOpen] = useState(false),
    [editing, setEditing] = useState<Expense | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [entryDate, setEntryDate] = useState(today),
    [description, setDescription] = useState(""),
    [amount, setAmount] = useState(""),
    [methodId, setMethodId] = useState(""),
    [notes, setNotes] = useState("");
  const requestKey = useRef("");
  const method = methods.data?.methods.find((m) => m.id === methodId);
  const available =
    Math.round(
      ((method?.balance ?? 0) +
        (editing?.paymentMethodId === methodId ? editing.amount : 0)) *
        100,
    ) / 100;
  const expenseAmount = Math.round(Number(amount || 0) * 100) / 100;
  const short = !!method && expenseAmount > available;
  const after = Math.round((available - expenseAmount) * 100) / 100;
  const showForm = (expense?: Expense) => {
    setEditing(expense ?? null);
    setEntryDate(expense?.entryDate.slice(0, 10) ?? today());
    setDescription(expense?.description ?? "");
    setAmount(expense ? String(expense.amount) : "");
    setMethodId(
      expense?.paymentMethodId ??
        methods.data?.methods.find((m) => m.active && m.name === "Cash")?.id ??
        "",
    );
    setNotes(expense?.notes ?? "");
    setError("");
    setNotice("");
    requestKey.current = crypto.randomUUID();
    setOpen(true);
  };
  const invalidate = () =>
    Promise.all([
      cache.invalidateQueries({ queryKey: ["expenses"] }),
      cache.invalidateQueries({ queryKey: ["payment-methods"] }),
    ]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (short) {
      setError(insufficient);
      return;
    }
    if (!method) {
      setError("Select an available payment method.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(
        editing ? `/api/expenses/${editing.id}` : "/api/expenses",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entryDate,
            description,
            amount: expenseAmount,
            paymentMethodId: methodId,
            notes,
            requestKey: requestKey.current,
            ...(editing ? { updatedAt: editing.updatedAt } : {}),
          }),
        },
      );
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(d.error || "Unable to save expense");
      await invalidate();
      setOpen(false);
      setNotice(
        editing
          ? "Expense updated and payment-method balances adjusted."
          : "Expense recorded and deducted from the selected payment method.",
      );
    } catch (e) {
      setError((e as Error).message);
      await methods.refetch();
    } finally {
      setBusy(false);
    }
  };
  const remove = async (expense: Expense) => {
    if (
      !window.confirm(
        `Delete this expense? ${rs(expense.amount)} will be restored to ${expense.paymentMethod.name}.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(`/api/expenses/${expense.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updatedAt: expense.updatedAt }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(d.error || "Unable to delete expense");
      await invalidate();
      setNotice("Expense deleted and the payment-method balance restored.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const summary = data?.summary;
  return (
    <div className="finance-page expenses-page">
      <div className="finance-page-heading">
        <div>
          <h2>Daily Expenses</h2>
          <p>
            Record daily business spending and keep each payment method’s
            balance up to date.
          </p>
        </div>
        <button className="finance-button" onClick={() => showForm()}>
          <i aria-hidden="true" className="fa-solid fa-plus" /> Add Expense
        </button>
      </div>
      {notice && (
        <div role="status" className="finance-info">
          {notice}
        </div>
      )}
      {error && !open && (
        <div role="alert" className="finance-error">
          {error}
        </div>
      )}
      <div className="payroll-stats">
        {[
          {
            label: "Today’s Expenses",
            value: summary ? rs(summary.today) : "—",
            icon: "calendar-day",
            tone: "rose",
          },
          {
            label: "This Month",
            value: summary ? rs(summary.month) : "—",
            icon: "calendar-days",
            tone: "blue",
          },
          {
            label: "Selected Period",
            value: summary ? rs(summary.filtered) : "—",
            icon: "receipt",
            tone: "teal",
          },
          {
            label: "Expense Entries",
            value: summary ? String(summary.count) : "—",
            icon: "list",
            tone: "blue",
          },
        ].map((s) => (
          <article key={s.label}>
            <span className={`metric-icon ${s.tone}`}>
              <i aria-hidden="true" className={`fa-solid fa-${s.icon}`} />
            </span>
            <strong>{s.value}</strong>
            <p>{s.label}</p>
          </article>
        ))}
      </div>
      <section className="surface">
        <div className="expense-list-heading">
          <h3>
            <i aria-hidden="true" className="fa-solid fa-receipt" /> Expense
            History
          </h3>
          <button
            className="finance-button secondary"
            onClick={() => {
              setFrom(today());
              setTo(today());
              setFilterMethod("");
              setSearch("");
              setSearchInput("");
            }}
          >
            Today
          </button>
        </div>
        <div className="expense-filters">
          <label>
            From
            <input
              type="date"
              aria-label="Expenses from date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              aria-label="Expenses to date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label>
            Payment method
            <select
              aria-label="Filter expenses by method"
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
            >
              <option value="">All payment methods</option>
              {methods.data?.methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.active ? "" : " (archived)"}
                </option>
              ))}
            </select>
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput.trim());
            }}
          >
            <label>
              Search
              <div className="expense-search">
                <input
                  aria-label="Search expenses"
                  placeholder="Description or notes…"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    if (!e.target.value) setSearch("");
                  }}
                />
                <button aria-label="Search expenses" type="submit">
                  <i
                    aria-hidden="true"
                    className="fa-solid fa-magnifying-glass"
                  />
                </button>
              </div>
            </label>
          </form>
        </div>
        {isError ? (
          <div role="alert" className="finance-error">
            Unable to load expenses. Check the date range and try again.{" "}
            <button onClick={() => refetch()}>Retry</button>
          </div>
        ) : isLoading ? (
          <div className="finance-empty">Loading expenses…</div>
        ) : !data?.entries.length ? (
          <div className="finance-empty">
            <i aria-hidden="true" className="fa-solid fa-receipt" />
            <h3>No expenses in this period</h3>
            <p>Add an expense or choose a different date range.</p>
          </div>
        ) : (
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Payment method</th>
                  <th>Amount</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((expense) => (
                  <tr key={expense.id}>
                    <td>
                      {new Date(expense.entryDate).toLocaleDateString("en-PK")}
                    </td>
                    <td className="expense-description-cell">
                      {expense.description}
                    </td>
                    <td>
                      <span className="expense-method-tag">
                        {expense.paymentMethod.name}
                      </span>
                    </td>
                    <td className="negative">
                      <strong>{rs(expense.amount)}</strong>
                    </td>
                    <td className="expense-notes-cell">
                      {expense.notes || "—"}
                    </td>
                    <td>
                      <div className="method-actions">
                        <button
                          aria-label={`Edit ${expense.description}`}
                          disabled={busy}
                          onClick={() => showForm(expense)}
                        >
                          <i aria-hidden="true" className="fa-solid fa-pen" />
                        </button>
                        <button
                          aria-label={`Delete ${expense.description}`}
                          disabled={busy}
                          onClick={() => remove(expense)}
                        >
                          <i
                            aria-hidden="true"
                            className="fa-regular fa-trash-can"
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="finance-help">
          Expenses also appear in Cashbook. Today and month totals follow the
          selected payment method; period totals also follow your date and
          search filters.
          {data && data.summary.count > data.limit
            ? ` Showing the latest ${data.limit} matching entries.`
            : ""}
        </p>
      </section>
      {open && (
        <FinanceModal
          title={editing ? "Edit Expense" : "Add Daily Expense"}
          subtitle="Paid expenses are deducted from the selected payment method."
          busy={busy}
          onClose={() => setOpen(false)}
        >
          <form className="finance-form" onSubmit={save}>
            {error && (
              <div role="alert" className="finance-error">
                {error}
              </div>
            )}
            <label>
              DESCRIPTION
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                maxLength={160}
                placeholder="e.g. Electricity bill, tea, delivery charges"
              />
            </label>
            <div className="finance-form-grid">
              <label>
                EXPENSE DATE
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  required
                />
              </label>
              <label>
                AMOUNT (RS)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError("");
                  }}
                  required
                  placeholder="0.00"
                />
              </label>
            </div>
            <label>
              PAID VIA
              <PaymentMethodSelect
                byId
                includeArchivedId={editing?.paymentMethodId}
                value={methodId}
                onChange={setMethodId}
              />
            </label>
            {method && (
              <div
                className={`expense-funds ${short ? "insufficient" : ""}`}
                aria-live="polite"
              >
                <div>
                  <span>
                    {editing?.paymentMethodId === methodId
                      ? "Available after restoring the old expense"
                      : "Available balance"}
                  </span>
                  <strong>{rs(available)}</strong>
                </div>
                {short ? (
                  <>
                    <div>
                      <span>Short by</span>
                      <strong>{rs(expenseAmount - available)}</strong>
                    </div>
                    {!error && <p>{insufficient}</p>}
                  </>
                ) : (
                  <div>
                    <span>Balance after {editing ? "update" : "expense"}</span>
                    <strong>{rs(after)}</strong>
                  </div>
                )}
              </div>
            )}
            <label>
              NOTES (OPTIONAL)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                placeholder="Any extra details…"
              />
            </label>
            <footer>
              <button
                type="button"
                className="finance-button secondary"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                className="finance-button"
                disabled={
                  busy || methods.isLoading || methods.isError || !methodId
                }
              >
                {busy ? "Saving…" : editing ? "Save Changes" : "Record Expense"}
              </button>
            </footer>
          </form>
        </FinanceModal>
      )}
    </div>
  );
}
