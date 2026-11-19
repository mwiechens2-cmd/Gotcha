import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  Globe,
  Layers,
  Lock,
  Play,
  RefreshCw,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  PhoneLookupResult,
  SubscriptionTierType,
  VehicleAlprAuditResult,
} from '../types';
import { generatePhoneLookup, generateVehicleAudit } from '../data/mockData';
import { fetchAlprWebIntel, fetchPhoneWebOsint, WebLookupResponse } from '../utils/webLookup';
import { useFirebase } from '../contexts/FirebaseContext';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const US_STATE_SET = new Set(US_STATES);

type BatchMode = 'auto' | 'phone' | 'plate';
type BatchItemStatus = 'queued' | 'running' | 'completed' | 'error';

export interface BatchQueueItem {
  id: string;
  rawInput: string;
  targetType: 'phone' | 'plate';
  normalizedTarget: string;
  stateCode?: string;
  status: BatchItemStatus;
  phoneResult?: PhoneLookupResult;
  alprResult?: VehicleAlprAuditResult;
  webIntel?: WebLookupResponse;
  errorMessage?: string;
  durationMs?: number;
}

interface BatchAuditViewProps {
  currentTier: SubscriptionTierType;
  isPasscodeUnlocked: boolean;
  onOpenPricing: () => void;
  onOpenPasscodeModal: () => void;
  onInspectPhone: (result: PhoneLookupResult) => void;
  onInspectAlpr: (audit: VehicleAlprAuditResult) => void;
  onRecordEvent: (type: 'phone' | 'alpr', targetKey: string) => void;
  onOpenExport: (
    data: { type: 'phone'; content: PhoneLookupResult } | { type: 'alpr'; content: VehicleAlprAuditResult }
  ) => void;
}

const SAMPLE_MIXED_LIST = `+1 (415) 890-4421
7XYZ892, CA
+1 (212) 555-0199
TEX-4921, TX
+1 (800) 672-3190
FL-88A2K, FL`;

const SAMPLE_PHONE_LIST = `+1 (415) 890-4421
+1 (212) 555-0199
+1 (512) 843-9012
+1 (800) 672-3190
+1 (312) 480-9914`;

const SAMPLE_PLATE_LIST = `7XYZ892, CA
TEX-4921, TX
FL-88A2K, FL
GA-9KL42, GA
8TRK410, WA`;

function parseBatchLines(
  rawText: string,
  mode: BatchMode,
  defaultState: string
): { items: BatchQueueItem[]; skippedLines: string[] } {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  const items: BatchQueueItem[] = [];
  const skippedLines: string[] = [];
  const seen = new Set<string>();

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const parts = line
      .split(/[\t,;]+/)
      .map((p) => p.replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);

    if (parts.length === 0) continue;

    // Skip common CSV header rows
    const headerCheck = parts[0].toLowerCase();
    if (
      idx === 0 &&
      ['phone', 'phonenumber', 'phone_number', 'plate', 'licenseplate', 'license_plate', 'target'].includes(
        headerCheck
      )
    ) {
      continue;
    }

    const firstToken = parts[0];
    const secondToken = parts[1]?.toUpperCase();

    // Detect if line looks like a phone number
    const digitsOnly = firstToken.replace(/\D/g, '');
    const hasLetters = /[a-zA-Z]/.test(firstToken);

    let resolvedType: 'phone' | 'plate';
    if (mode === 'phone') {
      resolvedType = 'phone';
    } else if (mode === 'plate') {
      resolvedType = 'plate';
    } else {
      resolvedType = !hasLetters && digitsOnly.length >= 7 ? 'phone' : 'plate';
    }

    if (resolvedType === 'phone') {
      if (digitsOnly.length < 7 || digitsOnly.length > 15) {
        skippedLines.push(`${line} (invalid 7-15 digit phone)`);
        continue;
      }
      const normalized = digitsOnly.length === 10 ? `+1${digitsOnly}` : `+${digitsOnly}`;
      const dedupeKey = `phone::${normalized}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      items.push({
        id: `batch_phone_${digitsOnly}_${idx}`,
        rawInput: line,
        targetType: 'phone',
        normalizedTarget: normalized,
        status: 'queued',
      });
    } else {
      // Support "7XYZ892 CA" or "7XYZ892, CA"
      let platePart = firstToken;
      let statePart = secondToken && US_STATE_SET.has(secondToken) ? secondToken : defaultState;

      if (!secondToken && /\s+[A-Za-z]{2}$/.test(firstToken)) {
        const spaceParts = firstToken.split(/\s+/);
        const maybeState = spaceParts[spaceParts.length - 1].toUpperCase();
        if (US_STATE_SET.has(maybeState)) {
          statePart = maybeState;
          platePart = spaceParts.slice(0, -1).join('');
        }
      }

      const cleanPlate = platePart.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (cleanPlate.length < 2 || cleanPlate.length > 10) {
        skippedLines.push(`${line} (invalid 2-10 char plate)`);
        continue;
      }

      const dedupeKey = `plate::${statePart}::${cleanPlate}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      items.push({
        id: `batch_plate_${statePart}_${cleanPlate}_${idx}`,
        rawInput: line,
        targetType: 'plate',
        normalizedTarget: cleanPlate,
        stateCode: statePart,
        status: 'queued',
      });
    }
  }

  return { items, skippedLines };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const BatchAuditView: React.FC<BatchAuditViewProps> = ({
  currentTier,
  isPasscodeUnlocked,
  onOpenPricing,
  onOpenPasscodeModal,
  onInspectPhone,
  onInspectAlpr,
  onRecordEvent,
  onOpenExport,
}) => {
  const { user, savePhoneTrace, savePlateAudit } = useFirebase();

  const [mode, setMode] = useState<BatchMode>('auto');
  const [defaultState, setDefaultState] = useState('CA');
  const [includeWebSearch, setIncludeWebSearch] = useState(false);
  const [rawInput, setRawInput] = useState(SAMPLE_MIXED_LIST);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [queue, setQueue] = useState<BatchQueueItem[]>(() =>
    parseBatchLines(SAMPLE_MIXED_LIST, 'auto', 'CA').items
  );
  const [skippedNotes, setSkippedNotes] = useState<string[]>([]);

  const [isRunning, setIsRunning] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'flagged' | 'error'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [savingAll, setSavingAll] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const cancelRequestedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isTierUnlocked = currentTier === 'investigator' || currentTier === 'enterprise';
  const isSensitiveUnlocked = isTierUnlocked && isPasscodeUnlocked;

  const stats = useMemo(() => {
    let completed = 0;
    let errors = 0;
    let flagged = 0;
    let running = 0;
    for (const item of queue) {
      if (item.status === 'completed') completed += 1;
      if (item.status === 'error') errors += 1;
      if (item.status === 'running') running += 1;
      if (
        (item.phoneResult && item.phoneResult.riskAnalysis.spamScore >= 65) ||
        (item.alprResult && item.alprResult.auditSummary.overallStatus === 'queried_active')
      ) {
        flagged += 1;
      }
    }
    const processed = completed + errors;
    const percent = queue.length > 0 ? Math.round((processed / queue.length) * 100) : 0;
    return { total: queue.length, completed, errors, flagged, running, processed, percent };
  }, [queue]);

  const rebuildQueueFromText = (text: string, nextMode = mode, nextState = defaultState) => {
    const parsed = parseBatchLines(text, nextMode, nextState);
    setQueue(parsed.items);
    setSkippedNotes(parsed.skippedLines);
    setSaveNotice(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadNotice(null);

    if (file.size > 1024 * 1024) {
      setUploadError('File exceeds 1 MB batch limit. Upload a smaller CSV or TXT list.');
      return;
    }

    try {
      const content = await file.text();
      setRawInput(content);
      rebuildQueueFromText(content);
      const count = parseBatchLines(content, mode, defaultState).items.length;
      setUploadNotice(`Loaded ${count} target(s) from ${file.name}`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unable to read uploaded file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const executeSingleItem = async (item: BatchQueueItem): Promise<BatchQueueItem> => {
    const start = performance.now();
    try {
      if (item.targetType === 'phone') {
        const result = generatePhoneLookup(item.normalizedTarget);
        let webIntel: WebLookupResponse | undefined;

        if (includeWebSearch) {
          webIntel = await fetchPhoneWebOsint({
            phoneNumber: result.phoneNumber,
            formattedNational: result.formattedNational,
            carrierName: result.carrier.name,
            locationHint: `${result.location.city}, ${result.location.state}`,
          });
        } else {
          await sleep(140);
        }

        onRecordEvent('phone', result.phoneNumber.replace(/\D/g, ''));
        return {
          ...item,
          status: 'completed',
          phoneResult: result,
          webIntel,
          errorMessage: undefined,
          durationMs: Math.round(performance.now() - start),
        };
      } else {
        const stateCode = item.stateCode || defaultState;
        const audit = generateVehicleAudit(item.normalizedTarget, stateCode);
        let webIntel: WebLookupResponse | undefined;

        if (includeWebSearch) {
          webIntel = await fetchAlprWebIntel({
            state: audit.state,
          });
        } else {
          await sleep(160);
        }

        onRecordEvent('alpr', `${audit.state}_${audit.plateNumber}`);
        return {
          ...item,
          status: 'completed',
          alprResult: audit,
          webIntel,
          errorMessage: undefined,
          durationMs: Math.round(performance.now() - start),
        };
      }
    } catch (err) {
      return {
        ...item,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Lookup failed.',
        durationMs: Math.round(performance.now() - start),
      };
    }
  };

  const runSequentialBatch = async (onlyFailedOrQueued = false) => {
    if (isRunning || queue.length === 0) return;

    cancelRequestedRef.current = false;
    setIsRunning(true);
    setSaveNotice(null);

    // Snapshot targets to process sequentially
    const workingList = queue.map((item) => {
      if (onlyFailedOrQueued && item.status === 'completed') {
        return item;
      }
      return { ...item, status: 'queued' as BatchItemStatus, errorMessage: undefined };
    });

    setQueue(workingList);

    for (let i = 0; i < workingList.length; i++) {
      if (cancelRequestedRef.current) break;
      const current = workingList[i];
      if (onlyFailedOrQueued && current.status === 'completed') continue;

      setQueue((prev) =>
        prev.map((row) => (row.id === current.id ? { ...row, status: 'running' } : row))
      );

      const finished = await executeSingleItem(current);
      workingList[i] = finished;

      setQueue((prev) => prev.map((row) => (row.id === current.id ? finished : row)));
    }

    setIsRunning(false);
  };

  const handleRetrySingle = async (targetId: string) => {
    if (isRunning) return;
    const item = queue.find((q) => q.id === targetId);
    if (!item) return;

    setQueue((prev) =>
      prev.map((row) => (row.id === targetId ? { ...row, status: 'running', errorMessage: undefined } : row))
    );
    const finished = await executeSingleItem(item);
    setQueue((prev) => prev.map((row) => (row.id === targetId ? finished : row)));
  };

  const handleStopBatch = () => {
    cancelRequestedRef.current = true;
  };

  const handleSaveAllCompleted = async () => {
    const completedItems = queue.filter((q) => q.status === 'completed');
    if (completedItems.length === 0) return;
    setSavingAll(true);
    setSaveNotice(null);

    let savedCount = 0;
    try {
      for (const item of completedItems) {
        if (item.phoneResult) {
          const id = await savePhoneTrace(
            item.phoneResult,
            isSensitiveUnlocked ? currentTier : 'explorer',
            item.webIntel?.summary
          );
          if (id) savedCount += 1;
        } else if (item.alprResult) {
          const id = await savePlateAudit(item.alprResult);
          if (id) savedCount += 1;
        }
      }
      if (savedCount > 0) {
        setSaveNotice(`Saved ${savedCount} completed record(s) to Cloud Firestore.`);
      }
    } finally {
      setSavingAll(false);
    }
  };

  const handleExportCsv = () => {
    const completed = queue.filter((q) => q.status === 'completed');
    if (completed.length === 0) return;

    const escapeCsv = (val: string | number) => {
      const str = String(val ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = [
      'Type',
      'Target',
      'State',
      'Status',
      'Primary Finding',
      'Score_Or_Detections30d',
      'Sensitive_Detail',
      'Location_Or_Carrier',
    ];

    const rows = completed.map((item) => {
      if (item.phoneResult) {
        const p = item.phoneResult;
        return [
          'Phone',
          p.formattedInternational,
          p.location.state,
          p.riskAnalysis.riskLevel,
          `${p.riskAnalysis.activityCategory} (${p.lineType})`,
          `${p.riskAnalysis.spamScore}/100`,
          isSensitiveUnlocked ? p.dossier?.subscriberName || 'N/A' : '[Redacted]',
          `${p.carrier.name} (${p.location.city}, ${p.location.state})`,
        ]
          .map(escapeCsv)
          .join(',');
      }
      const v = item.alprResult!;
      return [
        'ALPR Plate',
        v.plateNumber,
        v.state,
        v.auditSummary.overallStatus === 'queried_active' ? 'ACTIVE QUERY LOGGED' : 'PASSIVE ONLY',
        `${v.vehicleDetails.year} ${v.vehicleDetails.make} ${v.vehicleDetails.model}`,
        `${v.auditSummary.totalDetections30Days} detections (30d)`,
        isSensitiveUnlocked
          ? v.queryAuditLog.map((q) => q.officerBadgeOrCaseId).join(' | ')
          : '[Redacted]',
        v.auditSummary.lastDetectedLocation,
      ]
        .map(escapeCsv)
        .join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `VigilALPR_Batch_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredQueue = queue.filter((item) => {
    const q = searchFilter.trim().toLowerCase();
    const matchesText =
      !q ||
      item.normalizedTarget.toLowerCase().includes(q) ||
      (item.stateCode || '').toLowerCase().includes(q) ||
      (item.phoneResult?.carrier.name || '').toLowerCase().includes(q) ||
      (item.alprResult?.vehicleDetails.make || '').toLowerCase().includes(q);

    if (!matchesText) return false;
    if (statusFilter === 'completed') return item.status === 'completed';
    if (statusFilter === 'error') return item.status === 'error';
    if (statusFilter === 'flagged') {
      return (
        (item.phoneResult && item.phoneResult.riskAnalysis.spamScore >= 65) ||
        (item.alprResult && item.alprResult.auditSummary.overallStatus === 'queried_active')
      );
    }
    return true;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Sequential Batch Lookup & ALPR Audit
          </h1>
          <p className="mt-1.5 text-sm text-slate-400 max-w-3xl leading-relaxed">
            Upload a CSV/TXT list or paste phone numbers and license plates to execute automated lookups
            and surveillance audits sequentially with live progress tracking.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-400 tabular-nums shrink-0">
          <span>{stats.total} Queued</span>
          <span aria-hidden="true" className="mx-2 text-slate-700">·</span>
          <span className="text-emerald-400">{stats.completed} Done</span>
          <span aria-hidden="true" className="mx-2 text-slate-700">·</span>
          <span className="text-amber-400">{stats.flagged} Flagged</span>
        </div>
      </div>

      {/* Input & Configuration Card */}
      <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          {/* Input Mode Segmented Control */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-[#080c14] border border-slate-800 rounded-lg text-xs">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => {
                  setMode('auto');
                  rebuildQueueFromText(rawInput, 'auto', defaultState);
                }}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                  mode === 'auto' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Auto-Detect Mixed
              </button>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => {
                  setMode('phone');
                  rebuildQueueFromText(rawInput, 'phone', defaultState);
                }}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                  mode === 'phone' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Phone Numbers
              </button>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => {
                  setMode('plate');
                  rebuildQueueFromText(rawInput, 'plate', defaultState);
                }}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                  mode === 'plate' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                License Plates
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Default Plate State:</span>
              <select
                value={defaultState}
                disabled={isRunning}
                onChange={(e) => {
                  const st = e.target.value;
                  setDefaultState(st);
                  rebuildQueueFromText(rawInput, mode, st);
                }}
                aria-label="Default Plate Jurisdiction State"
                className="rounded-lg border border-slate-700 bg-[#080c14] py-1.5 px-2.5 text-xs font-mono text-white focus:border-cyan-500 focus:outline-none cursor-pointer disabled:opacity-50"
              >
                {US_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sample & File Upload Actions */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              disabled={isRunning}
              onClick={() => {
                setMode('phone');
                setRawInput(SAMPLE_PHONE_LIST);
                rebuildQueueFromText(SAMPLE_PHONE_LIST, 'phone', defaultState);
              }}
              className="rounded-lg border border-slate-800 bg-[#080c14] px-2.5 py-1.5 text-slate-300 hover:border-slate-700 hover:text-white cursor-pointer disabled:opacity-50"
            >
              Load Phone Sample
            </button>
            <button
              type="button"
              disabled={isRunning}
              onClick={() => {
                setMode('plate');
                setRawInput(SAMPLE_PLATE_LIST);
                rebuildQueueFromText(SAMPLE_PLATE_LIST, 'plate', defaultState);
              }}
              className="rounded-lg border border-slate-800 bg-[#080c14] px-2.5 py-1.5 text-slate-300 hover:border-slate-700 hover:text-white cursor-pointer disabled:opacity-50"
            >
              Load Plate Sample
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.tsv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={isRunning}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-3 py-1.5 font-semibold text-cyan-300 hover:bg-cyan-900/40 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload CSV / TXT</span>
            </button>
          </div>
        </div>

        {/* Textarea & Execution Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-8 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="batch-target-input" className="font-semibold text-slate-200">
                Target List (one entry per line, optional state suffix like <span className="font-mono text-cyan-400">7XYZ892, CA</span>)
              </label>
              <button
                type="button"
                disabled={isRunning || !rawInput}
                onClick={() => {
                  setRawInput('');
                  setQueue([]);
                  setSkippedNotes([]);
                  setUploadNotice(null);
                  setUploadError(null);
                }}
                className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-300 cursor-pointer disabled:opacity-40"
              >
                <Trash2 className="h-3 w-3" />
                <span>Clear</span>
              </button>
            </div>
            <textarea
              id="batch-target-input"
              rows={6}
              disabled={isRunning}
              value={rawInput}
              onChange={(e) => {
                const val = e.target.value;
                setRawInput(val);
                setUploadNotice(null);
                rebuildQueueFromText(val);
              }}
              placeholder={`+1 (415) 890-4421\n7XYZ892, CA\nTEX-4921, TX`}
              className="w-full rounded-lg border border-slate-700 bg-[#080c14] p-3 text-xs font-mono text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none leading-relaxed disabled:opacity-60"
            />
          </div>

          <div className="lg:col-span-4 space-y-3 rounded-lg border border-slate-800 bg-[#080c14]/70 p-4 text-xs">
            <div className="flex items-center gap-2 font-semibold text-white">
              <Layers className="h-4 w-4 text-cyan-400" />
              <span>Sequential Runner Options</span>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={includeWebSearch}
                disabled={isRunning}
                onChange={(e) => setIncludeWebSearch(e.target.checked)}
                className="mt-0.5 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-slate-300 leading-relaxed">
                <span className="font-medium text-white inline-flex items-center gap-1">
                  <Globe className="h-3 w-3 text-cyan-400" />
                  Include Live Web Search
                </span>
                <span className="block text-[11px] text-slate-400 mt-0.5">
                  Queries public caller-ID & Flock transparency sources sequentially for each row.
                </span>
              </span>
            </label>

            <div className="pt-2 space-y-2 border-t border-slate-800/80">
              {!isRunning ? (
                <button
                  type="button"
                  disabled={queue.length === 0}
                  onClick={() => void runSequentialBatch(false)}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Run Sequential Batch ({queue.length})</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopBatch}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-rose-700/70 bg-rose-950/60 px-4 py-2.5 text-xs font-semibold text-rose-200 hover:bg-rose-900/60 transition-colors cursor-pointer"
                >
                  <Square className="h-3.5 w-3.5" />
                  <span>Stop After Current Target</span>
                </button>
              )}

              {!isRunning && stats.errors > 0 && (
                <button
                  type="button"
                  onClick={() => void runSequentialBatch(true)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-950/50 transition-colors cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Retry Failed ({stats.errors})</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Notices / Skipped Lines */}
        {uploadNotice && (
          <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-3.5 py-2 text-xs text-emerald-300 font-mono">
            {uploadNotice}
          </div>
        )}
        {uploadError && (
          <div className="rounded-lg border border-rose-800/60 bg-rose-950/35 px-3.5 py-2 text-xs text-rose-300">
            {uploadError}
          </div>
        )}
        {skippedNotes.length > 0 && (
          <div className="rounded-lg border border-amber-800/50 bg-amber-950/25 px-3.5 py-2 text-xs text-amber-200">
            Skipped {skippedNotes.length} unrecognized line(s): {skippedNotes.slice(0, 3).join(' · ')}
            {skippedNotes.length > 3 ? ` (+${skippedNotes.length - 3} more)` : ''}
          </div>
        )}

        {/* Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-mono tabular-nums">
            <span className="text-slate-400">
              {isRunning
                ? `Executing sequential audit (${stats.processed} of ${stats.total} completed)...`
                : stats.processed > 0
                ? `Batch progress: ${stats.completed} succeeded, ${stats.errors} failed`
                : 'Ready to execute sequential batch'}
            </span>
            <span className="text-cyan-400 font-semibold">{stats.percent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all duration-300"
              style={{ width: `${stats.percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Results Toolbar */}
      <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#080c14] border border-slate-800 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'all' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'completed' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Completed ({stats.completed})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('flagged')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'flagged' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Flagged ({stats.flagged})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('error')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'error' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Errors ({stats.errors})
            </button>
          </div>

          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter results..."
            className="rounded-lg border border-slate-700 bg-[#080c14] py-1.5 px-3 text-xs font-mono text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none w-52"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={stats.completed === 0 || savingAll}
            onClick={() => void handleSaveAllCompleted()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-500/50 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
          >
            <Bookmark className="h-3.5 w-3.5 text-cyan-400" />
            <span>
              {savingAll
                ? 'Saving to Cloud...'
                : user
                ? `Save All (${stats.completed})`
                : `Sign In & Save (${stats.completed})`}
            </span>
          </button>

          <button
            type="button"
            disabled={stats.completed === 0}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer disabled:opacity-40"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export Batch CSV</span>
          </button>
        </div>
      </div>

      {saveNotice && (
        <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-4 py-2.5 text-xs text-emerald-300 font-mono">
          {saveNotice}
        </div>
      )}

      {/* Results Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0d1322] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-[#080c14]/90 text-slate-400 font-mono">
                <th className="py-3 px-4 font-semibold">#</th>
                <th className="py-3 px-4 font-semibold">Target</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Telemetry & Findings</th>
                <th className="py-3 px-4 font-semibold">Sensitive Detail</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center text-xs text-slate-400">
                    {queue.length === 0
                      ? 'Paste phone numbers or license plates above, or upload a CSV/TXT file to begin.'
                      : 'No batch rows match your current filter.'}
                  </td>
                </tr>
              ) : (
                filteredQueue.map((item, idx) => {
                  const isPhone = item.targetType === 'phone';
                  const p = item.phoneResult;
                  const v = item.alprResult;
                  const isFlagged =
                    (p && p.riskAnalysis.spamScore >= 65) ||
                    (v && v.auditSummary.overallStatus === 'queried_active');

                  return (
                    <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-500 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-white block">
                          {isPhone
                            ? p?.formattedNational || item.normalizedTarget
                            : `${item.normalizedTarget} (${item.stateCode || defaultState})`}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {isPhone ? 'Reverse Phone Trace' : 'ALPR Plate Audit'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                        {item.status === 'queued' && (
                          <span className="text-slate-400">Queued</span>
                        )}
                        {item.status === 'running' && (
                          <span className="text-cyan-400 font-semibold">Scanning...</span>
                        )}
                        {item.status === 'completed' && (
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              isFlagged ? 'text-amber-300' : 'text-emerald-400'
                            }`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>
                              {isFlagged ? 'Flagged' : 'Completed'}
                              {item.durationMs ? ` (${item.durationMs}ms)` : ''}
                            </span>
                          </span>
                        )}
                        {item.status === 'error' && (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span>Failed</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 max-w-sm">
                        {item.status === 'completed' && p && (
                          <div className="space-y-0.5">
                            <span className="font-medium text-slate-200 block">
                              {p.riskAnalysis.riskLevel} Risk ({p.riskAnalysis.spamScore}/100) · {p.lineType}
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate">
                              {p.carrier.name} · {p.location.city}, {p.location.state}
                            </span>
                            {item.webIntel && (
                              <span className="text-[11px] text-cyan-400 font-mono block">
                                Web: {item.webIntel.sources.length} source(s) matched
                              </span>
                            )}
                          </div>
                        )}
                        {item.status === 'completed' && v && (
                          <div className="space-y-0.5">
                            <span className="font-medium text-slate-200 block">
                              {v.auditSummary.overallStatus === 'queried_active'
                                ? `Active Query Logged (${v.auditSummary.activeAgencyQueriesCount})`
                                : 'Passive Sightings Only'}{' '}
                              · {v.auditSummary.totalDetections30Days} hits (30d)
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate">
                              {v.vehicleDetails.year} {v.vehicleDetails.make} {v.vehicleDetails.model} ·{' '}
                              {v.auditSummary.lastDetectedLocation}
                            </span>
                            {item.webIntel && (
                              <span className="text-[11px] text-cyan-400 font-mono block">
                                Web: {item.webIntel.sources.length} disclosure(s) found
                              </span>
                            )}
                          </div>
                        )}
                        {item.status === 'error' && (
                          <span className="text-rose-300 text-[11px]">
                            {item.errorMessage || 'Lookup failed.'}
                          </span>
                        )}
                        {(item.status === 'queued' || item.status === 'running') && (
                          <span className="text-slate-500 font-mono text-[11px]">
                            {item.status === 'running' ? 'Querying telemetry...' : 'Waiting in queue'}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        {item.status !== 'completed' ? (
                          <span className="text-slate-600">—</span>
                        ) : isSensitiveUnlocked ? (
                          <span className="text-slate-200">
                            {p
                              ? p.dossier?.subscriberName || 'No subscriber listed'
                              : v?.queryAuditLog[0]?.officerBadgeOrCaseId || 'No badge ref'}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={isTierUnlocked ? onOpenPasscodeModal : onOpenPricing}
                            className="inline-flex items-center gap-1 text-amber-300 hover:text-cyan-300 underline cursor-pointer"
                          >
                            <Lock className="h-3 w-3" />
                            <span>{isTierUnlocked ? 'Passcode Locked' : 'Upgrade'}</span>
                          </button>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {item.status === 'error' && !isRunning && (
                            <button
                              type="button"
                              onClick={() => void handleRetrySingle(item.id)}
                              className="inline-flex items-center gap-1 rounded border border-rose-700/60 bg-rose-950/40 px-2.5 py-1 text-[11px] font-medium text-rose-200 hover:bg-rose-900/50 cursor-pointer"
                            >
                              <RefreshCw className="h-3 w-3" />
                              <span>Retry</span>
                            </button>
                          )}
                          {item.status === 'completed' && (p || v) && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  if (p) onInspectPhone(p);
                                  else if (v) onInspectAlpr(v);
                                }}
                                className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-cyan-500/50 hover:text-white cursor-pointer"
                              >
                                <Eye className="h-3 w-3 text-cyan-400" />
                                <span>Inspect</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!isTierUnlocked) {
                                    onOpenPricing();
                                  } else if (!isPasscodeUnlocked) {
                                    onOpenPasscodeModal();
                                  } else if (p) {
                                    onOpenExport({ type: 'phone', content: p });
                                  } else if (v) {
                                    onOpenExport({ type: 'alpr', content: v });
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-cyan-300 hover:border-cyan-500/50 hover:text-white cursor-pointer"
                              >
                                <Download className="h-3 w-3" />
                                <span>PDF</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
