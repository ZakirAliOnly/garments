"use client";
import { useQuery } from "@tanstack/react-query";
export interface PaymentMethod {
  id: string;
  name: string;
  active: boolean;
  openingBalance: number;
  balance: number;
  _count: { entries: number };
}
export interface Transfer {
  id: string;
  from: { name: string };
  to: { name: string };
  amount: string;
  entryDate: string;
  notes: string | null;
}
export function usePaymentMethods(management = false) {
  return useQuery<{ methods: PaymentMethod[]; transfers: Transfer[] }>({
    queryKey: ["payment-methods", management ? "management" : "lookup"],
    queryFn: async () => {
      const r = await fetch(management ? "/api/payment-methods" : "/api/lookups/payment-methods");
      if (!r.ok) throw Error("Unable to load payment methods");
      return r.json();
    },
    staleTime: 0,
  });
}
