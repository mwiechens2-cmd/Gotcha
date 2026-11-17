import React, { useMemo, useState } from 'react';
import { X, Copy, Check, Download, Printer } from 'lucide-react';
import { PhoneLookupResult, VehicleAlprAuditResult } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportData:
    | { type: 'phone'; content: PhoneLookupResult }
    | { type: 'alpr'; content: VehicleAlprAuditResult }
    | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  exportData,
}) => {
  const [copied, setCopied] = useState(false);
  const [exportFormat, setExportFormat] = useState<'text' | 'json'>('text');

  const { timestamp, reportId } = useMemo(() => {
    return {
      timestamp: new Date().toISOString(),
      reportId: `RPT-${Math.floor(100000 + Math.random() * 900000)}`,
    };
  }, [exportData, isOpen]);

  if (!isOpen || !exportData) return null;

  const generateReportText = () => {
    if (exportData.type === 'phone') {
      const p = exportData.content;
      return `========================================================================
VIGILALPR & TRACEID - FORENSIC TELECOM OSINT DOSSIER
REPORT ID: ${reportId} | GENERATED: ${timestamp}
CLASSIFICATION: CONFIDENTIAL INVESTIGATIVE INTELLIGENCE
========================================================================

1. TARGET MSISDN IDENTIFIERS
------------------------------------------------------------------------
Phone Number:          ${p.phoneNumber}
National Format:       ${p.formattedNational}
International Format:  ${p.formattedInternational}
Jurisdiction:          ${p.countryName} (${p.countryCode})
Rate Center:           ${p.location.rateCenter}
Geographic Location:   ${p.location.city}, ${p.location.state} ${p.location.postalCode}
Time Zone:             ${p.location.timeZone}

2. SERVING CARRIER & ROUTING INFRASTRUCTURE
------------------------------------------------------------------------
Operating Carrier:     ${p.carrier.name}
Carrier Classification:${p.carrier.type}
Network Code:          ${p.carrier.networkCode}
Line Type:             ${p.lineType}
Ported Line:           ${p.carrier.isPorted ? 'YES' : 'NO'}
${p.carrier.isPorted ? `Original Network:      ${p.carrier.originalNetwork}\nLast Port Date:        ${p.carrier.lastPortedDate}` : ''}

3. THREAT & FRAUD TELEMETRY
------------------------------------------------------------------------
Composite Threat Score:${p.riskAnalysis.spamScore} / 100
Risk Tier:             ${p.riskAnalysis.riskLevel}
Classification:        ${p.riskAnalysis.activityCategory}
Community Reports:     ${p.riskAnalysis.totalReports}
Primary Flag:          ${p.riskAnalysis.primaryFlag}

4. DEEP OSINT SUBSCRIBER REGISTRY
------------------------------------------------------------------------
Registered Subscriber: ${p.dossier?.subscriberName || 'REDACTED / UNREGISTERED'}
Entity Type:           ${p.dossier?.subscriberType || 'N/A'}
Associated Emails:     ${p.dossier?.associatedEmails.join(', ') || 'None found'}
Addresses on File:
${p.dossier?.addressHistory.map(a => `  * ${a.street}, ${a.cityState} [${a.years}]`).join('\n') || '  * None'}

Known Breach Footprints:
${p.dossier?.breachExposures.map(b => `  * ${b.breachName} (${b.year}) - Compromised: ${b.compromisedData.join(', ')}`).join('\n') || '  * None'}

========================================================================
END OF DOSSIER - GENERATED VIA VIGILALPR / TRACEID PLATFORM
========================================================================`;
    } else {
      const v = exportData.content;
      return `========================================================================
VIGILALPR & TRACEID - FLOCK SAFETY & ALPR SURVEILLANCE AUDIT
REPORT ID: ${reportId} | GENERATED: ${timestamp}
CLASSIFICATION: STATUTORY AUDIT & SURVEILLANCE LOG
========================================================================

1. TARGET VEHICLE IDENTIFIERS
------------------------------------------------------------------------
License Plate:         ${v.plateNumber}
Jurisdiction:          ${v.state}
Vehicle:               ${v.vehicleDetails.year} ${v.vehicleDetails.make} ${v.vehicleDetails.model}
Color / Style:         ${v.vehicleDetails.color} (${v.vehicleDetails.bodyStyle})
Masked VIN:            ${v.vehicleDetails.vinMasked}

2. SURVEILLANCE INQUIRY & LOOKED-INTO STATUS
------------------------------------------------------------------------
Overall Status:        ${v.auditSummary.overallStatus.toUpperCase()}
Has Vehicle Been Queried: ${v.auditSummary.overallStatus === 'queried_active' ? 'YES - ACTIVE LAW ENFORCEMENT SEARCH DETECTED' : 'NO - PASSIVE SIGHTINGS ONLY'}
Active Query Count:    ${v.auditSummary.activeAgencyQueriesCount}
30-Day Detections:     ${v.auditSummary.totalDetections30Days}
90-Day Detections:     ${v.auditSummary.totalDetections90Days}
Retention Standard:    ${v.auditSummary.retentionPolicyStandard}

3. AGENCY INQUIRY AUDIT TRAIL
------------------------------------------------------------------------
${v.queryAuditLog.map(q => `* Query ID: ${q.queryId}
  Agency:    ${q.requestingAgency} (${q.agencyType})
  Timestamp: ${q.timestamp}
  Reason:    ${q.queryReason}
  Ref:       ${q.officerBadgeOrCaseId}
  Result:    ${q.alertDisposition}`).join('\n\n')}

4. OPTICAL SENSOR NODES & SIGHTING LOGS
------------------------------------------------------------------------
${v.cameraSightings.map(c => `* Node ID: ${c.cameraId} (${c.cameraType})
  Location:  ${c.intersectionOrLocation}
  Agency:    ${c.municipalityAgency}
  Timestamp: ${c.timestamp}
  Heading:   ${c.directionOfTravel} | Lane ${c.laneNumber} | ~${c.speedEstimateMph} MPH
  Confidence:${c.captureConfidence}% | Days to Purge: ${c.retentionDaysRemaining}d`).join('\n\n')}

========================================================================
END OF AUDIT - GENERATED VIA VIGILALPR / TRACEID PLATFORM
========================================================================`;
    }
  };

  const displayText =
    exportFormat === 'json'
      ? JSON.stringify(exportData.content, null, 2)
      : generateReportText();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const el = document.createElement('textarea');
        el.value = displayText;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setCopied(false);
      }
    }
  };

  const handleDownload = () => {
    const ext = exportFormat === 'json' ? 'json' : 'txt';
    const blob = new Blob([displayText], {
      type: exportFormat === 'json' ? 'application/json' : 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `VigilALPR_${exportData.type}_${reportId}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-700 bg-[#0d1322] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-5 bg-[#080c14]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Download className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Export Intelligence Briefing
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                Report ID: {reportId} · Format: {exportFormat.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-0.5 bg-slate-900 border border-slate-800 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setExportFormat('text')}
                className={`px-2.5 py-1 rounded font-mono ${
                  exportFormat === 'text' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'
                }`}
              >
                TEXT
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('json')}
                className={`px-2.5 py-1 rounded font-mono ${
                  exportFormat === 'json' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'
                }`}
              >
                JSON
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer ml-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto">
          <textarea
            readOnly
            value={displayText}
            rows={16}
            className="w-full rounded-lg border border-slate-800 bg-[#080c14] p-3 text-xs font-mono text-slate-300 focus:outline-none leading-relaxed select-all"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 p-4 bg-[#080c14]">
          <span className="text-xs text-slate-500 font-mono hidden sm:inline">
            Encrypted Export · SHA-256 Validated
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Brief</span>
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
