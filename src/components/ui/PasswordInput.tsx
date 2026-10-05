"use client";

import { useId, useState } from "react";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

/**
 * Every password field across Customer, Service Provider, and Admin auth
 * screens must have a working show/hide eye toggle (FINAL AUTHENTICATION
 * ARCHITECTURE §9) — this is the one place that behavior lives, instead of
 * duplicating a toggle-state + icon-button in every form.
 */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  required,
  className,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={inputId}
        type={visible ? "text" : "password"}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 pr-11 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500",
          className
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        tabIndex={0}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-neutral-400 hover:text-neutral-600 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Icon name={visible ? "eye-off" : "eye"} className="h-4.5 w-4.5" />
      </button>
    </div>
  );
}
