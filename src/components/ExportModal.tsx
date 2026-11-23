import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Copy, Check, Download, Printer, FileText } from 'lucide-react';
import { PhoneLookupResult, VehicleAlprAuditResult } from '../types';
import { generateDossierPdf } from '../utils/pdfReport';

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
  const [exportFormat, setExportFormat] = useState<'pdf' | 'text' | 'json'>('pdf');
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    setCopied(false);
    setPdfNotice(null);
    setPdfError(null);
    setIsGeneratingPdf(false);
  }, [isOpen, exportData]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

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

  const scheduleCopyReset = () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      scheduleCopyReset();
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
        scheduleCopyReset();
      } catch {
        setCopied(false);
      }
    }
  };

  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true);
    setPdfNotice(null);
    setPdfError(null);
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
    try {
      const fileName = generateDossierPdf({
        reportId,
        timestamp,
        exportData,
      });
      setPdfNotice(`Downloaded ${fileName}`);
      noticeTimerRef.current = setTimeout(() => setPdfNotice(null), 4000);
    } catch (err) {
      setPdfError(
        err instanceof Error ? err.message : 'Unable to build PDF report. Please retry.'
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownload = () => {
    if (exportFormat === 'pdf') {
      handleDownloadPdf();
      return;
    }
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
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 p-5 bg-[#080c14]">
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

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 p-0.5 bg-slate-900 border border-slate-800 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setExportFormat('pdf')}
                className={`px-2.5 py-1 rounded font-mono cursor-pointer transition-colors ${
                  exportFormat === 'pdf' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                PDF
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('text')}
                className={`px-2.5 py-1 rounded font-mono cursor-pointer transition-colors ${
                  exportFormat === 'text' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                TEXT
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('json')}
                className={`px-2.5 py-1 rounded font-mono cursor-pointer transition-colors ${
                  exportFormat === 'json' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
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
        <div className="p-5 overflow-y-auto space-y-4">
          {exportFormat === 'pdf' ? (
            <div className="rounded-xl border border-slate-700/80 bg-white text-slate-900 overflow-hidden shadow-lg">
              {/* Styled PDF Visual Preview Header */}
              <div className="bg-[#080c14] text-white px-6 py-4 border-b-[3px] border-cyan-500 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-base font-bold tracking-tight">VigilALPR / TraceID</div>
                  <div className="text-[11px] font-bold text-cyan-400 tracking-wide mt-0.5">
                    {exportData.type === 'phone'
                      ? 'FORENSIC TELECOM OSINT DOSSIER'
                      : 'FLOCK SAFETY & ALPR SURVEILLANCE AUDIT'}
                  </div>
                </div>
                <div className="text-right font-mono text-[11px] text-slate-300 space-y-0.5">
                  <div>Report ID: {reportId}</div>
                  <div>{new Date(timestamp).toLocaleString()}</div>
                </div>
              </div>

              {/* Styled PDF Preview Body */}
              <div className="p-6 space-y-4 text-xs">
                {exportData.type === 'phone' ? (
                  <>
                    <div
                      className={`rounded-lg border p-3.5 ${
                        exportData.content.riskAnalysis.spamScore >= 70
                          ? 'bg-rose-50 border-rose-300 text-rose-900'
                          : exportData.content.riskAnalysis.spamScore >= 35
                          ? 'bg-amber-50 border-amber-300 text-amber-900'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      }`}
                    >
                      <div className="font-bold">
                        {exportData.content.riskAnalysis.riskLevel.toUpperCase()} RISK PROFILE ·{' '}
                        {exportData.content.riskAnalysis.spamScore}/100
                      </div>
                      <p className="mt-1 text-slate-700">
                        {exportData.content.formattedInternational} · {exportData.content.carrier.name} ({exportData.content.lineType})
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">01. Telecom Routing</div>
                        <div className="font-semibold text-slate-900 mt-1">{exportData.content.carrier.name}</div>
                        <div className="text-slate-600 mt-0.5">
                          {exportData.content.location.city}, {exportData.content.location.state} · {exportData.content.location.rateCenter}
                        </div>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">02. Subscriber Registry</div>
                        <div className="font-semibold text-slate-900 mt-1">
                          {exportData.content.dossier?.subscriberName || 'Redacted'}
                        </div>
                        <div className="text-slate-600 mt-0.5">
                          {exportData.content.dossier?.addressHistory.length || 0} address(es) ·{' '}
                          {exportData.content.dossier?.breachExposures.length || 0} breach match(es)
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className={`rounded-lg border p-3.5 ${
                        exportData.content.auditSummary.overallStatus === 'queried_active'
                          ? 'bg-amber-50 border-amber-300 text-amber-900'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      }`}
                    >
                      <div className="font-bold">
                        {exportData.content.auditSummary.overallStatus === 'queried_active'
                          ? `ACTIVE SURVEILLANCE QUERIES LOGGED (${exportData.content.auditSummary.activeAgencyQueriesCount})`
                          : 'NOMINAL · PASSIVE OPTICAL SIGHTINGS ONLY'}
                      </div>
                      <p className="mt-1 text-slate-700">
                        Plate [{exportData.content.plateNumber}] ({exportData.content.state}) ·{' '}
                        {exportData.content.vehicleDetails.year} {exportData.content.vehicleDetails.make}{' '}
                        {exportData.content.vehicleDetails.model}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">01. Query & Retention Audit</div>
                        <div className="font-semibold text-slate-900 mt-1">
                          {exportData.content.queryAuditLog.length} Inquiry Record(s)
                        </div>
                        <div className="text-slate-600 mt-0.5">
                          {exportData.content.auditSummary.retentionPolicyStandard}
                        </div>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">02. Optical Sensor Sightings</div>
                        <div className="font-semibold text-slate-900 mt-1">
                          {exportData.content.cameraSightings.length} Recorded Camera Node(s)
                        </div>
                        <div className="text-slate-600 mt-0.5">
                          {exportData.content.auditSummary.lastDetectedLocation}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="border-t border-slate-200 pt-2.5 flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>Multi-page letter PDF with structured tables and pagination</span>
                  <span>Ready to export</span>
                </div>
              </div>
            </div>
          ) : (
            <textarea
              readOnly
              value={displayText}
              rows={16}
              className="w-full rounded-lg border border-slate-800 bg-[#080c14] p-3 text-xs font-mono text-slate-300 focus:outline-none leading-relaxed select-all"
            />
          )}

          {pdfNotice && (
            <div className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300 font-mono">
              {pdfNotice}
            </div>
          )}

          {pdfError && (
            <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-2 flex items-center justify-between gap-3 text-xs text-rose-200">
              <span>{pdfError}</span>
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="text-rose-300 hover:text-white font-semibold underline cursor-pointer shrink-0"
              >
                Retry PDF
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 p-4 bg-[#080c14]">
          <span className="text-xs text-slate-500 font-mono hidden sm:inline">
            Styled PDF, Text & JSON Export
          </span>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
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
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>
            {exportFormat !== 'pdf' && (
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5 text-cyan-400" />
                <span>Download .{exportFormat === 'json' ? 'json' : 'txt'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
