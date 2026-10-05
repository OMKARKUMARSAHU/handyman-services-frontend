export interface FaqRow {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  category: string | null;
  answer_confirmed: boolean | number;
}

export interface FaqDto {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  category: string | null;
  answerConfirmed: boolean;
}

export function toFaqDto(row: FaqRow): FaqDto {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    sortOrder: row.sort_order,
    category: row.category,
    answerConfirmed: Boolean(row.answer_confirmed),
  };
}
