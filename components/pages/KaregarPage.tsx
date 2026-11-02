"use client";
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useWorkers, useWorkerTasks, useRegularInvoices,
  type WorkerRecord, type WorkerTaskRecord, type InvoiceLean,
} from "@/lib/hooks/useQueries";

/* ─── Style tokens ───────────────────────────────────────────────────── */
const card: React.CSSProperties = {
  background: "white", borderRadius: "var(--r)", boxShadow: "var(--sh)",
  border: "1px solid rgba(205,216,236,.5)", marginBottom: 20,
};
const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "var(--ink3)",
  letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 4, display: "block",
};
const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1.5px solid var(--bg2)",
  borderRadius: "var(--r2)", fontSize: 13, fontFamily: "inherit",
  outline: "none", background: "white", color: "var(--ink)",
};
const th: React.CSSProperties = {
  padding: "10px 14px", textAlign: "left" as const, fontSize: 11, fontWeight: 600,
  color: "white", letterSpacing: ".5px", textTransform: "uppercase" as const,
};
const td: React.CSSProperties = {
  padding: "11px 14px", fontSize: 13, borderBottom: "1px solid var(--bg2)",
};
const xbtn = (variant: "pr" | "sc" | "gn" | "rd"): React.CSSProperties => {
  const bg = { pr: "var(--blue)", sc: "var(--bg2)", gn: "var(--green)", rd: "var(--red)" }[variant];
  const col = variant === "sc" ? "var(--ink)" : "white";
  return {
    padding: "9px 18px", borderRadius: "var(--r2)", border: "none", cursor: "pointer",
    fontFamily: "inherit", fontSize: 13, fontWeight: 600,
    background: bg, color: col,
  };
};
const iconBtn = (col: "blue" | "green" | "amber" | "red"): React.CSSProperties => {
  const map = {
    blue: { bg: "var(--blue5)", color: "var(--blue)" },
    green: { bg: "#e6f9f2", color: "var(--green)" },
    amber: { bg: "#fff8e6", color: "#c07800" },
    red: { bg: "#fff0f0", color: "var(--red)" },
  }[col];
  return {
    width: 30, height: 30, borderRadius: 7, border: "none", cursor: "pointer",
    background: map.bg, color: map.color, fontSize: 12,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
  };
};

/* ─── Helpers ────────────────────────────────────────────────────────── */
const STAGE_ORDER = ["cutting", "stitching", "finishing", "pressing", "ready"];
const stageLabel = (s: string) =>
  ({ cutting: "Cutting", stitching: "Stitching", finishing: "Finishing", pressing: "Pressing", ready: "Ready" }[s] ?? s);
const stageIcon = (s: string) =>
  ({ cutting: "fa-scissors", stitching: "fa-needle", finishing: "fa-star", pressing: "fa-fire-flame-curved", ready: "fa-box" }[s] ?? "fa-circle");

const priorityColor = (p: string) =>
  ({ normal: "var(--blue)", urgent: "#c07800", rush: "var(--red)" }[p] ?? "var(--muted)");

const statusBadge = (s: string): React.CSSProperties => ({
  padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, display: "inline-block",
  background: s === "in_progress" ? "#fff8e6" : "#e6f9f2",
  color: s === "in_progress" ? "#c07800" : "var(--green)",
});

const workerStatusBadge = (s: string): React.CSSProperties => ({
  padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, display: "inline-block",
  background: s === "active" ? "#e6f9f2" : s === "leave" ? "#fff8e6" : "var(--bg2)",
  color: s === "active" ? "var(--green)" : s === "leave" ? "#c07800" : "var(--muted)",
});

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const avatarColors = [
  "linear-gradient(135deg,#1057a0,#1a6fcc)",
  "linear-gradient(135deg,#1a8f5a,#22c57c)",
  "linear-gradient(135deg,#7c3aed,#a78bfa)",
  "linear-gradient(135deg,#c07800,#f0a500)",
  "linear-gradient(135deg,#b03030,#e03c3c)",
  "linear-gradient(135deg,#0e6b8f,#2e8fe0)",
];

const ROLES = ["Master Cutter", "Senior Tailor", "Junior Tailor", "Finishing Expert", "Embroidery", "Ironing / Pressing"];

/* ─── Empty form states ──────────────────────────────────────────────── */
const emptyWorker = () => ({
  name: "", role: "Senior Tailor", phone: "", cnic: "",
  salaryType: "per_piece", rate: "", joinDate: "", status: "active", notes: "",
});
const emptyTask = () => ({
  workerId: "", invoiceId: "", itemDescription: "",
  stage: "cutting", dueDate: "", pieceRate: "", priority: "normal", notes: "",
});

/* ─── Toast ──────────────────────────────────────────────────────────── */
function useToast() {
  const [toast, setToast] = useState<{ msg: string; icon: string } | null>(null);
  const show = useCallback((msg: string, icon = "fa-circle-check") => {
    setToast({ msg, icon });
    setTimeout(() => setToast(null), 3000);
  }, []);
  return { toast, show };
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════ */
export default function KaregarPage() {
  const qc = useQueryClient();
  const { toast, show: showToast } = useToast();

  const { data: workers = [], isLoading: wLoading } = useWorkers();
  const { data: allTasks = [], isLoading: tLoading } = useWorkerTasks();
  const { data: invoices = [] } = useRegularInvoices();

  /* filter / search state */
  const [taskWorkerFilter, setTaskWorkerFilter] = useState("");
  const [taskStageFilter, setTaskStageFilter] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState("in_progress");

  /* modal states */
  const [workerModal, setWorkerModal] = useState<{ open: boolean; editing: WorkerRecord | null }>({ open: false, editing: null });
  const [workerForm, setWorkerForm] = useState(emptyWorker());

  const [taskModal, setTaskModal] = useState<{ open: boolean; preWorkerId?: string; preWorkerName?: string; editingTask?: WorkerTaskRecord | null }>({ open: false });
  const [taskForm, setTaskForm] = useState(emptyTask());

  const [detailModal, setDetailModal] = useState<{ open: boolean; worker: WorkerRecord | null }>({ open: false, worker: null });

  const [saving, setSaving] = useState(false);

  /* ── Derived stats ─────────────────────────────────────────────────── */
  const totalWorkers = workers.length;
  const activeWorkers = workers.filter(w => w.status === "active").length;
  const inProgressTasks = allTasks.filter(t => t.status === "in_progress").length;

  /* ── Filtered tasks ────────────────────────────────────────────────── */
  const filteredTasks = allTasks.filter(t => {
    if (taskWorkerFilter && t.workerId !== taskWorkerFilter) return false;
    if (taskStageFilter && t.stage !== taskStageFilter) return false;
    if (taskStatusFilter && t.status !== taskStatusFilter) return false;
    return true;
  });

  /* ── Invoice items helper ──────────────────────────────────────────── */
  const getInvoiceItems = (inv: InvoiceLean): string[] => {
    try {
      const items = Array.isArray(inv.items) ? inv.items : [];
      return items
        .filter((i: { dt?: string; q?: number }) => i.dt)
        .map((i: { dt?: string; q?: number }) => `${i.dt}${i.q && i.q > 1 ? ` x${i.q}` : ""}`);
    } catch { return []; }
  };

  const selectedInvoice = invoices.find(i => i.id === taskForm.invoiceId) ?? null;

  /* ── Open modals ───────────────────────────────────────────────────── */
  const openAddWorker = () => {
    setWorkerForm(emptyWorker());
    setWorkerModal({ open: true, editing: null });
  };
  const openEditWorker = (w: WorkerRecord) => {
    setWorkerForm({
      name: w.name, role: w.role, phone: w.phone ?? "", cnic: w.cnic ?? "",
      salaryType: w.salaryType, rate: String(w.rate), joinDate: w.joinDate?.slice(0, 10) ?? "",
      status: w.status, notes: w.notes ?? "",
    });
    setWorkerModal({ open: true, editing: w });
  };
  const openAssignTask = (workerId?: string, workerName?: string) => {
    setTaskForm({ ...emptyTask(), workerId: workerId ?? "" });
    setTaskModal({ open: true, preWorkerId: workerId, preWorkerName: workerName });
  };
  const openEditTask = (t: WorkerTaskRecord) => {
    setTaskForm({
      workerId: t.workerId, invoiceId: t.invoiceId,
      itemDescription: t.itemDescription, stage: t.stage,
      dueDate: t.dueDate?.slice(0, 10) ?? "", pieceRate: String(t.pieceRate),
      priority: t.priority, notes: t.notes ?? "",
    });
    setTaskModal({ open: true, editingTask: t });
  };

  /* ── Save worker ───────────────────────────────────────────────────── */
  const saveWorker = async () => {
    if (!workerForm.name.trim()) { showToast("Name is required", "fa-triangle-exclamation"); return; }
    if (!workerForm.role.trim()) { showToast("Role is required", "fa-triangle-exclamation"); return; }
    setSaving(true);
    try {
      const editing = workerModal.editing;
      const res = await fetch(editing ? `/api/workers/${editing.id}` : "/api/workers", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workerForm),
      });
      if (!res.ok) { const e = await res.json(); showToast(e.error ?? "Failed", "fa-triangle-exclamation"); return; }
      await qc.invalidateQueries({ queryKey: ["workers"] });
      setWorkerModal({ open: false, editing: null });
      showToast(editing ? `${workerForm.name} updated` : `Worker added`, "fa-user-plus");
    } finally { setSaving(false); }
  };

  /* ── Save task ─────────────────────────────────────────────────────── */
  const saveTask = async () => {
    if (!taskForm.workerId) { showToast("Select a worker", "fa-triangle-exclamation"); return; }
    if (!taskForm.invoiceId) { showToast("Select an invoice", "fa-triangle-exclamation"); return; }
    if (!taskForm.itemDescription.trim()) { showToast("Enter item description", "fa-triangle-exclamation"); return; }
    setSaving(true);
    try {
      const editing = taskModal.editingTask;
      const res = await fetch(editing ? `/api/worker-tasks/${editing.id}` : "/api/worker-tasks", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskForm),
      });
      if (!res.ok) { const e = await res.json(); showToast(e.error ?? "Failed", "fa-triangle-exclamation"); return; }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["worker-tasks"] }),
        qc.invalidateQueries({ queryKey: ["workers"] }),
      ]);
      setTaskModal({ open: false });
      showToast(editing ? "Task updated" : "Task assigned successfully", "fa-circle-check");
    } finally { setSaving(false); }
  };

  /* ── Mark task complete ────────────────────────────────────────────── */
  const markComplete = async (task: WorkerTaskRecord) => {
    try {
      await fetch(`/api/worker-tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["worker-tasks"] }),
        qc.invalidateQueries({ queryKey: ["workers"] }),
      ]);
      showToast(`${task.taskId} marked complete`, "fa-circle-check");
    } catch { showToast("Failed to update task", "fa-triangle-exclamation"); }
  };

  /* ── Delete worker ─────────────────────────────────────────────────── */
  const deleteWorker = async (w: WorkerRecord) => {
    if (!confirm(`Remove ${w.name} (${w.workerId})?`)) return;
    const res = await fetch(`/api/workers/${w.id}`, { method: "DELETE" });
    if (!res.ok) { const e = await res.json(); showToast(e.error ?? "Failed", "fa-triangle-exclamation"); return; }
    await qc.invalidateQueries({ queryKey: ["workers"] });
    showToast(`${w.name} removed`);
  };

  /* ─────────────────────────────────────────────────────────────────── */
  return (
    <div>
      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 24, zIndex: 9999,
          background: "var(--ink)", color: "white", padding: "12px 20px",
          borderRadius: "var(--r)", display: "flex", alignItems: "center", gap: 10,
          fontSize: 13, fontWeight: 600, boxShadow: "var(--shm)",
          animation: "slideUp .25s ease",
        }}>
          <i className={`fa-solid ${toast.icon}`}></i> {toast.msg}
        </div>
      )}

      {/* ── Summary cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
        {[
          { icon: "fa-people-group", col: "var(--blue)", bg: "var(--blue5)", val: totalWorkers, lbl: "Total Workers" },
          { icon: "fa-circle-check", col: "var(--green)", bg: "#e6f9f2", val: activeWorkers, lbl: "Active Today" },
          { icon: "fa-scissors", col: "#c07800", bg: "#fff8e6", val: inProgressTasks, lbl: "Tasks In Progress" },
        ].map(s => (
          <div key={s.lbl} style={{ ...card, padding: 18, display: "flex", alignItems: "center", gap: 14, marginBottom: 0 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <i className={`fa-solid ${s.icon}`} style={{ color: s.col, fontSize: 18 }}></i>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>
                {wLoading || tLoading ? "—" : s.val}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{s.lbl}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Worker Cards Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
        {wLoading ? (
          <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: "var(--muted)" }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24 }}></i>
          </div>
        ) : workers.map((w, idx) => {
          const inProgressCount = w.tasks?.length ?? 0;
          const totalCount = w._count?.tasks ?? 0;
          const progress = totalCount > 0 ? Math.min(100, Math.round((totalCount / Math.max(totalCount, 10)) * 100)) : 0;
          const isActive = w.status === "active";
          const avatarBg = isActive ? avatarColors[idx % avatarColors.length] : "var(--bg3)";

          return (
            <div key={w.id} style={{
              ...card, padding: 18, marginBottom: 0,
              display: "flex", flexDirection: "column", gap: 12,
              position: "relative", overflow: "hidden",
              opacity: w.status === "inactive" ? 0.7 : 1,
            }}>
              {/* top accent bar */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 4,
                background: isActive ? "linear-gradient(90deg,var(--blue),var(--blue3))" : "var(--bg3)",
              }} />

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: avatarBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontSize: 18, fontWeight: 700, flexShrink: 0,
                }}>
                  {w.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    <i className="fa-solid fa-scissors" style={{ fontSize: 10, marginRight: 4 }}></i>{w.role}
                  </div>
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", background: "var(--bg)", padding: "2px 7px", borderRadius: 6 }}>
                  {w.workerId}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, textAlign: "center" }}>
                {[
                  { n: totalCount, l: "Total Tasks" },
                  { n: inProgressCount, l: "In Progress" },
                  { n: w.rate > 0 ? `Rs ${w.rate.toLocaleString()}` : "—", l: `Rate / ${w.salaryType === "per_piece" ? "Piece" : w.salaryType === "monthly" ? "Month" : "Day"}` },
                ].map(s => (
                  <div key={s.l} style={{ background: "var(--bg)", borderRadius: 8, padding: "8px 4px" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{s.n}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{s.l}</div>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                  <span>Monthly Progress</span>
                  <span style={{ fontWeight: 600, color: progress > 70 ? "var(--green)" : progress > 40 ? "var(--blue)" : "#c07800" }}>
                    {progress}%
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: "var(--bg2)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 4, transition: "width .4s",
                    width: `${progress}%`,
                    background: progress > 70 ? "var(--green)" : progress > 40 ? "var(--blue)" : "#c07800",
                  }} />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--bg2)" }}>
                <span style={workerStatusBadge(w.status)}>
                  <i className={`fa-solid ${w.status === "active" ? "fa-circle" : w.status === "leave" ? "fa-moon" : "fa-ban"} fa-xs`} style={{ marginRight: 4 }}></i>
                  {w.status === "active" ? "Active" : w.status === "leave" ? "On Leave" : "Inactive"}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={iconBtn("blue")} title="View Tasks" onClick={() => setDetailModal({ open: true, worker: w })}>
                    <i className="fa-solid fa-eye"></i>
                  </button>
                  <button style={iconBtn("amber")} title="Edit Worker" onClick={() => openEditWorker(w)}>
                    <i className="fa-solid fa-pen"></i>
                  </button>
                  <button style={iconBtn("green")} title="Assign Task" onClick={() => openAssignTask(w.id, w.name)}>
                    <i className="fa-solid fa-plus-circle"></i>
                  </button>
                  <button style={iconBtn("red")} title="Remove Worker" onClick={() => deleteWorker(w)}>
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add Worker card */}
        <div
          onClick={openAddWorker}
          style={{
            ...card, padding: 18, marginBottom: 0,
            border: "2px dashed var(--bg3)", background: "var(--bg)",
            boxShadow: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            minHeight: 200,
          }}
        >
          <div style={{ textAlign: "center", color: "var(--muted)" }}>
            <i className="fa-solid fa-user-plus" style={{ fontSize: 32, color: "var(--bg3)", marginBottom: 10, display: "block" }}></i>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Add New Worker</div>
            <div style={{ fontSize: 11, marginTop: 3 }}>Click to register</div>
          </div>
        </div>
      </div>

      {/* ── Active Tasks Table ── */}
      <div style={card}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--bg2)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>
            <i className="fa-solid fa-list-check" style={{ marginRight: 8, color: "var(--blue)" }}></i>
            Worker Tasks
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select
              style={{ ...inp, width: "auto", padding: "7px 12px" }}
              value={taskWorkerFilter}
              onChange={e => setTaskWorkerFilter(e.target.value)}
            >
              <option value="">All Workers</option>
              {workers.map(w => <option key={w.id} value={w.id}>{w.workerId} — {w.name}</option>)}
            </select>
            <select
              style={{ ...inp, width: "auto", padding: "7px 12px" }}
              value={taskStageFilter}
              onChange={e => setTaskStageFilter(e.target.value)}
            >
              <option value="">All Stages</option>
              {STAGE_ORDER.map(s => <option key={s} value={s}>{stageLabel(s)}</option>)}
            </select>
            <select
              style={{ ...inp, width: "auto", padding: "7px 12px" }}
              value={taskStatusFilter}
              onChange={e => setTaskStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            <button style={xbtn("pr")} onClick={() => openAssignTask()}>
              <i className="fa-solid fa-plus" style={{ marginRight: 6 }}></i>Assign Task
            </button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "linear-gradient(135deg,var(--ink),var(--ink3))" }}>
                {["Task ID", "Invoice", "Customer", "Worker", "Item", "Stage", "Priority", "Assigned", "Due Date", "Status", "Actions"].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tLoading ? (
                <tr><td colSpan={11} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: 32 }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }}></i>Loading…
                </td></tr>
              ) : filteredTasks.length === 0 ? (
                <tr><td colSpan={11} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: 32 }}>
                  No tasks found
                </td></tr>
              ) : filteredTasks.map(t => (
                <tr key={t.id} style={{ transition: "background .15s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}
                >
                  <td style={{ ...td, fontWeight: 700, color: "var(--muted)", fontSize: 12 }}>{t.taskId}</td>
                  <td style={td}>
                    <span style={{ background: "var(--blue5)", color: "var(--blue)", padding: "2px 8px", borderRadius: 5, fontSize: 12, fontWeight: 700 }}>
                      {t.invoiceNumber}
                    </span>
                  </td>
                  <td style={{ ...td, maxWidth: 140, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.customerName}</td>
                  <td style={td}>
                    <span style={{ background: "var(--blue5)", color: "var(--blue)", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>
                      {t.worker.name}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: 12 }}>{t.itemDescription}</td>
                  <td style={td}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "var(--blue5)", color: "var(--blue)" }}>
                      <i className={`fa-solid ${stageIcon(t.stage)} fa-xs`}></i>
                      {stageLabel(t.stage)}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{ fontWeight: 600, fontSize: 12, color: priorityColor(t.priority), textTransform: "capitalize" }}>
                      {t.priority}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: 12, color: "var(--muted)" }}>{fmtDate(t.assignedAt)}</td>
                  <td style={{ ...td, fontSize: 12, color: t.dueDate && new Date(t.dueDate) < new Date() && t.status === "in_progress" ? "var(--red)" : "var(--muted)" }}>
                    {fmtDate(t.dueDate)}
                  </td>
                  <td style={td}><span style={statusBadge(t.status)}>{t.status === "in_progress" ? "In Progress" : "Completed"}</span></td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button style={iconBtn("amber")} title="Edit" onClick={() => openEditTask(t)}>
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      {t.status === "in_progress" && (
                        <button style={iconBtn("green")} title="Mark Complete" onClick={() => markComplete(t)}>
                          <i className="fa-solid fa-circle-check"></i>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ════════════════════════════════════════════════
          ADD / EDIT WORKER MODAL
      ════════════════════════════════════════════════ */}
      {workerModal.open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setWorkerModal({ open: false, editing: null }); }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 580, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "var(--shm)" }}>
            <div style={{ padding: "18px 24px", background: "linear-gradient(135deg,var(--ink),#0e3460)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ color: "white", fontSize: 16, fontWeight: 700 }}>
                <i className="fa-solid fa-user-plus" style={{ marginRight: 8, color: "var(--gold)" }}></i>
                {workerModal.editing ? "Edit Worker" : "Add New Worker (Karegar)"}
              </h3>
              <button onClick={() => setWorkerModal({ open: false, editing: null })} style={{ background: "none", border: "none", color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: 18 }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              {!workerModal.editing && (
                <div style={{ background: "var(--blue5)", border: "1px solid var(--bg3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "var(--blue)", display: "flex", alignItems: "center", gap: 8 }}>
                  <i className="fa-solid fa-id-badge"></i> Worker ID will be auto-assigned
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lbl}>Full Name *</label>
                  <input style={inp} placeholder="Worker full name" value={workerForm.name} onChange={e => setWorkerForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Role / Skill *</label>
                  <select style={inp} value={workerForm.role} onChange={e => setWorkerForm(f => ({ ...f, role: e.target.value }))}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Phone</label>
                  <input style={inp} placeholder="03XX-XXXXXXX" value={workerForm.phone} onChange={e => setWorkerForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>CNIC (optional)</label>
                  <input style={inp} placeholder="XXXXX-XXXXXXX-X" value={workerForm.cnic} onChange={e => setWorkerForm(f => ({ ...f, cnic: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Salary Type</label>
                  <select style={inp} value={workerForm.salaryType} onChange={e => setWorkerForm(f => ({ ...f, salaryType: e.target.value }))}>
                    <option value="per_piece">Per Piece (پیس ریٹ)</option>
                    <option value="monthly">Monthly Fixed</option>
                    <option value="daily">Daily Wage</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Rate (Rs)</label>
                  <input style={inp} type="number" placeholder="e.g. 500" value={workerForm.rate} onChange={e => setWorkerForm(f => ({ ...f, rate: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Join Date</label>
                  <input style={inp} type="date" value={workerForm.joinDate} onChange={e => setWorkerForm(f => ({ ...f, joinDate: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Status</label>
                  <select style={inp} value={workerForm.status} onChange={e => setWorkerForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="leave">On Leave</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lbl}>Notes</label>
                  <textarea style={{ ...inp, resize: "vertical", minHeight: 70 }} placeholder="Special skills or notes…" value={workerForm.notes} onChange={e => setWorkerForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--bg2)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={xbtn("sc")} onClick={() => setWorkerModal({ open: false, editing: null })}>Cancel</button>
              <button style={xbtn("pr")} onClick={saveWorker} disabled={saving}>
                {saving ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Saving…</> : workerModal.editing ? "Update Worker" : "Add Worker"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          ASSIGN / EDIT TASK MODAL
      ════════════════════════════════════════════════ */}
      {taskModal.open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setTaskModal({ open: false }); }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "var(--shm)" }}>
            <div style={{ padding: "18px 24px", background: "linear-gradient(135deg,var(--ink),#0e3460)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ color: "white", fontSize: 16, fontWeight: 700 }}>
                <i className="fa-solid fa-plus-circle" style={{ marginRight: 8, color: "var(--gold)" }}></i>
                {taskModal.editingTask ? "Edit Task" : taskModal.preWorkerName ? `Assign Task — ${taskModal.preWorkerName}` : "Assign Task"}
              </h3>
              <button onClick={() => setTaskModal({ open: false })} style={{ background: "none", border: "none", color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: 18 }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

                {/* Worker */}
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lbl}>Worker (Karegar) *</label>
                  <select
                    style={inp}
                    value={taskForm.workerId}
                    onChange={e => setTaskForm(f => ({ ...f, workerId: e.target.value }))}
                  >
                    <option value="">— Select Worker —</option>
                    {workers.filter(w => w.status !== "inactive").map(w => (
                      <option key={w.id} value={w.id}>{w.workerId} — {w.name} ({w.role})</option>
                    ))}
                  </select>
                </div>

                {/* Invoice — only regular (registered customer) invoices */}
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lbl}>Invoice (Registered Customer) *</label>
                  <select
                    style={inp}
                    value={taskForm.invoiceId}
                    onChange={e => {
                      const id = e.target.value;
                      setTaskForm(f => ({ ...f, invoiceId: id, itemDescription: "" }));

                    }}
                  >
                    <option value="">— Select Invoice —</option>
                    {invoices.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invNumber} — {inv.customerName}{inv.deliveryDate ? ` (Due: ${fmtDate(inv.deliveryDate)})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Invoice items quick-pick */}
                {selectedInvoice && getInvoiceItems(selectedInvoice).length > 0 && (
                  <div style={{ gridColumn: "1/-1" }}>
                    <label style={lbl}>Quick-pick item from invoice</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {getInvoiceItems(selectedInvoice).map(item => (
                        <button
                          key={item}
                          type="button"
                          style={{
                            padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                            border: "1.5px solid",
                            borderColor: taskForm.itemDescription === item ? "var(--blue)" : "var(--bg3)",
                            background: taskForm.itemDescription === item ? "var(--blue5)" : "white",
                            color: taskForm.itemDescription === item ? "var(--blue)" : "var(--ink)",
                          }}
                          onClick={() => setTaskForm(f => ({ ...f, itemDescription: item }))}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Item description */}
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lbl}>Item Description *</label>
                  <input style={inp} placeholder="e.g. Qameez x2" value={taskForm.itemDescription} onChange={e => setTaskForm(f => ({ ...f, itemDescription: e.target.value }))} />
                </div>

                {/* Stage */}
                <div>
                  <label style={lbl}>Stage to Start</label>
                  <select style={inp} value={taskForm.stage} onChange={e => setTaskForm(f => ({ ...f, stage: e.target.value }))}>
                    {STAGE_ORDER.map(s => (
                      <option key={s} value={s}>{stageLabel(s)}</option>
                    ))}
                  </select>
                </div>

                {/* Due date */}
                <div>
                  <label style={lbl}>Due Date</label>
                  <input style={inp} type="date" value={taskForm.dueDate} onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))} />
                </div>

                {/* Piece rate */}
                <div>
                  <label style={lbl}>Piece Rate (Rs)</label>
                  <input style={inp} type="number" placeholder="e.g. 400" value={taskForm.pieceRate} onChange={e => setTaskForm(f => ({ ...f, pieceRate: e.target.value }))} />
                </div>

                {/* Priority */}
                <div>
                  <label style={lbl}>Priority</label>
                  <select style={inp} value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="rush">Rush</option>
                  </select>
                </div>

                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lbl}>Notes for Worker</label>
                  <textarea style={{ ...inp, resize: "vertical", minHeight: 60 }} placeholder="Special instructions…" value={taskForm.notes} onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))} />
                </div>


              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--bg2)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={xbtn("sc")} onClick={() => setTaskModal({ open: false })}>Cancel</button>
              <button style={xbtn("pr")} onClick={saveTask} disabled={saving}>
                {saving ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Saving…</> : taskModal.editingTask ? "Update Task" : "Assign Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          WORKER DETAIL MODAL
      ════════════════════════════════════════════════ */}
      {detailModal.open && detailModal.worker && (() => {
        const w = detailModal.worker;
        const wTasks = allTasks.filter(t => t.workerId === w.id);
        const done = wTasks.filter(t => t.status === "completed").length;
        const active = wTasks.filter(t => t.status === "in_progress").length;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) setDetailModal({ open: false, worker: null }); }}>
            <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "var(--shm)" }}>
              <div style={{ padding: "18px 24px", background: "linear-gradient(135deg,var(--ink),#0e3460)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ color: "white", fontSize: 16, fontWeight: 700 }}>
                  <i className="fa-solid fa-user" style={{ marginRight: 8, color: "var(--gold)" }}></i>
                  {w.name} — {w.workerId}
                </h3>
                <button onClick={() => setDetailModal({ open: false, worker: null })} style={{ background: "none", border: "none", color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: 18 }}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
                {/* info row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
                  {[
                    { l: "Role", v: w.role },
                    { l: "Status", v: w.status === "active" ? "Active" : w.status === "leave" ? "On Leave" : "Inactive" },
                    { l: "Total Tasks", v: wTasks.length },
                    { l: "In Progress", v: active },
                  ].map(s => (
                    <div key={s.l} style={{ background: "var(--bg)", borderRadius: 8, padding: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>{s.v}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{s.l}</div>
                    </div>
                  ))}
                </div>
                {/* info details */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20, fontSize: 13 }}>
                  {w.phone && <div><span style={{ color: "var(--muted)", fontSize: 11 }}>Phone</span><br />{w.phone}</div>}
                  {w.cnic && <div><span style={{ color: "var(--muted)", fontSize: 11 }}>CNIC</span><br />{w.cnic}</div>}
                  {w.joinDate && <div><span style={{ color: "var(--muted)", fontSize: 11 }}>Joined</span><br />{fmtDate(w.joinDate)}</div>}
                  <div><span style={{ color: "var(--muted)", fontSize: 11 }}>Salary</span><br />Rs {w.rate.toLocaleString()} / {w.salaryType === "per_piece" ? "piece" : w.salaryType === "monthly" ? "month" : "day"}</div>
                </div>
                {/* task list */}
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Tasks ({wTasks.length})</div>
                {wTasks.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--muted)" }}>No tasks assigned yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {wTasks.map(t => (
                      <div key={t.id} style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--bg2)" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{t.invoiceNumber} — {t.customerName}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.itemDescription} &bull; {stageLabel(t.stage)}</div>
                        </div>
                        <span style={statusBadge(t.status)}>{t.status === "in_progress" ? "In Progress" : "Done"}</span>
                        {t.dueDate && <span style={{ fontSize: 11, color: "var(--muted)" }}>Due {fmtDate(t.dueDate)}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {done > 0 && (
                  <div style={{ marginTop: 16, fontSize: 12, color: "var(--green)", fontWeight: 600 }}>
                    <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }}></i>
                    {done} task{done !== 1 ? "s" : ""} completed
                  </div>
                )}
              </div>
              <div style={{ padding: "16px 24px", borderTop: "1px solid var(--bg2)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button style={xbtn("sc")} onClick={() => setDetailModal({ open: false, worker: null })}>Close</button>
                <button style={xbtn("pr")} onClick={() => { setDetailModal({ open: false, worker: null }); openAssignTask(w.id, w.name); }}>
                  <i className="fa-solid fa-plus" style={{ marginRight: 6 }}></i>Assign Task
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
