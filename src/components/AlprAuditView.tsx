import React, { useState } from 'react';
import {
  Car,
  Search,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Clock,
  Compass,
  FileText,
  Eye,
  Lock,
  ArrowRight,
  ExternalLink,
  MapPin,
  Download,
  Info,
} from 'lucide-react';
import { VehicleAlprAuditResult, SubscriptionTierType } from '../types';
import { PRESET_PLATES, generateVehicleAudit } from '../data/mockData';

interface AlprAuditViewProps {
  currentTier: SubscriptionTierType;
  onOpenPricing: () => void;
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

export const AlprAuditView: React.FC<AlprAuditViewProps> = ({
  currentTier,
  onOpenPricing,
  onOpenFoia,
  onOpenExport,
}) => {
  const [inputPlate, setInputPlate] = useState('7XYZ892');
  const [selectedState, setSelectedState] = useState('CA');
  const [activeAudit, setActiveAudit] = useState<VehicleAlprAuditResult>(() =>
    generateVehicleAudit('7XYZ892', 'CA')
  );
  const [isAuditing, setIsAuditing] = useState(false);

  const handleAudit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputPlate.trim()) return;

    setIsAuditing(true);
    setTimeout(() => {
      const result = generateVehicleAudit(inputPlate, selectedState);
      setActiveAudit(result);
      setIsAuditing(false);
    }, 400);
  };

  const handleSelectPreset = (presetPlate: string, presetState: string) => {
    setInputPlate(presetPlate);
    setSelectedState(presetState);
    setIsAuditing(true);
    setTimeout(() => {
      const result = generateVehicleAudit(presetPlate, presetState);
      setActiveAudit(result);
      setIsAuditing(false);
    }, 250);
  };

  const isFullAuditUnlocked = currentTier === 'investigator' || currentTier === 'enterprise';

  const hasBeenLookedInto = activeAudit.auditSummary.overallStatus === 'queried_active';

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
              type="text"
              value={inputPlate}
              onChange={(e) => setInputPlate(e.target.value.toUpperCase())}
              placeholder="Enter License Plate (e.g. 7XYZ892)"
              className="w-full rounded-lg border border-slate-700 bg-[#080c14] py-2.5 pl-10 pr-4 text-sm font-mono tracking-wider font-bold text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 uppercase"
            />
          </div>

          <div className="w-full sm:w-36 shrink-0">
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
            <Search className="h-4 w-4" />
            <span>{isAuditing ? 'Scanning ALPR Gateways...' : 'Audit License Plate'}</span>
          </button>
        </form>

        {/* Preset Case Studies */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium mr-1">Sample vehicle audits:</span>
          {PRESET_PLATES.map((preset) => (
            <button
              key={`${preset.plate}_${preset.state}`}
              type="button"
              onClick={() => handleSelectPreset(preset.plate, preset.state)}
              className={`rounded-md border px-2.5 py-1 font-mono transition-colors cursor-pointer text-[12px] ${
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
                <span>Vehicle: {activeAudit.vehicleDetails.year} {activeAudit.vehicleDetails.make} {activeAudit.vehicleDetails.model} ({activeAudit.vehicleDetails.color})</span>
                <span aria-hidden="true">·</span>
                <span>VIN: {activeAudit.vehicleDetails.vinMasked}</span>
                <span aria-hidden="true">·</span>
                <span>Jurisdiction: {activeAudit.state}</span>
              </div>
            </div>
          </div>

          {/* Action Button: FOIA or Export */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onOpenFoia(activeAudit)}
              className="flex items-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-500/50 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <FileText className="h-4 w-4 text-cyan-400" />
              <span>FOIA Request Generator</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenExport({ type: 'alpr', content: activeAudit })}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Export Audit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Query Details & Camera Sightings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Query Audit Logs & Retention Analysis (6 Cols) */}
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
                      Agency Type: {log.agencyType} · {log.officerBadgeOrCaseId}
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
                {activeAudit.cameraSightings.length} Logged Node(s)
              </span>
            </div>

            {/* Sighting Timeline Cards */}
            <div className="space-y-3.5">
              {activeAudit.cameraSightings.map((sighting) => (
                <div
                  key={sighting.id}
                  className="rounded-lg border border-slate-800/90 bg-[#080c14]/70 p-4 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-white tracking-wide">
                      {sighting.cameraName}
                    </span>
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
                </div>
              ))}
            </div>

            {/* Tier Lock Teaser if on Free Explorer */}
            {!isFullAuditUnlocked && (
              <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-b from-cyan-950/40 to-[#080c14] p-5 text-center space-y-3 mt-4">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Historical 90-Day Audit Log Restricted
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    The free Explorer tier previews recent node captures. Upgrade to Investigator Pro
                    to unlock historical route corridor tracking, detailed officer badge identifiers, and
                    full FOIA expungement packet export.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenPricing}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer"
                >
                  <span>Upgrade to Investigator Pro ($29/mo)</span>
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
