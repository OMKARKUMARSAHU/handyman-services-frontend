"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/lib/icons";
import { Button } from "@/components/ui/Button";
import {
  listProviders,
  approveProvider,
  rejectProvider,
  AuthApiError,
  type AdminProviderListItem,
} from "@/lib/admin/api";
import type { ProviderApprovalStatus } from "@/lib/auth/types";

const FILTERS: { value: ProviderApprovalStatus | "all"; label: string }[] = [
  { value: "pending_approval", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

/**
 * Admin Dashboard's provider-approval area (FINAL AUTHENTICATION
 * ARCHITECTURE §6/§7/§15 — "Admin Dashboard must eventually contain a
 * provider approval area ... at minimum provide backend foundation for:
 * pending providers / approve / reject / status"). This is the frontend of
 * that foundation: a list view with Approve/Reject actions. Every action it
 * calls is itself re-checked server-side by `requireRole("admin")` — this
 * component has no authority of its own, it just surfaces what the backend
 * already allows this signed-in admin to do.
 */
export function AdminProviderQueue() {
  const [filter, setFilter] = useState<ProviderApprovalStatus | "all">("pending_approval");
  const [providers, setProviders] = useState<AdminProviderListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async (status: ProviderApprovalStatus | "all") => {
    setError(null);
    setProviders(null);
    try {
      const result = await listProviders(status === "all" ? {} : { approvalStatus: status });
      setProviders(result);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not load providers.");
      setProviders([]);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  async function handleApprove(id: string) {
    setActioningId(id);
    try {
      await approveProvider(id);
      await load(filter);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not approve this provider.");
    } finally {
      setActioningId(null);
    }
  }

  async function handleReject(id: string) {
    setActioningId(id);
    try {
      await rejectProvider(id, rejectReason.trim() || undefined);
      setRejectingId(null);
      setRejectReason("");
      await load(filter);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not reject this provider.");
    } finally {
      setActioningId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-900">Service Provider applications</h2>
        <div className="flex gap-1.5 rounded-lg bg-neutral-100 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.value ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {providers === null && !error && <p className="mt-4 text-sm text-neutral-500">Loading…</p>}

      {providers !== null && providers.length === 0 && !error && (
        <p className="mt-4 text-sm text-neutral-500">No providers in this category.</p>
      )}

      {providers !== null && providers.length > 0 && (
        <ul className="mt-4 divide-y divide-neutral-100">
          {providers.map((p) => (
            <li key={p.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    {p.name}
                    {p.businessName ? ` — ${p.businessName}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {[p.email, p.phone, p.city, p.yearsExperience != null ? `${p.yearsExperience} yrs experience` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {p.categories.length > 0 && (
                    <p className="mt-1 text-xs text-neutral-500">Categories: {p.categories.join(", ")}</p>
                  )}
                  {p.approvalStatus === "rejected" && p.rejectionReason && (
                    <p className="mt-1 text-xs text-red-600">Rejection reason: {p.rejectionReason}</p>
                  )}
                  <span
                    className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.approvalStatus === "approved"
                        ? "bg-green-100 text-green-700"
                        : p.approvalStatus === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    <Icon
                      name={
                        p.approvalStatus === "approved" ? "check-circle" : p.approvalStatus === "rejected" ? "x-circle" : "clock"
                      }
                      className="h-3.5 w-3.5"
                    />
                    {p.approvalStatus === "pending_approval" ? "Pending" : p.approvalStatus === "approved" ? "Approved" : "Rejected"}
                  </span>
                </div>

                {p.approvalStatus === "pending_approval" && (
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="flex gap-2">
                      <Button size="md" disabled={actioningId === p.id} onClick={() => handleApprove(p.id)}>
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="md"
                        disabled={actioningId === p.id}
                        onClick={() => setRejectingId(rejectingId === p.id ? null : p.id)}
                      >
                        Reject
                      </Button>
                    </div>
                    {rejectingId === p.id && (
                      <div className="flex w-64 flex-col gap-2">
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reason (optional)"
                          rows={2}
                          className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        <Button
                          variant="outline"
                          size="md"
                          disabled={actioningId === p.id}
                          onClick={() => handleReject(p.id)}
                          className="self-end border-red-300 text-red-700 hover:border-red-500 hover:text-red-800"
                        >
                          Confirm reject
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
