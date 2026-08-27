import type { Salary, Settings } from '../types';
import { formatCurrency } from '../lib/format';
import NumberInput from './NumberInput';

interface Props {
  salary: Salary;
  onUpdate: (patch: Partial<Salary>) => void;
  currency: Settings['currency'];
}

/**
 * Editable Sacrifice/Employer % rows for one salary, each showing its computed £/mo
 * contribution alongside it. Shared between the Salaries table's own pension-contribution
 * popup and the Pensions table's reverse view (editing the same underlying Salary fields
 * from either direction).
 */
export default function PensionRateFields({ salary, onUpdate, currency }: Props) {
  const sacrificeMonthly = (salary.grossAnnual * (salary.sacrificePercent / 100)) / 12;
  const employerMonthly = (salary.grossAnnual * (salary.employerContributionPercent / 100)) / 12;

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2">
        <span className="text-xs text-inkfaint w-16 shrink-0">Sacrifice</span>
        <NumberInput
          value={salary.sacrificePercent}
          onChange={(sacrificePercent) => onUpdate({ sacrificePercent })}
          className="w-14 bg-transparent border-b border-rule py-1 text-sm font-mono text-right tabular focus:outline-none focus-visible:border-brass"
        />
        <span className="text-xs text-inkfaint">%</span>
        <span className="text-xs text-inkfaint font-mono tabular ml-auto">
          ≈ {formatCurrency(sacrificeMonthly, currency)}/mo
        </span>
      </label>
      <label className="flex items-center gap-2">
        <span className="text-xs text-inkfaint w-16 shrink-0">Employer</span>
        <NumberInput
          value={salary.employerContributionPercent}
          onChange={(employerContributionPercent) => onUpdate({ employerContributionPercent })}
          className="w-14 bg-transparent border-b border-rule py-1 text-sm font-mono text-right tabular focus:outline-none focus-visible:border-brass"
        />
        <span className="text-xs text-inkfaint">%</span>
        <span className="text-xs text-inkfaint font-mono tabular ml-auto">
          ≈ {formatCurrency(employerMonthly, currency)}/mo
        </span>
      </label>
    </div>
  );
}
