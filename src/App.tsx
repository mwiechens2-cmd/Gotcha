import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { PhoneTraceView } from './components/PhoneTraceView';
import { AlprAuditView } from './components/AlprAuditView';
import { SurveillanceInquiryView } from './components/SurveillanceInquiryView';
import { PricingModal } from './components/PricingModal';
import { FoiaModal } from './components/FoiaModal';
import { ExportModal } from './components/ExportModal';
import { WebIntelPanel } from './components/WebIntelPanel';
import { SubscriptionTierType, VehicleAlprAuditResult, PhoneLookupResult } from './types';
import { generateVehicleAudit } from './data/mockData';
import { fetchFoiaPortalWeb, WebLookupResponse } from './utils/webLookup';
import { Globe } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'phone' | 'alpr' | 'inquiry' | 'foia'>('phone');
  const [currentTier, setCurrentTier] = useState<SubscriptionTierType>('investigator');
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isFoiaOpen, setIsFoiaOpen] = useState(false);
  const [currentAuditData, setCurrentAuditData] = useState<VehicleAlprAuditResult>(() =>
    generateVehicleAudit('7XYZ892', 'CA')
  );
  const [exportData, setExportData] = useState<
    | { type: 'phone'; content: PhoneLookupResult }
    | { type: 'alpr'; content: VehicleAlprAuditResult }
    | null
  >(null);

  const [foiaAgencySearch, setFoiaAgencySearch] = useState('');
  const [foiaWebLoading, setFoiaWebLoading] = useState(false);
  const [foiaWebError, setFoiaWebError] = useState<string | null>(null);
  const [foiaWebIntel, setFoiaWebIntel] = useState<WebLookupResponse | null>(null);

  const handleOpenFoia = (data?: VehicleAlprAuditResult) => {
    if (data) setCurrentAuditData(data);
    setIsFoiaOpen(true);
  };

  const handleOpenExport = (
    data: { type: 'phone'; content: PhoneLookupResult } | { type: 'alpr'; content: VehicleAlprAuditResult }
  ) => {
    setExportData(data);
  };

  const handleFindFoiaPortal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetAgency =
      foiaAgencySearch.trim() ||
      currentAuditData.reciprocalAgencies[0]?.agencyName ||
      `${currentAuditData.state} Police Records`;

    setFoiaWebLoading(true);
    setFoiaWebError(null);
    try {
      const response = await fetchFoiaPortalWeb({
        agencyOrCity: targetAgency,
        state: currentAuditData.state,
      });
      setFoiaWebIntel(response);
    } catch (err) {
      setFoiaWebError(err instanceof Error ? err.message : 'Unable to locate FOIA portal.');
    } finally {
      setFoiaWebLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Bar Navigation (Strict 3-Zone Contract) */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentTier={currentTier}
        onOpenPricing={() => setIsPricingOpen(true)}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 sm:px-6">
        {activeTab === 'phone' && (
          <PhoneTraceView
            currentTier={currentTier}
            onOpenPricing={() => setIsPricingOpen(true)}
            onOpenExport={handleOpenExport}
          />
        )}

        {activeTab === 'alpr' && (
          <AlprAuditView
            currentTier={currentTier}
            activeAudit={currentAuditData}
            onAuditChange={setCurrentAuditData}
            onOpenPricing={() => setIsPricingOpen(true)}
            onOpenFoia={handleOpenFoia}
            onOpenExport={handleOpenExport}
          />
        )}

        {activeTab === 'inquiry' && (
          <SurveillanceInquiryView
            currentTier={currentTier}
            activeAudit={currentAuditData}
            onOpenFoia={() => handleOpenFoia()}
          />
        )}

        {activeTab === 'foia' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Automated License Plate Reader (ALPR) Public Records Kit
              </h1>
              <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
                Empowering vehicle owners to submit legally grounded Freedom of Information Act (FOIA)
                and open records inquiries to municipal police departments and HOA boards.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-white">
                  How ALPR Data Rights Work in the United States
                </h2>
                <span className="text-xs font-mono text-cyan-400">
                  Active Target: {currentAuditData.plateNumber} ({currentAuditData.state})
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Automated License Plate Readers (including Flock Safety Falcon cameras, Motorola Vigilant nodes,
                and police cruiser scanners) capture hundreds of millions of optical scans per month.
                Under statutory open records acts, individuals have the legal right to inspect public agency records
                and verify that non-investigative captures are expunged within statutory retention periods.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
                <div className="p-4 rounded-lg border border-slate-800 bg-[#080c14]/70 space-y-2">
                  <span className="font-semibold text-cyan-400 block">California Senate Bill 34</span>
                  <p className="text-slate-400 leading-relaxed">
                    Requires every public agency operating an ALPR system to adopt an ALPR privacy policy,
                    maintain audit logs of who queries the data, and restrict unauthorized data sharing.
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-slate-800 bg-[#080c14]/70 space-y-2">
                  <span className="font-semibold text-cyan-400 block">Open Records & Sunshine Laws</span>
                  <p className="text-slate-400 leading-relaxed">
                    Most state statutes (such as the Texas Public Information Act or Florida Chapter 119)
                    permit vehicle owners to inspect records maintained by police departments concerning their property.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsFoiaOpen(true)}
                  className="rounded-lg bg-cyan-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer"
                >
                  Launch Customized Request Letter Generator ({currentAuditData.plateNumber})
                </button>
              </div>
            </div>

            {/* Live Web FOIA Portal Finder */}
            <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Find Your Police Department Public Records Portal
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Search the live web for the official FOIA / open records submission link and clerk contact for any city or law enforcement agency.
                </p>
              </div>

              <form onSubmit={handleFindFoiaPortal} className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={foiaAgencySearch}
                  onChange={(e) => setFoiaAgencySearch(e.target.value)}
                  placeholder={
                    currentAuditData.reciprocalAgencies[0]?.agencyName ||
                    `Enter city or police agency in ${currentAuditData.state}`
                  }
                  className="flex-1 rounded-lg border border-slate-700 bg-[#080c14] py-2 px-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={foiaWebLoading}
                  className="flex items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-950/50 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/50 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>{foiaWebLoading ? 'Searching Web...' : 'Locate Agency Portal'}</span>
                </button>
              </form>

              <WebIntelPanel
                title="Live Web FOIA Portal Results"
                isLoading={foiaWebLoading}
                error={foiaWebError}
                data={foiaWebIntel}
                onRetry={() => handleFindFoiaPortal()}
                emptyPrompt="Enter a city, county, or police department above and click 'Locate Agency Portal' to find official open-records submission URLs."
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#080c14] py-8 mt-12 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white tracking-tight">VigilALPR / TraceID</span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span>Investigative Intelligence & Surveillance Audit System</span>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-slate-400 text-xs">
            <button
              type="button"
              onClick={() => setIsPricingOpen(true)}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Subscription Plans
            </button>
            <button
              type="button"
              onClick={() => setIsFoiaOpen(true)}
              className="hover:text-white transition-colors cursor-pointer"
            >
              FOIA Request Generator
            </button>
            <span className="text-slate-400">
              Zero-Log Privacy Protocol
            </span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        currentTier={currentTier}
        onSelectTier={(tier) => setCurrentTier(tier)}
      />

      <FoiaModal
        isOpen={isFoiaOpen}
        onClose={() => setIsFoiaOpen(false)}
        auditData={currentAuditData}
      />

      <ExportModal
        isOpen={!!exportData}
        onClose={() => setExportData(null)}
        exportData={exportData}
      />
    </div>
  );
}
