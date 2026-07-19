'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Dices, RotateCcw } from 'lucide-react';

interface Topic {
  id: number;
  category: string;
  prompt: string;
}

interface RouletteSpinnerProps {
  onSpin: () => Promise<Topic | null>;
  isSpinning: boolean;
  setIsSpinning: (spinning: boolean) => void;
  onSpinStart: () => void;
  onLanded: (topic: Topic) => void;
  onClear: () => void;
}

const PLACEHOLDER_PROMPTS = [
  "Preparing the topics...",
  "Searching the database...",
  "Selecting categories...",
  "Formatting prompt...",
  "Almost there...",
  "Casual topics...",
  "Professional topics...",
  "Technology topics...",
  "Philosophy topics...",
  "Personal Growth...",
  "Culture & Society...",
];

export default function RouletteSpinner({
  onSpin,
  isSpinning,
  setIsSpinning,
  onSpinStart,
  onLanded,
  onClear,
}: RouletteSpinnerProps) {
  const [reelItems, setReelItems] = useState<string[]>([]);
  const [translateY, setTranslateY] = useState(0);
  const [finalTopic, setFinalTopic] = useState<Topic | null>(null);
  const [showPromptDetails, setShowPromptDetails] = useState(false);
  const reelRef = useRef<HTMLDivElement>(null);
  const itemHeight = 96; // 6rem or 96px height per item in the reel
  const spinDuration = 3500; // 3.5 seconds

  const startSpin = async () => {
    if (isSpinning) return;

    setIsSpinning(true);
    setShowPromptDetails(false);
    setFinalTopic(null);
    setTranslateY(0);
    onSpinStart();

    try {
      // 1. Fetch the topic from the parent (connected to Supabase)
      const topic = await onSpin();

      if (!topic) {
        setIsSpinning(false);
        return;
      }

      // 2. Build the reel items:
      // Mix placeholder prompts and categories for a convincing "roulette" effect,
      // ending precisely on our fetched topic prompt.
      const numReelItems = 25;
      const items: string[] = [];

      for (let i = 0; i < numReelItems - 1; i++) {
        const randIndex = Math.floor(Math.random() * PLACEHOLDER_PROMPTS.length);
        items.push(PLACEHOLDER_PROMPTS[randIndex]);
      }
      
      // The final target item in the reel is our actual topic prompt
      items.push(topic.prompt);
      setReelItems(items);
      setFinalTopic(topic);

      // 3. Trigger the animation. Wait 50ms for React to render the reel list
      setTimeout(() => {
        const targetOffset = (numReelItems - 1) * itemHeight;
        setTranslateY(-targetOffset);
      }, 50);

      // 4. Reveal prompt details after the roulette deceleration finishes
      setTimeout(() => {
        setIsSpinning(false);
        setShowPromptDetails(true);
        onLanded(topic);
      }, spinDuration + 100);

    } catch (err) {
      console.error('Error during spin:', err);
      setIsSpinning(false);
    }
  };

  const resetSpinner = () => {
    setFinalTopic(null);
    setShowPromptDetails(false);
    setTranslateY(0);
    setReelItems([]);
    onClear();
  };

  // Helper to determine the badge color for category
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Casual': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Professional': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Technology': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'Philosophy': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'Personal Growth': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Culture & Society': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'Arts & Literature': return 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20';
      case 'History & Education': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'Health & Wellness': return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
      case 'Travel & Adventure': return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      default: return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-8 py-4">
      {/* Spinner Roulette Window */}
      <div className="relative w-full rounded-2xl bg-zinc-950/80 border border-zinc-850 p-1 shadow-inner shadow-black/50 overflow-hidden">
        {/* Border gradient glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-purple-500/5 pointer-events-none" />

        {/* Indicator Markers (top and bottom arrows or indicators) */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 z-20 flex justify-between px-3 pointer-events-none">
          <div className="w-2.5 h-6 rounded-r bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
          <div className="w-2.5 h-6 rounded-l bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
        </div>

        {/* Viewport container */}
        <div className="relative h-24 overflow-hidden rounded-xl bg-zinc-950 flex items-center justify-center">
          {/* Subtle horizontal alignment line */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[52px] border-y border-zinc-800/40 bg-zinc-900/10 pointer-events-none" />

          {/* Sliding Reel */}
          {reelItems.length > 0 ? (
            <div
              ref={reelRef}
              style={{
                transform: `translateY(${translateY}px)`,
                transition: isSpinning ? `transform ${spinDuration}ms cubic-bezier(0.1, 0.8, 0.1, 1)` : 'none',
              }}
              className="absolute top-0 left-0 right-0 flex flex-col"
            >
              {reelItems.map((item, index) => (
                <div
                  key={index}
                  style={{ height: `${itemHeight}px` }}
                  className="flex items-center justify-center px-4 sm:px-8 text-center animate-fade-in"
                >
                  <p className="text-zinc-200 text-xs sm:text-base md:text-lg font-medium max-w-2xl line-clamp-2 leading-relaxed">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-zinc-500">
              <Dices className="h-6 w-6 animate-pulse" />
              <p className="text-xs uppercase tracking-widest font-semibold">Ready to Spin</p>
            </div>
          )}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          onClick={startSpin}
          disabled={isSpinning}
          className={`relative group px-8 py-3.5 rounded-xl font-semibold text-sm shadow-xl transition-all duration-300 ${
            isSpinning
              ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed scale-95'
              : 'bg-white text-zinc-950 hover:bg-zinc-100 hover:shadow-white/5 active:scale-95 cursor-pointer border border-transparent'
          }`}
        >
          {/* Internal pulsing glow when idle */}
          {!isSpinning && (
            <div className="absolute -inset-[1px] -z-10 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-20 blur group-hover:opacity-40 transition-opacity duration-300" />
          )}

          <span className="flex items-center gap-2">
            <Sparkles className={`h-4.5 w-4.5 ${isSpinning ? 'animate-spin' : 'animate-pulse'}`} />
            {isSpinning ? 'Spinning...' : 'Spin for Topic'}
          </span>
        </button>

        {finalTopic && !isSpinning && (
          <button
            onClick={resetSpinner}
            className="px-5 py-3.5 rounded-xl font-medium text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all duration-200 active:scale-95"
          >
            <span className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Clear
            </span>
          </button>
        )}
      </div>

      {/* Landing Display (Prompt Details Card) */}
      <div
        className={`w-full transition-all duration-500 ease-out ${
          showPromptDetails && finalTopic
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-4 scale-95 pointer-events-none h-0 overflow-hidden'
        }`}
      >
        {finalTopic && (
          <div className="relative rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5 sm:p-8 text-center shadow-2xl backdrop-blur-xl max-w-3xl mx-auto overflow-hidden">
            {/* Ambient category glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-gradient-to-b from-indigo-500/10 to-transparent blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center gap-3.5 sm:gap-4">
              <div className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${getCategoryColor(finalTopic.category)}`}>
                {finalTopic.category}
              </div>

              <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mt-2">Evaluation Prompt</h3>
              
              <p className="text-zinc-100 text-base sm:text-lg md:text-xl font-semibold leading-relaxed max-w-2xl text-center">
                "{finalTopic.prompt}"
              </p>

              <div className="w-12 h-0.5 rounded bg-zinc-800 my-4" />

              <p className="text-xs text-zinc-500">
                Landed on topic #{finalTopic.id}. Get ready to present your response!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
