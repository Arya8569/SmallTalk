'use client';

import React, { useState, useEffect } from 'react';
import { FALLBACK_TOPICS, Topic } from '@/lib/fallbackTopics';
import CategorySelection, { CATEGORIES } from '@/components/CategorySelection';
import RouletteSpinner from '@/components/RouletteSpinner';
import AudioRecorder from '@/components/AudioRecorder';
import MagicRings from '@/components/MagicRings';
import { Database, Laptop, Info } from 'lucide-react';

export default function Home() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'Casual',
    'Professional',
    'Technology',
  ]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connected' | 'local_fallback' | 'checking'>('checking');
  const [settledTopic, setSettledTopic] = useState<Topic | null>(null);

  const handleSpinStart = () => {
    setSettledTopic(null);
  };

  const handleLanded = (topic: Topic) => {
    setSettledTopic(topic);
    try {
      const seenStr = localStorage.getItem('smalltalk_seen_topics');
      const seenIds: number[] = seenStr ? JSON.parse(seenStr) : [];
      if (!seenIds.includes(topic.id)) {
        seenIds.push(topic.id);
        localStorage.setItem('smalltalk_seen_topics', JSON.stringify(seenIds));
      }
    } catch (e) {
      console.warn('Failed to save seen topic to localStorage:', e);
    }
  };

  const handleClear = () => {
    setSettledTopic(null);
  };

  const handleUploadSuccess = (url: string) => {
    console.log('Audio uploaded successfully to GCS:', url);
  };

  // Verify connection to Neon on mount
  useEffect(() => {
    async function checkConnection() {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();

        if (res.ok && data.status === 'connected') {
          setDbStatus('connected');
        } else {
          console.error('Neon connection check failed:', data);
          setDbStatus('local_fallback');
        }
      } catch (err) {
        console.error('Neon connection check threw exception:', err);
        setDbStatus('local_fallback');
      }
    }
    checkConnection();
  }, []);

  // Callback to fetch a random topic based on selected categories
  const handleSpinForTopic = async (): Promise<Topic | null> => {
    let seenIds: number[] = [];
    try {
      const seenStr = localStorage.getItem('smalltalk_seen_topics');
      if (seenStr) {
        seenIds = JSON.parse(seenStr);
      }
    } catch (e) {
      console.warn('Failed to read seen topics from localStorage:', e);
    }

    // 1. Attempt to fetch from Neon via /api/topics/random
    try {
      const response = await fetch('/api/topics/random', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories_filter: selectedCategories,
          exclude_ids: seenIds,
        }),
      });

      const resJson = await response.json();
      const data = resJson.data;

      if (response.ok && data && data.length > 0) {
        const topic = data[0] as Topic;
        setDbStatus('connected');
        return topic;
      }

      // If we got empty results, we might have seen all topics. Let's try resetting seen list.
      if (seenIds.length > 0) {
        console.log('All topics in selected categories have been seen. Resetting seen topics...');
        try {
          localStorage.removeItem('smalltalk_seen_topics');
        } catch (e) {}
        
        // Re-query without exclusions
        const retryRes = await fetch('/api/topics/random', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categories_filter: selectedCategories,
            exclude_ids: [],
          }),
        });
        const retryJson = await retryRes.json();
        if (retryRes.ok && retryJson.data && retryJson.data.length > 0) {
          const topic = retryJson.data[0] as Topic;
          setDbStatus('connected');
          return topic;
        }
      }
      
      if (!response.ok) {
        console.warn('Neon fetch failed. Using local fallback. Details:', resJson.error);
      }
    } catch (err) {
      console.warn('Failed to query Neon API. Using local fallback. Details:', err);
    }

    // 2. Local Fallback Mode
    setDbStatus('local_fallback');
    let filteredFallbacks = FALLBACK_TOPICS.filter((topic) =>
      selectedCategories.includes(topic.category) && !seenIds.includes(topic.id)
    );

    if (filteredFallbacks.length === 0) {
      // If we have seen all fallback topics in these categories, reset seen list
      if (seenIds.length > 0) {
        console.log('All fallback topics in selected categories have been seen. Resetting seen topics...');
        try {
          localStorage.removeItem('smalltalk_seen_topics');
        } catch (e) {}
        filteredFallbacks = FALLBACK_TOPICS.filter((topic) =>
          selectedCategories.includes(topic.category)
        );
      }
    }

    if (filteredFallbacks.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * filteredFallbacks.length);
    return filteredFallbacks[randomIndex];
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans select-none relative overflow-x-hidden">
      {/* MagicRings Interactive Ambient Background */}
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-none opacity-20">
        <MagicRings
          color="#a855f7"
          colorTwo="#6366f1"
          ringCount={8}
          speed={0.5}
          attenuation={5}
          lineThickness={2}
          baseRadius={0.15}
          radiusStep={0.06}
          scaleRate={0.08}
          opacity={0.8}
          blur={2}
          noiseAmount={0.02}
          followMouse={true}
          mouseInfluence={0.1}
          hoverScale={1.15}
          parallax={0.04}
          clickBurst={true}
        />
      </div>

      {/* Header */}
      <header className="w-full max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6 flex items-center justify-between border-b border-zinc-900 z-10">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-center overflow-hidden shadow-lg shadow-indigo-500/5">
            <img src="/microphone_logo_v2.png" className="h-7.5 w-7.5 object-contain" alt="SmallTalk Logo" />
          </div>
          <span className="font-bold text-lg md:text-xl tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-300 bg-clip-text text-transparent">
            SmallTalk
          </span>
        </div>

        {/* Database Status Indicator */}
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-zinc-900/60 border border-zinc-800 backdrop-blur-md">
          {dbStatus === 'checking' && (
            <>
              <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-xs text-zinc-400 font-medium">Connecting database...</span>
            </>
          )}
          {dbStatus === 'connected' && (
            <>
              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <span className="text-xs text-zinc-300 font-medium flex items-center gap-1">
                <Database className="h-3 w-3 text-emerald-400" />
                Neon Online
              </span>
            </>
          )}
          {dbStatus === 'local_fallback' && (
            <>
              <div className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-pulse" />
              <span className="text-xs text-zinc-300 font-medium flex items-center gap-1">
                <Laptop className="h-3 w-3 text-amber-400" />
                Local Mode (Offline)
              </span>
            </>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-12 flex flex-col gap-6 md:gap-10 z-10">
        
        {/* Title Section */}
        <section className="text-center flex flex-col items-center gap-3 md:gap-4 px-2">
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-zinc-50 to-zinc-400 bg-clip-text text-transparent max-w-2xl leading-tight">
            Evaluate Your Speech in Seconds
          </h1>
          <p className="text-zinc-400 text-xs sm:text-sm md:text-base max-w-lg leading-relaxed">
            Select your categories, spin the roulette to receive a random prompt, and test your speaking clarity, coherence, and flow.
          </p>
        </section>

        {/* Database Status Helper Notice */}
        {dbStatus === 'local_fallback' && (
          <section className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/30 flex gap-3 text-amber-400/90 text-xs max-w-3xl mx-auto">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-300">Database setup check:</span> The Neon client could not reach your database schema. 
              SmallTalk is automatically running in <strong>Local Preview Mode</strong> using the seeded list of 180 prompts. 
              To pull from your cloud database, please verify your tables are seeded in Neon and your credentials are added to <code className="bg-amber-950/40 px-1 py-0.5 rounded text-amber-200">.env.local</code>.
            </div>
          </section>
        )}

        {!settledTopic ? (
          <>
            {/* Category Selection Section */}
            <section className={isSpinning ? 'pointer-events-none opacity-50 transition-opacity duration-300' : 'transition-opacity duration-300'}>
              <CategorySelection
                selectedCategories={selectedCategories}
                onChange={setSelectedCategories}
              />
            </section>

            {/* Spinner Section */}
            <section className="w-full">
              <RouletteSpinner
                onSpin={handleSpinForTopic}
                isSpinning={isSpinning}
                setIsSpinning={setIsSpinning}
                onSpinStart={handleSpinStart}
                onLanded={handleLanded}
                onClear={handleClear}
              />
            </section>
          </>
        ) : (
          /* Audio Recorder Section */
          !isSpinning && (
            <section className="w-full mt-4">
              <AudioRecorder
                topicId={settledTopic.id}
                promptText={settledTopic.prompt}
                onUploadSuccess={handleUploadSuccess}
                onReset={handleClear}
              />
            </section>
          )
        )}

      </main>

      {/* Footer */}
      <footer className="w-full py-8 text-center text-xs text-zinc-600 border-t border-zinc-950 bg-black/10 mt-auto">
        <p>&copy; {new Date().getFullYear()} SmallTalk Speech Evaluation. All rights reserved.</p>
      </footer>
    </div>
  );
}
