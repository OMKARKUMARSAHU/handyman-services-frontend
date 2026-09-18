import { Container } from "@/components/ui/Container";
import type { HomepageSection } from "@/types";
import { TrustCard } from "./TrustCard";

export function WhyChooseUs({ section }: { section: HomepageSection }) {
  const items = section.items ?? [];

  return (
    <Container>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item, i) => (
          <TrustCard key={i} item={item} />
        ))}
      </div>
    </Container>
  );
}
