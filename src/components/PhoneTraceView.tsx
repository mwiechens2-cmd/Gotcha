import React, { useState } from 'react';
import {
  Search,
  Phone,
  Lock,
  Unlock,
  Download,
  Mail,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { PhoneLookupResult, SubscriptionTierType } from '../types';
import { PRESET_PHONES, generatePhoneLookup } from '../data/mockData';

interface PhoneTraceViewProps {
  currentTier: SubscriptionTierType;
  onOpenPricing: () => void;
  onOpenExport: (data: { type: 'phone'; content: PhoneLookupResult }) => void;
}

export const PhoneTraceView: React.FC<PhoneTraceViewProps> = ({
  currentTier,
  onOpenPricing,
  onOpenExport,
}) => {
  const [inputNumber, setInputNumber] = useState('+1 (415) 890-4421');
  const [activeResult, setActiveResult] = useState<PhoneLookupResult>(() =>
    generatePhoneLookup('+1 (415) 890-4421')
  );
  const [isSearching, setIsSearching] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const digits = inputNumber.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      setValidationError('Enter a valid 7 to 15-digit phone number (e.g. +1 415-890-4421).');
      return;
    }

    setValidationError(null);
    setIsSearching(true);
    setTimeout(() => {
      const result = generatePhoneLookup(inputNumber);
      setActiveResult(result);
      setIsSearching(false);
    }, 350);
  };

  const handleSelectPreset = (presetNumber: string) => {
    setValidationError(null);
    setInputNumber(presetNumber);
    setIsSearching(true);
    setTimeout(() => {
      const result = generatePhoneLookup(presetNumber);
      setActiveResult(result);
      setIsSearching(false);
    }, 250);
  };

  const isDossierUnlocked = currentTier === 'investigator' || currentTier === 'enterprise';

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
              type="text"
              value={inputNumber}
              onChange={(e) => {
                setInputNumber(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="Enter phone number (e.g. +1 415-890-4421)"
              className="w-full rounded-lg border border-slate-700 bg-[#080c14] py-2.5 pl-10 pr-4 text-sm font-mono text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            <span>{isSearching ? 'Querying Telecom Routing...' : 'Trace Number'}</span>
          </button>
        </form>
        {validationError && (
          <p className="mt-2 text-xs text-rose-400 font-medium">{validationError}</p>
        )}

        {/* Quick Presets for Instant Testing */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium mr-1">Case study presets:</span>
          {PRESET_PHONES.map((preset) => (
            <button
              key={preset.number}
              type="button"
              onClick={() => handleSelectPreset(preset.number)}
              className={`rounded-md border px-2.5 py-1 font-mono transition-colors cursor-pointer text-[12px] ${
                activeResult.formattedNational === preset.number.replace('+1 ', '') ||
                inputNumber === preset.number
                  ? 'border-cyan-500/80 bg-cyan-950/40 text-cyan-300'
                  : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Analysis Section: Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Telecom Infrastructure & Risk Assessment (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 01: Telecom Routing */}
          <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h2 className="text-base font-semibold text-white">
                  01. Telecom & Carrier Architecture
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span className="font-mono text-cyan-400 tabular-nums">
                    {activeResult.formattedInternational}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{activeResult.countryName}</span>
                  <span aria-hidden="true">·</span>
                  <span>E.164 Validated</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2.5 py-1 rounded border font-mono font-medium ${
                    activeResult.lineType === 'VoIP' || activeResult.lineType === 'Virtual / Burner'
                      ? 'border-amber-800/60 bg-amber-950/30 text-amber-300'
                      : 'border-slate-700 bg-slate-800/50 text-slate-300'
                  }`}
                >
                  Line: {activeResult.lineType}
                </span>
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
                  Coordinates: {activeResult.location.coordinates[0].toFixed(3)}°N,{' '}
                  {activeResult.location.coordinates[1].toFixed(3)}°W
                </span>
              </div>
            </div>
          </div>

          {/* Section 02: Threat & Reputation Analysis */}
          <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-6 space-y-5">
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
                      activeResult.riskAnalysis.spamScore > 70
                        ? 'bg-rose-500'
                        : activeResult.riskAnalysis.spamScore > 35
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
                  <span className="text-slate-400 block mb-0.5">Community Reports</span>
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
                <button
                  type="button"
                  onClick={() => onOpenExport({ type: 'phone', content: activeResult })}
                  className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export</span>
                </button>
              )}
            </div>

            {/* Redacted Paywall View vs Unlocked Unredacted Dossier */}
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

                {/* Conversion Callout */}
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
                  <div className="space-y-1.5 mt-1">
                    {activeResult.dossier?.associatedEmails.map((email, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-slate-300 font-mono">
                        <Mail className="h-3 w-3 text-cyan-400 shrink-0" />
                        <span className="truncate">{email}</span>
                      </div>
                    ))}
                    {activeResult.dossier?.digitalFootprint.map((fp, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-slate-400">{fp.platform}</span>
                        <span className="font-mono text-cyan-300">{fp.profileHandle}</span>
                      </div>
                    ))}
                  </div>
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
