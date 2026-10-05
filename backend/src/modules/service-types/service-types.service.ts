import { randomUUID } from "node:crypto";
import { getDb } from "../../database/db";
import { NotFoundError } from "../../shared/errors";
import { type ServiceTypeDto, type ServiceTypeRow, toServiceTypeDto } from "./service-types.types";

const TABLE = "service_types";

export async function listServiceTypes(): Promise<ServiceTypeDto[]> {
  const rows = await getDb()<ServiceTypeRow>(TABLE).where({ active: true }).orderBy("sort_order", "asc");
  return rows.map(toServiceTypeDto);
}

export async function getServiceTypeById(id: string): Promise<ServiceTypeDto | null> {
  const row = await getDb()<ServiceTypeRow>(TABLE).where({ id }).first();
  return row ? toServiceTypeDto(row) : null;
}

export interface UpsertServiceTypeInput {
  key: string;
  label: string;
  sortOrder?: number;
  active?: boolean;
}

export async function createServiceType(input: UpsertServiceTypeInput): Promise<ServiceTypeDto> {
  const id = randomUUID();
  await getDb()<ServiceTypeRow>(TABLE).insert({
    id,
    key: input.key,
    label: input.label,
    sort_order: input.sortOrder ?? 0,
    active: input.active ?? true,
  });
  const createdRow = await getServiceTypeById(id);
  if (!createdRow) throw new Error("Failed to read back created service type.");
  return createdRow;
}

export async function updateServiceType(id: string, input: Partial<UpsertServiceTypeInput>): Promise<ServiceTypeDto> {
  const existing = await getServiceTypeById(id);
  if (!existing) throw new NotFoundError("Service type not found.");

  const patch: Partial<ServiceTypeRow> = {};
  if (input.key !== undefined) patch.key = input.key;
  if (input.label !== undefined) patch.label = input.label;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.active !== undefined) patch.active = input.active;

  if (Object.keys(patch).length > 0) {
    await getDb()<ServiceTypeRow>(TABLE).where({ id }).update(patch);
  }
  const updated = await getServiceTypeById(id);
  if (!updated) throw new Error("Failed to read back updated service type.");
  return updated;
}
