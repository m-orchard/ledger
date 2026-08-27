import { useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceDot,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { Account, Asset, Loan, OneOffEvent, ProjectionPoint } from '../types';
import { parseLocalDate } from '../lib/projection';
import { formatCurrency } from '../lib/format';
import { useAppSettings } from '../lib/AppSettingsContext';
import { ownerBuckets } from '../lib/ownership';
import Card from './Card';
import ColorDot from './ColorDot';

interface Props {
  points: ProjectionPoint[];
  retirementAge: number;
  currentAge: number;
  accounts: Account[];
  assets: Asset[];
  loans: Loan[];
  oneOffs: OneOffEvent[];
  showReal: boolean;
  hidden: Set<string>;
  onHiddenChange: (next: Set<string>) => void;
}

// Validated categorical palette (see the dataviz skill) — fixed order, assigned by rank and
// never reassigned as series come and go. Colours are assigned from ONE shared ranking across
// both accounts/assets and loans, so e.g. a house and a mortgage never end up the same colour
// just because each is #1 in its own stack — a real identity never shares a hue with another.
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
// "Other" is a fold, not an identity — it gets a fixed neutral rather than competing for a hue slot.
const OTHER_COLOR = '#898781';

interface Series {
  key: string;
  name: string;
  color: string;
  memberIds: string[];
  /** Absent for the "Other" fold, which can mix items from several owners. */
  ownerId?: string;
  /** Only set for the "Other" fold — the individual names it's standing in for, for a legend breakdown. */
  memberNames?: string[];
}

interface RankedItem {
  id: string;
  name: string;
  value: number;
  ownerId: string;
}

/**
 * Ranks every account/asset/loan by its current (today) balance, across both
 * directions together, and assigns the fixed categorical palette in that
 * shared order — so colour identifies a specific account or loan, never
 * ambiguously shared between one of each. Past the 8-slot ceiling, the
 * smallest per direction fold into that direction's single "Other" series
 * (a neutral, not a 9th hue).
 */
function buildAllSeries(
  positiveItems: RankedItem[],
  loanItems: RankedItem[]
): { assetSeries: Series[]; loanSeries: Series[] } {
  const all = [...positiveItems, ...loanItems].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const colorById = new Map<string, string>();
  all.slice(0, 8).forEach((item, i) => colorById.set(item.id, PALETTE[i]));

  function toSeries(items: RankedItem[], otherKey: string): Series[] {
    const kept = items.filter((item) => colorById.has(item.id));
    const rest = items.filter((item) => !colorById.has(item.id));
    const series: Series[] = kept.map((item) => ({
      key: item.id,
      name: item.name || 'Unnamed',
      color: colorById.get(item.id) as string,
      memberIds: [item.id],
      ownerId: item.ownerId,
    }));
    if (rest.length > 0) {
      series.push({
        key: otherKey,
        name: `Other (${rest.length})`,
        color: OTHER_COLOR,
        memberIds: rest.map((item) => item.id),
        memberNames: rest.map((item) => item.name || 'Unnamed'),
      });
    }
    return series;
  }

  // Distinct keys per direction — assets and loans can each independently overflow into their
  // own "Other", and sharing one literal key would clobber one fold's row value with the other's.
  return { assetSeries: toSeries(positiveItems, '__other_assets__'), loanSeries: toSeries(loanItems, '__other_loans__') };
}

function seriesValue(series: Series, balances: Record<string, number>): number {
  return series.memberIds.reduce((s, id) => s + (balances[id] ?? 0), 0);
}

interface OwnerGroup {
  ownerId: string | null;
  ownerName: string | null;
  ownerColor: string | null;
  items: Series[];
}

/** Groups series by owner — the same rule as everywhere else in the app: no grouping at all when no household members are set up. Items that don't map to a single owner (the "Other" fold) land in their own trailing ungrouped section. */
function groupSeriesByOwner(
  series: Series[],
  people: { id: string; name: string }[],
  sharedColor: string
): OwnerGroup[] {
  if (people.length === 0) {
    return series.length > 0 ? [{ ownerId: null, ownerName: null, ownerColor: null, items: series }] : [];
  }
  const buckets = ownerBuckets(people as never, sharedColor);
  const byOwner = new Map<string, Series[]>();
  const other: Series[] = [];
  series.forEach((s) => {
    if (s.ownerId && buckets.some((b) => b.id === s.ownerId)) {
      const list = byOwner.get(s.ownerId) ?? [];
      list.push(s);
      byOwner.set(s.ownerId, list);
    } else {
      other.push(s);
    }
  });
  const groups: OwnerGroup[] = buckets
    .map((b) => ({ ownerId: b.id, ownerName: b.name || 'Unnamed', ownerColor: b.color, items: byOwner.get(b.id) ?? [] }))
    .filter((g) => g.items.length > 0);
  if (other.length > 0) groups.push({ ownerId: null, ownerName: 'Other', ownerColor: null, items: other });
  return groups;
}

export default function NetWorthChart({
  points,
  retirementAge,
  currentAge,
  accounts,
  assets,
  loans,
  oneOffs,
  showReal,
  hidden,
  onHiddenChange,
}: Props) {
  const { currency, people, sharedColor } = useAppSettings();

  const { assetSeries, loanSeries } = useMemo(() => {
    const currentPositive = { ...points[0]?.accountBalances, ...points[0]?.assetBalances };
    const currentLoans = points[0]?.loanBalances ?? {};
    const positiveItems: RankedItem[] = [...accounts, ...assets].map((item) => ({
      id: item.id,
      name: item.name,
      value: currentPositive[item.id] ?? 0,
      ownerId: item.ownerId,
    }));
    const loanItems: RankedItem[] = loans.map((item) => ({
      id: item.id,
      name: item.name,
      value: currentLoans[item.id] ?? 0,
      ownerId: item.ownerId,
    }));
    return buildAllSeries(positiveItems, loanItems);
  }, [accounts, assets, loans, points]);

  const allSeries = useMemo(() => [...assetSeries, ...loanSeries], [assetSeries, loanSeries]);

  // Canonical display order — Net worth first, then each owner's items (household order, Shared
  // last, "Other" trailing) — the same `groups` structure drives both the legend and the tooltip,
  // so they can never drift out of sync with each other.
  const groups = useMemo(() => groupSeriesByOwner(allSeries, people, sharedColor), [allSeries, people, sharedColor]);

  const data = points.map((p) => {
    const factor = showReal ? p.inflationFactor : 1;
    const row: Record<string, number> = { age: p.age };
    const positiveBalances = { ...p.accountBalances, ...p.assetBalances };
    assetSeries.forEach((s) => {
      row[s.key] = seriesValue(s, positiveBalances) / factor;
    });
    loanSeries.forEach((s) => {
      row[s.key] = -seriesValue(s, p.loanBalances) / factor;
    });
    // Net worth reflects only the currently-toggled-on series — hiding an
    // account/loan is a real what-if ("what would my net worth look like
    // without this"), not just a visual filter, so the line must recompute.
    row.totalNetWorth =
      assetSeries.reduce((s, series) => s + (hidden.has(series.key) ? 0 : row[series.key]), 0) +
      loanSeries.reduce((s, series) => s + (hidden.has(series.key) ? 0 : row[series.key]), 0);
    return row;
  });

  // Computed explicitly rather than left to Recharts' "auto" domain — with multiple
  // stackIds sharing one axis, auto-domain doesn't reliably recalculate against the
  // true stacked extent as the underlying data changes (confirmed: a loan whose
  // balance grows for decades produced a domain many times too small).
  const [yMin, yMax] = useMemo(() => {
    let min = 0;
    let max = 0;
    data.forEach((row) => {
      const positiveTotal = assetSeries.reduce((s, series) => s + (hidden.has(series.key) ? 0 : row[series.key]), 0);
      const negativeTotal = loanSeries.reduce((s, series) => s + (hidden.has(series.key) ? 0 : row[series.key]), 0);
      max = Math.max(max, positiveTotal, row.totalNetWorth);
      min = Math.min(min, negativeTotal, row.totalNetWorth);
    });
    const padding = (max - min) * 0.05;
    return [min - padding, max + padding];
  }, [data, assetSeries, loanSeries, hidden]);

  const eventMarkers = useMemo(() => {
    if (data.length === 0) return [];
    const firstAge = data[0].age;
    const lastAge = data[data.length - 1].age;
    return oneOffs
      .map((event) => {
        const eventDate = parseLocalDate(event.date);
        const now = new Date();
        const monthsFromNow = (eventDate.getFullYear() - now.getFullYear()) * 12 + (eventDate.getMonth() - now.getMonth());
        const age = currentAge + monthsFromNow / 12;
        let nearest = data[0];
        let bestDiff = Infinity;
        data.forEach((row) => {
          const diff = Math.abs(row.age - age);
          if (diff < bestDiff) {
            bestDiff = diff;
            nearest = row;
          }
        });
        return { event, age: nearest.age, y: nearest.totalNetWorth };
      })
      .filter((m) => m.age >= firstAge && m.age <= lastAge);
  }, [oneOffs, currentAge, data]);

  function toggleSingle(key: string) {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onHiddenChange(next);
  }

  // Shift+click isolates one series among the stacked accounts/loans (toggling it again restores the rest).
  function isolate(key: string) {
    const others = allSeries.map((s) => s.key).filter((k) => k !== key);
    const alreadyIsolated = others.length > 0 && others.every((k) => hidden.has(k)) && !hidden.has(key);
    const next = new Set(hidden);
    if (alreadyIsolated) {
      others.forEach((k) => next.delete(k));
    } else {
      others.forEach((k) => next.add(k));
      next.delete(key);
    }
    onHiddenChange(next);
  }

  function handleLegendClick(key: string, shiftKey: boolean) {
    if (shiftKey && key !== 'totalNetWorth') isolate(key);
    else toggleSingle(key);
  }

  function LegendRow({
    seriesKey,
    label,
    color,
    shape,
    breakdown,
  }: {
    seriesKey: string;
    label: string;
    color: string;
    shape: 'line' | 'square';
    breakdown?: string[];
  }) {
    const isHidden = hidden.has(seriesKey);
    const instructions = 'Click to toggle · Shift+click to show only this one';
    const title = breakdown && breakdown.length > 0 ? `Includes: ${breakdown.join(', ')}\n\n${instructions}` : instructions;
    return (
      <button
        onClick={(e) => handleLegendClick(seriesKey, e.shiftKey)}
        title={title}
        className="flex items-center gap-1.5 text-left w-full"
        style={{ opacity: isHidden ? 0.4 : 1 }}
      >
        {shape === 'line' ? (
          <span className="inline-block w-3 h-0.5 shrink-0" style={{ backgroundColor: color }} />
        ) : (
          <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
        )}
        <span className="truncate">{label}</span>
      </button>
    );
  }

  function renderLegend() {
    return (
      <div className="flex flex-col gap-3 text-[11px] font-mono pl-2" style={{ color: '#5B6760' }}>
        <LegendRow seriesKey="totalNetWorth" label="Net worth" color="#1F2A24" shape="line" />
        {groups.map((g) => (
          <div key={g.ownerId ?? 'other'} className="space-y-1">
            {g.ownerName && (
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-inkfaint">
                {g.ownerColor && <ColorDot color={g.ownerColor} />}
                {g.ownerName}
              </p>
            )}
            {g.items.map((s) => (
              <LegendRow key={s.key} seriesKey={s.key} label={s.name} color={s.color} shape="square" breakdown={s.memberNames} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  function renderTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey?: string | number; value?: number; color?: string }[]; label?: number }) {
    if (!active || !payload || payload.length === 0) return null;
    const byKey = new Map(payload.map((entry) => [entry.dataKey, entry]));
    const netWorthEntry = byKey.get('totalNetWorth');
    return (
      <div
        style={{
          background: '#F7F6F1',
          border: '1px solid #C9CBB9',
          borderRadius: 2,
          fontFamily: 'IBM Plex Mono',
          fontSize: 12,
          padding: '8px 10px',
          minWidth: 160,
        }}
      >
        <p style={{ color: '#1F2A24', marginBottom: 4 }}>Age {label}</p>
        {netWorthEntry && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0' }}>
            <span style={{ display: 'inline-block', width: 10, height: 2, backgroundColor: '#1F2A24' }} />
            <span style={{ flex: 1 }}>Net worth</span>
            <span style={{ fontWeight: 600 }}>{formatCurrency(Math.abs(netWorthEntry.value ?? 0), currency)}</span>
          </div>
        )}
        {groups.map((g) => {
          const rows = g.items.map((s) => ({ series: s, entry: byKey.get(s.key) })).filter((r) => r.entry);
          if (rows.length === 0) return null;
          return (
            <div key={g.ownerId ?? 'other'} style={{ marginTop: 4 }}>
              {g.ownerName && <p style={{ color: '#898781', fontSize: 10, textTransform: 'uppercase', margin: '4px 0 2px' }}>{g.ownerName}</p>}
              {rows.map(({ series, entry }) => (
                <div key={series.key} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0' }}>
                  <span style={{ display: 'inline-block', width: 10, height: 2, backgroundColor: entry?.color ?? series.color }} />
                  <span style={{ flex: 1 }}>{series.name}</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(Math.abs(entry?.value ?? 0), currency)}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <h3 className="font-display text-lg text-ink">Net worth over time</h3>
        <p className="text-[11px] text-inkfaint">{showReal ? 'Inflation-adjusted' : 'Nominal'}</p>
      </div>
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#C9CBB9" vertical={false} />
            <XAxis
              dataKey="age"
              tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono', fill: '#5B6760' }}
              tickFormatter={(v) => `${v}`}
              label={{ value: 'age', position: 'insideBottom', offset: -12, fontSize: 11, fill: '#5B6760' }}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono', fill: '#5B6760' }}
              tickFormatter={(v) => formatCurrency(v, currency, { compact: true })}
              width={64}
            />
            <Tooltip content={renderTooltip} />
            <Legend content={renderLegend} layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ right: 0 }} />
            <ReferenceLine
              x={retirementAge}
              stroke="#A6493D"
              strokeDasharray="4 4"
              label={{ value: 'retirement', position: 'top', fontSize: 11, fill: '#A6493D' }}
            />
            <ReferenceLine y={0} stroke="#C9CBB9" />
            {assetSeries.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stackId="assets"
                stroke={s.color}
                strokeDasharray="4 2"
                fill={s.color}
                fillOpacity={0.45}
                strokeWidth={1}
                hide={hidden.has(s.key)}
                isAnimationActive={false}
              />
            ))}
            {loanSeries.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stackId="liabilities"
                stroke={s.color}
                strokeDasharray="4 2"
                fill={s.color}
                fillOpacity={0.45}
                strokeWidth={1}
                hide={hidden.has(s.key)}
                isAnimationActive={false}
              />
            ))}
            <Line
              type="monotone"
              dataKey="totalNetWorth"
              name="Net worth"
              stroke="#1F2A24"
              strokeWidth={2}
              dot={false}
              hide={hidden.has('totalNetWorth')}
              isAnimationActive={false}
            />
            {eventMarkers.map(({ event, age, y }) => (
              <ReferenceDot
                key={event.id}
                x={age}
                y={y}
                r={4}
                isFront
                shape={(props: { cx?: number; cy?: number }) => (
                  <g>
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={4}
                      fill={event.amount < 0 ? '#A6493D' : '#2F5D62'}
                      stroke="#F7F6F1"
                      strokeWidth={1.5}
                    />
                    <title>{`${event.name || 'One-off'}: ${formatCurrency(event.amount, currency)}`}</title>
                  </g>
                )}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
