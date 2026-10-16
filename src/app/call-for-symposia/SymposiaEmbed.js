'use client';

import { useState, useRef, useEffect } from 'react';
import { ExternalLink, RotateCw, Maximize2, Minimize2, Loader2, ArrowUpRight } from 'lucide-react';

const EMBED_URL = 'https://symposia-forms.vercel.app/login';

export default function SymposiaEmbed() {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef(null);

  const handleRefresh = () => {
    setIsLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  return (
    <div className={`flex flex-col transition-all duration-200 ${isFullscreen ? 'fixed inset-0 z-50 bg-[#1d1d1f] p-4' : 'w-full'}`}>
      {/* Header bar */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className={`font-semibold tracking-tight ${isFullscreen ? 'text-white text-lg' : 'text-xl'}`}>
              Call for Symposia
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Platform
            </span>
          </div>
          {!isFullscreen && (
            <p className="text-[var(--muted)] text-xs mt-0.5">
              Symposia submissions and proposals management
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh iframe button */}
          <button
            type="button"
            onClick={handleRefresh}
            title="Reload application"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isFullscreen
                ? 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                : 'bg-white text-[var(--foreground)] border-[var(--border)] hover:bg-[#fafafa]'
            }`}
          >
            <RotateCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Open in new tab button */}
          <a
            href={EMBED_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in a new tab"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isFullscreen
                ? 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                : 'bg-white text-[var(--foreground)] border-[var(--border)] hover:bg-[#fafafa]'
            }`}
          >
            <ExternalLink size={13} />
            <span className="hidden sm:inline">Open in Tab</span>
          </a>

          {/* Fullscreen toggle button */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit full screen (Esc)' : 'Expand full screen'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0071e3] text-white rounded-lg text-xs font-semibold hover:bg-[#0077ed] transition-colors shadow-sm"
          >
            {isFullscreen ? (
              <>
                <Minimize2 size={13} />
                <span>Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 size={13} />
                <span className="hidden sm:inline">Full Screen</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Embedded Iframe Container */}
      <div
        className={`relative w-full rounded-xl overflow-hidden border transition-all duration-200 bg-white ${
          isFullscreen
            ? 'flex-1 border-white/10 shadow-2xl'
            : 'h-[calc(100vh-160px)] min-h-[680px] border-[var(--border)] shadow-sm'
        }`}
      >
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm transition-opacity duration-300">
            <Loader2 className="w-7 h-7 text-[#0071e3] animate-spin mb-3" />
            <p className="text-xs font-medium text-slate-700">Connecting to Symposia Forms...</p>
            <p className="text-[11px] text-slate-400 mt-1">https://symposia-forms.vercel.app</p>
          </div>
        )}

        <iframe
          ref={iframeRef}
          key={iframeKey}
          src={EMBED_URL}
          title="Call for Symposia"
          onLoad={() => setIsLoading(false)}
          className="w-full h-full border-0"
          allow="clipboard-write; clipboard-read; fullscreen; camera; microphone"
          loading="eager"
        />
      </div>
    </div>
  );
}
