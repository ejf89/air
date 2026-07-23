"use client";

import * as React from "react";
import { useGalleryStore } from "@/lib/store";

export interface SectionProps {
  storeKey: string;
  title: string;
  count?: number;
  children: React.ReactNode;
}

/** Top-level collapsible section ("Boards", "Assets") with Air-style header. */
export function Section({ storeKey, title, count, children }: SectionProps): JSX.Element {
  const expanded = useGalleryStore((s) => s.expanded[storeKey] ?? true);
  const toggleExpanded = useGalleryStore((s) => s.toggleExpanded);

  return (
    <section className="mb-2">
      <button
        type="button"
        onClick={() => toggleExpanded(storeKey, true)}
        className="group mb-2 flex w-full items-center gap-1.5 rounded-md px-1 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`shrink-0 text-neutral-400 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
        >
          <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 group-hover:text-neutral-700">
          {typeof count === "number" ? `${count.toLocaleString()} ` : ""}
          {title}
        </span>
      </button>
      {expanded ? children : null}
    </section>
  );
}
