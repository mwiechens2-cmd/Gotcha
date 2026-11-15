import React from 'react';
import { Shield, CreditCard } from 'lucide-react';
import { SubscriptionTierType } from '../types';

interface NavbarProps {
  activeTab: 'phone' | 'alpr' | 'inquiry' | 'foia';
  setActiveTab: (tab: 'phone' | 'alpr' | 'inquiry' | 'foia') => void;
  currentTier: SubscriptionTierType;
  onOpenPricing: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentTier,
  onOpenPricing,
}) => {
  const tierLabels: Record<SubscriptionTierType, string> = {
    explorer: 'Explorer (Free)',
    investigator: 'Investigator Pro',
    enterprise: 'Enterprise OSINT',
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#080c14]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-emerald-500/10 border border-cyan-500/40 text-cyan-400">
            <Shield className="h-4 w-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-white font-sans">
            VigilALPR <span className="text-slate-500 font-normal">/</span> TraceID
          </span>
        </div>

        {/* Zone 2: 4-5 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() => setActiveTab('phone')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 cursor-pointer ${
              activeTab === 'phone'
                ? 'border-cyan-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Phone OSINT Trace
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('alpr')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 cursor-pointer ${
              activeTab === 'alpr'
                ? 'border-cyan-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Flock ALPR Audit
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inquiry')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 cursor-pointer ${
              activeTab === 'inquiry'
                ? 'border-cyan-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Surveillance Inquiries
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('foia')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 cursor-pointer ${
              activeTab === 'foia'
                ? 'border-cyan-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            FOIA & Deletion Kit
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenPricing}
            className="group flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/90 px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:bg-slate-800 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <CreditCard className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-slate-400 hidden sm:inline">Tier:</span>
            <span className="font-semibold text-white group-hover:text-cyan-300">
              {tierLabels[currentTier]}
            </span>
            {currentTier === 'explorer' && (
              <span className="ml-1 text-[11px] text-cyan-400 font-semibold underline underline-offset-2">
                Upgrade
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile navigation tab strip */}
      <div className="flex md:hidden overflow-x-auto border-t border-slate-800/60 px-4 py-2 gap-4 text-xs font-medium text-slate-400 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('phone')}
          className={`whitespace-nowrap ${activeTab === 'phone' ? 'text-cyan-400 font-semibold' : ''}`}
        >
          Phone Trace
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('alpr')}
          className={`whitespace-nowrap ${activeTab === 'alpr' ? 'text-cyan-400 font-semibold' : ''}`}
        >
          ALPR Audit
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('inquiry')}
          className={`whitespace-nowrap ${activeTab === 'inquiry' ? 'text-cyan-400 font-semibold' : ''}`}
        >
          Surveillance Inquiries
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('foia')}
          className={`whitespace-nowrap ${activeTab === 'foia' ? 'text-cyan-400 font-semibold' : ''}`}
        >
          FOIA Kit
        </button>
      </div>
    </header>
  );
};
