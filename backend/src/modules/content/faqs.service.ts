import { randomUUID } from "node:crypto";
import { getDb } from "../../database/db";
import { NotFoundError } from "../../shared/errors";
import { toFaqDto, type FaqDto, type FaqRow } from "./faqs.types";

const TABLE = "faqs";

export async function listFaqs(): Promise<FaqDto[]> {
  const rows = await getDb()<FaqRow>(TABLE).orderBy("sort_order", "asc");
  return rows.map(toFaqDto);
}

export interface UpsertFaqInput {
  question: string;
  answer: string;
  sortOrder?: number;
  category?: string | null;
  answerConfirmed?: boolean;
}

export async function createFaq(input: UpsertFaqInput): Promise<FaqDto> {
  const id = randomUUID();
  await getDb()<FaqRow>(TABLE).insert({
    id,
    question: input.question,
    answer: input.answer,
    sort_order: input.sortOrder ?? 0,
    category: input.category ?? null,
    answer_confirmed: input.answerConfirmed ?? false,
  });
  const row = await getDb()<FaqRow>(TABLE).where({ id }).first();
  return toFaqDto(row!);
}

export async function updateFaq(id: string, input: Partial<UpsertFaqInput>): Promise<FaqDto> {
  const existing = await getDb()<FaqRow>(TABLE).where({ id }).first();
  if (!existing) throw new NotFoundError("FAQ not found.");

  const patch: Partial<FaqRow> = {};
  if (input.question !== undefined) patch.question = input.question;
  if (input.answer !== undefined) patch.answer = input.answer;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.category !== undefined) patch.category = input.category;
  if (input.answerConfirmed !== undefined) patch.answer_confirmed = input.answerConfirmed;

  if (Object.keys(patch).length > 0) {
    await getDb()<FaqRow>(TABLE).where({ id }).update(patch);
  }
  const row = await getDb()<FaqRow>(TABLE).where({ id }).first();
  return toFaqDto(row!);
}

export async function deleteFaq(id: string): Promise<void> {
  const deleted = await getDb()<FaqRow>(TABLE).where({ id }).delete();
  if (!deleted) throw new NotFoundError("FAQ not found.");
}
