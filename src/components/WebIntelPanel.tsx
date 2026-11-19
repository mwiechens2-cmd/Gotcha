import React from 'react';
import { Globe, ExternalLink, AlertCircle, RefreshCw, Info } from 'lucide-react';
import { WebLookupResponse } from '../utils/webLookup';

interface WebIntelPanelProps {
  title: string;
  isLoading: boolean;
  error: string | null;
  data: WebLookupResponse | null;
  onRetry?: () => void;
  emptyPrompt?: string;
}

export const WebIntelPanel: React.FC<WebIntelPanelProps> = ({
  title,
  isLoading,
  error,
  data,
  onRetry,
  emptyPrompt,
}) => {
  if (!isLoading && !error && !data) {
    if (!emptyPrompt) return null;
    return (
      <div className="rounded-lg border border-slate-800/90 bg-[#080c14]/60 p-4 text-xs text-slate-400">
        {emptyPrompt}
      </div>
    );
  }

  const modeLabel =
    data?.searchMode === 'public_web_fallback'
      ? 'Public Web Fallback'
      : data?.searchMode === 'gemini_grounding'
      ? 'Gemini Search Grounding'
      : null;

  return (
    <div className="rounded-lg border border-cyan-900/50 bg-[#080c14]/80 p-4 space-y-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-2 text-cyan-300 font-semibold">
          <Globe className="h-3.5 w-3.5 shrink-0" />
          <span>{title}</span>
        </div>
        {data && (
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400 tabular-nums">
            {modeLabel && <span>{modeLabel}</span>}
            {modeLabel && data.sources.length > 0 && <span aria-hidden="true">·</span>}
            {data.sources.length > 0 && (
              <span>
                {data.sources.length} Web Source{data.sources.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2 py-2 animate-pulse">
          <div className="h-3 bg-slate-800 rounded w-3/4" />
          <div className="h-3 bg-slate-800 rounded w-full" />
          <div className="h-3 bg-slate-800 rounded w-5/6" />
          <span className="text-[11px] font-mono text-cyan-400/80 block pt-1">
            Querying live internet search sources...
          </span>
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-lg border border-rose-800/60 bg-rose-950/30 p-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-1 rounded border border-rose-700/60 bg-rose-900/40 px-2.5 py-1 text-[11px] font-medium text-rose-200 hover:bg-rose-900/70 cursor-pointer shrink-0"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      {data && !isLoading && !error && (
        <div className="space-y-3">
          {data.notice && (
            <div className="rounded-lg border border-amber-700/50 bg-amber-950/25 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-200">
              <div className="flex items-center gap-2">
                <Info className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span>{data.notice}</span>
              </div>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1 text-amber-300 hover:text-white font-medium cursor-pointer shrink-0"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Retry Search</span>
                </button>
              )}
            </div>
          )}

          <div className="text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
            {data.summary}
          </div>

          {data.sources.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 block">
                Verified Web Sources:
              </span>
              <div className="flex flex-col gap-1.5">
                {data.sources.slice(0, 6).map((src, idx) => (
                  <a
                    key={`${src.uri}-${idx}`}
                    href={src.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-[11px] text-cyan-300 hover:border-cyan-500/50 hover:text-cyan-200 transition-colors"
                  >
                    <span className="truncate">{src.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
