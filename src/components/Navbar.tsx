import React from 'react';
import { Shield, CreditCard, LogIn, LogOut } from 'lucide-react';
import { SubscriptionTierType } from '../types';
import { useFirebase } from '../contexts/FirebaseContext';

export type AppTab = 'phone' | 'alpr' | 'inquiry' | 'foia' | 'watchlist';

interface NavbarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  currentTier: SubscriptionTierType;
  onOpenPricing: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentTier,
  onOpenPricing,
}) => {
  const { user, authLoading, signInWithGoogle, signOutUser } = useFirebase();

  const tierLabels: Record<SubscriptionTierType, string> = {
    explorer: 'Explorer',
    investigator: 'Investigator Pro',
    enterprise: 'Enterprise OSINT',
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#080c14]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => setActiveTab('phone')}
          className="flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer text-left group"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-emerald-500/10 border border-cyan-500/40 text-cyan-400 group-hover:border-cyan-400 transition-colors">
            <Shield className="h-4 w-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-white font-sans">
            VigilALPR <span className="text-slate-500 font-normal">/</span> TraceID
          </span>
        </button>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() => setActiveTab('phone')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 cursor-pointer ${
              activeTab === 'phone'
                ? 'border-cyan-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Phone Trace
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
            ALPR Audit
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
            Inquiries
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
            FOIA Kit
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('watchlist')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 cursor-pointer ${
              activeTab === 'watchlist'
                ? 'border-cyan-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Watchlist
          </button>
        </nav>

        {/* Zone 3: Tier & Account controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenPricing}
            className="group flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:bg-slate-800 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <CreditCard className="h-3.5 w-3.5 text-cyan-400" />
            <span className="font-semibold text-white group-hover:text-cyan-300">
              {tierLabels[currentTier]}
            </span>
          </button>

          {user ? (
            <button
              type="button"
              onClick={() => void signOutUser()}
              title={`Signed in as ${user.email || 'Google User'} — Click to sign out`}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span className="max-w-[96px] truncate hidden sm:inline">
                {user.displayName?.split(' ')[0] || 'Account'}
              </span>
              <LogOut className="h-3.5 w-3.5 text-slate-400" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={authLoading}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>{authLoading ? 'Signing In...' : 'Sign In'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile navigation tab strip */}
      <div className="flex lg:hidden overflow-x-auto border-t border-slate-800/60 px-4 py-2 gap-4 text-xs font-medium text-slate-400 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('phone')}
          className={`whitespace-nowrap shrink-0 ${activeTab === 'phone' ? 'text-cyan-400 font-semibold' : ''}`}
        >
          Phone Trace
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('alpr')}
          className={`whitespace-nowrap shrink-0 ${activeTab === 'alpr' ? 'text-cyan-400 font-semibold' : ''}`}
        >
          ALPR Audit
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('inquiry')}
          className={`whitespace-nowrap shrink-0 ${activeTab === 'inquiry' ? 'text-cyan-400 font-semibold' : ''}`}
        >
          Inquiries
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('foia')}
          className={`whitespace-nowrap shrink-0 ${activeTab === 'foia' ? 'text-cyan-400 font-semibold' : ''}`}
        >
          FOIA Kit
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('watchlist')}
          className={`whitespace-nowrap shrink-0 ${activeTab === 'watchlist' ? 'text-cyan-400 font-semibold' : ''}`}
        >
          Watchlist
        </button>
      </div>
    </header>
  );
};
