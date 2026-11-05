"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import FinanceModal from "@/components/finance/FinanceModal";
import PaymentMethodSelect from "@/components/finance/PaymentMethodSelect";
interface Adjustment {
  id: string;
  kind: string;
  amount: string;
  hours: string | null;
  rate: string | null;
  entryDate: string;
  paymentMethodName: string | null;
  notes: string | null;
}
interface Payroll {
  id: string;
  monthlyWage: string;
  absentDays: string;
  paidAmount: string;
  paidAt: string | null;
  paymentMethodName: string | null;
  adjustments: Adjustment[];
}
interface Worker {
  id: string;
  workerId: string;
  name: string;
  role: string;
  phone: string | null;
  salaryType: string;
  rate: number;
  extraHoursRate: number;
  status: string;
  payroll: Payroll | null;
  totals: {
    wage: number;
    extra: number;
    advances: number;
    absence: number;
    gross: number;
    net: number;
  };
}
const rs = (n: number) =>
  `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
const monthLabel = (m: string) =>
  new Date(`${m}-02T12:00:00Z`).toLocaleDateString("en-PK", {
    month: "long",
    year: "numeric",
  });
export default function WorkersPage() {
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const cache = useQueryClient();
  const { data, isLoading, isFetching, isError, refetch } = useQuery<{
    workers: Worker[];
  }>({
    queryKey: ["payroll", month],
    queryFn: async () => {
      const r = await fetch(`/api/payroll?month=${month}`);
      if (!r.ok) throw Error();
      return r.json();
    },
  });
  const workers = data?.workers ?? [];
  const [modal, setModal] = useState<
      "worker" | "pay" | "advance" | "extra" | null
    >(null),
    [selected, setSelected] = useState<Worker | null>(null),
    [expanded, setExpanded] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [name, setName] = useState(""),
    [role, setRole] = useState(""),
    [phone, setPhone] = useState(""),
    [wage, setWage] = useState(""),
    [extraRate, setExtraRate] = useState(""),
    [status, setStatus] = useState("active");
  const [amount, setAmount] = useState(""),
    [hours, setHours] = useState(""),
    [rate, setRate] = useState(""),
    [absentDays, setAbsentDays] = useState("0"),
    [method, setMethod] = useState(""),
    [entryDate, setEntryDate] = useState(today),
    [notes, setNotes] = useState("");
  const requestKey = useRef("");
  const current = workers.find((w) => w.id === selected?.id) ?? selected;
  const active = workers.filter((w) => w.status === "active");
  const totalWages = active.reduce((s, w) => s + w.totals.wage, 0),
    advances = workers.reduce((s, w) => s + w.totals.advances, 0),
    paid = workers.reduce((s, w) => s + Number(w.payroll?.paidAmount ?? 0), 0);
  const absence =
    Math.round(
      ((current?.totals.wage ?? 0) / 30) * Number(absentDays || 0) * 100,
    ) / 100;
  const gross =
    Math.round(
      ((current?.totals.wage ?? 0) + (current?.totals.extra ?? 0) - absence) *
        100,
    ) / 100;
  const net = Math.round((gross - (current?.totals.advances ?? 0)) * 100) / 100;
  const openWorker = (worker?: Worker) => {
    setSelected(worker ?? null);
    setName(worker?.name ?? "");
    setRole(worker?.role ?? "");
    setPhone(worker?.phone ?? "");
    setWage(String(worker?.rate ?? ""));
    setExtraRate(String(worker?.extraHoursRate ?? 0));
    setStatus(worker?.status ?? "active");
    setError("");
    setModal("worker");
  };
  const openAction = (action: "pay" | "advance" | "extra", worker: Worker) => {
    setSelected(worker);
    setAmount("");
    setHours("");
    setRate(String(worker.extraHoursRate));
    setAbsentDays(String(worker.payroll?.absentDays ?? 0));
    setEntryDate(today());
    setNotes("");
    setError("");
    requestKey.current = crypto.randomUUID();
    setModal(action);
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const url =
        modal === "worker"
          ? selected
            ? `/api/workers/${selected.id}`
            : "/api/workers"
          : `/api/workers/${current?.id}/payroll`;
      const body =
        modal === "worker"
          ? {
              ...selected,
              name,
              role,
              phone,
              rate: Number(wage),
              extraHoursRate: Number(extraRate),
              status,
              salaryType: "monthly",
            }
          : {
              month,
              action: modal,
              amount: Number(amount),
              hours: Number(hours),
              rate: Number(rate),
              absentDays: Number(absentDays),
              paymentMethod: method,
              entryDate,
              notes,
              requestKey: requestKey.current,
            };
      const response = await fetch(url, {
        method: modal === "worker" && selected ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(result.error || "Unable to save changes");
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["payroll"] }),
        cache.invalidateQueries({ queryKey: ["payment-methods"] }),
      ]);
      setModal(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="finance-page workers-page">
      <div className="finance-page-heading">
        <div>
          <h2>Workers</h2>
          <p>Manage employees, wages &amp; advances</p>
        </div>
        <div className="finance-toolbar">
          <label className="month-picker">
            <span className="sr-only">Payroll month</span>
            <input
              aria-label="Payroll month"
              type="month"
              required
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
          </label>
          <button className="finance-button" onClick={() => openWorker()}>
            <i aria-hidden="true" className="fa-solid fa-plus" /> Add Worker
          </button>
        </div>
      </div>
      <div className="finance-info">
        <strong>Payroll month: </strong>
        {monthLabel(month)}. Advances and wage payments are stored per month.
        Pick another month to view its own advances and paid/unpaid state.
      </div>
      {isError ? (
        <div role="alert" className="finance-error">
          Unable to load workers.{" "}
          <button onClick={() => refetch()}>Retry</button>
        </div>
      ) : isLoading ? (
        <div className="finance-empty">Loading payroll…</div>
      ) : (
        <>
          <div className="payroll-stats">
            {[
              {
                label: "Active Workers",
                value: String(active.length),
                icon: "users",
                tone: "blue",
              },
              {
                label: "Monthly Wage Bill",
                value: rs(totalWages),
                icon: "wallet",
                tone: "teal",
              },
              {
                label: "Advances This Month",
                value: rs(advances),
                icon: "arrow-trend-down",
                tone: "rose",
              },
              {
                label: "Wages Paid",
                value: rs(paid),
                icon: "circle-check",
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
          {!workers.length && (
            <div className="finance-empty">
              <i aria-hidden="true" className="fa-solid fa-users" />
              <h3>No workers yet</h3>
              <p>
                Add your first worker to manage monthly wages, extra hours and
                advances.
              </p>
            </div>
          )}
          <div className="worker-list">
            {workers.map((w) => (
              <article
                className={`worker-card ${w.status !== "active" ? "inactive" : ""}`}
                key={w.id}
              >
                <div className="worker-row">
                  <span className="worker-avatar">
                    {w.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="worker-details">
                    <h3>
                      {w.name} <span className="worker-role">{w.role}</span>
                    </h3>
                    <p>
                      {w.phone || "No phone added"}
                      {w.status !== "active" && ` · ${w.status}`}
                      {w.salaryType !== "monthly" &&
                        " · Set monthly wage to use payroll"}
                    </p>
                  </div>
                  <div className="worker-figures">
                    <div>
                      <span>MONTHLY WAGE</span>
                      <strong>{rs(w.totals.wage)}</strong>
                    </div>
                    <div>
                      <span>ADVANCES</span>
                      <strong>
                        {w.totals.advances ? rs(w.totals.advances) : "—"}
                      </strong>
                    </div>
                    <div>
                      <span>EXTRA HRS</span>
                      <strong>
                        {w.totals.extra ? rs(w.totals.extra) : "—"}
                      </strong>
                    </div>
                    <div>
                      <span>NET PAYABLE</span>
                      <strong className="positive">
                        {w.payroll?.paidAt ? "Paid" : rs(w.totals.net)}
                      </strong>
                    </div>
                  </div>
                  <div className="worker-actions">
                    <button
                      className="finance-button success"
                      disabled={
                        !!w.payroll?.paidAt ||
                        w.status !== "active" ||
                        w.salaryType !== "monthly"
                      }
                      onClick={() => openAction("pay", w)}
                    >
                      <i aria-hidden="true" className="fa-solid fa-wallet" />
                      {w.payroll?.paidAt ? "Paid" : "Pay Wages"}
                    </button>
                    <button
                      className="finance-button secondary"
                      disabled={
                        !!w.payroll?.paidAt ||
                        w.status !== "active" ||
                        w.salaryType !== "monthly"
                      }
                      onClick={() => openAction("extra", w)}
                    >
                      <i aria-hidden="true" className="fa-regular fa-clock" />{" "}
                      Extra hours
                    </button>
                    <button
                      className="finance-button secondary"
                      disabled={
                        !!w.payroll?.paidAt ||
                        w.status !== "active" ||
                        w.salaryType !== "monthly"
                      }
                      onClick={() => openAction("advance", w)}
                    >
                      + Advance
                    </button>
                    <button
                      className="finance-icon-button"
                      aria-label={`Edit ${w.name}`}
                      onClick={() => openWorker(w)}
                    >
                      <i aria-hidden="true" className="fa-solid fa-pen" />
                    </button>
                    <button
                      className="finance-icon-button"
                      aria-label={`View history for ${w.name}`}
                      aria-expanded={expanded === w.id}
                      onClick={() =>
                        setExpanded(expanded === w.id ? null : w.id)
                      }
                    >
                      <i
                        aria-hidden="true"
                        className={`fa-solid fa-chevron-${expanded === w.id ? "up" : "down"}`}
                      />
                    </button>
                  </div>
                </div>
                {expanded === w.id && (
                  <div className="worker-history">
                    <h4>{monthLabel(month)} · Payroll history</h4>
                    {w.payroll?.paidAt && (
                      <p className="positive">
                        Wages paid: {rs(Number(w.payroll.paidAmount))} via{" "}
                        {w.payroll.paymentMethodName} on{" "}
                        {new Date(w.payroll.paidAt).toLocaleDateString("en-PK")}
                        . Absence deduction: {rs(w.totals.absence)}.
                      </p>
                    )}
                    {!w.payroll?.adjustments.length ? (
                      <p>No advances or extra hours recorded for this month.</p>
                    ) : (
                      <div className="finance-table-wrap">
                        <table className="finance-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Type</th>
                              <th>Amount</th>
                              <th>Payment method / hours</th>
                              <th>Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {w.payroll.adjustments.map((a) => (
                              <tr key={a.id}>
                                <td>
                                  {new Date(a.entryDate).toLocaleDateString(
                                    "en-PK",
                                  )}
                                </td>
                                <td>
                                  {a.kind === "extra"
                                    ? "Extra hours"
                                    : "Advance"}
                                </td>
                                <td>{rs(Number(a.amount))}</td>
                                <td>
                                  {a.kind === "extra"
                                    ? `${a.hours} hours × ${rs(Number(a.rate))}`
                                    : a.paymentMethodName}
                                </td>
                                <td>{a.notes || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      {modal && (
        <FinanceModal
          className={modal === "pay" ? "payroll-pay-modal" : ""}
          title={
            modal === "worker"
              ? selected
                ? "Edit Worker"
                : "Add Worker"
              : `${modal === "pay" ? "Pay Wages" : modal === "extra" ? "Extra hours" : "Advance"} — ${current?.name}`
          }
          subtitle={
            modal === "pay"
              ? "Choose the payroll month and confirm amounts below"
              : undefined
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
            {modal === "worker" ? (
              <>
                <label>
                  FULL NAME
                  <input
                    placeholder="e.g. Ahmed Khan"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={100}
                  />
                </label>
                <div className="finance-form-grid">
                  <label>
                    ROLE / POSITION
                    <input
                      placeholder="e.g. Tailor"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    PHONE
                    <input
                      placeholder="03XX XXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </label>
                  <label>
                    MONTHLY WAGE (RS)
                    <input
                      type="number"
                      value={wage}
                      min="0"
                      step="0.01"
                      onChange={(e) => setWage(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    DEFAULT EXTRA-HOURS RATE (RS/HR)
                    <input
                      type="number"
                      value={extraRate}
                      min="0"
                      step="0.01"
                      onChange={(e) => setExtraRate(e.target.value)}
                      required
                    />
                  </label>
                </div>
                <div className="finance-form-field"><span className="finance-label">STATUS</span><div className="finance-segmented worker-status" role="group" aria-label="Worker status">{[{value:"active",label:"Active"},{value:"inactive",label:"Inactive"},{value:"leave",label:"On leave"}].map(s=><button key={s.value} type="button" className={status===s.value?"selected":""} aria-pressed={status===s.value} onClick={()=>setStatus(s.value)}>{s.label}</button>)}</div></div>
                {selected && (
                  <p className="finance-help">
                    Wage changes apply to months without an existing payroll
                    record. Earlier payroll snapshots and payments are retained.
                  </p>
                )}
              </>
            ) : (
              <>
                <label>
                  PAYROLL MONTH
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => {
                      if (e.target.value) {
                        setMonth(e.target.value);
                        setAbsentDays("0");
                      }
                    }}
                    required
                  />
                </label>
                <p className="finance-help">
                  This entry belongs to {monthLabel(month)}. Payment date
                  controls when cash moves.
                </p>
                {isFetching ? (
                  <p>Loading selected month…</p>
                ) : current?.payroll?.paidAt ? (
                  <div className="finance-info">
                    Wages for this month are already paid. Choose an unpaid
                    month.
                  </div>
                ) : (
                  <>
                    {modal === "pay" ? (
                      <>
                        <div className="payroll-breakdown">
                          {[
                            {
                              label: "Monthly wage",
                              value: current?.totals.wage ?? 0,
                            },
                            {
                              label: "+ Extra hours",
                              value: current?.totals.extra ?? 0,
                            },
                            { label: "− Absence", value: -absence },
                            { label: "Adjusted gross", value: gross },
                            {
                              label: "− Advances",
                              value: -(current?.totals.advances ?? 0),
                            },
                            { label: "Net to pay", value: net },
                          ].map((r, i) => (
                            <div
                              className={i === 5 ? "net-row" : ""}
                              key={r.label}
                            >
                              <span>{r.label}</span>
                              <strong>{rs(r.value)}</strong>
                            </div>
                          ))}
                        </div>
                        <label>
                          ABSENT DAYS
                          <input
                            type="number"
                            value={absentDays}
                            min="0"
                            max="30"
                            step="0.5"
                            onChange={(e) => setAbsentDays(e.target.value)}
                            required
                          />
                        </label>
                        <p className="finance-help">
                          One day’s wage = monthly wage ÷ 30. Extra hours use
                          the hours and rate recorded for this month.
                        </p>
                      </>
                    ) : modal === "extra" ? (
                      <div className="finance-form-grid">
                        <label>
                          EXTRA HOURS
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={hours}
                            onChange={(e) => setHours(e.target.value)}
                            required
                          />
                        </label>
                        <label>
                          RATE (RS/HR)
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={rate}
                            onChange={(e) => setRate(e.target.value)}
                            required
                          />
                        </label>
                      </div>
                    ) : (
                      <label>
                        ADVANCE AMOUNT (RS)
                        <input
                          type="number"
                          min="0.01"
                          max={current?.totals.net}
                          step="0.01"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          required
                        />
                      </label>
                    )}
                    {modal !== "extra" && (
                      <label>
                        PAID VIA
                        <PaymentMethodSelect
                          variant="buttons"
                          value={method}
                          onChange={setMethod}
                        />
                      </label>
                    )}
                    <div className="finance-form-grid">
                      <label>
                        {modal === "extra" ? "ENTRY DATE" : "PAYMENT DATE"}
                        <input
                          type="date"
                          value={entryDate}
                          onChange={(e) => setEntryDate(e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        NOTES (OPTIONAL)
                        <input
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="e.g. Cash payment"
                        />
                      </label>
                    </div>
                    <div className="finance-impact">
                      <strong>
                        {modal === "extra"
                          ? "Payroll impact"
                          : "Cashbook impact"}
                      </strong>
                      <p>
                        {modal === "extra"
                          ? `${rs(Number(hours || 0) * Number(rate || 0))} will be added to this month’s wages. No cash moves until payment.`
                          : `An outgoing entry of ${rs(modal === "pay" ? net : Number(amount || 0))} via ${method || "the selected method"} for this payroll month.`}
                      </p>
                    </div>
                  </>
                )}
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
                className={`finance-button ${modal === "pay" ? "success" : ""}`}
                disabled={
                  busy ||
                  (modal !== "worker" &&
                    (isFetching ||
                      !!current?.payroll?.paidAt ||
                      (modal === "pay" && net < 0)))
                }
              >
                {busy
                  ? "Saving…"
                  : modal === "worker"
                    ? selected
                      ? "Save Worker"
                      : "Add Worker"
                    : modal === "pay"
                      ? `Pay ${rs(net)}`
                      : modal === "extra"
                        ? "Add Extra hours"
                        : "Record Advance"}
              </button>
            </footer>
          </form>
        </FinanceModal>
      )}
    </div>
  );
}
