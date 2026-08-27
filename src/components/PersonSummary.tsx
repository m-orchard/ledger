import type { AppData } from '../types';
import { formatCurrency } from '../lib/format';
import { toMonthlyAmount } from '../lib/frequency';
import { calcSalaryBreakdown } from '../lib/tax';
import { ownerBuckets } from '../lib/ownership';
import ColorDot from './ColorDot';
import Card from './Card';

interface Props {
  data: AppData;
}

interface Bucket {
  id: string;
  name: string;
  color: string;
  netWorth: number;
  monthlyIncome: number;
  monthlyOutgoings: number;
}

export default function PersonSummary({ data }: Props) {
  const { people, accounts, assets, loans, income, expenses, salaries, settings } = data;

  const buckets: Bucket[] = ownerBuckets(people, settings.sharedColor).map((owner) => {
    const netWorth =
      accounts.filter((a) => a.ownerId === owner.id).reduce((s, a) => s + a.balance, 0) +
      assets.filter((a) => a.ownerId === owner.id).reduce((s, a) => s + a.value, 0) -
      loans.filter((l) => l.ownerId === owner.id).reduce((s, l) => s + l.balance, 0);

    const monthlyIncome =
      income
        .filter((i) => i.ownerId === owner.id)
        .reduce((s, i) => s + toMonthlyAmount(i.amount, i.frequency), 0) +
      salaries
        .filter((sal) => sal.ownerId === owner.id)
        .reduce((s, sal) => s + calcSalaryBreakdown(sal, settings.tax).takeHomeMonthly, 0);

    const monthlyOutgoings =
      expenses
        .filter((e) => e.ownerId === owner.id)
        .reduce((s, e) => s + toMonthlyAmount(e.amount, e.frequency), 0) +
      loans.filter((l) => l.ownerId === owner.id).reduce((s, l) => s + l.monthlyPayment, 0);

    return { id: owner.id, name: owner.name || 'Unnamed', color: owner.color, netWorth, monthlyIncome, monthlyOutgoings };
  });

  if (people.length === 0) return null;

  return (
    <Card>
      <h3 className="font-display text-lg text-ink mb-1">By person</h3>
      <p className="text-xs text-inkfaint mb-4">Current net worth and monthly cash flow, split by who owns each item.</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {buckets.map((b) => (
          <div key={b.id} className="border border-rule/60 rounded-sm p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-ink mb-2">
              <ColorDot color={b.color} />
              {b.name}
            </p>
            <p className="font-mono text-lg tabular text-brass">{formatCurrency(b.netWorth, settings.currency)}</p>
            <p className="text-[11px] text-inkfaint mb-2">net worth</p>
            <div className="flex justify-between text-xs font-mono tabular">
              <span className="text-teal">+{formatCurrency(b.monthlyIncome, settings.currency)}</span>
              <span className="text-brick">-{formatCurrency(b.monthlyOutgoings, settings.currency)}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
