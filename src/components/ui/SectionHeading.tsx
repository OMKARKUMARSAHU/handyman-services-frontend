import { Container } from "./Container";

export function SectionHeading({
  eyebrow,
  heading,
  subheading,
  align = "center",
}: {
  eyebrow?: string;
  heading: string;
  subheading?: string | null;
  align?: "center" | "left";
}) {
  return (
    <Container
      className={align === "center" ? "text-center" : "text-left"}
    >
      <div className={align === "center" ? "mx-auto max-w-2xl" : "max-w-2xl"}>
        {eyebrow && (
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-600">
            {eyebrow}
          </p>
        )}
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          {heading}
        </h2>
        {subheading && (
          <p className="mt-3 text-base text-neutral-600 sm:text-lg">{subheading}</p>
        )}
      </div>
    </Container>
  );
}
