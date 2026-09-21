import { cn } from "@/lib/utils";

const STEPS = ["Address", "Schedule", "Summary"] as const;

export function CheckoutStepper({ activeStep }: { activeStep: 0 | 1 | 2 }) {
  return (
    <ol className="flex items-center gap-2 text-sm">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
              i === activeStep
                ? "bg-brand-600 text-white"
                : i < activeStep
                  ? "bg-brand-100 text-brand-700"
                  : "bg-neutral-100 text-neutral-400"
            )}
          >
            {i + 1}
          </span>
          <span className={cn("font-medium", i === activeStep ? "text-neutral-900" : "text-neutral-500")}>
            {label}
          </span>
          {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-neutral-300" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}
