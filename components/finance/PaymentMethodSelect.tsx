"use client";
import { useEffect, useId, useMemo } from "react";
import { usePaymentMethods } from "@/lib/hooks/usePaymentMethods";
export default function PaymentMethodSelect({
  value,
  onChange,
  byId = false,
  variant = "select",
  id,
  label = "Payment method",
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  byId?: boolean;
  variant?: "select" | "buttons";
  id?: string;
  label?: string;
  style?: React.CSSProperties;
}) {
  const generated = useId();
  const { data, isLoading, isError } = usePaymentMethods();
  const active = useMemo(() => data?.methods.filter((m) => m.active), [data]);
  useEffect(() => {
    if (
      active?.length &&
      !active.some((m) => (byId ? m.id : m.name) === value)
    ) {
      const fallback = active.find((m) => m.name === "Cash") ?? active[0];
      onChange(byId ? fallback.id : fallback.name);
    }
  }, [active, byId, value, onChange]);
  return (
    <>
      {variant === "buttons" ? <div className="finance-segmented" role="group" aria-label={label}>
        {isLoading ? <span>Loading methods…</span> : active?.map(m => <button type="button" key={m.id} aria-pressed={(byId?m.id:m.name)===value} className={(byId?m.id:m.name)===value?"selected":""} onClick={()=>onChange(byId?m.id:m.name)}>{m.name}</button>)}
      </div> : <select
        id={id ?? generated}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading || isError || !active?.length}
        required
        style={style}
      >
        <option value="">
          {isLoading
            ? "Loading methods…"
            : isError
              ? "Methods unavailable"
              : "Select payment method"}
        </option>
        {active?.map((m) => (
          <option key={m.id} value={byId ? m.id : m.name}>
            {m.name}
          </option>
        ))}
      </select>}
      {isError && (
        <small className="finance-field-error" role="alert">
          Unable to load payment methods. Refresh before saving.
        </small>
      )}
      {!isLoading && !isError && !active?.length && (
        <small className="finance-field-error">
          Add an active payment method first.
        </small>
      )}
    </>
  );
}
