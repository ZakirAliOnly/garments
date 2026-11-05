"use client";
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePaymentMethods,
  type PaymentMethod,
} from "@/lib/hooks/usePaymentMethods";
import FinanceModal from "@/components/finance/FinanceModal";
import PaymentMethodSelect from "@/components/finance/PaymentMethodSelect";
const rs = (n: number) =>
  `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
export default function PaymentMethodsPage() {
  const { data, isLoading, isError, refetch } = usePaymentMethods(true),
    cache = useQueryClient();
  const [modal, setModal] = useState<"method" | "transfer" | null>(null),
    [edit, setEdit] = useState<PaymentMethod | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [name, setName] = useState(""),
    [opening, setOpening] = useState("0"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [amount, setAmount] = useState(""),
    [entryDate, setEntryDate] = useState(today),
    [notes, setNotes] = useState("");
  const requestKey = useRef("");
  const methods = data?.methods ?? [],
    active = methods
      .filter((m) => m.active)
      .sort((a, b) => {
        const defaults = ["Cash", "EasyPaisa", "Bank", "Mobile Wallet"];
        const rank = (name: string) =>
          defaults.includes(name) ? defaults.indexOf(name) : 100;
        return rank(a.name) - rank(b.name);
      }),
    archived = methods.filter((m) => !m.active);
  const openMethod = (method?: PaymentMethod) => {
    setEdit(method ?? null);
    setName(method?.name ?? "");
    setOpening(String(method?.openingBalance ?? 0));
    setError("");
    setModal("method");
  };
  const openTransfer = (method?: PaymentMethod) => {
    setFrom(method?.id ?? active[0]?.id ?? "");
    setTo(active.find((m) => m.id !== (method?.id ?? active[0]?.id))?.id ?? "");
    setAmount("");
    setNotes("");
    setEntryDate(today());
    requestKey.current = crypto.randomUUID();
    setError("");
    setModal("transfer");
  };
  const mutate = async (url: string, body: unknown, method = "POST") => {
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(d.error || "Unable to save changes");
    await cache.invalidateQueries({ queryKey: ["payment-methods"] });
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (modal === "method")
        await mutate(
          edit ? `/api/payment-methods/${edit.id}` : "/api/payment-methods",
          { name, openingBalance: Number(opening) },
          edit ? "PATCH" : "POST",
        );
      else
        await mutate("/api/payment-methods/transfers", {
          fromId: from,
          toId: to,
          amount: Number(amount),
          entryDate,
          notes,
          requestKey: requestKey.current,
        });
      setModal(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (m: PaymentMethod) => {
    if (
      !window.confirm(
        `${m.active ? "Archive" : "Restore"} ${m.name}? Transaction history will be kept.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await mutate(
        `/api/payment-methods/${m.id}`,
        { active: !m.active },
        "PATCH",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const cards = (list: PaymentMethod[]) =>
    list.map((m) => (
      <article className="method-card" key={m.id}>
        <div className="method-card-top">
          <div>
            <h3>{m.name}</h3>
            <p>OPENING · {rs(m.openingBalance)}</p>
          </div>
          <div className="method-actions">
            {m.active && (
              <button
                title={`Transfer from ${m.name}`}
                aria-label={`Transfer from ${m.name}`}
                disabled={busy || active.length < 2}
                onClick={() => openTransfer(m)}
              >
                <i
                  aria-hidden="true"
                  className="fa-solid fa-arrow-right-arrow-left"
                />
              </button>
            )}
            <button
              title={`Edit ${m.name}`}
              aria-label={`Edit ${m.name}`}
              disabled={busy}
              onClick={() => openMethod(m)}
            >
              <i aria-hidden="true" className="fa-solid fa-pen" />
            </button>
            <button
              title={m.active ? "Archive method" : "Restore method"}
              aria-label={`${m.active ? "Archive" : "Restore"} ${m.name}`}
              disabled={busy}
              onClick={() => toggle(m)}
            >
              <i
                aria-hidden="true"
                className={`fa-solid fa-${m.active ? "box-archive" : "rotate-left"}`}
              />
            </button>
          </div>
        </div>
        <div className="method-balance">
          <span>CURRENT</span>
          <strong className={m.balance < 0 ? "negative" : "positive"}>
            {rs(m.balance)}
          </strong>
        </div>
      </article>
    ));
  return (
    <div className="finance-page">
      <div className="finance-page-heading">
        <div>
          <h2>Payment Method</h2>
          <p>
            Manage the cash, wallet and bank channels used across your business.
            Each method tracks its opening and current balance.
          </p>
        </div>
      </div>
      <div className="finance-toolbar">
        <button
          className="finance-button secondary"
          disabled={active.length < 2 || busy}
          onClick={() => openTransfer()}
        >
          <i
            aria-hidden="true"
            className="fa-solid fa-arrow-right-arrow-left"
          />{" "}
          Transfer
        </button>
        <button className="finance-button" onClick={() => openMethod()}>
          <i aria-hidden="true" className="fa-solid fa-plus" /> Add method
        </button>
      </div>
      {error && !modal && (
        <div role="alert" className="finance-error">
          {error}
        </div>
      )}
      {isError ? (
        <div role="alert" className="finance-error">
          Unable to load payment methods.{" "}
          <button onClick={() => refetch()}>Retry</button>
        </div>
      ) : isLoading ? (
        <div className="finance-empty">Loading methods…</div>
      ) : (
        <>
          <div className="finance-section-title">
            <i aria-hidden="true" className="fa-solid fa-wallet" /> Active
            methods <span />
            {active.length}
          </div>
          <div className="methods-grid">{cards(active)}</div>
          {!active.length && (
            <div className="finance-empty">
              Add your first payment method to record transactions.
            </div>
          )}
          {archived.length > 0 && (
            <>
              <div className="finance-section-title">
                Archived methods <span />
                {archived.length}
              </div>
              <div className="methods-grid archived">{cards(archived)}</div>
            </>
          )}
          <div className="finance-section-title">
            <i aria-hidden="true" className="fa-solid fa-clock-rotate-left" />{" "}
            Transfer history <span />
            {data?.transfers.length ?? 0}
          </div>
          {!data?.transfers.length ? (
            <div className="finance-empty">No transfers yet.</div>
          ) : (
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Amount</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transfers.map((t) => (
                    <tr key={t.id}>
                      <td>
                        {new Date(t.entryDate).toLocaleDateString("en-PK")}
                      </td>
                      <td>{t.from.name}</td>
                      <td>{t.to.name}</td>
                      <td>{rs(Number(t.amount))}</td>
                      <td>{t.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="finance-help">
            Transfers move funds between methods and do not count as income or
            expense. Showing the most recent 100 transfers.
          </p>
        </>
      )}
      {modal && (
        <FinanceModal
          title={
            modal === "transfer"
              ? "Transfer funds"
              : edit
                ? "Edit payment method"
                : "Add payment method"
          }
          onClose={() => setModal(null)}
          busy={busy}
        >
          <form onSubmit={save} className="finance-form">
            {error && (
              <div role="alert" className="finance-error">
                {error}
              </div>
            )}
            {modal === "method" ? (
              <>
                <label>
                  METHOD NAME
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={80}
                    placeholder="e.g. Cash, EasyPaisa, UBL 098"
                  />
                </label>
                <label>
                  OPENING BALANCE (RS)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={opening}
                    onChange={(e) => setOpening(e.target.value)}
                    required
                    disabled={!!edit?._count.entries}
                  />
                </label>
                {!!edit?._count.entries && (
                  <p className="finance-help">
                    Opening balance is locked after the first transaction. Use a
                    Cashbook adjustment to correct the current balance.
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="finance-form-grid">
                  <label>
                    FROM
                    <PaymentMethodSelect byId value={from} onChange={setFrom} />
                  </label>
                  <label>
                    TO
                    <PaymentMethodSelect byId value={to} onChange={setTo} />
                  </label>
                </div>
                <p className="finance-help">
                  Available in {methods.find((m) => m.id === from)?.name}:{" "}
                  {rs(methods.find((m) => m.id === from)?.balance ?? 0)}
                </p>
                <div className="finance-form-grid">
                  <label>
                    AMOUNT (RS)
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    TRANSFER DATE
                    <input
                      type="date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      required
                    />
                  </label>
                </div>
                <label>
                  NOTES (OPTIONAL)
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <div className="finance-info">
                  The source decreases and the destination increases by the same
                  amount.
                </div>
              </>
            )}
            <footer>
              <button
                type="button"
                className="finance-button secondary"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button
                className="finance-button"
                disabled={
                  busy ||
                  (modal === "transfer" && (!from || !to || from === to))
                }
              >
                {busy
                  ? "Saving…"
                  : modal === "transfer"
                    ? "Transfer"
                    : edit
                      ? "Save changes"
                      : "Add method"}
              </button>
            </footer>
          </form>
        </FinanceModal>
      )}
    </div>
  );
}
