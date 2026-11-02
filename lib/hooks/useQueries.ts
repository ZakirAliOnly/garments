import { useQuery } from "@tanstack/react-query";

export interface CustomerOption {
  id: string;
  cid: string;
  name: string;
  phone: string;
  address: string | null;
}

export interface AccountHeader {
  id: string;
  name: string;
  prefix: string;
  customerCount: number;
  createdAt: string;
}

// Full lean customer list — used by dropdowns across all pages.
// staleTime = 60s: same data won't be re-fetched when switching pages.
export function useCustomersLean() {
  return useQuery<CustomerOption[]>({
    queryKey: ["customers", "lean"],
    queryFn: async () => {
      const res = await fetch("/api/customers?lean=1");
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    },
    staleTime: 60_000,
  });
}

// Account headers — rarely change; 5-min staleTime.
export function useAccountHeaders() {
  return useQuery<AccountHeader[]>({
    queryKey: ["account-headers"],
    queryFn: async () => {
      const res = await fetch("/api/account-headers");
      if (!res.ok) throw new Error("Failed to fetch account headers");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}

// ── Workers ──────────────────────────────────────────────────────────────────

export interface WorkerRecord {
  id: string;
  workerId: string;
  name: string;
  role: string;
  phone: string | null;
  cnic: string | null;
  salaryType: string;
  rate: number;
  joinDate: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { tasks: number };
  tasks: { id: string }[]; // in_progress tasks only (for count)
}

export function useWorkers(status?: string) {
  return useQuery<WorkerRecord[]>({
    queryKey: ["workers", status ?? "all"],
    queryFn: async () => {
      const url = status ? `/api/workers?status=${status}` : "/api/workers";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch workers");
      return res.json();
    },
    staleTime: 30_000,
  });
}

// ── Worker Tasks ─────────────────────────────────────────────────────────────

export interface WorkerTaskRecord {
  id: string;
  taskId: string;
  workerId: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  itemDescription: string;
  stage: string;
  dueDate: string | null;
  pieceRate: number;
  priority: string;
  status: string;
  notes: string | null;
  assignedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  worker: { id: string; workerId: string; name: string; role: string };
  invoice: { id: string; invNumber: string; deliveryDate: string | null; items: unknown };
}

export function useWorkerTasks(filters?: { workerId?: string; invoiceId?: string; status?: string; stage?: string }) {
  const params = new URLSearchParams();
  if (filters?.workerId) params.set("workerId", filters.workerId);
  if (filters?.invoiceId) params.set("invoiceId", filters.invoiceId);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.stage) params.set("stage", filters.stage);
  const qs = params.toString();

  return useQuery<WorkerTaskRecord[]>({
    queryKey: ["worker-tasks", filters ?? "all"],
    queryFn: async () => {
      const res = await fetch(`/api/worker-tasks${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch worker tasks");
      return res.json();
    },
    staleTime: 20_000,
  });
}

// Regular (registered-customer) invoices lean list — used in assign-task modal.
export interface InvoiceLean {
  id: string;
  invNumber: string;
  customerName: string;
  customerId: string | null;
  items: unknown;
  deliveryDate: string | null;
  status: string;
}

export function useRegularInvoices() {
  return useQuery<InvoiceLean[]>({
    queryKey: ["invoices", "regular-lean"],
    queryFn: async () => {
      const res = await fetch("/api/invoices?type=regular");
      if (!res.ok) throw new Error("Failed to fetch invoices");
      return res.json();
    },
    staleTime: 30_000,
  });
}
