import type { Page } from "@/types";
export const MODULES = [
  { id: "dashboard", label: "Dashboard", icon: "house" },
  { id: "stock", label: "Stock / Inventory", icon: "boxes-stacked" },
  { id: "purchase", label: "Purchase", icon: "cart-shopping" },
  { id: "invoice", label: "Invoice", icon: "file-invoice" },
  { id: "refund", label: "Refund & Replace", icon: "rotate-left" },
  { id: "expenses", label: "Expenses", icon: "receipt" },
  { id: "cashbook", label: "Cashbook", icon: "book-open" },
  { id: "workers", label: "Workers", icon: "users" },
  { id: "payment-methods", label: "Payment Method", icon: "wallet" },
  { id: "reports", label: "Reports", icon: "chart-line" },
  { id: "settings", label: "Settings", icon: "gear" },
] as const;
export type ModuleId = (typeof MODULES)[number]["id"];
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  allowedModules: string[];
}
export function isModule(value: unknown): value is ModuleId {
  return MODULES.some((m) => m.id === value);
}
export function hasPage(
  user: Pick<SessionUser, "role" | "active" | "allowedModules"> | null,
  page: Page,
): boolean {
  if (!user?.active) return false;
  if (user.role === "admin") return true;
  if (page === "user-management") return false;
  return isModule(page) && user.allowedModules.includes(page);
}
export function pagesFor(user: SessionUser): Page[] {
  return [
    ...MODULES.map((m) => m.id).filter((p) => hasPage(user, p)),
    ...(user.role === "admin" ? ["user-management" as const] : []),
  ];
}
