"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkerTasks, useRegularInvoices, type WorkerTaskRecord } from "@/lib/hooks/useQueries";

/* ─── Styles ─────────────────────────────────────────────────────────── */
const card: React.CSSProperties = {
  background: "white", borderRadius: "var(--r)", boxShadow: "var(--sh)",
  border: "1px solid rgba(205,216,236,.5)", marginBottom: 20,
};
const th: React.CSSProperties = {
  padding: "10px 14px", textAlign: "left" as const, fontSize: 11, fontWeight: 600,
  color: "white", letterSpacing: ".5px", textTransform: "uppercase" as const,
};
const td: React.CSSProperties = {
  padding: "11px 14px", fontSize: 13, borderBottom: "1px solid var(--bg2)",
};
const xbtn = (variant: "pr" | "sc" | "gn"): React.CSSProperties => {
  const bg = { pr: "var(--blue)", sc: "var(--bg2)", gn: "var(--green)" }[variant];
  const col = variant === "sc" ? "var(--ink)" : "white";
  return { padding: "7px 14px", borderRadius: "var(--r2)", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: bg, color: col };
};
const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1.5px solid var(--bg2)",
  borderRadius: "var(--r2)", fontSize: 13, fontFamily: "inherit",
  outline: "none", background: "white", color: "var(--ink)",
};

/* ─── Constants ──────────────────────────────────────────────────────── */
const STAGES = ["cutting", "stitching", "finishing", "pressing", "ready"] as const;
type Stage = typeof STAGES[number];

const STAGE_META: Record<Stage, { label: string; icon: string; color: string; bg: string }> = {
  cutting:   { label: "Fabric Cut",          icon: "fa-scissors",            color: "var(--blue)",   bg: "var(--blue5)" },
  stitching: { label: "Stitching",            icon: "fa-needle",              color: "#7c3aed",       bg: "#f3e8ff" },
  finishing: { label: "Finishing & Pressing", icon: "fa-star",                color: "var(--green)",  bg: "#e6f9f2" },
  pressing:  { label: "Ironing / Pressing",   icon: "fa-fire-flame-curved",   color: "#c07800",       bg: "#fff8e6" },
  ready:     { label: "Ready for Pickup",     icon: "fa-box",                 color: "#0e6b8f",       bg: "#e0f7ff" },
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const isOverdue = (dueDate: string | null, status: string) =>
  status === "in_progress" && !!dueDate && new Date(dueDate) < new Date();

/* ─── Group tasks by invoice ─────────────────────────────────────────── */
interface InvoiceGroup {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  deliveryDate: string | null;
  tasks: WorkerTaskRecord[];
  currentStage: Stage | null;
  allDone: boolean;
  overdue: boolean;
}

function groupByInvoice(tasks: WorkerTaskRecord[]): InvoiceGroup[] {
  const map = new Map<string, InvoiceGroup>();
  for (const t of tasks) {
    if (!map.has(t.invoiceId)) {
      map.set(t.invoiceId, {
        invoiceId: t.invoiceId,
        invoiceNumber: t.invoiceNumber,
        customerName: t.customerName,
        deliveryDate: t.invoice.deliveryDate,
        tasks: [],
        currentStage: null,
        allDone: false,
        overdue: false,
      });
    }
    map.get(t.invoiceId)!.tasks.push(t);
  }

  for (const grp of map.values()) {
    const active = grp.tasks.find(t => t.status === "in_progress");
    grp.currentStage = (active?.stage ?? null) as Stage | null;
    grp.allDone = grp.tasks.length > 0 && grp.tasks.every(t => t.status === "completed");
    grp.overdue = grp.tasks.some(t => isOverdue(t.dueDate, t.status));
  }

  return Array.from(map.values()).sort((a, b) => {
    if (!a.allDone && b.allDone) return -1;
    if (a.allDone && !b.allDone) return 1;
    return a.invoiceNumber.localeCompare(b.invoiceNumber);
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   ORDER PIPELINE CARD
═══════════════════════════════════════════════════════════════════════ */
function OrderPipelineCard({ grp, onAdvance, onMarkReady }: {
  grp: InvoiceGroup;
  onAdvance: (task: WorkerTaskRecord) => void;
  onMarkReady: (grp: InvoiceGroup) => void;
}) {
  const activeTask = grp.tasks.find(t => t.status === "in_progress");
  const stagesWithTasks = new Map<string, WorkerTaskRecord>();
  for (const t of grp.tasks) stagesWithTasks.set(t.stage, t);

  const currentIdx = activeTask ? STAGES.indexOf(activeTask.stage as Stage) : -1;

  return (
    <div style={{ ...card, marginBottom: 0 }}>
      {/* head */}
      <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--bg2)", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ background: "var(--blue5)", color: "var(--blue)", padding: "2px 8px", borderRadius: 5, fontSize: 12, fontWeight: 700 }}>
              {grp.invoiceNumber}
            </span>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{grp.customerName}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
            {grp.tasks.map(t => t.itemDescription).filter((v, i, a) => a.indexOf(v) === i).join(", ")}
            {grp.deliveryDate && <> &bull; Due: <span style={{ color: isOverdue(grp.deliveryDate, grp.allDone ? "completed" : "in_progress") ? "var(--red)" : "inherit" }}>{fmtDate(grp.deliveryDate)}</span></>}
          </div>
        </div>
        <span style={{
          padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
          background: grp.allDone ? "#e6f9f2" : grp.overdue ? "#fff0f0" : "var(--blue5)",
          color: grp.allDone ? "var(--green)" : grp.overdue ? "var(--red)" : "var(--blue)",
        }}>
          {grp.allDone ? "Ready for Pickup" : grp.overdue ? "Overdue" : activeTask ? `In Work — ${STAGE_META[activeTask.stage as Stage]?.label ?? activeTask.stage}` : "Pending"}
        </span>
      </div>

      {/* pipeline steps */}
      <div style={{ padding: "16px 18px" }}>
        {/* Order received */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          {["Order Received"].map(label => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <i className="fa-solid fa-check" style={{ color: "white", fontSize: 11 }}></i>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{label}</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>Done</div>
              </div>
              <div style={{ width: 30, height: 2, background: "var(--bg2)", marginLeft: 4 }}></div>
            </div>
          ))}
        </div>

        {/* Production stages */}
        <div style={{ display: "flex", gap: 0, overflowX: "auto", paddingBottom: 4 }}>
          {STAGES.map((stage, idx) => {
            const task = stagesWithTasks.get(stage);
            const isDone = task?.status === "completed";
            const isActive = task?.status === "in_progress";
            const isPending = !task;
            const meta = STAGE_META[stage];
            const isLast = idx === STAGES.length - 1;

            let dotBg = "var(--bg2)";
            let dotColor = "var(--muted)";
            let dotBorder = "var(--bg3)";
            if (isDone) { dotBg = "var(--green)"; dotColor = "white"; dotBorder = "var(--green)"; }
            else if (isActive) { dotBg = "var(--blue)"; dotColor = "white"; dotBorder = "var(--blue)"; }

            return (
              <div key={stage} style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 120 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: dotBg, border: `2px solid ${dotBorder}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: isActive ? "0 0 0 4px rgba(26,111,204,.15)" : "none",
                      animation: isActive ? "activePulse 2s infinite" : "none",
                    }}>
                      <i className={`fa-solid ${isDone ? "fa-check" : meta.icon} fa-xs`} style={{ color: dotColor }}></i>
                    </div>
                    <div style={{ textAlign: "center", paddingBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: isDone ? "var(--green)" : isActive ? "var(--blue)" : "var(--muted)", lineHeight: 1.3 }}>
                        {meta.label}
                      </div>
                      {task && (
                        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                          <span style={{ background: meta.bg, color: meta.color, padding: "1px 6px", borderRadius: 10, fontWeight: 600 }}>
                            <i className="fa-solid fa-scissors fa-xs" style={{ marginRight: 3 }}></i>
                            {task.worker.name}
                          </span>
                        </div>
                      )}
                      {isPending && (
                        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>Pending</div>
                      )}
                      {isDone && task?.completedAt && (
                        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{fmtDate(task.completedAt)}</div>
                      )}
                    </div>
                  </div>
                </div>
                {!isLast && (
                  <div style={{ width: 24, height: 2, background: isDone ? "var(--green)" : "var(--bg2)", marginTop: 15, flexShrink: 0 }}></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* footer */}
      <div style={{ padding: "10px 18px", borderTop: "1px solid var(--bg2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          {grp.allDone
            ? <><i className="fa-solid fa-circle-check" style={{ color: "var(--green)", marginRight: 6 }}></i>All steps complete</>
            : activeTask
              ? `Step ${currentIdx + 2} of ${STAGES.length + 1}` // +1 for order received
              : "Awaiting assignment"}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {activeTask && !grp.allDone && (
            <button style={xbtn("pr")} onClick={() => onAdvance(activeTask)}>
              <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }}></i>Mark Stage Done
            </button>
          )}
          {grp.allDone && (
            <button style={xbtn("gn")} onClick={() => onMarkReady(grp)}>
              <i className="fa-solid fa-bell" style={{ marginRight: 6 }}></i>Notify Customer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════ */
export default function OrderUpdatePage() {
  const qc = useQueryClient();
  const { data: allTasks = [], isLoading } = useWorkerTasks();
  const { data: invoices = [] } = useRegularInvoices();

  const [statusFilter, setStatusFilter] = useState<"all" | "in_progress" | "ready" | "overdue">("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  /* ── Group all tasks by invoice ── */
  const groups = groupByInvoice(allTasks);

  /* ── Filter ── */
  const filtered = groups.filter(grp => {
    if (search) {
      const q = search.toLowerCase();
      if (!grp.invoiceNumber.toLowerCase().includes(q) && !grp.customerName.toLowerCase().includes(q)) return false;
    }
    if (statusFilter === "in_progress") return !grp.allDone;
    if (statusFilter === "ready") return grp.allDone;
    if (statusFilter === "overdue") return grp.overdue;
    return true;
  });

  /* ── Stats ── */
  const pending = groups.filter(g => !g.allDone && !g.currentStage).length;
  const inProgress = groups.filter(g => !g.allDone && !!g.currentStage).length;
  const readyCount = groups.filter(g => g.allDone).length;
  const overdueCount = groups.filter(g => g.overdue).length;

  /* ── Advance a task stage (mark current stage done, next stage becomes active for same invoice) ── */
  const handleAdvance = async (task: WorkerTaskRecord) => {
    try {
      // Mark current task complete
      await fetch(`/api/worker-tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      await qc.invalidateQueries({ queryKey: ["worker-tasks"] });
      showToast(`${task.invoiceNumber} — ${STAGE_META[task.stage as Stage]?.label ?? task.stage} marked complete`);
    } catch {
      showToast("Failed to update task");
    }
  };

  const handleMarkReady = (grp: InvoiceGroup) => {
    showToast(`${grp.invoiceNumber} (${grp.customerName}) is ready for pickup!`);
  };

  /* ── All orders summary table ── */
  const invoiceTaskMap = new Map<string, WorkerTaskRecord[]>();
  for (const t of allTasks) {
    if (!invoiceTaskMap.has(t.invoiceId)) invoiceTaskMap.set(t.invoiceId, []);
    invoiceTaskMap.get(t.invoiceId)!.push(t);
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 24, zIndex: 9999,
          background: "var(--ink)", color: "white", padding: "12px 20px",
          borderRadius: "var(--r)", display: "flex", alignItems: "center", gap: 10,
          fontSize: 13, fontWeight: 600, boxShadow: "var(--shm)",
        }}>
          <i className="fa-solid fa-circle-check"></i> {toast}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }}>
        {[
          { icon: "fa-hourglass-half", col: "var(--blue)",   bg: "var(--blue5)", val: pending,     lbl: "Pending Assignment" },
          { icon: "fa-gear",           col: "#c07800",        bg: "#fff8e6",      val: inProgress,  lbl: "In Progress" },
          { icon: "fa-circle-check",   col: "var(--green)",  bg: "#e6f9f2",      val: readyCount,  lbl: "Ready for Pickup" },
          { icon: "fa-triangle-exclamation", col: "var(--red)", bg: "#fff0f0",   val: overdueCount, lbl: "Overdue" },
        ].map(s => (
          <div key={s.lbl} style={{ ...card, padding: 18, display: "flex", alignItems: "center", gap: 14, marginBottom: 0 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <i className={`fa-solid ${s.icon}`} style={{ color: s.col, fontSize: 18 }}></i>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>
                {isLoading ? "—" : s.val}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{s.lbl}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ ...card, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <i className="fa-solid fa-magnifying-glass" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 13 }}></i>
          <input
            style={{ ...inp, paddingLeft: 36 }}
            placeholder="Search invoice or customer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {(["all", "in_progress", "ready", "overdue"] as const).map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            style={{
              padding: "8px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: "1.5px solid",
              borderColor: statusFilter === f ? "var(--blue)" : "var(--bg3)",
              background: statusFilter === f ? "var(--blue5)" : "white",
              color: statusFilter === f ? "var(--blue)" : "var(--ink)",
              cursor: "pointer",
            }}
          >
            {f === "all" ? "All" : f === "in_progress" ? "In Progress" : f === "ready" ? "Ready" : "Overdue"}
          </button>
        ))}
      </div>

      {/* Pipeline cards */}
      {isLoading ? (
        <div style={{ ...card, padding: 48, textAlign: "center", color: "var(--muted)" }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 28, marginBottom: 12, display: "block" }}></i>
          Loading order pipeline…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...card, padding: 48, textAlign: "center", color: "var(--muted)" }}>
          <i className="fa-solid fa-box-open" style={{ fontSize: 36, marginBottom: 12, display: "block", opacity: .4 }}></i>
          No orders found
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(560px, 1fr))", gap: 16, marginBottom: 20 }}>
          {filtered.map(grp => (
            <OrderPipelineCard key={grp.invoiceId} grp={grp} onAdvance={handleAdvance} onMarkReady={handleMarkReady} />
          ))}
        </div>
      )}

      {/* All Orders Summary Table */}
      <div style={card}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--bg2)", fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>
          <i className="fa-solid fa-table-list" style={{ marginRight: 8, color: "var(--blue)" }}></i>
          All Orders Summary
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "linear-gradient(135deg,var(--ink),var(--ink3))" }}>
                {["Invoice", "Customer", "Items", "Workers Assigned", "Current Stage", "Due Date", "Status"].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: 32 }}>No registered customer invoices yet</td></tr>
              ) : invoices.map(inv => {
                const tasks = invoiceTaskMap.get(inv.id) ?? [];
                const activeTask = tasks.find(t => t.status === "in_progress");
                const allDone = tasks.length > 0 && tasks.every(t => t.status === "completed");
                const workerNames = [...new Set(tasks.map(t => t.worker.name))].join(", ");

                let items: string[] = [];
                try {
                  const arr = Array.isArray(inv.items) ? inv.items : [];
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  items = arr.filter((i: any) => i.dt).map((i: any) => `${i.dt}${i.q > 1 ? ` x${i.q}` : ""}`);
                } catch { /* noop */ }

                return (
                  <tr key={inv.id}
                    style={{ transition: "background .15s" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}
                  >
                    <td style={td}>
                      <span style={{ background: "var(--blue5)", color: "var(--blue)", padding: "2px 8px", borderRadius: 5, fontSize: 12, fontWeight: 700 }}>
                        {inv.invNumber}
                      </span>
                    </td>
                    <td style={{ ...td, maxWidth: 140, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inv.customerName}</td>
                    <td style={{ ...td, fontSize: 12, color: "var(--muted)" }}>{items.join(", ") || "—"}</td>
                    <td style={{ ...td, fontSize: 12 }}>{workerNames || <span style={{ color: "var(--muted)" }}>Not assigned</span>}</td>
                    <td style={td}>
                      {tasks.length === 0
                        ? <span style={{ fontSize: 12, color: "var(--muted)" }}>Not started</span>
                        : allDone
                          ? <span style={{ background: "#e6f9f2", color: "var(--green)", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Ready for Pickup</span>
                          : activeTask
                            ? <span style={{ background: "var(--blue5)", color: "var(--blue)", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                                <i className={`fa-solid ${STAGE_META[activeTask.stage as Stage]?.icon ?? "fa-circle"} fa-xs`} style={{ marginRight: 4 }}></i>
                                {STAGE_META[activeTask.stage as Stage]?.label ?? activeTask.stage}
                              </span>
                            : <span style={{ fontSize: 12, color: "var(--muted)" }}>Pending</span>
                      }
                    </td>
                    <td style={{ ...td, fontSize: 12, color: isOverdue(inv.deliveryDate, allDone ? "completed" : "in_progress") ? "var(--red)" : "var(--muted)" }}>
                      {fmtDate(inv.deliveryDate)}
                    </td>
                    <td style={td}>
                      <span style={{
                        padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, display: "inline-block",
                        background: allDone ? "#e6f9f2" : tasks.length === 0 ? "var(--bg2)" : "#fff8e6",
                        color: allDone ? "var(--green)" : tasks.length === 0 ? "var(--muted)" : "#c07800",
                      }}>
                        {allDone ? "Ready" : tasks.length === 0 ? "Unassigned" : "In Progress"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
