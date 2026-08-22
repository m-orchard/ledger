import type { Account, AccountType, Frequency } from '../types';
import { ACCOUNT_TYPE_LABELS } from '../types';
import { newId } from '../lib/storage';
import { formatCurrency } from '../lib/format';
import { toMonthlyAmount } from '../lib/frequency';
import { selectOnFocus } from '../lib/selectOnFocus';
import { useAppSettings } from '../lib/AppSettingsContext';
import NumberInput from './NumberInput';
import AddWithOwner from './AddWithOwner';
import Card from './Card';
import RemoveButton from './RemoveButton';
import OwnerGroupedList from './OwnerGroupedList';
import RateSchedule from './RateSchedule';

interface Props {
  accounts: Account[];
  onChange: (accounts: Account[]) => void;
}

const ACCOUNT_TYPES: AccountType[] = [
  'cash-isa',
  'stocks-isa',
  'savings',
  'cash',
  'general-investment',
  'other',
];

const FREQUENCIES: Frequency[] = ['weekly', 'monthly', 'annual'];

export default function Accounts({ accounts, onChange }: Props) {
  const { currency } = useAppSettings();
  function update(id: string, patch: Partial<Account>) {
    onChange(accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function remove(id: string) {
    onChange(accounts.filter((a) => a.id !== id));
  }

  function add(ownerId: string) {
    onChange([
      ...accounts,
      {
        id: newId(),
        name: '',
        type: 'savings',
        balance: 0,
        annualGrowthRate: 4,
        contributionAmount: 0,
        contributionFrequency: 'monthly',
        ownerId,
      },
    ]);
  }

  const generalAccounts = accounts.filter((a) => a.type !== 'pension' && a.type !== 'lifetime-isa');

  const totalBalance = generalAccounts.reduce((s, a) => s + a.balance, 0);
  const totalContribution = generalAccounts.reduce(
    (s, a) => s + toMonthlyAmount(a.contributionAmount, a.contributionFrequency),
    0
  );

  function renderTable(list: Account[]) {
    const contribution = list.reduce(
      (s, a) => s + toMonthlyAmount(a.contributionAmount, a.contributionFrequency),
      0
    );
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-inkfaint border-b border-rule">
              <th className="pb-2 pr-3 font-normal">Name</th>
              <th className="pb-2 pr-3 font-normal">Type</th>
              <th className="pb-2 pr-3 font-normal text-right">Balance</th>
              <th className="pb-2 pr-3 font-normal text-right">Growth/yr</th>
              <th className="pb-2 pr-3 font-normal text-right">Contribution</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id} className="border-b border-rule/60">
                <td className="py-2 pr-2">
                  <input
                    type="text"
                    value={a.name}
                    onChange={(e) => update(a.id, { name: e.target.value })}
                    onFocus={selectOnFocus}
                    placeholder="Account name"
                    className="w-full bg-transparent focus:outline-none focus-visible:border-b focus-visible:border-brass"
                  />
                </td>
                <td className="py-2 pr-2">
                  <select
                    value={a.type}
                    onChange={(e) => update(a.id, { type: e.target.value as AccountType })}
                    className="bg-transparent text-sm focus:outline-none"
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {ACCOUNT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-2 text-right">
                  <NumberInput
                    value={a.balance}
                    onChange={(balance) => update(a.id, { balance })}
                    className="w-24 bg-transparent text-right font-mono tabular focus:outline-none"
                  />
                </td>
                <td className="py-2 pr-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <NumberInput
                      value={a.annualGrowthRate}
                      onChange={(annualGrowthRate) => update(a.id, { annualGrowthRate })}
                      className="w-16 bg-transparent text-right font-mono tabular focus:outline-none"
                    />
                    <span className="text-inkfaint text-xs">%</span>
                    <RateSchedule
                      label={`${a.name || 'Account'} — growth rate changes`}
                      changes={a.rateChanges ?? []}
                      onChange={(rateChanges) => update(a.id, { rateChanges })}
                    />
                  </div>
                </td>
                <td className="py-2 pr-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <NumberInput
                      value={a.contributionAmount}
                      onChange={(contributionAmount) => update(a.id, { contributionAmount })}
                      className="w-16 bg-transparent text-right font-mono tabular focus:outline-none"
                    />
                    <select
                      value={a.contributionFrequency}
                      onChange={(e) => update(a.id, { contributionFrequency: e.target.value as Frequency })}
                      className="bg-transparent text-xs focus:outline-none"
                    >
                      {FREQUENCIES.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className="py-2 text-right">
                  <RemoveButton onClick={() => remove(a.id)} label={`Remove ${a.name || 'account'}`} />
                </td>
              </tr>
            ))}
          </tbody>
          {list.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} className="pt-2 text-xs text-inkfaint">Total monthly contributions</td>
                <td className="pt-2 text-right font-mono text-xs tabular text-teal">{formatCurrency(contribution, currency)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
        {list.length === 0 && <p className="text-xs text-inkfaint italic mt-2">Nothing yet.</p>}
      </div>
    );
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-1 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-lg text-ink">Accounts</h3>
          <AddWithOwner label="+" ariaLabel="Add account" onAdd={add} className="" />
        </div>
        <span className="font-mono text-sm tabular text-brass">{formatCurrency(totalBalance, currency)}</span>
      </div>
      <p className="text-xs text-inkfaint mb-4">
        ISAs, savings, and other accounts — each with its own growth assumption and regular
        contribution. Pensions and Lifetime ISAs are above, since they both get money on top of
        what you put in. Use the rate's schedule button to add future changes — a fixed-term
        bond maturing into a lower rate, for example.
      </p>

      <OwnerGroupedList
        items={generalAccounts}
        getOwnerId={(a) => a.ownerId}
        total={(list) => formatCurrency(list.reduce((s, a) => s + a.balance, 0), currency)}
        totalClassName="text-brass"
      >
        {(list) => renderTable(list)}
      </OwnerGroupedList>

      <p className="text-[11px] text-inkfaint mt-4">
        Total monthly contributions across everyone: {formatCurrency(totalContribution, currency)}
      </p>
    </Card>
  );
}
