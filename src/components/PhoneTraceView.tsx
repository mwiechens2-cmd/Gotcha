import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  Phone,
  Lock,
  Unlock,
  Download,
  Mail,
  ArrowRight,
  ShieldAlert,
  Globe,
  Bookmark,
  Check,
  Bell,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';
import { PhoneLookupResult, SubscriptionTierType } from '../types';
import { PRESET_PHONES, generatePhoneLookup } from '../data/mockData';
import {
  fetchPhoneTrace,
  fetchPhoneWebOsint,
  PhoneTraceRequestError,
  WebLookupResponse,
} from '../utils/webLookup';
import { WebIntelPanel } from './WebIntelPanel';
import { PhoneAddressGoogleMap } from './PhoneAddressGoogleMap';
import { useFirebase } from '../contexts/FirebaseContext';
import { buildPhoneLookupId, buildWatchlistId } from '../services/firestoreService';

interface PhoneTraceViewProps {
  currentTier: SubscriptionTierType;
  isPasscodeUnlocked: boolean;
  activeResult: PhoneLookupResult;
  onResultChange: (result: PhoneLookupResult) => void;
  onOpenPricing: () => void;
  onOpenPasscodeModal: () => void;
  onLockPasscode: () => void;
  onOpenExport: (data: { type: 'phone'; content: PhoneLookupResult }) => void;
  externalTraceRequest?: { phoneNumber: string; requestId: number } | null;
}

export const PhoneTraceView: React.FC<PhoneTraceViewProps> = ({
  currentTier,
  isPasscodeUnlocked,
  activeResult,
  onResultChange,
  onOpenPricing,
  onOpenPasscodeModal,
  onLockPasscode,
  onOpenExport,
  externalTraceRequest = null,
}) => {
  const { savedPhoneLookups, watchlistItems, savePhoneTrace, addToWatchlist } = useFirebase();

  const [inputNumber, setInputNumber] = useState(activeResult.formattedInternational);
  const [isSearching, setIsSearching] = useState(false);
  const [traceStage, setTraceStage] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [webLoading, setWebLoading] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);
  const [webIntel, setWebIntel] = useState<WebLookupResponse | null>(null);
  const [savingTrace, setSavingTrace] = useState(false);
  const [watchingTarget, setWatchingTarget] = useState(false);
  const [lastTraceMeta, setLastTraceMeta] = useState<{
    target: string;
    completedAt: string;
    traceId: string;
  } | null>(null);

  const traceRunIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultsAnchorRef = useRef<HTMLDivElement | null>(null);
  const webPanelAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setInputNumber(activeResult.formattedInternational);
  }, [activeResult.formattedInternational]);

  const handledExternalIdRef = useRef<number>(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      traceRunIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!externalTraceRequest || externalTraceRequest.requestId === handledExternalIdRef.current) {
      return;
    }
    handledExternalIdRef.current = externalTraceRequest.requestId;
    setInputNumber(externalTraceRequest.phoneNumber);
    void executeTraceForInput(externalTraceRequest.phoneNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalTraceRequest?.requestId]);

  const currentLookupId = buildPhoneLookupId(activeResult.phoneNumber);
  const currentWatchId = buildWatchlistId('phone', activeResult.phoneNumber);
  const isSaved = savedPhoneLookups.some((item) => item.id === currentLookupId);
  const isWatched = watchlistItems.some((item) => item.id === currentWatchId);

  const runLiveWebSearch = async (target: PhoneLookupResult, runId?: number) => {
    const activeId = runId ?? traceRunIdRef.current;
    setWebLoading(true);
    setWebError(null);
    try {
      const response = await fetchPhoneWebOsint({
        phoneNumber: target.phoneNumber,
        formattedNational: target.formattedNational,
        carrierName: target.carrier.name,
        locationHint: `${target.location.city}, ${target.location.state}`,
      });
      if (!isMountedRef.current || activeId !== traceRunIdRef.current) return;
      setWebIntel(response);
    } catch (err) {
      if (!isMountedRef.current || activeId !== traceRunIdRef.current) return;
      setWebError(err instanceof Error ? err.message : 'Unable to fetch web OSINT records.');
    } finally {
      if (isMountedRef.current && activeId === traceRunIdRef.current) {
        setWebLoading(false);
      }
    }
  };

  const executeTraceForInput = async (rawNumber: string) => {
    const runId = ++traceRunIdRef.current;
    setValidationError(null);
    setWebIntel(null);
    setWebError(null);
    setIsSearching(true);
    setTraceStage('Querying live NANPA/LERG carrier switch database & FCC Open Data...');

    try {
      let result: PhoneLookupResult;
      try {
        result = await fetchPhoneTrace(rawNumber);
      } catch (err) {
        if (err instanceof PhoneTraceRequestError && err.status >= 400 && err.status < 500) {
          throw err;
        }
        result = generatePhoneLookup(rawNumber);
      }

      if (!isMountedRef.current || runId !== traceRunIdRef.current) return;

      onResultChange(result);
      setInputNumber(result.formattedInternational);
      setLastTraceMeta({
        target: result.formattedInternational,
        completedAt: new Date().toLocaleTimeString(),
        traceId: `TRC-${String(runId).padStart(3, '0')}`,
      });

      if (typeof resultsAnchorRef.current?.scrollIntoView === 'function') {
        resultsAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      setIsSearching(false);
      setTraceStage('');
      void runLiveWebSearch(result, runId);
    } catch (err) {
      if (!isMountedRef.current || runId !== traceRunIdRef.current) return;
      setValidationError(
        err instanceof Error ? err.message : 'Unable to complete phone trace.'
      );
      setIsSearching(false);
      setTraceStage('');
    }
  };

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputNumber.trim();
    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');

    if (!hasPlus && digits.length === 7) {
      setValidationError(
        'Include the 3-digit area code (e.g. +1 415-890-4421) so serving carrier and rate center can be resolved.'
      );
      return;
    }

    if (digits.length < (hasPlus ? 7 : 10) || digits.length > 15) {
      setValidationError(
        'Enter a valid phone number with area code (e.g. +1 415-890-4421 or +44 20 7946 0958).'
      );
      return;
    }

    void executeTraceForInput(trimmed);
  };

  const handleSelectPreset = (presetNumber: string) => {
    setInputNumber(presetNumber);
    void executeTraceForInput(presetNumber);
  };

  const handleSaveTrace = async () => {
    setSavingTrace(true);
    try {
      const saveTier: SubscriptionTierType = isDossierUnlocked ? currentTier : 'explorer';
      await savePhoneTrace(activeResult, saveTier, webIntel?.summary);
    } finally {
      setSavingTrace(false);
    }
  };

  const handleWatchNumber = async () => {
    setWatchingTarget(true);
    try {
      await addToWatchlist({
        itemType: 'phone',
        targetValue: activeResult.phoneNumber,
        jurisdictionState: '',
        label: `${activeResult.carrier.name} (${activeResult.formattedNational})`,
        lastStatus: `${activeResult.riskAnalysis.riskLevel} Risk (${activeResult.riskAnalysis.spamScore}/100)`,
      });
    } finally {
      setWatchingTarget(false);
    }
  };

  const isTierUnlocked = currentTier === 'investigator' || currentTier === 'enterprise';
  const isDossierUnlocked = isTierUnlocked && isPasscodeUnlocked;

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-rose-400 bg-rose-950/40 border-rose-800/60';
    if (score >= 35) return 'text-amber-400 bg-amber-950/40 border-amber-800/60';
    return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60';
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header section with natural editorial title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Reverse Phone OSINT & Telecom Trace
        </h1>
        <p className="mt-1.5 text-sm text-slate-400 max-w-3xl leading-relaxed">
          Inspect carrier routing, line classifications, VoIP trunk originations, and spam risk scores.
          Unlock comprehensive subscriber registries and breach footprints with Investigator Pro.
        </p>
      </div>

      {/* Interactive Search Bar & Quick Presets */}
      <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-5">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Phone className="h-4 w-4" />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={inputNumber}
              onChange={(e) => {
                setInputNumber(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="Enter phone number (e.g. +1 415-890-4421)"
              className="w-full rounded-lg border border-slate-700 bg-[#080c14] py-2.5 pl-10 pr-9 text-sm font-mono text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            {inputNumber && !isSearching && (
              <button
                type="button"
                onClick={() => {
                  setInputNumber('');
                  setValidationError(null);
                  inputRef.current?.focus();
                }}
                aria-label="Clear phone number"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span>{isSearching ? 'Tracing Number...' : 'Trace Number'}</span>
          </button>
        </form>
        {validationError && (
          <p className="mt-2 text-xs text-rose-400 font-medium">{validationError}</p>
        )}

        {/* Quick Presets for Instant Testing */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium mr-1">Case study presets:</span>
          {PRESET_PHONES.map((preset) => {
            const activeDigits = activeResult.phoneNumber.replace(/\D/g, '');
            const presetDigits = preset.number.replace(/\D/g, '');
            const isSelected = activeDigits === presetDigits;
            return (
              <button
                key={preset.number}
                type="button"
                disabled={isSearching}
                onClick={() => handleSelectPreset(preset.number)}
                className={`rounded-md border px-2.5 py-1 font-mono transition-colors cursor-pointer text-[12px] disabled:opacity-50 ${
                  isSelected
                    ? 'border-cyan-500/80 bg-cyan-950/40 text-cyan-300'
                    : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Trace Status & Progress Banner */}
      <div ref={resultsAnchorRef}>
        {isSearching ? (
          <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/25 px-4 py-3 flex items-center gap-3 text-xs text-cyan-200 font-mono">
            <Loader2 className="h-4 w-4 text-cyan-400 animate-spin shrink-0" />
            <span>
              {traceStage ||
                'Executing telecom carrier routing trace and querying live FCC / web OSINT repositories...'}
            </span>
          </div>
        ) : lastTraceMeta ? (
          <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-mono">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                Trace <span className="text-slate-400">({lastTraceMeta.traceId})</span> completed for{' '}
                <strong className="text-white">{lastTraceMeta.target}</strong> at{' '}
                {lastTraceMeta.completedAt}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="text-slate-400">
                {webLoading
                  ? 'Live FCC & Web OSINT lookup in progress...'
                  : webIntel
                  ? `Live Web OSINT updated (${webIntel.sources.length} sources)`
                  : webError
                  ? 'Live Web OSINT unavailable (telecom trace ready)'
                  : 'Telecom routing & risk profile updated'}
              </span>
              {(webLoading || webIntel || webError) && (
                <button
                  type="button"
                  onClick={() => {
                    if (typeof webPanelAnchorRef.current?.scrollIntoView === 'function') {
                      webPanelAnchorRef.current.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                      });
                    }
                  }}
                  className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                >
                  View Web Results
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Main Analysis Section: Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Telecom Infrastructure & Risk Assessment (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 01: Telecom Routing */}
          <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-6 space-y-5">
            {isSearching ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-5 w-56 rounded bg-slate-800" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="h-20 rounded-lg bg-[#080c14]/70 border border-slate-800" />
                  <div className="h-20 rounded-lg bg-[#080c14]/70 border border-slate-800" />
                  <div className="h-20 rounded-lg bg-[#080c14]/70 border border-slate-800" />
                  <div className="h-20 rounded-lg bg-[#080c14]/70 border border-slate-800" />
                </div>
              </div>
            ) : (
            <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div>
                <h2 className="text-base font-semibold text-white">
                  01. Telecom & Carrier Architecture
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span className="font-mono text-cyan-400 tabular-nums">
                    {activeResult.formattedInternational}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{activeResult.countryName}</span>
                  <span aria-hidden="true">·</span>
                  <span>Line: {activeResult.lineType}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleSaveTrace()}
                  disabled={savingTrace}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                    isSaved
                      ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300'
                      : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-500/50 hover:text-white'
                  }`}
                >
                  {isSaved ? <Check className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5 text-cyan-400" />}
                  <span>{savingTrace ? 'Saving...' : isSaved ? 'Saved' : 'Save Trace'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleWatchNumber()}
                  disabled={watchingTarget}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                    isWatched
                      ? 'border-cyan-500/60 bg-cyan-950/50 text-cyan-300'
                      : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-500/50 hover:text-white'
                  }`}
                >
                  <Bell className="h-3.5 w-3.5 text-cyan-400" />
                  <span>{watchingTarget ? 'Adding...' : isWatched ? 'Watching' : 'Watch'}</span>
                </button>
              </div>
            </div>

            {/* Carrier Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-lg border border-slate-800/90 bg-[#080c14]/60">
                <span className="text-slate-400 block mb-1">Serving Carrier Network</span>
                <span className="text-sm font-semibold text-white block">
                  {activeResult.carrier.name}
                </span>
                <span className="text-slate-500 font-mono mt-0.5 block text-[11px]">
                  {activeResult.carrier.type} · Network ID: {activeResult.carrier.networkCode}
                </span>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-800/90 bg-[#080c14]/60">
                <span className="text-slate-400 block mb-1">Porting Status & History</span>
                <span className="text-sm font-semibold text-white block">
                  {activeResult.carrier.isPorted ? 'Ported Line (Transferred)' : 'Original Network Allocation'}
                </span>
                <span className="text-slate-500 font-mono mt-0.5 block text-[11px]">
                  {activeResult.carrier.isPorted
                    ? `Transferred from ${activeResult.carrier.originalNetwork}`
                    : 'No porting transfers detected'}
                </span>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-800/90 bg-[#080c14]/60">
                <span className="text-slate-400 block mb-1">Rate Center & Switch</span>
                <span className="text-sm font-medium text-white block">
                  {activeResult.location.rateCenter}
                </span>
                <span className="text-slate-500 font-mono mt-0.5 block text-[11px]">
                  {activeResult.location.timeZone}
                </span>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-800/90 bg-[#080c14]/60">
                <span className="text-slate-400 block mb-1">Geographic Region</span>
                <span className="text-sm font-medium text-white block">
                  {activeResult.location.city}, {activeResult.location.state}{' '}
                  {activeResult.location.postalCode}
                </span>
                <span className="text-slate-500 font-mono mt-0.5 block text-[11px]">
                  Coordinates: {Math.abs(activeResult.location.coordinates[0]).toFixed(3)}°
                  {activeResult.location.coordinates[0] >= 0 ? 'N' : 'S'},{' '}
                  {Math.abs(activeResult.location.coordinates[1]).toFixed(3)}°
                  {activeResult.location.coordinates[1] >= 0 ? 'E' : 'W'}
                </span>
              </div>
            </div>

            {/* Registered Owner & Physical Address Summary */}
            {(() => {
              const owner = activeResult.ownerSummary;
              const fallbackName = activeResult.dossier?.subscriberName;
              const fallbackAddr = activeResult.dossier?.addressHistory?.[0];
              const resolvedName = owner?.ownerName || fallbackName || 'Unlisted Subscriber';
              const resolvedType =
                owner?.ownerType ||
                (activeResult.dossier?.subscriberType === 'Individual'
                  ? 'Individual'
                  : activeResult.dossier?.subscriberType === 'Corporate'
                  ? 'Corporate'
                  : 'Unlisted');
              const isPrivateIndividualLocked = resolvedType === 'Individual' && !isDossierUnlocked;
              const streetDisplay =
                owner?.streetAddress || (owner?.status === 'verified_owner' ? fallbackAddr?.street : undefined);
              const cityDisplay = owner?.cityStateZip || `${activeResult.location.city}, ${activeResult.location.state}`;

              return (
                <div className="p-4 rounded-lg border border-slate-800/90 bg-[#080c14]/75 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-400 font-medium">Registered Owner & Physical Address</span>
                    <span
                      className={`px-2 py-0.5 rounded border text-[10px] font-mono font-semibold ${
                        owner?.status === 'verified_owner'
                          ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300'
                          : owner?.status === 'cnam_only'
                          ? 'border-cyan-700/60 bg-cyan-950/40 text-cyan-300'
                          : 'border-slate-700 bg-slate-900 text-slate-300'
                      }`}
                    >
                      {owner?.sourceLabel || 'Carrier / Public Registry'}
                    </span>
                  </div>

                  {isPrivateIndividualLocked ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
                      <div>
                        <p className="text-sm font-semibold text-amber-300">
                          Private Individual Record Matched (Locked)
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Unlock the OSINT Dossier to reveal verified individual subscriber name and street address history.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={isTierUnlocked ? onOpenPasscodeModal : onOpenPricing}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/50 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/50 transition-colors cursor-pointer shrink-0"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        <span>{isTierUnlocked ? 'Enter Passcode' : 'Unlock Dossier'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                      <div>
                        <span className="text-[11px] text-slate-500 block">Owner / Registrant Name</span>
                        <span className="text-sm font-semibold text-white block mt-0.5">{resolvedName}</span>
                        <span className="text-[11px] font-mono text-slate-400">{resolvedType}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">Street & Billing/Registry Address</span>
                        {streetDisplay ? (
                          <>
                            <span className="text-sm font-medium text-slate-100 block mt-0.5">{streetDisplay}</span>
                            <span className="text-[11px] text-slate-400">{cityDisplay}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-sm font-medium text-slate-300 block mt-0.5">
                              {cityDisplay} (Rate Center Only)
                            </span>
                            <span className="text-[11px] text-slate-500">No public street address listed</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {owner?.note && !isPrivateIndividualLocked && (
                    <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/80 pt-2">
                      {owner.note}
                    </p>
                  )}

                  {owner?.sourceUrl && !isPrivateIndividualLocked && (
                    <div className="pt-0.5">
                      <a
                        href={owner.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline"
                      >
                        <span>Inspect Official Source Record</span>
                        <ArrowRight className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })()}
            </>
            )}
          </div>

          {/* Interactive Google Maps Registered Address Pin */}
          <PhoneAddressGoogleMap
            activeResult={activeResult}
            isDossierUnlocked={isDossierUnlocked}
            isSearching={isSearching}
          />

          {/* Section 02: Threat & Reputation Analysis */}
          <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-6 space-y-5">
            {isSearching ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-5 w-64 rounded bg-slate-800" />
                <div className="h-3 w-full rounded bg-slate-800" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="h-14 rounded-lg bg-[#080c14]/70 border border-slate-800" />
                  <div className="h-14 rounded-lg bg-[#080c14]/70 border border-slate-800" />
                  <div className="h-14 rounded-lg bg-[#080c14]/70 border border-slate-800" />
                </div>
              </div>
            ) : (
            <>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h2 className="text-base font-semibold text-white">
                  02. Fraud Risk & Telemarketing Telemetry
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span>FCC Complaint Aggregator</span>
                  <span aria-hidden="true">·</span>
                  <span>Carrier Spam Repositories</span>
                </div>
              </div>

              <span
                className={`text-xs px-2.5 py-1 rounded border font-mono font-bold ${getRiskColor(
                  activeResult.riskAnalysis.spamScore
                )}`}
              >
                {activeResult.riskAnalysis.riskLevel.toUpperCase()} RISK
              </span>
            </div>

            {/* Score Bar & Indicators */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center text-xs mb-1.5 font-medium">
                  <span className="text-slate-300">Composite Threat Score</span>
                  <span className="font-mono text-sm text-cyan-400 tabular-nums font-bold">
                    {activeResult.riskAnalysis.spamScore} / 100
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      activeResult.riskAnalysis.spamScore >= 70
                        ? 'bg-rose-500'
                        : activeResult.riskAnalysis.spamScore >= 35
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${activeResult.riskAnalysis.spamScore}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div className="p-3 rounded-lg border border-slate-800 bg-[#080c14]/50">
                  <span className="text-slate-400 block mb-0.5">Classification</span>
                  <span className="font-medium text-white">
                    {activeResult.riskAnalysis.activityCategory}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-slate-800 bg-[#080c14]/50">
                  <span className="text-slate-400 block mb-0.5">FCC Complaints</span>
                  <span className="font-mono text-white tabular-nums font-semibold">
                    {activeResult.riskAnalysis.totalReports.toLocaleString()} Incidents
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-slate-800 bg-[#080c14]/50">
                  <span className="text-slate-400 block mb-0.5">Primary Red Flag</span>
                  <span className="font-medium text-slate-300 truncate block" title={activeResult.riskAnalysis.primaryFlag}>
                    {activeResult.riskAnalysis.primaryFlag}
                  </span>
                </div>
              </div>
            </div>
            </>
            )}
          </div>

          {/* Section 03 (Left): Live Web OSINT Grounding */}
          <div
            ref={webPanelAnchorRef}
            className="rounded-xl border border-slate-800 bg-[#0d1322] p-6 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Live Web Directory & Complaint Search
                </h2>
                <span className="text-xs text-slate-400 mt-0.5 block">
                  Query live web sources for public business listings, FCC/FTC spam reports, and area exchange data
                </span>
              </div>
              <button
                type="button"
                onClick={() => void runLiveWebSearch(activeResult)}
                disabled={webLoading || isSearching}
                className="flex items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-950/50 px-3.5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/50 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>{webLoading ? 'Searching Web...' : 'Search Live Web'}</span>
              </button>
            </div>

            <WebIntelPanel
              title={`Live Web OSINT Results for ${activeResult.formattedNational}`}
              isLoading={webLoading}
              error={webError}
              data={webIntel}
              onRetry={() => void runLiveWebSearch(activeResult)}
              emptyPrompt="Click 'Trace Number' or 'Search Live Web' to run a real-time lookup across FCC Open Data and public caller-ID directories."
            />
          </div>
        </div>

        {/* Right Column: Deep OSINT Dossier (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-6 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                {isDossierUnlocked ? (
                  <Unlock className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Lock className="h-4 w-4 text-amber-400" />
                )}
                <h2 className="text-base font-semibold text-white">
                  03. Deep OSINT Identity Dossier
                </h2>
              </div>

              {isDossierUnlocked && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onLockPasscode}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-300 font-medium cursor-pointer"
                    title="Re-lock sensitive OSINT dossier"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>Lock</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenExport({ type: 'phone', content: activeResult })}
                    className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export</span>
                  </button>
                </div>
              )}
            </div>

            {/* Redacted Paywall / Passcode Gate vs Unlocked Unredacted Dossier */}
            {!isDossierUnlocked ? (
              <div className="mt-4 space-y-4">
                {/* Visual Redacted Teaser */}
                <div className="space-y-3 filter blur-[3px] select-none pointer-events-none opacity-40">
                  <div className="p-3 rounded bg-slate-900 border border-slate-800">
                    <span className="text-xs text-slate-500">Registered Subscriber</span>
                    <p className="text-sm font-bold text-white">Jordan E. Richardson (Private)</p>
                  </div>
                  <div className="p-3 rounded bg-slate-900 border border-slate-800">
                    <span className="text-xs text-slate-500">Address History</span>
                    <p className="text-xs text-slate-300">1420 Lakeview Crest, Apt 402, Austin TX</p>
                  </div>
                  <div className="p-3 rounded bg-slate-900 border border-slate-800">
                    <span className="text-xs text-slate-500">Compromised Credentials / Breaches</span>
                    <p className="text-xs text-slate-300">2 Breaches Detected (2024 Telecom Leak)</p>
                  </div>
                </div>

                {/* Conversion or Access Passcode Callout */}
                {isTierUnlocked ? (
                  <div className="rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-950/30 to-[#080c14] p-5 text-center space-y-3.5">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        OSINT Access Passcode Required
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Sensitive subscriber registries, physical addresses, breach exposures, and PDF exports
                        are protected by your workspace access passcode.
                      </p>
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={onOpenPasscodeModal}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer"
                      >
                        <span>Enter Access Passcode to Unlock</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-b from-cyan-950/40 to-[#080c14] p-5 text-center space-y-3.5">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Investigator Subscription Required
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Deep OSINT dossiers reveal verified subscriber identities, physical address records,
                        connected email accounts, and historical data breach associations.
                      </p>
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={onOpenPricing}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer shadow-lg shadow-cyan-950/50"
                      >
                        <span>Unlock Dossier with Investigator Pro ($29/mo)</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-[11px] text-slate-500 mt-2 block">
                        Unlimited monthly searches · Cancel anytime
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Unlocked OSINT Dossier Content */
              <div className="mt-4 space-y-4 text-xs">
                {/* Subscriber Profile */}
                <div className="p-4 rounded-lg border border-slate-800 bg-[#080c14]/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Verified Subscriber Registry</span>
                    <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                      {activeResult.dossier?.subscriberType}
                    </span>
                  </div>
                  <p className="text-base font-bold text-white tracking-tight">
                    {activeResult.dossier?.subscriberName}
                  </p>
                </div>

                {/* Address History */}
                <div className="p-4 rounded-lg border border-slate-800 bg-[#080c14]/70 space-y-2">
                  <span className="text-slate-400 block">Physical Address History</span>
                  <div className="space-y-2 mt-1">
                    {activeResult.dossier?.addressHistory.map((addr, idx) => (
                      <div key={idx} className="flex items-start justify-between border-t border-slate-800/60 pt-2 first:border-0 first:pt-0">
                        <div>
                          <p className="text-slate-200 font-medium">{addr.street}</p>
                          <p className="text-slate-500 text-[11px]">{addr.cityState}</p>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 shrink-0 ml-2">
                          {addr.years}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Digital Footprint & Emails */}
                <div className="p-4 rounded-lg border border-slate-800 bg-[#080c14]/70 space-y-2">
                  <span className="text-slate-400 block">Associated Digital Footprints</span>
                  {(activeResult.dossier?.associatedEmails && activeResult.dossier.associatedEmails.length > 0) ||
                  (activeResult.dossier?.digitalFootprint && activeResult.dossier.digitalFootprint.length > 0) ? (
                    <div className="space-y-1.5 mt-1">
                      {activeResult.dossier?.associatedEmails.map((email, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-slate-300 font-mono">
                          <Mail className="h-3 w-3 text-cyan-400 shrink-0" />
                          <span className="truncate">{email}</span>
                        </div>
                      ))}
                      {activeResult.dossier?.digitalFootprint.map((fp, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 text-[11px] pt-1">
                          <span className="text-slate-400 shrink-0">{fp.platform}</span>
                          <span className="font-mono text-cyan-300 text-right truncate">{fp.profileHandle}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-[11px]">No public email or social profile links matched.</p>
                  )}
                </div>

                {/* Breach Exposures */}
                <div className="p-4 rounded-lg border border-slate-800 bg-[#080c14]/70 space-y-2">
                  <span className="text-slate-400 block">Data Breach Incidents</span>
                  {activeResult.dossier?.breachExposures && activeResult.dossier.breachExposures.length > 0 ? (
                    <div className="space-y-2 mt-1">
                      {activeResult.dossier.breachExposures.map((breach, idx) => (
                        <div key={idx} className="border-t border-slate-800/60 pt-1.5 first:border-0 first:pt-0">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-rose-300">{breach.breachName}</span>
                            <span className="font-mono text-slate-400 text-[11px]">{breach.year}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Compromised: {breach.compromisedData.join(', ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-[11px]">No active dark web breach records matching this MSISDN.</p>
                  )}
                </div>

                {/* Alternate Numbers */}
                {activeResult.dossier?.altPhoneNumbers && activeResult.dossier.altPhoneNumbers.length > 0 && (
                  <div className="p-4 rounded-lg border border-slate-800 bg-[#080c14]/70 space-y-1.5">
                    <span className="text-slate-400 block">Linked Alternate Lines</span>
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {activeResult.dossier.altPhoneNumbers.map((num, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectPreset(num)}
                          className="font-mono text-[11px] text-cyan-300 hover:underline bg-slate-900 border border-slate-800 px-2 py-0.5 rounded cursor-pointer"
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
