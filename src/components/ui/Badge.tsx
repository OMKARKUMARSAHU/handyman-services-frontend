import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-accent-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-neutral-900 shadow-sm",
        className
      )}
    >
      {children}
    </span>
  );
}
