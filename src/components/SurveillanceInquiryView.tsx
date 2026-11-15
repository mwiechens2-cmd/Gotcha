import React, { useState } from 'react';
import {
  Eye,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Building,
  FileCheck,
  Search,
  Filter,
  Download,
  Info,
  Calendar,
  Lock,
} from 'lucide-react';
import { AlprQueryAuditRecord, SubscriptionTierType } from '../types';

interface SurveillanceInquiryViewProps {
  currentTier: SubscriptionTierType;
  onOpenPricing: () => void;
  onOpenFoia: () => void;
}

const SAMPLE_INQUIRIES: AlprQueryAuditRecord[] = [
  {
    queryId: 'QRY-2026-LAPD-88192',
    timestamp: '2026-11-10T22:15:40-08:00',
    requestingAgency: 'Los Angeles Police Department (Valley Traffic Div)',
    agencyType: 'Municipal Police',
    queryReason: 'Intersection Canvas: Automated Geo-Fence Correlation (0.5 mi radius of reported incident)',
    searchRadiusMiles: 0.5,
    officerBadgeOrCaseId: 'Badge #4109 / Ref: IR-2026-77821',
    matchedCriteria: 'Plate exact match on northbound camera sensor',
    alertDisposition: 'Active Vehicle Canvass',
  },
  {
    queryId: 'QRY-2026-LASD-04122',
    timestamp: '2026-11-04T11:02:18-08:00',
    requestingAgency: 'Los Angeles County Sheriff Dept (West Hollywood Station)',
    agencyType: 'County Sheriff',
    queryReason: 'Regional ALPR Sharing Audit: Routine Stolen Vehicle & BOLO Hotlist Sweep',
    searchRadiusMiles: 5.0,
    officerBadgeOrCaseId: 'Auto-Task Scheduler / Unit ALPR-8',
    matchedCriteria: 'Daily NCIC Hotlist Cross-Reference',
    alertDisposition: 'Hotlist Cross-Check Negative',
  },
  {
    queryId: 'QRY-2026-TX-SYNC-1198',
    timestamp: '2026-11-10T04:00:00-06:00',
    requestingAgency: 'Texas Department of Public Safety (DPS ALPR Gateway)',
    agencyType: 'State Highway Patrol',
    queryReason: 'Daily Automated NCIC/TCIC Clean Sync Check (Passive Batch)',
    searchRadiusMiles: 0,
    officerBadgeOrCaseId: 'Automated Daemon / TCIC-ALPR',
    matchedCriteria: 'System Batch Verification',
    alertDisposition: 'Hotlist Cross-Check Negative',
  },
  {
    queryId: 'QRY-2026-FL-HOA-9921',
    timestamp: '2026-11-09T08:14:00-05:00',
    requestingAgency: 'Biscayne Gated Communities Security Consortium',
    agencyType: 'HOA Security',
    queryReason: 'Community Perimeter Access Log: Authorized Resident Decal Audit',
    searchRadiusMiles: 1.0,
    officerBadgeOrCaseId: 'Sec-Mgr #104 / Access Patrol',
    matchedCriteria: 'Registered Plate Verification',
    alertDisposition: 'Inquiry Logged',
  },
];

export const SurveillanceInquiryView: React.FC<SurveillanceInquiryViewProps> = ({
  currentTier,
  onOpenPricing,
  onOpenFoia,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');

  const filteredInquiries = SAMPLE_INQUIRIES.filter((inq) => {
    const matchesSearch =
      inq.requestingAgency.toLowerCase().includes(searchFilter.toLowerCase()) ||
      inq.queryReason.toLowerCase().includes(searchFilter.toLowerCase()) ||
      inq.queryId.toLowerCase().includes(searchFilter.toLowerCase());

    if (filterType === 'all') return matchesSearch;
    if (filterType === 'police') return matchesSearch && (inq.agencyType === 'Municipal Police' || inq.agencyType === 'County Sheriff');
    if (filterType === 'hoa') return matchesSearch && inq.agencyType === 'HOA Security';
    if (filterType === 'hotlist') return matchesSearch && inq.alertDisposition.includes('Hotlist');
    return matchesSearch;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Surveillance Inquiries & Search Audits
        </h1>
        <p className="mt-1.5 text-sm text-slate-400 max-w-3xl leading-relaxed">
          Detailed transparency ledger of when, why, and by whom vehicles have been searched or investigated
          across regional Automated License Plate Reader (ALPR) and Flock camera networks.
        </p>
      </div>

      {/* Educational Briefing Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-4.5 space-y-1.5">
          <span className="font-semibold text-cyan-400 block">1. Geo-Fence Canvas Searches</span>
          <p className="text-slate-300 leading-relaxed">
            When an incident is reported, detectives query all vehicles recorded within a designated radius
            (typically 0.25 to 1.0 mile) during a specific time window.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-4.5 space-y-1.5">
          <span className="font-semibold text-emerald-400 block">2. Hotlist Cross-Reference</span>
          <p className="text-slate-300 leading-relaxed">
            Automated syncs cross-check daily against state and federal databases (NCIC, Amber Alerts,
            unpaid toll/registration suspensions, or stolen vehicle lists).
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-4.5 space-y-1.5">
          <span className="font-semibold text-amber-400 block">3. Statutory Audit Requirement</span>
          <p className="text-slate-300 leading-relaxed">
            Statutes such as California SB 34 require law enforcement agencies to record the name of the user,
            the date, and the specific investigative purpose for every ALPR search.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Interactive Segmented Filter Controls */}
        <div className="flex items-center gap-1 p-1 bg-[#080c14] border border-slate-800 rounded-lg w-full sm:w-auto overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Inquiries
          </button>
          <button
            type="button"
            onClick={() => setFilterType('police')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              filterType === 'police'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Police & Sheriff
          </button>
          <button
            type="button"
            onClick={() => setFilterType('hoa')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              filterType === 'hoa'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            HOA Security
          </button>
          <button
            type="button"
            onClick={() => setFilterType('hotlist')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              filterType === 'hotlist'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Hotlist Checks
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter agency or case ID..."
            className="w-full rounded-lg border border-slate-700 bg-[#080c14] py-1.5 pl-8 pr-3 text-xs font-mono text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Inquiry Logs Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0d1322] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-[#080c14]/90 text-slate-400 font-mono">
                <th className="py-3 px-4 font-semibold">Query ID & Timestamp</th>
                <th className="py-3 px-4 font-semibold">Requesting Agency</th>
                <th className="py-3 px-4 font-semibold">Investigative Grounds / Reason</th>
                <th className="py-3 px-4 font-semibold">Officer / Case Ref</th>
                <th className="py-3 px-4 font-semibold">Disposition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredInquiries.map((inq) => (
                <tr key={inq.queryId} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-slate-200 whitespace-nowrap">
                    <span className="font-semibold text-cyan-400 block">{inq.queryId}</span>
                    <span className="text-[11px] text-slate-500 tabular-nums">
                      {new Date(inq.timestamp).toLocaleString()}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-white block">{inq.requestingAgency}</span>
                    <span className="text-[11px] text-slate-400 font-mono">{inq.agencyType}</span>
                  </td>
                  <td className="py-3.5 px-4 max-w-sm">
                    <p className="text-slate-300 leading-relaxed text-xs">{inq.queryReason}</p>
                    {inq.searchRadiusMiles ? (
                      <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                        Search Radius: {inq.searchRadiusMiles} miles
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                    {inq.officerBadgeOrCaseId}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                        inq.alertDisposition === 'Active Vehicle Canvass'
                          ? 'border-amber-800/80 bg-amber-950/40 text-amber-300 font-semibold'
                          : inq.alertDisposition === 'Hotlist Cross-Check Negative'
                          ? 'border-emerald-800/80 bg-emerald-950/40 text-emerald-300'
                          : 'border-slate-700 bg-slate-800/50 text-slate-300'
                      }`}
                    >
                      {inq.alertDisposition}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transparency Action Callout */}
      <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white">
            Exercise Your Statutory Privacy Rights
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 max-w-2xl leading-relaxed">
            If your vehicle has been captured or investigated without formal cause, you are legally entitled to
            submit an open records request to inspect the audit log or request statutory expungement.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenFoia}
          className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer shrink-0"
        >
          <FileCheck className="h-4 w-4" />
          <span>Open FOIA Toolkit</span>
        </button>
      </div>
    </div>
  );
};
