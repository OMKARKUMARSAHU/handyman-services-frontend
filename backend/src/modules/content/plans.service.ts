import { getDb } from "../../database/db";
import { toPlanDto, type PlanDto, type PlanRow } from "./plans.types";

const TABLE = "plans";

/** Legacy, read-only (PHASE_2_BACKEND_DATABASE_SCHEMA.md §6 — "LEGACY / PENDING CLIENT DECISION", retained unmodified, no admin write path built in Phase 3). */
export async function listAvailablePlans(): Promise<PlanDto[]> {
  const rows = await getDb()<PlanRow>(TABLE).where({ available: true }).orderBy("sort_order", "asc");
  return rows.map(toPlanDto);
}
