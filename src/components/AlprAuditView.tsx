import React, { useEffect, useRef, useState } from 'react';
import {
  Car,
  Search,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Lock,
  ArrowRight,
  Download,
  Globe,
  Bookmark,
  Check,
  Bell,
  Loader2,
  MapPin,
  X,
} from 'lucide-react';
import { VehicleAlprAuditResult, SubscriptionTierType } from '../types';
import { PRESET_PLATES, generateVehicleAudit } from '../data/mockData';
import { fetchAlprWebIntel, WebLookupResponse } from '../utils/webLookup';
import { WebIntelPanel } from './WebIntelPanel';
import { AlprSightingMap } from './AlprSightingMap';
import { useFirebase } from '../contexts/FirebaseContext';
import { buildAlprAuditId, buildWatchlistId } from '../services/firestoreService';

interface AlprAuditViewProps {
  currentTier: SubscriptionTierType;
  isPasscodeUnlocked: boolean;
  activeAudit: VehicleAlprAuditResult;
  onAuditChange: (audit: VehicleAlprAuditResult) => void;
  onOpenPricing: () => void;
  onOpenPasscodeModal: () => void;
  onOpenFoia: (auditData: VehicleAlprAuditResult) => void;
  onOpenExport: (data: { type: 'alpr'; content: VehicleAlprAuditResult }) => void;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export const AlprAuditView: React.FC<AlprAuditViewProps> = ({
  currentTier,
  isPasscodeUnlocked,
  activeAudit,
  onAuditChange,
  onOpenPricing,
  onOpenPasscodeModal,
  onOpenFoia,
  onOpenExport,
}) => {
  const { savedAlprAudits, watchlistItems, savePlateAudit, addToWatchlist } = useFirebase();

  const [inputPlate, setInputPlate] = useState(activeAudit.plateNumber);
  const [selectedState, setSelectedState] = useState(activeAudit.state);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditStage, setAuditStage] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const [cityOrCounty, setCityOrCounty] = useState('');
  const [webLoading, setWebLoading] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);
  const [webIntel, setWebIntel] = useState<WebLookupResponse | null>(null);
  const [savingAudit, setSavingAudit] = useState(false);
  const [watchingPlate, setWatchingPlate] = useState(false);
  const [lastAuditMeta, setLastAuditMeta] = useState<{
    plate: string;
    state: string;
    completedAt: string;
    auditId: string;
  } | null>(null);
  const [selectedSightingId, setSelectedSightingId] = useState<string | null>(
    activeAudit.cameraSightings[0]?.id ?? null
  );
  const [mapFocusNonce, setMapFocusNonce] = useState(0);

  const auditRunIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultsAnchorRef = useRef<HTMLDivElement | null>(null);
  const mapSectionRef = useRef<HTMLDivElement | null>(null);
  const webPanelAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setInputPlate(activeAudit.plateNumber);
    setSelectedState(activeAudit.state);
    setSelectedSightingId(activeAudit.cameraSightings[0]?.id ?? null);
    setMapFocusNonce(0);
  }, [activeAudit.plateNumber, activeAudit.state, activeAudit.cameraSightings]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      auditRunIdRef.current += 1;
    };
  }, []);

  const currentAuditId = buildAlprAuditId(activeAudit.plateNumber, activeAudit.state);
  const currentWatchId = buildWatchlistId('plate', activeAudit.plateNumber, activeAudit.state);
  const isSaved = savedAlprAudits.some((item) => item.id === currentAuditId);
  const isWatched = watchlistItems.some((item) => item.id === currentWatchId);

  const runLiveWebAlprSearch = async (targetAudit = activeAudit, runId?: number) => {
    const activeId = runId ?? auditRunIdRef.current;
    setWebLoading(true);
    setWebError(null);
    try {
      const response = await fetchAlprWebIntel({
        state: targetAudit.state,
        cityOrCounty: cityOrCounty.trim() || undefined,
      });
      if (!isMountedRef.current || activeId !== auditRunIdRef.current) return;
      setWebIntel(response);
    } catch (err) {
      if (!isMountedRef.current || activeId !== auditRunIdRef.current) return;
      setWebError(err instanceof Error ? err.message : 'Unable to fetch ALPR web disclosures.');
    } finally {
      if (isMountedRef.current && activeId === auditRunIdRef.current) {
        setWebLoading(false);
      }
    }
  };

  const executeAuditForPlate = async (rawPlate: string, stateCode: string) => {
    const runId = ++auditRunIdRef.current;
    setValidationError(null);
    setWebIntel(null);
    setWebError(null);
    setIsAuditing(true);
    setAuditStage('Querying regional Flock Falcon & municipal ALPR camera nodes...');

    try {
      await delay(180);
      if (!isMountedRef.current || runId !== auditRunIdRef.current) return;

      setAuditStage('Auditing law enforcement inquiry logs and statutory retention windows...');
      await delay(180);
      if (!isMountedRef.current || runId !== auditRunIdRef.current) return;

      const result = generateVehicleAudit(rawPlate, stateCode);
      onAuditChange(result);
      setInputPlate(result.plateNumber);
      setSelectedState(result.state);
      setLastAuditMeta({
        plate: result.plateNumber,
        state: result.state,
        completedAt: new Date().toLocaleTimeString(),
        auditId: `AUD-${String(runId).padStart(3, '0')}`,
      });

      if (typeof resultsAnchorRef.current?.scrollIntoView === 'function') {
        resultsAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      setIsAuditing(false);
      setAuditStage('');
      void runLiveWebAlprSearch(result, runId);
    } catch (err) {
      if (!isMountedRef.current || runId !== auditRunIdRef.current) return;
      setValidationError(
        err instanceof Error ? err.message : 'Unable to complete license plate audit.'
      );
      setIsAuditing(false);
      setAuditStage('');
    }
  };

  const handleAudit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = inputPlate.trim().replace(/[^A-Z0-9-]/gi, '');
    if (cleaned.length < 2 || cleaned.length > 10) {
      setValidationError('Enter a valid 2 to 10-character license plate (letters, numbers, or hyphens).');
      return;
    }

    void executeAuditForPlate(cleaned, selectedState);
  };

  const handleSelectPreset = (presetPlate: string, presetState: string) => {
    setInputPlate(presetPlate);
    setSelectedState(presetState);
    void executeAuditForPlate(presetPlate, presetState);
  };

  const handleSaveAudit = async () => {
    setSavingAudit(true);
    try {
      await savePlateAudit(activeAudit);
    } finally {
      setSavingAudit(false);
    }
  };

  const handleWatchPlate = async () => {
    setWatchingPlate(true);
    try {
      await addToWatchlist({
        itemType: 'plate',
        targetValue: activeAudit.plateNumber,
        jurisdictionState: activeAudit.state,
        label: `${activeAudit.vehicleDetails.year} ${activeAudit.vehicleDetails.make} ${activeAudit.vehicleDetails.model}`,
        lastStatus:
          activeAudit.auditSummary.overallStatus === 'queried_active'
            ? 'Active Query Logged'
            : 'Passive Sightings Only',
      });
    } finally {
      setWatchingPlate(false);
    }
  };

  const isTierUnlocked = currentTier === 'investigator' || currentTier === 'enterprise';
  const isFullAuditUnlocked = isTierUnlocked && isPasscodeUnlocked;
  const hasBeenLookedInto = activeAudit.auditSummary.overallStatus === 'queried_active';

  const visibleSightings = isFullAuditUnlocked
    ? activeAudit.cameraSightings
    : activeAudit.cameraSightings.slice(0, 1);
  const hiddenSightingsCount = Math.max(0, activeAudit.cameraSightings.length - visibleSightings.length);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header section with natural title prose */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Flock Safety & ALPR Surveillance Audit
        </h1>
        <p className="mt-1.5 text-sm text-slate-400 max-w-3xl leading-relaxed">
          Audit automated license plate reader (ALPR) networks for recorded vehicle sightings,
          identify active law enforcement database queries, and verify statutory data retention limits.
        </p>
      </div>

      {/* Plate & Jurisdiction Input Bar */}
      <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-5">
        <form onSubmit={handleAudit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Car className="h-4 w-4" />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={inputPlate}
              onChange={(e) => {
                setInputPlate(e.target.value.toUpperCase());
                if (validationError) setValidationError(null);
              }}
              placeholder="Enter License Plate (e.g. 7XYZ892)"
              className="w-full rounded-lg border border-slate-700 bg-[#080c14] py-2.5 pl-10 pr-9 text-sm font-mono tracking-wider font-bold text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 uppercase"
            />
            {inputPlate && !isAuditing && (
              <button
                type="button"
                onClick={() => {
                  setInputPlate('');
                  setValidationError(null);
                  inputRef.current?.focus();
                }}
                aria-label="Clear license plate"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="w-full sm:w-40 shrink-0">
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              aria-label="Jurisdiction State"
              className="w-full rounded-lg border border-slate-700 bg-[#080c14] py-2.5 px-3 text-sm font-mono text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              {US_STATES.map((st) => (
                <option key={st} value={st}>
                  {st} Jurisdiction
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isAuditing}
            className="flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            {isAuditing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span>{isAuditing ? 'Scanning ALPR Gateways...' : 'Audit License Plate'}</span>
          </button>
        </form>
        {validationError && (
          <p className="mt-2 text-xs text-rose-400 font-medium">{validationError}</p>
        )}

        {/* Preset Case Studies */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium mr-1">Sample vehicle audits:</span>
          {PRESET_PLATES.map((preset) => (
            <button
              key={`${preset.plate}_${preset.state}`}
              type="button"
              disabled={isAuditing}
              onClick={() => handleSelectPreset(preset.plate, preset.state)}
              className={`rounded-md border px-2.5 py-1 font-mono transition-colors cursor-pointer text-[12px] disabled:opacity-50 ${
                activeAudit.plateNumber === preset.plate && activeAudit.state === preset.state
                  ? 'border-cyan-500/80 bg-cyan-950/40 text-cyan-300'
                  : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              {preset.label}: {preset.plate} ({preset.state})
            </button>
          ))}
        </div>
      </div>

      {/* Live Audit Progress & Completion Banner */}
      <div ref={resultsAnchorRef}>
        {isAuditing ? (
          <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/25 px-4 py-3 flex items-center gap-3 text-xs text-cyan-200 font-mono">
            <Loader2 className="h-4 w-4 text-cyan-400 animate-spin shrink-0" />
            <span>
              {auditStage || 'Querying regional Flock Safety & ALPR gateways...'}
            </span>
          </div>
        ) : lastAuditMeta ? (
          <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-mono">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                Audit <span className="text-slate-400">({lastAuditMeta.auditId})</span> completed for{' '}
                <strong className="text-white">
                  [{lastAuditMeta.plate}] ({lastAuditMeta.state})
                </strong>{' '}
                at {lastAuditMeta.completedAt}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="text-slate-400">
                {webLoading
                  ? 'Searching EFF Atlas & public ALPR disclosures...'
                  : webIntel
                  ? `Live ALPR disclosures updated (${webIntel.sources.length} sources)`
                  : webError
                  ? 'Live ALPR web search unavailable (plate audit ready)'
                  : 'ALPR sightings & query ledger updated'}
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

      {/* CORE FOCAL ANSWER: "Have I been looked into by Flock camera?" */}
      <div
        className={`rounded-xl border p-6 transition-all ${
          hasBeenLookedInto
            ? 'border-amber-500/40 bg-gradient-to-r from-amber-950/20 via-[#0d1322] to-[#080c14]'
            : 'border-emerald-500/40 bg-gradient-to-r from-emerald-950/20 via-[#0d1322] to-[#080c14]'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl border shrink-0 ${
                hasBeenLookedInto
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
              }`}
            >
              {hasBeenLookedInto ? (
                <AlertTriangle className="h-6 w-6" />
              ) : (
                <CheckCircle2 className="h-6 w-6" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Surveillance Inquiry Status:
                </h2>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded font-mono font-bold tracking-wide border ${
                    hasBeenLookedInto
                      ? 'border-amber-500/50 bg-amber-950/60 text-amber-300'
                      : 'border-emerald-500/50 bg-emerald-950/60 text-emerald-300'
                  }`}
                >
                  {hasBeenLookedInto ? 'ACTIVE QUERY LOGGED' : 'PASSIVE SIGHTINGS ONLY'}
                </span>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
                {hasBeenLookedInto ? (
                  <>
                    <strong className="text-amber-300 font-semibold">Yes:</strong> This license plate{' '}
                    <strong className="font-mono text-white">[{activeAudit.plateNumber}]</strong> has been
                    actively queried or searched by law enforcement in the ALPR database within recent patrol records.
                  </>
                ) : (
                  <>
                    <strong className="text-emerald-400 font-semibold">Nominal:</strong> No active
                    investigative searches, warrant hotlist hits, or targeted queries have been run
                    against <strong className="font-mono text-white">[{activeAudit.plateNumber}]</strong>.
                    Recorded captures are automated passive optical passes.
                  </>
                )}
              </p>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1 font-mono">
                <span>
                  Vehicle: {activeAudit.vehicleDetails.year} {activeAudit.vehicleDetails.make}{' '}
                  {activeAudit.vehicleDetails.model} ({activeAudit.vehicleDetails.color})
                </span>
                <span aria-hidden="true">·</span>
                <span>VIN: {activeAudit.vehicleDetails.vinMasked}</span>
                <span aria-hidden="true">·</span>
                <span>Jurisdiction: {activeAudit.state}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons: Save, Watch, FOIA & Export */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleSaveAudit()}
              disabled={savingAudit}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 ${
                isSaved
                  ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-cyan-500/50 hover:bg-slate-700'
              }`}
            >
              {isSaved ? <Check className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5 text-cyan-400" />}
              <span>{savingAudit ? 'Saving...' : isSaved ? 'Saved' : 'Save Audit'}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleWatchPlate()}
              disabled={watchingPlate}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 ${
                isWatched
                  ? 'border-cyan-500/60 bg-cyan-950/50 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-cyan-500/50 hover:bg-slate-700'
              }`}
            >
              <Bell className="h-3.5 w-3.5 text-cyan-400" />
              <span>{watchingPlate ? 'Adding...' : isWatched ? 'Watching' : 'Watch'}</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenFoia(activeAudit)}
              className="flex items-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-500/50 hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileText className="h-4 w-4 text-cyan-400" />
              <span>FOIA Request</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isTierUnlocked) {
                  onOpenPricing();
                } else if (!isPasscodeUnlocked) {
                  onOpenPasscodeModal();
                } else {
                  onOpenExport({ type: 'alpr', content: activeAudit });
                }
              }}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {isFullAuditUnlocked ? <Download className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              <span>
                {isFullAuditUnlocked
                  ? 'Export Audit'
                  : isTierUnlocked
                  ? 'Passcode to Export'
                  : 'Unlock Export'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Geospatial Sighting Map */}
      <div ref={mapSectionRef}>
        <AlprSightingMap
          plateNumber={activeAudit.plateNumber}
          stateCode={activeAudit.state}
          overallStatus={activeAudit.auditSummary.overallStatus}
          sightings={visibleSightings}
          totalSightingsCount={activeAudit.cameraSightings.length}
          selectedSightingId={selectedSightingId}
          focusNonce={mapFocusNonce}
          onSelectSighting={(sightingId) => setSelectedSightingId(sightingId)}
          isLockedPreview={!isFullAuditUnlocked}
          onExportPdf={() => {
            if (!isTierUnlocked) {
              onOpenPricing();
            } else if (!isPasscodeUnlocked) {
              onOpenPasscodeModal();
            } else {
              onOpenExport({ type: 'alpr', content: activeAudit });
            }
          }}
        />
      </div>

      {/* Main Grid: Query Details & Camera Sightings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Query Audit Logs, Retention Analysis & Live Web Intel (6 Cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Query Audit Log */}
          <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="text-base font-semibold text-white">
                  01. Agency Query & Search Records
                </h3>
                <span className="text-xs text-slate-400 mt-0.5 block">
                  Detailed logs of who queried this plate and the official reason code
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {activeAudit.queryAuditLog.length} Inquiry Record(s)
              </span>
            </div>

            <div className="space-y-3.5">
              {activeAudit.queryAuditLog.map((log) => (
                <div
                  key={log.queryId}
                  className="rounded-lg border border-slate-800/90 bg-[#080c14]/70 p-4 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-cyan-400 font-semibold">{log.queryId}</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Requesting Agency</span>
                    <span className="text-sm font-semibold text-white block">
                      {log.requestingAgency}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Agency Type: {log.agencyType} ·{' '}
                      {isFullAuditUnlocked
                        ? log.officerBadgeOrCaseId
                        : isTierUnlocked
                        ? '[Badge/Case Locked · Passcode Required]'
                        : '[Badge/Case Redacted on Explorer]'}
                    </span>
                  </div>

                  <div className="border-t border-slate-800/60 pt-2">
                    <span className="text-slate-400 block text-[11px]">Inquiry Reason / Ground</span>
                    <p className="text-slate-200 mt-0.5 leading-relaxed font-sans">
                      {log.queryReason}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                    <span className="text-slate-400">Disposition:</span>
                    <span
                      className={`font-semibold font-mono ${
                        log.alertDisposition === 'Active Vehicle Canvass'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {log.alertDisposition}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Retention & Privacy Policy Standards */}
          <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">
              02. Statutory Retention & Expungement Windows
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automated License Plate Readers capture optical images of vehicles on public roadways.
              State statutes and municipal policies strictly limit how long non-investigative data may be retained.
            </p>

            <div className="p-4 rounded-lg border border-slate-800 bg-[#080c14]/70 space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Jurisdiction Policy</span>
                <span className="font-mono text-cyan-300 font-semibold">
                  {activeAudit.state} Legal Standard
                </span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                {activeAudit.auditSummary.retentionPolicyStandard}
              </p>
              <div className="flex items-center justify-between border-t border-slate-800/60 pt-2 text-[11px] text-slate-400 font-mono">
                <span>Total 30-Day Detections: {activeAudit.auditSummary.totalDetections30Days}</span>
                <span aria-hidden="true">·</span>
                <span>90-Day Aggregate: {activeAudit.auditSummary.totalDetections90Days}</span>
              </div>
            </div>

            {/* Reciprocal Data Sharing Network */}
            <div className="space-y-2 pt-1">
              <span className="text-xs font-semibold text-slate-300 block">
                Regional Reciprocal Sharing Network (Flock Talon Links)
              </span>
              <p className="text-[11px] text-slate-400">
                The following agencies hold active reciprocal data-sharing memorandums for camera nodes in this sector:
              </p>
              <div className="space-y-1.5 text-xs">
                {activeAudit.reciprocalAgencies.map((recip, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800/80"
                  >
                    <div>
                      <span className="text-white font-medium block">{recip.agencyName}</span>
                      <span className="text-[11px] text-slate-400">{recip.jurisdiction}</span>
                    </div>
                    <span className="text-[11px] font-mono text-cyan-400">
                      {recip.dataShareScope}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Live Web Flock & ALPR Jurisdiction Disclosures */}
          <div ref={webPanelAnchorRef} className="rounded-xl border border-slate-800 bg-[#0d1322] p-6 space-y-4">
            <div className="border-b border-slate-800/80 pb-3">
              <h3 className="text-base font-semibold text-white">
                Live Web Flock & ALPR Transparency Lookup
              </h3>
              <span className="text-xs text-slate-400 mt-0.5 block">
                Search public web disclosures for Flock Safety portals, municipal camera contracts, and state ALPR laws in {activeAudit.state}.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={cityOrCounty}
                onChange={(e) => setCityOrCounty(e.target.value)}
                placeholder={`Optional city or county in ${activeAudit.state} (e.g. Austin, Marietta)`}
                className="flex-1 rounded-lg border border-slate-700 bg-[#080c14] py-2 px-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void runLiveWebAlprSearch(activeAudit)}
                disabled={webLoading || isAuditing}
                className="flex items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-950/50 px-3.5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/50 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>{webLoading ? 'Searching Web...' : 'Search Web Records'}</span>
              </button>
            </div>

            <WebIntelPanel
              title={`Public ALPR & Flock Disclosures (${cityOrCounty.trim() ? `${cityOrCounty.trim()}, ` : ''}${activeAudit.state})`}
              isLoading={webLoading}
              error={webError}
              data={webIntel}
              onRetry={() => void runLiveWebAlprSearch(activeAudit)}
              emptyPrompt={`Run a live web search to inspect published Flock Safety transparency portals and ALPR policies for ${activeAudit.state}.`}
            />
          </div>
        </div>

        {/* Right Column: Camera Sighting Logs & Node Details (6 Cols) */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-6 space-y-4 relative">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="text-base font-semibold text-white">
                  03. Camera Sightings & Optical Node Log
                </h3>
                <span className="text-xs text-slate-400 mt-0.5 block">
                  Sensor nodes that recorded this plate, timestamps, and capture confidence
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {visibleSightings.length} of {activeAudit.cameraSightings.length} Node(s)
              </span>
            </div>

            {/* Sighting Timeline Cards */}
            <div className="space-y-3.5">
              {visibleSightings.map((sighting, idx) => {
                const isSelected = sighting.id === selectedSightingId;
                return (
                  <div
                    key={sighting.id}
                    className={`rounded-lg border p-4 space-y-2 text-xs transition-colors ${
                      isSelected
                        ? 'border-cyan-500/70 bg-cyan-950/20'
                        : 'border-slate-800/90 bg-[#080c14]/70'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/15 border border-cyan-500/40 font-mono text-[10px] font-bold text-cyan-300 shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-mono text-xs font-bold text-white tracking-wide">
                          {sighting.cameraName}
                        </span>
                      </div>
                      <span className="font-mono text-cyan-400 tabular-nums text-[11px]">
                        {new Date(sighting.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800/60">
                      <div>
                        <span className="text-slate-400 block">Sensor Node ID</span>
                        <span className="font-mono text-slate-200">{sighting.cameraId}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Hardware Model</span>
                        <span className="font-mono text-emerald-400 font-semibold">{sighting.cameraType}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Operating Agency</span>
                        <span className="text-slate-300 truncate block">{sighting.municipalityAgency}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Location</span>
                        <span className="text-slate-300 truncate block">{sighting.intersectionOrLocation}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-[11px] font-mono text-slate-400">
                      <span>Heading: {sighting.directionOfTravel} (Lane {sighting.laneNumber})</span>
                      <span>Speed: ~{sighting.speedEstimateMph} MPH</span>
                      <span>Confidence: {sighting.captureConfidence}%</span>
                      <span className="text-amber-400">Purge in: {sighting.retentionDaysRemaining}d</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/60 text-[11px]">
                      <span className="font-mono text-slate-400 tabular-nums">
                        GPS: {sighting.coordinates[0].toFixed(4)}, {sighting.coordinates[1].toFixed(4)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSightingId(sighting.id);
                          setMapFocusNonce((n) => n + 1);
                          if (typeof mapSectionRef.current?.scrollIntoView === 'function') {
                            mapSectionRef.current.scrollIntoView({
                              behavior: 'smooth',
                              block: 'nearest',
                            });
                          }
                        }}
                        className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                      >
                        <MapPin className="h-3 w-3" />
                        <span>Locate on Map</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tier or Passcode Lock Teaser */}
            {!isFullAuditUnlocked && (
              <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-b from-cyan-950/40 to-[#080c14] p-5 text-center space-y-3 mt-4">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {!isTierUnlocked
                      ? hiddenSightingsCount > 0
                        ? `${hiddenSightingsCount} Additional Camera Sightings & Full Audit Locked`
                        : 'Historical 90-Day Audit Log Restricted'
                      : 'Enter Access Passcode to Reveal Full Sightings & Badge IDs'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {!isTierUnlocked
                      ? 'The free Explorer tier previews only the latest capture and redacts officer badge IDs. Upgrade to Investigator Pro to unlock all camera sightings, unredacted badge identifiers, and full FOIA packet exports.'
                      : 'Full optical node logs, unredacted officer badge identifiers, and PDF audit exports are gated behind the OSINT access passcode.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={isTierUnlocked ? onOpenPasscodeModal : onOpenPricing}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer"
                >
                  <span>
                    {isTierUnlocked
                      ? 'Enter Access Passcode to Unlock'
                      : 'Upgrade to Investigator Pro ($29/mo)'}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
