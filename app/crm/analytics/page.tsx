'use client';

import { useEffect, useState } from 'react';
import { getFunnelData, getSourceAttribution, getCrewFunnel } from '@/lib/api';
import type { FunnelData, SourceData, CrewFunnelStage } from '@/lib/api';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// ── colour helpers ──────────────────────────────────────────────────────────
const FUNNEL_COLORS: Record<string, string> = {
  CALLED: 'bg-blue-500',
  INFO_COLLECTED: 'bg-indigo-500',
  LINK_SENT: 'bg-violet-500',
  PAID: 'bg-green-500',
  MATCHED: 'bg-emerald-500',
  FAILED: 'bg-red-500',
};

const FUNNEL_TEXT_COLORS: Record<string, string> = {
  CALLED: 'text-blue-400',
  INFO_COLLECTED: 'text-indigo-400',
  LINK_SENT: 'text-violet-400',
  PAID: 'text-green-400',
  MATCHED: 'text-emerald-400',
  FAILED: 'text-red-400',
};

const COHORT_COLORS: Record<string, string> = {
  MATCHED: 'bg-emerald-500',
  IN_COHORT: 'bg-cyan-500',
  INVITED: 'bg-sky-500',
  CONFIRMED: 'bg-green-500',
  ATTENDED: 'bg-lime-500',
};

const COHORT_TEXT_COLORS: Record<string, string> = {
  MATCHED: 'text-emerald-400',
  IN_COHORT: 'text-cyan-400',
  INVITED: 'text-sky-400',
  CONFIRMED: 'text-green-400',
  ATTENDED: 'text-lime-400',
};

const SOURCE_COLORS: Record<string, string> = {
  CALL: 'border-blue-500/30 text-blue-300',
  SMS: 'border-violet-500/30 text-violet-300',
  WEB_FORM: 'border-amber-500/30 text-amber-300',
  WEB_WAITLIST: 'border-emerald-500/30 text-emerald-300',
};

function formatLabel(s: string) {
  return s.replace(/_/g, ' ');
}

function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

// ── main page ───────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [sources, setSources] = useState<SourceData[]>([]);
  const [crewStages, setCohortStages] = useState<CrewFunnelStage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [f, s, c] = await Promise.all([
        getFunnelData(),
        getSourceAttribution(),
        getCrewFunnel(),
      ]);
      setFunnel(f);
      setSources(s);
      setCohortStages(c.stages || []);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const maxFunnelCount = funnel
    ? Math.max(...funnel.stages.map((s) => s.count), 1)
    : 1;
  const maxCrewCount = Math.max(...crewStages.map((s) => s.count), 1);

  return (
    <div className="min-h-screen bg-black neon-grid-bg text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Analytics</h1>
          <Button
            variant="outline"
            onClick={fetchAll}
            className="border-white/[0.15] text-white/60 hover:bg-white/[0.06]"
          >
            Refresh
          </Button>
        </div>

        {loading ? (
          <p className="text-white/30 text-center py-16">Loading...</p>
        ) : (
          <>
            {/* ── Section 1: Lead Funnel ─────────────────────────────────── */}
            <Card className="neon-card">
              <CardHeader>
                <CardTitle className="text-lg">Lead Funnel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {funnel?.stages.map((stage, i) => {
                  const widthPct = Math.max((stage.count / maxFunnelCount) * 100, 4);
                  const color = FUNNEL_COLORS[stage.status] || 'bg-white/20';
                  const textColor = FUNNEL_TEXT_COLORS[stage.status] || 'text-white/60';
                  return (
                    <div key={stage.status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium uppercase tracking-wider ${textColor}`}>
                          {formatLabel(stage.status)}
                        </span>
                        <span className="text-sm mono-num text-white/60">{stage.count}</span>
                      </div>
                      <div className="w-full h-7 bg-white/[0.04] rounded overflow-hidden">
                        <div
                          className={`h-full ${color} rounded transition-all duration-500`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      {/* Conversion rate to next stage */}
                      {i === 1 && funnel.conversionRates && (
                        <p className="text-xs text-white/30 mt-1 pl-1">
                          Info &rarr; Link: {pct(funnel.conversionRates.infoToLink)}
                        </p>
                      )}
                      {i === 2 && funnel.conversionRates && (
                        <p className="text-xs text-white/30 mt-1 pl-1">
                          Link &rarr; Paid: {pct(funnel.conversionRates.linkToPaid)}
                        </p>
                      )}
                      {i === 3 && funnel.conversionRates && (
                        <p className="text-xs text-white/30 mt-1 pl-1">
                          Paid &rarr; Matched: {pct(funnel.conversionRates.paidToMatched)}
                        </p>
                      )}
                    </div>
                  );
                })}

                {/* Overall */}
                {funnel?.conversionRates && (
                  <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between">
                    <span className="text-sm text-white/40">Overall Conversion</span>
                    <span className="text-lg font-bold mono-num text-emerald-400">
                      {pct(funnel.conversionRates.overallConversion)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Section 2: Source Attribution ───────────────────────────── */}
            <div>
              <h2 className="text-lg font-bold mb-4">Source Attribution</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {sources.map((src) => {
                  const colorCls = SOURCE_COLORS[src.source] || 'border-white/[0.12] text-white/60';
                  return (
                    <Card key={src.source} className="neon-card">
                      <CardHeader className="pb-2">
                        <CardTitle className={`text-sm font-semibold uppercase tracking-wider ${colorCls.split(' ')[1]}`}>
                          {formatLabel(src.source)}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-white/40 text-xs">Total</span>
                          <span className="mono-num text-white font-bold text-lg">{src.total}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/40 text-xs">Matched</span>
                          <span className="mono-num text-emerald-400 font-bold text-lg">{src.matched}</span>
                        </div>
                        <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between">
                          <span className="text-white/40 text-xs">Conversion</span>
                          <span className="mono-num text-white font-bold">
                            {src.conversionRate.toFixed(1)}%
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {sources.length === 0 && (
                  <p className="text-white/30 col-span-4 text-center py-8">No source data available.</p>
                )}
              </div>
            </div>

            {/* ── Section 3: Crew Funnel ────────────────────────────────── */}
            <Card className="neon-card">
              <CardHeader>
                <CardTitle className="text-lg">Crew Funnel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {crewStages.map((stage) => {
                  const widthPct = Math.max((stage.count / maxCrewCount) * 100, 4);
                  const color = COHORT_COLORS[stage.stage] || 'bg-white/20';
                  const textColor = COHORT_TEXT_COLORS[stage.stage] || 'text-white/60';
                  return (
                    <div key={stage.stage}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium uppercase tracking-wider ${textColor}`}>
                          {formatLabel(stage.stage)}
                        </span>
                        <span className="text-sm mono-num text-white/60">{stage.count}</span>
                      </div>
                      <div className="w-full h-7 bg-white/[0.04] rounded overflow-hidden">
                        <div
                          className={`h-full ${color} rounded transition-all duration-500`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {crewStages.length === 0 && (
                  <p className="text-white/30 text-center py-8">No crew funnel data available.</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
