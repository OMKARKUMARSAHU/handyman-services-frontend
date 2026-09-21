"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

const FIELD_CLASS =
  "w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

const SLOT_OPTIONS = [
  { value: "", label: "No preference" },
  { value: "morning", label: "Morning (9am–12pm)" },
  { value: "afternoon", label: "Afternoon (12pm–4pm)" },
  { value: "evening", label: "Evening (4pm–7pm)" },
];

/**
 * Simple date + general time-of-day preference — not a real slot/capacity
 * system, per PHASE_2_UI_UX_DESIGN.md §9 (exact slot rules are [TBD],
 * PHASE_2_OPEN_QUESTIONS.md #20).
 */
export function ScheduleStep({
  initialDate,
  initialSlot,
  onBack,
  onContinue,
}: {
  initialDate: string;
  initialSlot: string;
  onBack: () => void;
  onContinue: (date: string, slot: string) => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [slot, setSlot] = useState(initialSlot);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) {
      setError("Please choose a preferred date.");
      return;
    }
    setError(null);
    onContinue(date, slot);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="schedule-date" className="mb-1.5 block text-sm font-medium text-neutral-800">
          Preferred date
        </label>
        <input
          id="schedule-date"
          type="date"
          required
          min={today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={FIELD_CLASS}
        />
      </div>
      <div>
        <label htmlFor="schedule-slot" className="mb-1.5 block text-sm font-medium text-neutral-800">
          Preferred time of day
        </label>
        <select id="schedule-slot" value={slot} onChange={(e) => setSlot(e.target.value)} className={FIELD_CLASS}>
          {SLOT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-neutral-500">
          This is a preference, not a guaranteed slot — our team confirms the exact visit time.
        </p>
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" size="lg" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" size="lg">
          Continue to summary
        </Button>
      </div>
    </form>
  );
}
