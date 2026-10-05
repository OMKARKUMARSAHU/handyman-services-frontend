export type Role = "customer" | "provider" | "admin";

export type ProviderApprovalStatus = "pending_approval" | "approved" | "rejected";

/** Shape returned by the backend's `GET /me` — role-aware, matches backend/src/modules/users/users.routes.ts exactly. */
export interface CurrentUser {
  role: Role;
  id?: string;
  sub?: string;
  name: string;
  email: string | null;
  accountStatus?: "active" | "disabled";
  /** Present only when role === "provider" — the actual gate for dashboard access, independent of the Cognito group. */
  approvalStatus?: ProviderApprovalStatus;
  businessName?: string | null;
  city?: string | null;
  categories?: string[];
  yearsExperience?: number | null;
  bio?: string | null;
  availability?: string | null;
  rejectionReason?: string | null;
  approvedAt?: string | null;
}

export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
  requestId?: string;
}
