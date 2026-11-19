import React, { useState } from 'react';
import {
  Bookmark,
  Car,
  Check,
  Edit3,
  Eye,
  LogIn,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { generatePhoneLookup, generateVehicleAudit } from '../data/mockData';
import {
  SavedAlprAuditRecord,
  SavedPhoneLookupRecord,
  WatchlistItemRecord,
} from '../types';

interface WatchlistViewProps {
  onOpenPhoneTrace: (phoneNumber: string) => void;
  onOpenAlprAudit: (plateNumber: string, state: string) => void;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  onOpenPhoneTrace,
  onOpenAlprAudit,
}) => {
  const {
    user,
    authReady,
    authLoading,
    dataLoading,
    savedPhoneLookups,
    savedAlprAudits,
    watchlistItems,
    signInWithGoogle,
    addToWatchlist,
    updateWatchlistItem,
    deleteWatchlistItem,
    deletePhoneTrace,
    deletePlateAudit,
  } = useFirebase();

  const [section, setSection] = useState<'watchlist' | 'phones' | 'plates'>('watchlist');
  const [filterText, setFilterText] = useState('');

  // Quick add watchlist form
  const [newType, setNewType] = useState<'phone' | 'plate'>('plate');
  const [newTarget, setNewTarget] = useState('');
  const [newState, setNewState] = useState('CA');
  const [newLabel, setNewLabel] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Inline label editing & busy IDs
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleAddWatchItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    let computedTarget = newTarget.trim();
    let computedStatus = 'Monitored';

    if (newType === 'phone') {
      const digits = computedTarget.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) {
        setFormError('Enter a valid 7 to 15-digit phone number.');
        return;
      }
      const lookup = generatePhoneLookup(computedTarget);
      computedTarget = lookup.phoneNumber;
      computedStatus = `${lookup.riskAnalysis.riskLevel} Risk (${lookup.riskAnalysis.spamScore}/100)`;
    } else {
      const cleaned = computedTarget.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (cleaned.length < 2 || cleaned.length > 10) {
        setFormError('Enter a valid 2 to 10-character license plate.');
        return;
      }
      const audit = generateVehicleAudit(cleaned, newState);
      computedTarget = audit.plateNumber;
      computedStatus =
        audit.auditSummary.overallStatus === 'queried_active'
          ? 'Active Query Logged'
          : 'Passive Sightings Only';
    }

    setIsAdding(true);
    try {
      await addToWatchlist({
        itemType: newType,
        targetValue: computedTarget,
        jurisdictionState: newType === 'plate' ? newState : '',
        label: newLabel.trim() || computedTarget,
        lastStatus: computedStatus,
      });
      setNewTarget('');
      setNewLabel('');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRefreshWatchItem = async (item: WatchlistItemRecord) => {
    setBusyId(item.id);
    try {
      let nextStatus = item.lastStatus;
      if (item.itemType === 'phone') {
        const res = generatePhoneLookup(item.targetValue);
        nextStatus = `${res.riskAnalysis.riskLevel} Risk (${res.riskAnalysis.spamScore}/100)`;
      } else {
        const res = generateVehicleAudit(item.targetValue, item.jurisdictionState || 'CA');
        nextStatus =
          res.auditSummary.overallStatus === 'queried_active'
            ? 'Active Query Logged'
            : 'Passive Sightings Only';
      }
      await updateWatchlistItem(item.id, item.label, nextStatus);
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveLabel = async (item: WatchlistItemRecord) => {
    if (!editingLabel.trim()) return;
    setBusyId(item.id);
    try {
      await updateWatchlistItem(item.id, editingLabel.trim(), item.lastStatus);
      setEditingId(null);
    } finally {
      setBusyId(null);
    }
  };

  const formatSavedTime = (ts: unknown): string => {
    if (ts && typeof ts === 'object' && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
      return (ts as { toDate: () => Date }).toDate().toLocaleString();
    }
    return 'Synced';
  };

  const queryLower = filterText.trim().toLowerCase();
  const filteredWatchlist = watchlistItems.filter(
    (item) =>
      !queryLower ||
      item.targetValue.toLowerCase().includes(queryLower) ||
      item.label.toLowerCase().includes(queryLower) ||
      item.lastStatus.toLowerCase().includes(queryLower)
  );
  const filteredPhones = savedPhoneLookups.filter(
    (row) =>
      !queryLower ||
      row.formattedNational.toLowerCase().includes(queryLower) ||
      row.carrierName.toLowerCase().includes(queryLower) ||
      (row.subscriberPreview || '').toLowerCase().includes(queryLower)
  );
  const filteredPlates = savedAlprAudits.filter(
    (row) =>
      !queryLower ||
      row.plateNumber.toLowerCase().includes(queryLower) ||
      row.state.toLowerCase().includes(queryLower) ||
      row.lastLocation.toLowerCase().includes(queryLower)
  );

  if (!authReady) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="h-8 w-64 rounded bg-slate-800/80 animate-pulse" />
        <div className="h-44 rounded-xl border border-slate-800 bg-[#0d1322] animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Cloud Watchlist & Saved Investigations
          </h1>
          <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
            Sync your subscription tier across sessions, archive reverse phone OSINT traces and ALPR plate audits,
            and monitor target vehicles or caller lines in one workspace.
          </p>
        </div>

        <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-b from-[#111c33] to-[#0d1322] p-8 text-center space-y-5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Bookmark className="h-6 w-6" />
          </div>
          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="text-lg font-bold text-white">
              Sign in with Google to Sync Your Workspace
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your saved phone traces, ALPR vehicle audits, monitored watchlist targets, and subscription tier
              are stored privately under your verified Google account in Cloud Firestore.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            disabled={authLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" />
            <span>{authLoading ? 'Connecting Google Account...' : 'Sign In with Google'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Cloud Watchlist & Saved Investigations
          </h1>
          <p className="mt-1.5 text-sm text-slate-400 max-w-3xl leading-relaxed">
            Manage monitored license plates and phone numbers, reopen archived phone OSINT lookups,
            and review saved Flock Safety / ALPR audits synced to your account.
          </p>
        </div>
        <div className="text-xs font-mono text-slate-400 tabular-nums">
          <span>{watchlistItems.length} Watched</span>
          <span aria-hidden="true" className="mx-2 text-slate-700">·</span>
          <span>{savedPhoneLookups.length} Phone Traces</span>
          <span aria-hidden="true" className="mx-2 text-slate-700">·</span>
          <span>{savedAlprAudits.length} ALPR Audits</span>
        </div>
      </div>

      {/* Add to Watchlist Bar */}
      <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Add Target to Monitored Watchlist</h2>
          <span className="text-xs text-slate-400">Instant status sync via Firestore</span>
        </div>

        <form onSubmit={handleAddWatchItem} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-2">
            <select
              value={newType}
              onChange={(e) => {
                setNewType(e.target.value as 'phone' | 'plate');
                setFormError(null);
              }}
              aria-label="Target type"
              className="w-full rounded-lg border border-slate-700 bg-[#080c14] py-2 px-3 text-xs font-medium text-white focus:border-cyan-500 focus:outline-none cursor-pointer"
            >
              <option value="plate">License Plate</option>
              <option value="phone">Phone Number</option>
            </select>
          </div>

          <div className={newType === 'plate' ? 'sm:col-span-3' : 'sm:col-span-5'}>
            <input
              type="text"
              value={newTarget}
              onChange={(e) => {
                setNewTarget(newType === 'plate' ? e.target.value.toUpperCase() : e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder={newType === 'plate' ? 'Plate (e.g. 7XYZ892)' : 'Phone (e.g. +1 415-890-4421)'}
              className="w-full rounded-lg border border-slate-700 bg-[#080c14] py-2 px-3 text-xs font-mono text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {newType === 'plate' && (
            <div className="sm:col-span-2">
              <select
                value={newState}
                onChange={(e) => setNewState(e.target.value)}
                aria-label="Plate state"
                className="w-full rounded-lg border border-slate-700 bg-[#080c14] py-2 px-3 text-xs font-mono text-white focus:border-cyan-500 focus:outline-none cursor-pointer"
              >
                {US_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="sm:col-span-3">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              maxLength={80}
              placeholder="Case label (e.g. Daily Commute Civic)"
              className="w-full rounded-lg border border-slate-700 bg-[#080c14] py-2 px-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isAdding}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isAdding ? 'Adding...' : 'Watch Target'}</span>
            </button>
          </div>
        </form>

        {formError && <p className="text-xs text-rose-400 font-medium">{formError}</p>}
      </div>

      {/* Section Switcher & Search Filter */}
      <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-[#080c14] border border-slate-800 rounded-lg w-full sm:w-auto overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setSection('watchlist')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              section === 'watchlist' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Monitored Watchlist ({watchlistItems.length})
          </button>
          <button
            type="button"
            onClick={() => setSection('phones')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              section === 'phones' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Saved Phone Traces ({savedPhoneLookups.length})
          </button>
          <button
            type="button"
            onClick={() => setSection('plates')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              section === 'plates' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Saved ALPR Audits ({savedAlprAudits.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter saved records..."
            className="w-full rounded-lg border border-slate-700 bg-[#080c14] py-1.5 pl-8 pr-3 text-xs font-mono text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Loading Skeleton */}
      {dataLoading && (
        <div className="space-y-3">
          <div className="h-20 rounded-xl border border-slate-800 bg-[#0d1322] animate-pulse" />
          <div className="h-20 rounded-xl border border-slate-800 bg-[#0d1322] animate-pulse" />
        </div>
      )}

      {/* Monitored Watchlist List */}
      {!dataLoading && section === 'watchlist' && (
        <div className="space-y-3">
          {filteredWatchlist.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-white">No Watchlist Targets Found</p>
              <p className="text-xs text-slate-400">
                Add a phone number or license plate above, or click "Watch" directly inside Phone OSINT Trace or Flock ALPR Audit.
              </p>
            </div>
          ) : (
            filteredWatchlist.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-800 bg-[#0d1322] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {item.itemType === 'plate' ? (
                      <Car className="h-4 w-4 text-cyan-400 shrink-0" />
                    ) : (
                      <Phone className="h-4 w-4 text-cyan-400 shrink-0" />
                    )}
                    <span className="font-mono text-sm font-bold text-white">
                      {item.targetValue}
                      {item.jurisdictionState ? ` (${item.jurisdictionState})` : ''}
                    </span>
                    <span className="text-slate-700" aria-hidden="true">·</span>
                    <span className="text-xs font-mono text-cyan-300">{item.lastStatus}</span>
                  </div>

                  {editingId === item.id ? (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                        maxLength={80}
                        className="rounded border border-slate-700 bg-[#080c14] px-2.5 py-1 text-xs text-white focus:border-cyan-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSaveLabel(item)}
                        disabled={busyId === item.id}
                        className="inline-flex items-center gap-1 rounded bg-cyan-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-cyan-500 cursor-pointer"
                      >
                        <Check className="h-3 w-3" />
                        <span>Save</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-xs text-slate-400 hover:text-white px-2 py-1 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="text-slate-200 font-medium">{item.label}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-[11px]">Updated {formatSavedTime(item.updatedAt)}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (item.itemType === 'phone') {
                        onOpenPhoneTrace(item.targetValue);
                      } else {
                        onOpenAlprAudit(item.targetValue, item.jurisdictionState || 'CA');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>{item.itemType === 'phone' ? 'Open Trace' : 'Open Audit'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRefreshWatchItem(item)}
                    disabled={busyId === item.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${busyId === item.id ? 'animate-spin' : ''}`} />
                    <span>Re-Check</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(item.id);
                      setEditingLabel(item.label);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white cursor-pointer"
                    title="Rename label"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteWatchlistItem(item.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                    title="Remove from watchlist"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Saved Phone Lookups */}
      {!dataLoading && section === 'phones' && (
        <div className="space-y-3">
          {filteredPhones.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-white">No Saved Phone Traces Yet</p>
              <p className="text-xs text-slate-400">
                Run any reverse phone trace and click "Save Trace" to archive its telecom telemetry and web findings here.
              </p>
            </div>
          ) : (
            filteredPhones.map((row: SavedPhoneLookupRecord) => (
              <div
                key={row.id}
                className="rounded-xl border border-slate-800 bg-[#0d1322] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-sm font-bold text-white">{row.formattedNational}</span>
                    <span className="text-slate-700" aria-hidden="true">·</span>
                    <span className="text-xs text-slate-300">{row.carrierName}</span>
                    <span className="text-slate-700" aria-hidden="true">·</span>
                    <span className="text-xs font-mono text-cyan-300">
                      {row.lineType} · {row.riskLevel} Risk ({row.spamScore}/100)
                    </span>
                  </div>
                  {row.subscriberPreview && (
                    <p className="text-xs text-slate-300">Subscriber: {row.subscriberPreview}</p>
                  )}
                  {row.webSummary && (
                    <p className="text-xs text-slate-400 line-clamp-2">{row.webSummary}</p>
                  )}
                  <span className="text-[11px] font-mono text-slate-500 block">
                    Saved {formatSavedTime(row.savedAt)}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenPhoneTrace(row.phoneNumber)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Open Trace</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void deletePhoneTrace(row.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                    title="Delete saved trace"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Saved ALPR Audits */}
      {!dataLoading && section === 'plates' && (
        <div className="space-y-3">
          {filteredPlates.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-white">No Saved ALPR Plate Audits Yet</p>
              <p className="text-xs text-slate-400">
                Audit any license plate in Flock ALPR Audit and click "Save Audit" to store its query status here.
              </p>
            </div>
          ) : (
            filteredPlates.map((row: SavedAlprAuditRecord) => (
              <div
                key={row.id}
                className="rounded-xl border border-slate-800 bg-[#0d1322] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-sm font-bold text-white">
                      {row.plateNumber} ({row.state})
                    </span>
                    <span className="text-slate-700" aria-hidden="true">·</span>
                    <span
                      className={`text-xs font-mono font-semibold ${
                        row.overallStatus === 'queried_active' ? 'text-amber-300' : 'text-emerald-400'
                      }`}
                    >
                      {row.overallStatus === 'queried_active' ? 'ACTIVE QUERY LOGGED' : 'PASSIVE SIGHTINGS ONLY'}
                    </span>
                    <span className="text-slate-700" aria-hidden="true">·</span>
                    <span className="text-xs font-mono text-slate-300 tabular-nums">
                      {row.detections30Days} detections (30d)
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">Last Seen: {row.lastLocation}</p>
                  <p className="text-[11px] text-slate-400">{row.retentionStandard}</p>
                  <span className="text-[11px] font-mono text-slate-500 block">
                    Saved {formatSavedTime(row.savedAt)}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenAlprAudit(row.plateNumber, row.state)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Open Audit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void deletePlateAudit(row.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                    title="Delete saved audit"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
