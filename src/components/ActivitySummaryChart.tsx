import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { SavedAlprAuditRecord, SavedPhoneLookupRecord } from '../types';

export interface ActivityEvent {
  type: 'phone' | 'alpr';
  targetKey: string;
  timestampMs: number;
}

interface ActivitySummaryChartProps {
  sessionEvents: ActivityEvent[];
  savedPhoneLookups: SavedPhoneLookupRecord[];
  savedAlprAudits: SavedAlprAuditRecord[];
  dataLoading?: boolean;
}

interface DailyPoint {
  dateKey: string;
  label: string;
  fullDate: string;
  phoneTraces: number;
  alprAudits: number;
  total: number;
}

function toLocalDateKey(ms: number): string {
  const d = new Date(ms);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveTimestampMs(ts: unknown): number {
  if (
    ts &&
    typeof ts === 'object' &&
    'toMillis' in ts &&
    typeof (ts as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof ts === 'number' && Number.isFinite(ts)) {
    return ts;
  }
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey?: string;
    value?: number;
    payload?: DailyPoint;
  }>;
}

const ChartTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-slate-700 bg-[#080c14]/95 px-3 py-2.5 text-xs shadow-xl">
      <p className="font-mono font-semibold text-white mb-1.5">{point.fullDate}</p>
      <div className="space-y-1 font-mono tabular-nums">
        <div className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="h-2 w-2 rounded-xs bg-cyan-500 inline-block" />
            Phone Traces
          </span>
          <span className="font-semibold text-cyan-300">{point.phoneTraces}</span>
        </div>
        <div className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="h-2 w-2 rounded-xs bg-emerald-500 inline-block" />
            ALPR Audits
          </span>
          <span className="font-semibold text-emerald-300">{point.alprAudits}</span>
        </div>
        <div className="flex items-center justify-between gap-5 border-t border-slate-800 pt-1 mt-1">
          <span className="text-slate-400">Daily Total</span>
          <span className="font-bold text-white">{point.total}</span>
        </div>
      </div>
    </div>
  );
};

export const ActivitySummaryChart: React.FC<ActivitySummaryChartProps> = ({
  sessionEvents,
  savedPhoneLookups,
  savedAlprAudits,
  dataLoading = false,
}) => {
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');
  const [showPhones, setShowPhones] = useState(true);
  const [showAlpr, setShowAlpr] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { dailyData, totalPhones, totalAlpr, peakDaily } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days: DailyPoint[] = [];
    const byKey = new Map<string, DailyPoint>();

    for (let offset = 29; offset >= 0; offset--) {
      const d = new Date(todayStart);
      d.setDate(todayStart.getDate() - offset);
      const dateKey = toLocalDateKey(d.getTime());
      const point: DailyPoint = {
        dateKey,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: d.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        phoneTraces: 0,
        alprAudits: 0,
        total: 0,
      };
      days.push(point);
      byKey.set(dateKey, point);
    }

    const seenPhones = new Set<string>();
    const seenAlprs = new Set<string>();

    // Count persisted phone traces from Firestore within last 30 days
    for (const row of savedPhoneLookups) {
      const dateKey = toLocalDateKey(resolveTimestampMs(row.savedAt));
      const bucket = byKey.get(dateKey);
      if (!bucket) continue;
      const dedupeKey = `${dateKey}::${row.phoneNumber.replace(/\D/g, '')}`;
      if (!seenPhones.has(dedupeKey)) {
        seenPhones.add(dedupeKey);
        bucket.phoneTraces += 1;
      }
    }

    // Count persisted ALPR audits from Firestore within last 30 days
    for (const row of savedAlprAudits) {
      const dateKey = toLocalDateKey(resolveTimestampMs(row.savedAt));
      const bucket = byKey.get(dateKey);
      if (!bucket) continue;
      const dedupeKey = `${dateKey}::${row.state}_${row.plateNumber.toUpperCase()}`;
      if (!seenAlprs.has(dedupeKey)) {
        seenAlprs.add(dedupeKey);
        bucket.alprAudits += 1;
      }
    }

    // Merge live in-session traces and plate audits without double-counting saved items
    for (const evt of sessionEvents) {
      const dateKey = toLocalDateKey(evt.timestampMs);
      const bucket = byKey.get(dateKey);
      if (!bucket) continue;
      const dedupeKey = `${dateKey}::${evt.targetKey}`;
      if (evt.type === 'phone') {
        if (!seenPhones.has(dedupeKey)) {
          seenPhones.add(dedupeKey);
          bucket.phoneTraces += 1;
        }
      } else {
        if (!seenAlprs.has(dedupeKey)) {
          seenAlprs.add(dedupeKey);
          bucket.alprAudits += 1;
        }
      }
    }

    let phoneSum = 0;
    let alprSum = 0;
    let peak = 0;
    for (const point of days) {
      point.total = point.phoneTraces + point.alprAudits;
      phoneSum += point.phoneTraces;
      alprSum += point.alprAudits;
      if (point.total > peak) peak = point.total;
    }

    return {
      dailyData: days,
      totalPhones: phoneSum,
      totalAlpr: alprSum,
      peakDaily: peak,
    };
  }, [savedAlprAudits, savedPhoneLookups, sessionEvents]);

  return (
    <section
      aria-label="30-day activity summary chart"
      className="rounded-xl border border-slate-800 bg-[#0d1322] p-5 space-y-4"
    >
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold text-white tracking-tight">
              30-Day Investigation Activity Summary
            </h2>
            <span className="text-xs font-mono text-slate-400 tabular-nums">
              {dailyData[0]?.label} – {dailyData[dailyData.length - 1]?.label}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono tabular-nums">
            <span className="text-slate-300">
              Phone Traces: <strong className="text-cyan-400">{totalPhones}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span className="text-slate-300">
              ALPR Audits: <strong className="text-emerald-400">{totalAlpr}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span className="text-slate-300">
              Combined 30d: <strong className="text-white">{totalPhones + totalAlpr}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span className="text-slate-400">
              Daily Peak: <strong className="text-slate-200">{peakDaily}</strong>
            </span>
          </div>
        </div>

        {/* Interactive Chart Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Series Toggle Buttons */}
          <button
            type="button"
            onClick={() => setShowPhones((prev) => (prev && !showAlpr ? true : !prev))}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              showPhones
                ? 'border-cyan-500/40 bg-cyan-950/40 text-cyan-200'
                : 'border-slate-800 bg-[#080c14] text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className={`h-2 w-2 rounded-xs ${showPhones ? 'bg-cyan-500' : 'bg-slate-600'}`} />
            <span>Phone Traces</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAlpr((prev) => (prev && !showPhones ? true : !prev))}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              showAlpr
                ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                : 'border-slate-800 bg-[#080c14] text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className={`h-2 w-2 rounded-xs ${showAlpr ? 'bg-emerald-500' : 'bg-slate-600'}`} />
            <span>ALPR Audits</span>
          </button>

          {/* Chart Type Switcher */}
          <div className="flex items-center gap-1 p-0.5 bg-[#080c14] border border-slate-800 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setChartType('bar')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                chartType === 'bar' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Bars</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType('area')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                chartType === 'area' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Trend</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#080c14] px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                <span>Show</span>
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span>Hide</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      {!isCollapsed && (
        <div className="pt-1">
          {dataLoading ? (
            <div className="h-52 w-full rounded-lg border border-slate-800/80 bg-[#080c14]/60 animate-pulse" />
          ) : (
            <div className="h-52 w-full rounded-lg border border-slate-800/80 bg-[#080c14]/60 px-2 pt-3 pb-1">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'bar' ? (
                  <BarChart
                    data={dailyData}
                    margin={{ top: 6, right: 12, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                      tickLine={false}
                      axisLine={{ stroke: '#1e293b' }}
                      interval={4}
                    />
                    <YAxis
                      allowDecimals={false}
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                      tickLine={false}
                      axisLine={false}
                      width={34}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                    />
                    {showPhones && (
                      <Bar
                        dataKey="phoneTraces"
                        name="Phone Traces"
                        fill="#06b6d4"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={18}
                      />
                    )}
                    {showAlpr && (
                      <Bar
                        dataKey="alprAudits"
                        name="ALPR Audits"
                        fill="#10b981"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={18}
                      />
                    )}
                  </BarChart>
                ) : (
                  <AreaChart
                    data={dailyData}
                    margin={{ top: 6, right: 12, left: -12, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="phoneTraceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="alprAuditFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                      tickLine={false}
                      axisLine={{ stroke: '#1e293b' }}
                      interval={4}
                    />
                    <YAxis
                      allowDecimals={false}
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                      tickLine={false}
                      axisLine={false}
                      width={34}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    {showPhones && (
                      <Area
                        type="monotone"
                        dataKey="phoneTraces"
                        name="Phone Traces"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        fill="url(#phoneTraceFill)"
                      />
                    )}
                    {showAlpr && (
                      <Area
                        type="monotone"
                        dataKey="alprAudits"
                        name="ALPR Audits"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#alprAuditFill)"
                      />
                    )}
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
