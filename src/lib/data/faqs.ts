import faqsData from "@/data/faqs.json";
import type { FAQ } from "@/types";

export function getFAQs(): FAQ[] {
  return [...(faqsData as FAQ[])].sort((a, b) => a.sortOrder - b.sortOrder);
}
