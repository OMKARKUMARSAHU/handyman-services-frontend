"use client";

import { useId, useState } from "react";
import type { FAQ } from "@/types";
import { cn } from "@/lib/utils";

export function FAQAccordion({ faqs }: { faqs: FAQ[] }) {
  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id ?? null);

  return (
    <div className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
      {faqs.map((faq) => (
        <FAQItem
          key={faq.id}
          faq={faq}
          open={openId === faq.id}
          onToggle={() => setOpenId((current) => (current === faq.id ? null : faq.id))}
        />
      ))}
    </div>
  );
}

function FAQItem({
  faq,
  open,
  onToggle,
}: {
  faq: FAQ;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();

  return (
    <div>
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-neutral-900 sm:text-base"
        >
          {faq.question}
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className={cn("h-5 w-5 shrink-0 text-brand-600 transition-transform", open && "rotate-180")}
          >
            <path
              fillRule="evenodd"
              d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </h2>
      <div id={panelId} hidden={!open} className="px-5 pb-4 text-sm text-neutral-600">
        {faq.answer}
      </div>
    </div>
  );
}
