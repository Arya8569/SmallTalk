'use client';

import React from 'react';
import { Check } from 'lucide-react';

export const CATEGORIES = [
  { id: 'Casual', label: 'Casual / Icebreakers', color: 'from-blue-500 to-indigo-600', description: 'Fun, lighthearted topics & icebreakers' },
  { id: 'Professional', label: 'Professional / Work', color: 'from-emerald-500 to-teal-600', description: 'Interview prep, leadership & work culture' },
  { id: 'Technology', label: 'Technology & Future', color: 'from-cyan-500 to-blue-600', description: 'AI, future trends & digital evolution' },
  { id: 'Philosophy', label: 'Philosophy & Deep Thoughts', color: 'from-purple-500 to-pink-600', description: 'Ethics, human nature & big questions' },
  { id: 'Personal Growth', label: 'Personal Growth', color: 'from-amber-500 to-orange-600', description: 'Burnout, habits & self-discovery' },
  { id: 'Culture & Society', label: 'Culture & Society', color: 'from-rose-500 to-red-600', description: 'Globalization, traditions & modern life' },
  { id: 'Politics & Global Affairs', label: 'Politics & Global Affairs', color: 'from-red-500 to-rose-600', description: 'Governments, policy debates & international relations' },
  { id: 'Science & Environment', label: 'Science & Environment', color: 'from-emerald-500 to-teal-600', description: 'Physics, nature, biology & eco-sustainability' },
  { id: 'History & Modern Relevance', label: 'History & Modern Relevance', color: 'from-amber-500 to-orange-600', description: 'Historical events & how they shape the modern world' },
  { id: 'Abstract & Creative Writing', label: 'Abstract & Creative Writing', color: 'from-fuchsia-500 to-purple-600', description: 'Imaginative queries & creative storytelling prompts' },
];

interface CategorySelectionProps {
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
}

export default function CategorySelection({ selectedCategories, onChange }: CategorySelectionProps) {
  const toggleCategory = (id: string) => {
    if (selectedCategories.includes(id)) {
      // Don't allow deselecting all categories
      if (selectedCategories.length > 1) {
        onChange(selectedCategories.filter((cat) => cat !== id));
      }
    } else {
      onChange([...selectedCategories, id]);
    }
  };

  const selectAll = () => {
    onChange(CATEGORIES.map((c) => c.id));
  };

  const selectNone = () => {
    // Keep at least the first one to avoid empty queries
    onChange([CATEGORIES[0].id]);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xl shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100 tracking-tight">Select Topics Categories</h2>
          <p className="text-sm text-zinc-400 mt-1">Select one or more categories to filter the spinner topics.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={selectAll}
            className="px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700/80 rounded-lg transition-all"
          >
            Select All
          </button>
          <button
            onClick={selectNone}
            className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-300 bg-transparent hover:bg-zinc-800/40 rounded-lg transition-all border border-zinc-800/60"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategories.includes(cat.id);
          return (
            <div
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className={`group relative overflow-hidden rounded-xl border p-4 cursor-pointer transition-all duration-300 active:scale-[0.98] select-none touch-manipulation ${
                isSelected
                  ? 'bg-zinc-800/40 border-zinc-700/80 shadow-lg shadow-black/10'
                  : 'bg-zinc-950/20 border-zinc-900/50 hover:border-zinc-800/80 hover:bg-zinc-900/10'
              }`}
            >
              {/* Highlight background gradient glow on hover/select */}
              <div
                className={`absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300 ${cat.color}`}
              />

              <div className="flex items-start gap-3.5 relative z-10">
                {/* Custom Checkbox */}
                <div
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-200 ${
                    isSelected
                      ? `bg-gradient-to-r ${cat.color} border-transparent text-white scale-110 shadow`
                      : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-500'
                  }`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
                </div>

                <div className="flex-1">
                  <span
                    className={`block font-medium text-sm transition-colors duration-200 ${
                      isSelected ? 'text-zinc-100 font-semibold' : 'text-zinc-300 group-hover:text-zinc-200'
                    }`}
                  >
                    {cat.label}
                  </span>
                  <span className="block text-xs text-zinc-500 mt-0.5 group-hover:text-zinc-400 transition-colors">
                    {cat.description}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
