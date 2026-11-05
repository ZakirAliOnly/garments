"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
interface Event {
  id: string;
  createdAt: string;
  type: string;
  description: string;
  actorName: string;
  actorEmail: string | null;
  amount: string | null;
  direction: string | null;
  status: string | null;
  method: string | null;
}
interface Result {
  events: Event[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    invoices: number;
    invoiceAmount: number;
    cashIn: number;
    cashOut: number;
    tasks: number;
  };
}
const ranges = [
  ["today", "Today"],
  ["7", "7 Days"],
  ["30", "30 Days"],
  ["90", "3 Months"],
  ["all", "All Time"],
];
const types = [
  ["all", "All Types"],
  ["invoices", "Invoices"],
  ["payments", "Payments"],
  ["tasks", "Tasks"],
  ["payroll", "Payroll"],
  ["workers", "Workers"],
  ["purchases", "Purchases"],
  ["stock", "Stock"],
  ["refunds", "Refunds & Replacements"],
  ["methods", "Payment Methods & Transfers"],
  ["users", "Users"],
  ["customers", "Customers"],
];
const money = (value: number | string) =>
  `Rs ${Number(value).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Karachi",
});
const timeFormat = new Intl.DateTimeFormat("en-PK", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Karachi",
});
export default function ActivityPage() {
  const [range, setRange] = useState("30"),
    [type, setType] = useState("all"),
    [page, setPage] = useState(1);
  const { data, isLoading, isError, isFetching, refetch } = useQuery<Result>({
    queryKey: ["activity", range, type, page],
    queryFn: async () => {
      const r = await fetch(
        `/api/activity?range=${range}&type=${type}&page=${page}`,
        { cache: "no-store" },
      );
      if (!r.ok) throw Error("Unable to load activity log");
      return r.json();
    },
    staleTime: 0,
  });
  const summary = data?.summary;
  return (
    <section className="activity-page" aria-labelledby="activity-title">
      <div className="activity-heading">
        <div>
          <div className="activity-title">
            <span aria-hidden="true">
              <i className="fas fa-wave-square" />
            </span>
            <h2 id="activity-title">Activity Log</h2>
          </div>
          <p>
            All application activity — invoices, payments, workers, salaries,
            and more
          </p>
        </div>
        <button
          className="activity-control"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <i
            className={`fas fa-rotate${isFetching ? " fa-spin" : ""}`}
            aria-hidden="true"
          />{" "}
          Refresh
        </button>
      </div>
      <div className="activity-stats" aria-live="polite">
        <div>
          <span>Total Events</span>
          <strong>{data?.total.toLocaleString() ?? "—"}</strong>
        </div>
        <div>
          <span>Invoices</span>
          <strong className="activity-blue">
            {summary
              ? `${summary.invoices} — ${money(summary.invoiceAmount)}`
              : "—"}
          </strong>
        </div>
        <div>
          <span>Cash In</span>
          <strong className="activity-green">
            {summary ? money(summary.cashIn) : "—"}
          </strong>
        </div>
        <div>
          <span>Cash Out</span>
          <strong className="activity-red">
            {summary ? money(summary.cashOut) : "—"}
          </strong>
        </div>
        <div>
          <span>Tasks</span>
          <strong className="activity-orange">{summary?.tasks ?? "—"}</strong>
        </div>
      </div>
      <div className="activity-filters">
        <div role="group" aria-label="Activity date range">
          {ranges.map(([value, label]) => (
            <button
              key={value}
              className={`activity-control${range === value ? " selected" : ""}`}
              aria-pressed={range === value}
              onClick={() => {
                setRange(value);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="activity-type">
          Activity type
        </label>
        <select
          id="activity-type"
          className="activity-control"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        >
          {types.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {isError ? (
        <div className="finance-error" role="alert">
          Unable to load activity log.{" "}
          <button onClick={() => void refetch()}>Try again</button>
        </div>
      ) : (
        <div
          className="activity-table-wrap"
          aria-busy={isFetching}
          tabIndex={0}
          role="region"
          aria-label="Activity records"
        >
          <table className="activity-table">
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Type</th>
                <th>Description</th>
                <th>User</th>
                <th className="activity-amount">Amount</th>
                <th>Status / Method</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="activity-empty">
                    Loading activity…
                  </td>
                </tr>
              ) : !data?.events.length ? (
                <tr>
                  <td colSpan={6} className="activity-empty">
                    <i className="fas fa-wave-square" aria-hidden="true" />
                    <strong>No activity found</strong>
                    <span>
                      Try another date range or activity type. New actions will
                      appear here.
                    </span>
                  </td>
                </tr>
              ) : (
                data.events.map((event) => {
                  const tone =
                    event.direction === "in"
                      ? "green"
                      : event.direction === "out"
                        ? "red"
                        : event.type.includes("Deleted")
                          ? "red"
                          : "blue";
                  return (
                    <tr key={event.id}>
                      <td>
                        <time dateTime={event.createdAt}>
                          {dateFormat.format(new Date(event.createdAt))}
                          <small>
                            {timeFormat.format(new Date(event.createdAt))}
                          </small>
                        </time>
                      </td>
                      <td>
                        <span className={`activity-badge ${tone}`}>
                          <i
                            className={`fas fa-${event.direction === "in" ? "arrow-trend-up" : event.direction === "out" ? "arrow-trend-down" : "file-lines"}`}
                            aria-hidden="true"
                          />
                          {event.type}
                        </span>
                      </td>
                      <td className="activity-description">
                        {event.description}
                      </td>
                      <td>
                        <div className="activity-user">
                          <span className="activity-avatar" aria-hidden="true">
                            {event.actorName.slice(0, 1).toUpperCase()}
                          </span>
                          <div>
                            <strong>{event.actorName}</strong>
                            {event.actorEmail && (
                              <small>{event.actorEmail}</small>
                            )}
                          </div>
                        </div>
                      </td>
                      <td
                        className={`activity-amount ${event.direction ? `activity-${tone}` : ""}`}
                      >
                        {event.amount === null
                          ? "—"
                          : `${event.direction === "out" ? "−" : event.direction === "in" ? "+" : ""}${money(event.amount)}`}
                      </td>
                      <td>
                        {event.method ? (
                          <span className="activity-badge neutral">
                            {event.method}
                          </span>
                        ) : event.status ? (
                          <span
                            className={`activity-badge ${["paid", "active", "completed"].includes(event.status) ? "green" : ["unpaid", "disabled", "pending"].includes(event.status) ? "red" : "orange"}`}
                          >
                            {event.status}
                          </span>
                        ) : (
                          <span className="activity-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > 0 && (
        <div className="activity-pagination">
          <span>
            {(page - 1) * 50 + 1}–{Math.min(page * 50, data.total)} of{" "}
            {data.total.toLocaleString()} events · Times in Pakistan
          </span>
          <div>
            <button
              className="activity-control"
              disabled={page === 1 || isFetching}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span>Page {page}</span>
            <button
              className="activity-control"
              disabled={page * 50 >= data.total || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
      <p className="activity-footnote">
        Activity totals reflect recorded events in the selected filters,
        including payments later edited or reversed. They are not current
        account balances. User attribution is captured when an action is
        recorded.
      </p>
    </section>
  );
}
