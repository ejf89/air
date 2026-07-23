"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { SortField, SortFieldName } from "@/app/api/clips";
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from "./AssetMenu";

export type SortMode = { kind: "custom" } | { kind: "server"; field: SortField };
export type ViewMode = "gallery" | "table";

export const SORT_LABELS: Record<SortFieldName, string> = {
  dateModified: "Date modified",
  dateCreated: "Date created",
  dateTaken: "Date taken",
  name: "Name",
  size: "Size",
};

const SORT_OPTIONS: SortFieldName[] = [
  "dateModified",
  "dateCreated",
  "dateTaken",
  "name",
  "size",
];

export interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

/** The centered top-bar search field, like the reference site's. */
export function SearchBox({ value, onChange, placeholder }: SearchBoxProps): JSX.Element {
  return (
    <div className="relative w-full" data-tour="search">
      <svg
        width="15"
        height="15"
        viewBox="0 0 20 20"
        fill="none"
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
      >
        <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        data-draggable="true"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-10 pr-3 text-[15px] text-neutral-900 placeholder:text-neutral-400 outline-none transition-shadow focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

export interface SortControlsProps {
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
}

/** "Date modified ↓"-style sort cluster, right-aligned by the title row. */
export function SortControls({ sort, onSortChange }: SortControlsProps): JSX.Element {
  const sortLabel = sort.kind === "custom" ? "Custom" : SORT_LABELS[sort.field.name];
  const direction = sort.kind === "server" ? sort.field.direction : null;

  return (
    <div className="flex shrink-0 items-center gap-1">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            data-draggable="true"
            type="button"
            className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 data-[state=open]:bg-neutral-100"
          >
            {sortLabel}
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="text-neutral-400">
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className={MENU_CONTENT_CLASS}>
            <DropdownMenu.Item
              className={MENU_ITEM_CLASS}
              onSelect={() => onSortChange({ kind: "custom" })}
            >
              Custom
              {sort.kind === "custom" ? <Check /> : null}
            </DropdownMenu.Item>
            {SORT_OPTIONS.map((name) => (
              <DropdownMenu.Item
                key={name}
                className={MENU_ITEM_CLASS}
                onSelect={() =>
                  onSortChange({ kind: "server", field: { name, direction: "desc" } })
                }
              >
                {SORT_LABELS[name]}
                {sort.kind === "server" && sort.field.name === name ? <Check /> : null}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {direction ? (
        <button
          data-draggable="true"
          type="button"
          aria-label={`Sort ${direction === "desc" ? "descending" : "ascending"} — click to flip`}
          onClick={() =>
            sort.kind === "server" &&
            onSortChange({
              kind: "server",
              field: { ...sort.field, direction: direction === "desc" ? "asc" : "desc" },
            })
          }
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            className={direction === "asc" ? "rotate-180" : ""}
          >
            <path d="M8 3v10m0 0 3.5-3.5M8 13 4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function GridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <path d="M2.5 4h1M6 4h7.5M2.5 8h1M6 8h7.5M2.5 12h1M6 12h7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export interface ViewSwitcherProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

/** Air-style view dropdown: Gallery (justified wall) or Table. */
export function ViewSwitcher({ view, onChange }: ViewSwitcherProps): JSX.Element {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          data-draggable="true"
          type="button"
          aria-label="Change view"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 data-[state=open]:bg-neutral-100"
        >
          {view === "gallery" ? <GridIcon /> : <ListIcon />}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className={MENU_CONTENT_CLASS}>
          <DropdownMenu.Item className={MENU_ITEM_CLASS} onSelect={() => onChange("gallery")}>
            <GridIcon /> Gallery
            {view === "gallery" ? <Check /> : null}
          </DropdownMenu.Item>
          <DropdownMenu.Item className={MENU_ITEM_CLASS} onSelect={() => onChange("table")}>
            <ListIcon /> Table
            {view === "table" ? <Check /> : null}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Check() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" className="ml-auto text-blue-600">
      <path d="M2.5 6.2L4.8 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
