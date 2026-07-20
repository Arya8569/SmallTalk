'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, CheckCircle2, AlertCircle, Loader2, Sparkles, RefreshCw } from 'lucide-react';

interface AudioRecorderProps {
  topicId: number;
  promptText: string;
  onUploadSuccess: (url: string) => void;
  onReset: () => void;
}

interface Segment {
  text_segment: string;
  type: 'neutral' | 'red' | 'green';
}

interface EvaluationRecord {
  id: string;
  topic_id: number;
  audio_url: string;
  rating: number;
  feedback_json: {
    transcript: string;
    analysis: Segment[];
  };
  created_at: string;
}

export default function AudioRecorder({ topicId, promptText, onUploadSuccess, onReset }: AudioRecorderProps) {
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'stopped'>('idle');
  const [timer, setTimer] = useState(60);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Upload and AI Evaluation States
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [gcsUrl, setGcsUrl] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up timers and audio streams on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      stopMediaStream();
    };
  }, []);

  const stopMediaStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startTimer = () => {
    setTimer(60);
    timerIntervalRef.current = setInterval(() => {
      setTimer((prevTimer) => {
        if (prevTimer <= 1) {
          stopRecording();
          return 0;
        }
        return prevTimer - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const startRecording = async () => {
    audioChunksRef.current = [];
    setAudioBlob(null);
    setAudioUrl(null);
    setUploadState('idle');
    setGcsUrl(null);
    setEvaluation(null);
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(finalBlob);
        
        const url = URL.createObjectURL(finalBlob);
        setAudioUrl(url);
        
        // Auto-trigger GCS upload
        uploadAudio(finalBlob);
      };

      mediaRecorder.start(250);
      setRecordingState('recording');
      startTimer();
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setErrorMessage('Microphone access denied. Please verify your permissions and try again.');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || recordingState !== 'recording') return;

    stopTimer();
    mediaRecorderRef.current.stop();
    stopMediaStream();
    setRecordingState('stopped');
  };

  const uploadAudio = async (blobToUpload: Blob) => {
    setUploadState('uploading');
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', blobToUpload, `recording-${topicId}-${Date.now()}.webm`);
      formData.append('topic_id', topicId.toString());

      const backendApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';
      const response = await fetch(`${backendApiUrl}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload server responded with status: ${response.status}`);
      }

      const data = (await response.json()) as EvaluationRecord;
      
      if (data && data.audio_url) {
        setUploadState('success');
        setGcsUrl(data.audio_url);
        setEvaluation(data);
        onUploadSuccess(data.audio_url);
      } else {
        throw new Error('Upload succeeded, but no audio_url was returned by the server.');
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadState('error');
      setErrorMessage(err.message || 'Connection to upload backend failed. Make sure your FastAPI backend is running on port 8000.');
    }
  };

  const handleTryAnotherTopic = async () => {
    if (evaluation && evaluation.id) {
      try {
        const backendApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';
        fetch(`${backendApiUrl}/recordings/${evaluation.id}`, {
          method: 'DELETE',
        }).catch((err) => console.error('Failed to delete recording:', err));
        console.log(`Triggered deletion for recording: ${evaluation.id}`);
      } catch (err) {
        console.error('Failed to trigger deletion on reset:', err);
      }
    }
    onReset();
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
      
      {/* Active Question Display */}
      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-4 sm:p-6 backdrop-blur-xl shadow-xl flex flex-col gap-2.5 sm:gap-3 animate-fade-in">
        <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Active Topic Prompt</span>
        <h2 className="text-zinc-100 text-base sm:text-lg md:text-xl font-bold leading-relaxed">
          "{promptText}"
        </h2>
      </div>

      {/* Recording card */}
      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-4 sm:p-6 backdrop-blur-xl shadow-2xl flex flex-col gap-5 sm:gap-6 relative overflow-hidden animate-fade-in">
        {recordingState === 'recording' && (
          <div className="absolute inset-0 bg-red-500/[0.02] animate-pulse pointer-events-none" />
        )}

        <div className="flex items-center justify-between border-b border-zinc-850 pb-4 gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              <Mic className={`h-4.5 w-4.5 ${recordingState === 'recording' ? 'text-red-500 animate-pulse' : 'text-zinc-400'}`} />
              Record Your Answer
            </h3>
            <p className="text-xs text-zinc-400">
              Speak clearly for up to 60 seconds. Evaluation will automatically generate.
            </p>
          </div>
          {recordingState === 'idle' && (
            <button
              onClick={onReset}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-800 bg-zinc-950/20 hover:bg-zinc-800 rounded-lg transition-all"
            >
              Change Topic
            </button>
          )}
        </div>

        {/* Main recording area */}
        <div className="flex flex-col items-center justify-center py-4 sm:py-6 border border-zinc-800/50 bg-zinc-950/40 rounded-xl gap-4">
          
          {recordingState === 'recording' ? (
            <div className="flex flex-col items-center gap-4">
              <div className="relative flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    className="stroke-zinc-800 fill-none"
                    strokeWidth="6"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    className="stroke-red-500 fill-none transition-all duration-1000"
                    strokeWidth="6"
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 - (251.2 * timer) / 60}
                  />
                </svg>
                <span className="absolute text-xl font-bold font-mono text-zinc-100">{timer}s</span>
              </div>

              <div className="flex items-center gap-1 h-6">
                {[...Array(9)].map((_, i) => (
                  <div
                    key={i}
                    style={{
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: `${0.6 + Math.random() * 0.5}s`,
                    }}
                    className="w-1 bg-red-500/80 rounded-full animate-bounce h-2"
                  />
                ))}
              </div>
              <p className="text-xs font-semibold text-red-500/90 tracking-widest uppercase animate-pulse">RECORDING LIVE</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className={`h-16 w-16 rounded-full border flex items-center justify-center transition-all duration-200 ${
                recordingState === 'stopped' ? 'bg-zinc-850 border-zinc-700 text-zinc-300' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}>
                <Mic className="h-7 w-7" />
              </div>
              <p className="text-xs text-zinc-500">
                {recordingState === 'stopped' ? 'Recording finished' : 'Ready to record speech'}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-4 mt-2">
            {recordingState === 'idle' && (
              <button
                onClick={startRecording}
                className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 font-semibold text-sm text-white transition-all duration-200 hover:shadow-lg hover:shadow-red-900/10 active:scale-95 flex items-center gap-2"
              >
                <Mic className="h-4.5 w-4.5" />
                Start Recording
              </button>
            )}

            {recordingState === 'recording' && (
              <button
                onClick={stopRecording}
                className="px-6 py-2.5 rounded-lg bg-zinc-200 hover:bg-white font-semibold text-sm text-zinc-950 transition-all duration-200 active:scale-95 flex items-center gap-2"
              >
                <Square className="h-4 w-4 fill-zinc-950" />
                Stop & Upload
              </button>
            )}

            {recordingState === 'stopped' && uploadState !== 'uploading' && (
              <button
                onClick={startRecording}
                className="px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 font-semibold text-sm text-zinc-300 transition-all duration-200 active:scale-95 flex items-center gap-2"
              >
                <Mic className="h-4 w-4" />
                Record Again
              </button>
            )}
          </div>
        </div>

        {/* Uploading / Error Status messages */}
        {uploadState === 'uploading' && (
          <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-900/30 flex items-center gap-3 text-indigo-400 text-xs">
            <Loader2 className="h-4.5 w-4.5 animate-spin shrink-0 text-indigo-400" />
            <div>
              <span className="font-semibold text-indigo-300">Processing Audio:</span> Transcribing speech via Groq Whisper and evaluating content with Gemini 2.5 Flash...
            </div>
          </div>
        )}

        {uploadState === 'error' && (
          <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/30 flex items-start gap-3 text-red-400 text-xs">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-400 mt-0.5" />
            <div>
              <span className="font-semibold text-red-300">Analysis Failed:</span> {errorMessage}
            </div>
          </div>
        )}
      </div>

      {/* Results View Card */}
      {evaluation && uploadState === 'success' && (
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-4 sm:p-6 md:p-8 backdrop-blur-xl shadow-2xl flex flex-col gap-5 sm:gap-6 animate-fade-in">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-850 pb-5 sm:pb-6 gap-4">
            <div>
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-400" />
                Speech Evaluation Results
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                A detailed breakdown of your speaking score, fillers, and rhetorical highlights.
              </p>
            </div>

            {/* Rating Stars component */}
            <div className="flex items-center gap-1.5 bg-zinc-950/50 border border-zinc-850 px-3.5 py-2 rounded-xl self-start sm:self-auto">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mr-1.5">Rating:</span>
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className={`w-5 h-5 ${
                      i < evaluation.rating
                        ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.3)]'
                        : 'text-zinc-800 fill-zinc-900'
                    }`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
          </div>

          {/* GCS Audio Player */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Listen to Recording</span>
            <div className="bg-zinc-950/40 border border-zinc-850 p-4 rounded-xl flex items-center justify-center">
              <audio
                controls
                src={evaluation.audio_url}
                className="w-full max-w-lg accent-indigo-500"
              />
            </div>
          </div>

          {/* Segmented Transcript Paragraph */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Dynamic Transcript Critique</span>
            
            <div className="bg-zinc-950/80 border border-zinc-850 p-4 sm:p-6 rounded-xl text-zinc-100 text-sm sm:text-base md:text-lg leading-relaxed font-medium">
              {evaluation.feedback_json.analysis && evaluation.feedback_json.analysis.length > 0 ? (
                <div className="inline leading-loose tracking-wide break-words">
                  {evaluation.feedback_json.analysis.map((seg, idx) => {
                    if (seg.type === 'green') {
                      return (
                        <span
                          key={idx}
                          className="bg-green-200 text-green-900 rounded px-1 mx-0.5 inline font-semibold break-words py-[2px]"
                        >
                          {seg.text_segment}
                        </span>
                      );
                    } else if (seg.type === 'red') {
                      return (
                        <span
                          key={idx}
                          className="bg-red-200 text-red-900 rounded px-1 mx-0.5 inline font-semibold break-words py-[2px]"
                        >
                          {seg.text_segment}
                        </span>
                      );
                    } else {
                      return (
                        <span key={idx} className="text-zinc-300 inline break-words">
                          {seg.text_segment}
                        </span>
                      );
                    }
                  })}
                </div>
              ) : (
                <p className="text-zinc-300 italic leading-relaxed">{evaluation.feedback_json.transcript}</p>
              )}
            </div>

            {/* Quick Legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500 px-1 mt-1">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded bg-green-200 border border-green-300" />
                <span className="text-zinc-400">Excellent rhetoric / vocabulary</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded bg-red-200 border border-red-300" />
                <span className="text-zinc-400">Filler words / grammatical issues</span>
              </span>
            </div>
          </div>

          {/* Reset Page Action */}
          <div className="border-t border-zinc-850 pt-6 mt-2 flex items-center justify-center">
            <button
              onClick={handleTryAnotherTopic}
              className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-900/10 flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Try Another Topic
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
