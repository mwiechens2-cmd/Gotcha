import React, { useEffect, useRef, useState } from 'react';
import { X, Copy, Check, Download, FileText, Globe } from 'lucide-react';
import { VehicleAlprAuditResult } from '../types';
import { fetchFoiaPortalWeb, WebLookupResponse } from '../utils/webLookup';
import { WebIntelPanel } from './WebIntelPanel';

interface FoiaModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditData?: VehicleAlprAuditResult;
}

export const FoiaModal: React.FC<FoiaModalProps> = ({
  isOpen,
  onClose,
  auditData,
}) => {
  const [copied, setCopied] = useState(false);
  const [requesterName, setRequesterName] = useState('Citizen Requester');
  const [agencyQuery, setAgencyQuery] = useState('');
  const [webLoading, setWebLoading] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);
  const [webIntel, setWebIntel] = useState<WebLookupResponse | null>(null);

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupTokenRef = useRef(0);

  useEffect(() => {
    lookupTokenRef.current += 1;
    setCopied(false);
    setAgencyQuery('');
    setWebLoading(false);
    setWebError(null);
    setWebIntel(null);
  }, [isOpen, auditData?.plateNumber, auditData?.state]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      lookupTokenRef.current += 1;
    };
  }, []);

  if (!isOpen) return null;

  const plate = auditData?.plateNumber || '7XYZ892';
  const state = auditData?.state || 'CA';
  const agencies =
    auditData?.reciprocalAgencies.map((a) => a.agencyName).join(', ') ||
    'Local Municipal Police Department';

  const getStateStatute = (st: string) => {
    switch (st) {
      case 'CA':
        return 'California Public Records Act (Gov. Code § 7920 et seq.) & California Senate Bill 34 (ALPR Privacy Standards, Civil Code §§ 1798.90.5 - 1798.90.55)';
      case 'TX':
        return 'Texas Public Information Act (Tex. Gov\'t Code Chapter 552) & Local Government Code § 370.007';
      case 'FL':
        return 'Florida Sunshine Law (Florida Statutes Chapter 119) & Section 316.0777';
      case 'GA':
        return 'Georgia Open Records Act (O.C.G.A. § 50-18-70 et seq.)';
      case 'NY':
        return 'New York Freedom of Information Law (FOIL, Public Officers Law Article 6)';
      case 'IL':
        return 'Illinois Freedom of Information Act (5 ILCS 140/)';
      case 'WA':
        return 'Washington Public Records Act (RCW 42.56)';
      case 'CO':
        return 'Colorado Open Records Act (CORA, C.R.S. § 24-72-201 et seq.)';
      case 'AZ':
        return 'Arizona Public Records Law (A.R.S. § 39-121 et seq.)';
      default:
        return `${st} Public Records & Open Records Statutes, along with municipal ALPR usage guidelines`;
    }
  };

  const letterText = `[Date: ${new Date().toLocaleDateString('en-US')}]

TO: Public Records Officer / ALPR Data Custodian
RE: Automated License Plate Reader (ALPR) Records & Audit Log Request
TARGET VEHICLE: License Plate [${plate}], Jurisdiction [${state}]
RELEVANT AGENCIES: ${agencies}

Dear Public Records Officer,

Pursuant to the ${getStateStatute(state)}, I hereby submit this formal request for public records and access logs concerning the automated tracking and query history of the motor vehicle identified above.

Specifically, I request copies of:
1. SIGHTING LOGS: Complete metadata records of all ALPR automated optical captures of license plate [${plate}] within the statutory retention window (past 30 to 90 days), including sensor hardware ID, optical node location, lane/direction, and timestamp.
2. INQUIRY & SEARCH AUDIT TRAIL: The mandatory administrative access log indicating each instance where an agency personnel member, investigator, or automated task searched, queried, filtered, or flagged plate [${plate}], including the user identifier, badge or employee number, date/time, and the specific investigative reason entered pursuant to statutory record-keeping requirements.
3. DATA-SHARING DISCLOSURE: A list of any external law enforcement agencies, private entities, or HOA security portals with whom automated captures or hotlist alerts for this vehicle were shared via regional reciprocity networks.
4. EXPUNGEMENT CONFIRMATION: If no active criminal investigation directly links to this vehicle, please confirm that all passive non-investigative optical captures will be purged in compliance with the statutory expiration schedule.

If this request is denied in whole or in part, please specify the statutory exemption upon which you rely. Please provide responsive documents in electronic format via email.

Respectfully submitted,

${requesterName}
Vehicle Registered Owner / Representative
Contact Phone: Available on File
`;

  const scheduleCopiedReset = () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(letterText);
      setCopied(true);
      scheduleCopiedReset();
    } catch {
      try {
        const el = document.createElement('textarea');
        el.value = letterText;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopied(true);
        scheduleCopiedReset();
      } catch {
        setCopied(false);
      }
    }
  };

  const handleDownload = () => {
    const blob = new Blob([letterText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ALPR_Public_Records_Request_${plate}_${state}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFindPortal = async () => {
    const targetAgency =
      agencyQuery.trim() || auditData?.reciprocalAgencies[0]?.agencyName || `${state} Police Records`;
    const token = ++lookupTokenRef.current;
    setWebLoading(true);
    setWebError(null);
    try {
      const response = await fetchFoiaPortalWeb({
        agencyOrCity: targetAgency,
        state,
      });
      if (token !== lookupTokenRef.current) return;
      setWebIntel(response);
    } catch (err) {
      if (token !== lookupTokenRef.current) return;
      setWebError(err instanceof Error ? err.message : 'Unable to locate agency FOIA portal.');
    } finally {
      if (token === lookupTokenRef.current) {
        setWebLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#0d1322] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-5 bg-[#080c14]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Statutory ALPR Public Records & Deletion Request
              </h2>
              <span className="text-xs text-slate-400">
                Formal legal inquiry customized for plate [{plate}] ({state})
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Your Name (Printed on Request):
            </label>
            <input
              type="text"
              value={requesterName}
              onChange={(e) => setRequesterName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#080c14] py-1.5 px-3 text-xs text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-300">
                Generated Legal Notice (Ready to Send):
              </span>
              <span className="text-[11px] font-mono text-cyan-400">
                Governing Law: {getStateStatute(state).split('&')[0]}
              </span>
            </div>
            <textarea
              readOnly
              value={letterText}
              rows={10}
              className="w-full rounded-lg border border-slate-800 bg-[#080c14] p-3 text-xs font-mono text-slate-300 focus:outline-none leading-relaxed select-all"
            />
          </div>

          {/* Live Web Portal Lookup */}
          <div className="rounded-lg border border-slate-800 bg-[#080c14]/70 p-3.5 space-y-2.5">
            <span className="text-xs font-semibold text-slate-200 block">
              Find Official Agency FOIA Portal via Web Search
            </span>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={agencyQuery}
                onChange={(e) => setAgencyQuery(e.target.value)}
                placeholder={auditData?.reciprocalAgencies[0]?.agencyName || `City or Police Dept in ${state}`}
                className="flex-1 rounded-lg border border-slate-700 bg-[#0d1322] py-1.5 px-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleFindPortal}
                disabled={webLoading}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/50 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/50 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>{webLoading ? 'Searching...' : 'Find FOIA Portal'}</span>
              </button>
            </div>
            <WebIntelPanel
              title="Agency Public Records Portal Lookup"
              isLoading={webLoading}
              error={webError}
              data={webIntel}
              onRetry={handleFindPortal}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 p-4 bg-[#080c14]">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy Text'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Request (.txt)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
