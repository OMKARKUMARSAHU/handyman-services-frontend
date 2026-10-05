export interface TestimonialRow {
  id: string;
  name: string;
  city: string;
  plan_id: string | null;
  rating: number;
  quote: string;
  photo: string | null;
  approved: boolean | number;
  sort_order: number;
}

export interface TestimonialDto {
  id: string;
  name: string;
  city: string;
  planId: string | null;
  rating: number;
  quote: string;
  photo: string | null;
  approved: boolean;
  sortOrder: number;
}

export function toTestimonialDto(row: TestimonialRow): TestimonialDto {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    planId: row.plan_id,
    rating: row.rating,
    quote: row.quote,
    photo: row.photo,
    approved: Boolean(row.approved),
    sortOrder: row.sort_order,
  };
}
