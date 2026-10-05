import { randomUUID } from "node:crypto";
import { getDb } from "../../database/db";
import { NotFoundError } from "../../shared/errors";
import { toTestimonialDto, type TestimonialDto, type TestimonialRow } from "./testimonials.types";

const TABLE = "testimonials";

/** Customer-facing: approved only (PHASE_2_BACKEND_API_CONTRACT.md §CONTENT). */
export async function listApprovedTestimonials(): Promise<TestimonialDto[]> {
  const rows = await getDb()<TestimonialRow>(TABLE).where({ approved: true }).orderBy("sort_order", "asc");
  return rows.map(toTestimonialDto);
}

/** Admin: everything, including not-yet-approved ones, so the queue can be moderated. */
export async function listAllTestimonials(): Promise<TestimonialDto[]> {
  const rows = await getDb()<TestimonialRow>(TABLE).orderBy("sort_order", "asc");
  return rows.map(toTestimonialDto);
}

export interface UpsertTestimonialInput {
  name: string;
  city: string;
  planId?: string | null;
  rating: number;
  quote: string;
  photo?: string | null;
  approved?: boolean;
  sortOrder?: number;
}

export async function createTestimonial(input: UpsertTestimonialInput): Promise<TestimonialDto> {
  const id = randomUUID();
  await getDb()<TestimonialRow>(TABLE).insert({
    id,
    name: input.name,
    city: input.city,
    plan_id: input.planId ?? null,
    rating: input.rating,
    quote: input.quote,
    photo: input.photo ?? null,
    approved: input.approved ?? false,
    sort_order: input.sortOrder ?? 0,
  });
  const row = await getDb()<TestimonialRow>(TABLE).where({ id }).first();
  return toTestimonialDto(row!);
}

export async function updateTestimonial(id: string, input: Partial<UpsertTestimonialInput>): Promise<TestimonialDto> {
  const existing = await getDb()<TestimonialRow>(TABLE).where({ id }).first();
  if (!existing) throw new NotFoundError("Testimonial not found.");

  const patch: Partial<TestimonialRow> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.city !== undefined) patch.city = input.city;
  if (input.planId !== undefined) patch.plan_id = input.planId;
  if (input.rating !== undefined) patch.rating = input.rating;
  if (input.quote !== undefined) patch.quote = input.quote;
  if (input.photo !== undefined) patch.photo = input.photo;
  if (input.approved !== undefined) patch.approved = input.approved;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

  if (Object.keys(patch).length > 0) {
    await getDb()<TestimonialRow>(TABLE).where({ id }).update(patch);
  }
  const row = await getDb()<TestimonialRow>(TABLE).where({ id }).first();
  return toTestimonialDto(row!);
}

export async function deleteTestimonial(id: string): Promise<void> {
  const deleted = await getDb()<TestimonialRow>(TABLE).where({ id }).delete();
  if (!deleted) throw new NotFoundError("Testimonial not found.");
}
