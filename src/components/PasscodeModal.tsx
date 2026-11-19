import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck, X } from 'lucide-react';
import { verifyAccessPasscode } from '../utils/webLookup';

interface PasscodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlocked: () => void;
  customSecretConfigured: boolean;
  demoPasscode: string | null;
}

export const PasscodeModal: React.FC<PasscodeModalProps> = ({
  isOpen,
  onClose,
  onUnlocked,
  customSecretConfigured,
  demoPasscode,
}) => {
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setPasscode('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError('Enter the investigator access passcode.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await verifyAccessPasscode(passcode.trim());
      onUnlocked();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify passcode.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-[#0d1322] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-5 bg-[#080c14]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">OSINT Access Passcode</h2>
              <span className="text-xs text-slate-400">
                {customSecretConfigured
                  ? 'Verified against configured server secret'
                  : 'Session vault gate for sensitive dossiers'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
            aria-label="Close passcode dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <p className="text-slate-300 leading-relaxed">
            Enter the access passcode to unredact subscriber identity registries, physical address
            histories, breach exposures, officer badge IDs, and PDF/JSON dossier exports.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="osint-passcode-input" className="block font-semibold text-slate-200">
              Access Passcode
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock className="h-3.5 w-3.5" />
              </div>
              <input
                id="osint-passcode-input"
                type={showPasscode ? 'text' : 'password'}
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (error) setError(null);
                }}
                autoFocus
                placeholder="Enter passcode..."
                className="w-full rounded-lg border border-slate-700 bg-[#080c14] py-2.5 pl-9 pr-10 text-sm font-mono text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={() => setShowPasscode((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white cursor-pointer"
                aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
              >
                {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-800/60 bg-rose-950/35 px-3 py-2 text-rose-300">
              {error}
            </div>
          )}

          {!customSecretConfigured && demoPasscode && (
            <div className="rounded-lg border border-slate-800 bg-[#080c14]/80 px-3 py-2.5 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span>
                  Demo passcode active:{' '}
                  <strong className="font-mono text-cyan-300 select-all">{demoPasscode}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setPasscode(demoPasscode)}
                  className="text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                >
                  Use Demo Code
                </button>
              </div>
              <p className="text-slate-500">
                Set <code className="text-slate-300">OSINT_ACCESS_SECRET</code> in Settings &gt; Secrets to enforce a custom secret.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 font-medium text-slate-300 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{submitting ? 'Verifying...' : 'Unlock OSINT Tools'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
