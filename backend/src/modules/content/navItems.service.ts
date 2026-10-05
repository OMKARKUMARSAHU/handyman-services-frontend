import { randomUUID } from "node:crypto";
import { getDb } from "../../database/db";
import { NotFoundError } from "../../shared/errors";
import { toNavItemDto, type NavItemDto, type NavItemRow } from "./navItems.types";

const TABLE = "nav_items";

export async function listNavItems(): Promise<NavItemDto[]> {
  const rows = await getDb()<NavItemRow>(TABLE).orderBy("sort_order", "asc");
  return rows.map(toNavItemDto);
}

export interface UpsertNavItemInput {
  label: string;
  href: string;
  sortOrder?: number;
}

export async function createNavItem(input: UpsertNavItemInput): Promise<NavItemDto> {
  const id = randomUUID();
  await getDb()<NavItemRow>(TABLE).insert({ id, label: input.label, href: input.href, sort_order: input.sortOrder ?? 0 });
  const row = await getDb()<NavItemRow>(TABLE).where({ id }).first();
  return toNavItemDto(row!);
}

export async function updateNavItem(id: string, input: Partial<UpsertNavItemInput>): Promise<NavItemDto> {
  const existing = await getDb()<NavItemRow>(TABLE).where({ id }).first();
  if (!existing) throw new NotFoundError("Nav item not found.");

  const patch: Partial<NavItemRow> = {};
  if (input.label !== undefined) patch.label = input.label;
  if (input.href !== undefined) patch.href = input.href;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

  if (Object.keys(patch).length > 0) {
    await getDb()<NavItemRow>(TABLE).where({ id }).update(patch);
  }
  const row = await getDb()<NavItemRow>(TABLE).where({ id }).first();
  return toNavItemDto(row!);
}

export async function deleteNavItem(id: string): Promise<void> {
  const deleted = await getDb()<NavItemRow>(TABLE).where({ id }).delete();
  if (!deleted) throw new NotFoundError("Nav item not found.");
}
