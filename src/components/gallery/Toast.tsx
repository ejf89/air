"use client";

import * as React from "react";
import { useGalleryStore } from "@/lib/store";

/** Bottom-center confirmation toast (e.g. after moving assets to a board). */
export function Toast(): JSX.Element | null {
  const toast = useGalleryStore((s) => s.toast);
  const clearToast = useGalleryStore((s) => s.clearToast);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 2600);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  if (!toast) return null;

  return (
    <div
      key={toast.key}
      role="status"
      className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 animate-[toast-in_180ms_ease-out] rounded-full bg-neutral-900 py-2.5 pl-4 pr-5 text-sm font-medium text-white shadow-2xl"
    >
      <span className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 align-[-2px]">
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6.2L4.8 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {toast.message}
    </div>
  );
}
