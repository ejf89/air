"use client";

import * as React from "react";
import { tileRegistry } from "@/lib/tileRegistry";

const TOUR_KEY = "air-gallery-tour-done";

interface TourStep {
  title: string;
  body: string;
  /** Returns the element to spotlight; null/undefined = centered card. */
  target?: () => HTMLElement | null;
}

const STEPS: TourStep[] = [
  {
    title: "Welcome to the gallery",
    body: "A quick tour of what this wall can do — 30 seconds, tops.",
  },
  {
    title: "Select from anywhere",
    body: "Drag across the page — even starting on a photo — to lasso a selection. Shift+drag adds more, ⌘-click toggles one, Esc clears. Hover a video for a live preview.",
    target: () => (tileRegistry.values().next().value as HTMLElement) ?? null,
  },
  {
    title: "Selected tiles are drag handles",
    body: "Click a tile to select it, then drag it to reorder the wall. Drag one tile of a selection and the whole group moves together.",
    target: () => (tileRegistry.values().next().value as HTMLElement) ?? null,
  },
  {
    title: "Boards hold assets",
    body: "Drop selected assets on a board to move them there — or click a board to step inside it. Right-click anything for more actions.",
    target: () => document.querySelector<HTMLElement>("[data-board-card]"),
  },
  {
    title: "Search and sort",
    body: "Search sweeps every nested board. Sorts run on the server; “Custom” is your own manual order — the only mode where reordering applies.",
    target: () => document.querySelector<HTMLElement>("[data-tour='search']"),
  },
  {
    title: "It's all yours",
    body: "Rearrangements save locally in your browser — the public Air API is read-only. Restart this tour any time from the ? button.",
  },
];

interface SpotRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function Tour(): JSX.Element | null {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [rect, setRect] = React.useState<SpotRect | null>(null);

  // First visit only — and wait for the wall to actually have tiles.
  React.useEffect(() => {
    if (localStorage.getItem(TOUR_KEY)) return;
    const t = setInterval(() => {
      if (tileRegistry.size > 0) {
        clearInterval(t);
        setOpen(true);
      }
    }, 300);
    return () => clearInterval(t);
  }, []);

  // Measure the current step's target (after scrolling it into view).
  React.useEffect(() => {
    if (!open) return;
    const target = STEPS[step]?.target?.() ?? null;
    if (!target) {
      setRect(null);
      return;
    }
    target.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
    const measure = () => {
      const r = target.getBoundingClientRect();
      setRect({ left: r.left - 6, top: r.top - 6, width: r.width + 12, height: r.height + 12 });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, step]);

  const finish = React.useCallback(() => {
    localStorage.setItem(TOUR_KEY, "1");
    setOpen(false);
    setStep(0);
  }, []);

  const restart = React.useCallback(() => {
    localStorage.removeItem(TOUR_KEY);
    setStep(0);
    setOpen(true);
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        onClick={restart}
        aria-label="Restart tour"
        data-draggable="true"
        className="fixed bottom-5 right-5 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-neutral-600 shadow-lg ring-1 ring-black/10 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
      >
        ?
      </button>
    );
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const hasTarget = Boolean(current.target);
  const spotRect = hasTarget ? rect : null;

  // Tooltip position: under the spotlight if it fits, else above; centered
  // card when there's no target.
  const tooltipStyle: React.CSSProperties = spotRect
    ? spotRect.top + spotRect.height + 210 < window.innerHeight
      ? { left: Math.max(16, Math.min(spotRect.left, window.innerWidth - 420)), top: spotRect.top + spotRect.height + 14 }
      : { left: Math.max(16, Math.min(spotRect.left, window.innerWidth - 420)), top: Math.max(16, spotRect.top - 210) }
    : { left: "50%", top: "38%", transform: "translate(-50%, -50%)" };

  return (
    <div className="fixed inset-0 z-50" data-draggable="true">
      {/* Dim layer / spotlight cutout */}
      {spotRect ? (
        <div
          className="absolute rounded-xl ring-2 ring-white/40 transition-all duration-200"
          style={{
            left: spotRect.left,
            top: spotRect.top,
            width: spotRect.width,
            height: spotRect.height,
            boxShadow: "0 0 0 9999px rgba(10, 10, 12, 0.6)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-[2px]" />
      )}

      <div
        key={step}
        role="dialog"
        aria-label={current.title}
        className="absolute w-[min(400px,calc(100vw-32px))] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 animate-[tour-in_180ms_ease-out]"
        style={tooltipStyle}
      >
        <div className="p-5">
        {!hasTarget ? (
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-500 text-lg font-bold italic text-white shadow-md">
            a
          </span>
        ) : null}
        <p className="text-[17px] font-bold tracking-tight text-neutral-900">{current.title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{current.body}</p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${i === step ? "bg-blue-600" : "bg-neutral-200"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={finish}
              className="rounded-lg px-2.5 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
            >
              Skip
            </button>
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-neutral-700"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
