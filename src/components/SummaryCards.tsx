import type { ProjectionPoint } from '../types';
import { formatCurrency, formatAge } from '../lib/format';
import { useAppSettings } from '../lib/AppSettingsContext';

interface Props {
  currentNetWorth: number;
  currentDebt: number;
  atRetirement: ProjectionPoint | undefined;
  retirementAge: number;
  monthlyCashSurplus: number;
  /** Whether the "at retirement" figure leads with inflation-adjusted or nominal values. */
  showReal: boolean;
}

function Card({
  label,
  value,
  sub,
  tone = 'ink',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'ink' | 'brass' | 'brick' | 'teal';
}) {
  const toneClass = {
    ink: 'text-ink',
    brass: 'text-brass',
    brick: 'text-brick',
    teal: 'text-teal',
  }[tone];

  return (
    <div className="bg-surface border border-rule rounded-sm p-4">
      <p className="text-[11px] uppercase tracking-wide text-inkfaint mb-1">{label}</p>
      <p className={`font-mono text-2xl tabular ${toneClass}`}>{value}</p>
      {sub && <p className="text-xs text-inkfaint mt-1">{sub}</p>}
    </div>
  );
}

export default function SummaryCards({
  currentNetWorth,
  currentDebt,
  atRetirement,
  retirementAge,
  monthlyCashSurplus,
  showReal,
}: Props) {
  const { currency } = useAppSettings();
  const retirementValue = atRetirement && (showReal ? atRetirement.totalNetWorthReal : atRetirement.totalNetWorth);
  const retirementOther = atRetirement && (showReal ? atRetirement.totalNetWorth : atRetirement.totalNetWorthReal);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card label="Net worth today" value={formatCurrency(currentNetWorth, currency)} />
      <Card
        label={`At age ${formatAge(retirementAge)}`}
        value={atRetirement ? formatCurrency(retirementValue as number, currency) : '—'}
        sub={
          atRetirement
            ? `${formatCurrency(retirementOther as number, currency)} ${showReal ? 'in future pounds' : 'inflation-adjusted'}`
            : undefined
        }
        tone="brass"
      />
      <Card
        label="Total debt today"
        value={formatCurrency(currentDebt, currency)}
        sub={atRetirement ? `${formatCurrency(atRetirement.totalDebt, currency)} at retirement` : undefined}
        tone={currentDebt > 0 ? 'brick' : 'ink'}
      />
      <Card
        label="Monthly cash surplus"
        value={formatCurrency(monthlyCashSurplus, currency)}
        sub="Income minus expenses minus contributions"
        tone={monthlyCashSurplus < 0 ? 'brick' : 'teal'}
      />
    </div>
  );
}
