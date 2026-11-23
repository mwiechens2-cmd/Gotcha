import React, { useEffect, useRef, useState } from 'react';
import { X, Check, ShieldCheck } from 'lucide-react';
import { SubscriptionTierType } from '../types';
import { SUBSCRIPTION_PLANS } from '../data/mockData';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: SubscriptionTierType;
  onSelectTier: (tier: SubscriptionTierType) => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  currentTier,
  onSelectTier,
}) => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [justUpgraded, setJustUpgraded] = useState<SubscriptionTierType | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setJustUpgraded(null);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const handleActivate = (tierId: SubscriptionTierType) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onSelectTier(tierId);
    setJustUpgraded(tierId);
    timerRef.current = setTimeout(() => {
      setJustUpgraded(null);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-700 bg-[#0d1322] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-5 bg-[#080c14]">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Intelligence Subscription & Fee Tiers
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select your investigative tier to unlock unredacted phone dossiers and ALPR surveillance records.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cadence Toggle */}
        <div className="flex items-center justify-center py-4 border-b border-slate-800/80 bg-[#0a0f1b]">
          <div className="flex items-center gap-1 p-1 bg-[#080c14] border border-slate-800 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setIsAnnual(false)}
              className={`px-3 py-1 font-medium rounded-md transition-colors cursor-pointer ${
                !isAnnual ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setIsAnnual(true)}
              className={`px-3 py-1 font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                isAnnual ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Annual Billing</span>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/70 border border-cyan-800/60 px-1 rounded">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-5">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrent = currentTier === plan.id;
            const price = isAnnual ? plan.priceAnnual : plan.priceMonthly;

            return (
              <div
                key={plan.id}
                className={`rounded-xl border p-5 flex flex-col justify-between transition-all relative ${
                  plan.popular
                    ? 'border-cyan-500/60 bg-gradient-to-b from-[#111c33] to-[#0c1220] shadow-xl shadow-cyan-950/20'
                    : 'border-slate-800 bg-[#090d18]'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300 bg-cyan-950 border border-cyan-500/50 px-2.5 py-0.5 rounded-full">
                    Most Popular
                  </span>
                )}

                <div>
                  <div className="flex justify-between items-baseline">
                    <h3 className="text-base font-bold text-white">{plan.name}</h3>
                    {isCurrent && (
                      <span className="text-[11px] font-mono font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded">
                        Active
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 mt-1 min-h-[32px] leading-relaxed">
                    {plan.description}
                  </p>

                  {/* Price */}
                  <div className="my-4 pb-4 border-b border-slate-800/80">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold font-mono text-white tabular-nums">
                        ${price}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {plan.priceMonthly === 0 ? 'forever' : isAnnual ? '/ month (billed yearly)' : '/ month'}
                      </span>
                    </div>
                  </div>

                  {/* Features List */}
                  <ul className="space-y-2.5 text-xs text-slate-300 mb-6">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <span className="leading-tight">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Activation Button */}
                <div>
                  <button
                    type="button"
                    onClick={() => handleActivate(plan.id)}
                    disabled={isCurrent}
                    className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isCurrent
                        ? 'bg-slate-800/80 text-slate-400 border border-slate-700 cursor-default'
                        : plan.popular
                        ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950/60'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                  >
                    {justUpgraded === plan.id ? (
                      <span className="text-emerald-300 flex items-center gap-1">
                        <Check className="h-4 w-4" /> Activated!
                      </span>
                    ) : isCurrent ? (
                      'Current Plan'
                    ) : (
                      `Switch to ${plan.name}`
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Guarantee footer */}
        <div className="border-t border-slate-800 p-4 bg-[#080c14] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            <span>Encrypted zero-log searches · Instant digital activation · Cancel anytime</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Enterprise procurement invoice available upon request
          </span>
        </div>
      </div>
    </div>
  );
};
