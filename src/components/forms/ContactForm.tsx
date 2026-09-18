"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Plan, Appliance, LeadPayload } from "@/types";
import { submitLead } from "@/lib/data";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const inputClasses =
  "w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClasses = "mb-1.5 block text-sm font-medium text-neutral-800";

export function ContactForm({
  plans,
  appliances,
}: {
  plans: Plan[];
  appliances: Appliance[];
}) {
  const searchParams = useSearchParams();
  const preselectedPlan = searchParams.get("plan");

  const [form, setForm] = useState<LeadPayload>({
    fullName: "",
    contactNumber: "",
    email: "",
    pincode: "",
    address: "",
    city: "",
    state: "",
    planId: preselectedPlan,
    applianceIds: [],
    consent: false,
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  function update<K extends keyof LeadPayload>(key: K, value: LeadPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleAppliance(id: string) {
    setForm((prev) => ({
      ...prev,
      applianceIds: prev.applianceIds.includes(id)
        ? prev.applianceIds.filter((a) => a !== id)
        : [...prev.applianceIds, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    const result = await submitLead(form);
    setResultMessage(result.message);
    setStatus(result.success ? "success" : "error");
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="rounded-2xl border border-brand-200 bg-brand-50 p-8 text-center"
      >
        <h2 className="text-lg font-bold text-brand-800">Request received</h2>
        <p className="mt-2 text-sm text-brand-700">{resultMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="fullName" className={labelClasses}>
            Full Name *
          </label>
          <input
            id="fullName"
            required
            type="text"
            className={inputClasses}
            value={form.fullName}
            onChange={(e) => update("fullName", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="contactNumber" className={labelClasses}>
            Contact Number *
          </label>
          <input
            id="contactNumber"
            required
            type="tel"
            inputMode="tel"
            className={inputClasses}
            value={form.contactNumber}
            onChange={(e) => update("contactNumber", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="email" className={labelClasses}>
            Email Address *
          </label>
          <input
            id="email"
            required
            type="email"
            className={inputClasses}
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="pincode" className={labelClasses}>
            Pincode *
          </label>
          <input
            id="pincode"
            required
            type="text"
            inputMode="numeric"
            className={inputClasses}
            value={form.pincode}
            onChange={(e) => update("pincode", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="address" className={labelClasses}>
            Full Address *
          </label>
          <input
            id="address"
            required
            type="text"
            className={inputClasses}
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="city" className={labelClasses}>
            City *
          </label>
          <input
            id="city"
            required
            type="text"
            className={inputClasses}
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="state" className={labelClasses}>
            State *
          </label>
          <input
            id="state"
            required
            type="text"
            className={inputClasses}
            value={form.state}
            onChange={(e) => update("state", e.target.value)}
          />
        </div>
      </div>

      <div>
        <span className={labelClasses}>Select a Plan</span>
        <div className="grid gap-3 sm:grid-cols-3">
          {plans.map((plan) => (
            <label
              key={plan.id}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-lg border px-3.5 py-2.5 text-sm",
                form.planId === plan.id
                  ? "border-brand-500 bg-brand-50 font-semibold text-brand-800"
                  : "border-neutral-300 text-neutral-700"
              )}
            >
              {plan.name}
              <input
                type="radio"
                name="planId"
                value={plan.id}
                checked={form.planId === plan.id}
                onChange={() => update("planId", plan.id)}
                className="sr-only"
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className={labelClasses}>Appliances</span>
        <div className="grid gap-2 sm:grid-cols-3">
          {appliances.map((appliance) => (
            <label key={appliance.id} className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={form.applianceIds.includes(appliance.id)}
                onChange={() => toggleAppliance(appliance.id)}
                className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
              />
              {appliance.name}
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm text-neutral-700">
        <input
          required
          type="checkbox"
          checked={form.consent}
          onChange={(e) => update("consent", e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
        />
        I agree to the{" "}
        <a href="/terms" className="text-brand-700 underline">
          Terms &amp; Conditions
        </a>{" "}
        and{" "}
        <a href="/privacy" className="text-brand-700 underline">
          Privacy Policy
        </a>
        . *
      </label>

      {status === "error" && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {resultMessage}
        </p>
      )}

      <Button type="submit" size="lg" disabled={status === "submitting"} className="w-full sm:w-auto">
        {status === "submitting" ? "Submitting…" : "Request a Service"}
      </Button>
    </form>
  );
}
