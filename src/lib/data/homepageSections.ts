import homepageSectionsData from "@/data/homepage-sections.json";
import type { HomepageSection } from "@/types";

export function getHomepageSections(): HomepageSection[] {
  return [...(homepageSectionsData as HomepageSection[])].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
}

export function getHomepageSection(key: string): HomepageSection | undefined {
  return (homepageSectionsData as HomepageSection[]).find((s) => s.key === key);
}
