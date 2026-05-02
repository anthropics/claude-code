"use client";

import type { SportTab } from "@/lib/types";

interface Props {
  tabs: SportTab[];
  selected: string;
  onChange: (slug: string) => void;
}

export default function SportsTabs({ tabs, selected, onChange }: Props) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1"
      style={{ scrollbarWidth: "none" }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.slug}
          onClick={() => onChange(tab.slug)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150 ${
            selected === tab.slug
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
              : "bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white border border-gray-800"
          }`}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
