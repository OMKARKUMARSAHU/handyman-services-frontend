import type { LeadPayload, LeadSubmissionResult } from "@/types";

/**
 * Mock lead submission.
 *
 * Phase 3 scope explicitly excludes a real backend, so this function does
 * NOT store data anywhere remote — it validates shape and resolves after a
 * short simulated delay so the UI can show a realistic submitting/success
 * flow. The function signature is the seam a future WordPress or custom API
 * integration would plug into (see PHASE_2_SYSTEM_DESIGN.md §3, §16) —
 * calling code never needs to change, only this implementation.
 */
export async function submitLead(payload: LeadPayload): Promise<LeadSubmissionResult> {
  if (!payload.consent) {
    return {
      success: false,
      message: "Please agree to the Terms & Privacy Policy to continue.",
    };
  }

  // Simulate network latency for a realistic mock flow.
  await new Promise((resolve) => setTimeout(resolve, 600));

  console.log("[mock submitLead] received:", payload);

  return {
    success: true,
    message:
      "Thanks! This is a Phase 3 demo submission — no data has been sent anywhere. Once a backend is connected, this will notify our team directly.",
  };
}
