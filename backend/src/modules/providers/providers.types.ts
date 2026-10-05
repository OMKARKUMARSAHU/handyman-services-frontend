export type ProviderApprovalStatus = "pending_approval" | "approved" | "rejected";

export interface ServiceProviderDto {
  id: string;
  cognitoSub: string;
  name: string;
  email: string | null;
  phone: string | null;
  accountStatus: "active" | "disabled";
  approvalStatus: ProviderApprovalStatus;
  businessName: string | null;
  city: string | null;
  categories: string[];
  yearsExperience: number | null;
  bio: string | null;
  availability: string | null;
  rejectionReason: string | null;
  approvedAt: string | null;
}

export interface ServiceProviderRow {
  id: string;
  cognito_sub: string;
  name: string;
  email: string | null;
  phone: string | null;
  account_status: "active" | "disabled";
  approval_status: ProviderApprovalStatus;
  business_name: string | null;
  city: string | null;
  categories: string[] | string | null;
  years_experience: number | null;
  bio: string | null;
  availability: string | null;
  terms_accepted_at: Date | string | null;
  privacy_accepted_at: Date | string | null;
  approved_at: Date | string | null;
  reviewed_by_sub: string | null;
  rejection_reason: string | null;
}

/** `categories` is a JSON column — mysql2/knex normally hands back a parsed array, but this defensively handles a raw JSON string too. */
function parseCategories(value: ServiceProviderRow["categories"]): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function toServiceProviderDto(row: ServiceProviderRow): ServiceProviderDto {
  return {
    id: row.id,
    cognitoSub: row.cognito_sub,
    name: row.name,
    email: row.email,
    phone: row.phone,
    accountStatus: row.account_status,
    approvalStatus: row.approval_status,
    businessName: row.business_name,
    city: row.city,
    categories: parseCategories(row.categories),
    yearsExperience: row.years_experience,
    bio: row.bio,
    availability: row.availability,
    rejectionReason: row.rejection_reason,
    approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
  };
}
