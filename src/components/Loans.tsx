import type { Asset, Loan } from '../types';
import { newId } from '../lib/storage';
import { formatCurrency } from '../lib/format';
import { selectOnFocus } from '../lib/selectOnFocus';
import { useAppSettings } from '../lib/AppSettingsContext';
import NumberInput from './NumberInput';
import AddWithOwner from './AddWithOwner';
import Card from './Card';
import RemoveButton from './RemoveButton';
import OwnerGroupedList from './OwnerGroupedList';

interface Props {
  loans: Loan[];
  assets: Asset[];
  onChange: (loans: Loan[]) => void;
}

export default function Loans({ loans, assets, onChange }: Props) {
  const { currency } = useAppSettings();
  function update(id: string, patch: Partial<Loan>) {
    onChange(loans.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function remove(id: string) {
    onChange(loans.filter((l) => l.id !== id));
  }

  function add(ownerId: string) {
    onChange([
      ...loans,
      {
        id: newId(),
        name: '',
        balance: 0,
        originalAmount: 0,
        annualInterestRate: 4.5,
        monthlyPayment: 0,
        ownerId,
      },
    ]);
  }

  const totalBalance = loans.reduce((s, l) => s + l.balance, 0);

  function paidOffPercent(l: Loan): number | undefined {
    if (l.originalAmount <= 0) return undefined;
    return Math.max(0, Math.min(1, (l.originalAmount - l.balance) / l.originalAmount)) * 100;
  }

  function renderTable(list: Loan[], ownerId: string) {
    const eligibleAssets = assets.filter((a) => a.ownerId === ownerId);

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-inkfaint border-b border-rule">
              <th className="pb-2 pr-3 font-normal">Name</th>
              <th className="pb-2 pr-3 font-normal text-right">Original</th>
              <th className="pb-2 pr-3 font-normal text-right">Balance</th>
              <th className="pb-2 pr-3 font-normal text-right">Interest/yr</th>
              <th className="pb-2 pr-3 font-normal text-right">Payment/mo</th>
              <th className="pb-2 pr-3 font-normal">Secured against</th>
              <th className="pb-2 pr-3 font-normal text-right">Equity</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((l) => {
              const percent = paidOffPercent(l);
              const linkedAsset = assets.find((a) => a.id === l.assetId);
              return (
                <tr key={l.id} className="border-b border-rule/60">
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      value={l.name}
                      onChange={(e) => update(l.id, { name: e.target.value })}
                      onFocus={selectOnFocus}
                      placeholder="Loan name"
                      className="w-full bg-transparent focus:outline-none focus-visible:border-b focus-visible:border-brass"
                    />
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <NumberInput
                      value={l.originalAmount}
                      onChange={(originalAmount) => update(l.id, { originalAmount })}
                      className="w-24 bg-transparent text-right font-mono tabular focus:outline-none"
                    />
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <NumberInput
                      value={l.balance}
                      onChange={(balance) => update(l.id, { balance })}
                      className="w-24 bg-transparent text-right font-mono tabular focus:outline-none"
                    />
                    {percent !== undefined && (
                      <span className="block text-[11px] text-inkfaint">{percent.toFixed(0)}% paid off</span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <NumberInput
                      value={l.annualInterestRate}
                      onChange={(annualInterestRate) => update(l.id, { annualInterestRate })}
                      className="w-16 bg-transparent text-right font-mono tabular focus:outline-none"
                    />
                    <span className="text-inkfaint text-xs">%</span>
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <NumberInput
                      value={l.monthlyPayment}
                      onChange={(monthlyPayment) => update(l.id, { monthlyPayment })}
                      className="w-20 bg-transparent text-right font-mono tabular focus:outline-none"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      value={l.assetId ?? ''}
                      onChange={(e) => update(l.id, { assetId: e.target.value || undefined })}
                      className="bg-transparent text-sm focus:outline-none"
                    >
                      <option value="">None</option>
                      {eligibleAssets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name || 'Unnamed asset'}
                        </option>
                      ))}
                      {/* Keep a currently-linked asset visible even if its owner no longer matches */}
                      {linkedAsset && !eligibleAssets.includes(linkedAsset) && (
                        <option value={linkedAsset.id}>
                          {(linkedAsset.name || 'Unnamed asset') + ' (mismatched owner)'}
                        </option>
                      )}
                    </select>
                  </td>
                  <td className="py-2 pr-2 text-right font-mono tabular text-xs text-inkfaint">
                    {linkedAsset ? formatCurrency(linkedAsset.value - l.balance, currency) : '—'}
                  </td>
                  <td className="py-2 text-right">
                    <RemoveButton onClick={() => remove(l.id)} label={`Remove ${l.name || 'loan'}`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <p className="text-sm text-inkfaint italic mt-2">Nothing yet.</p>}
      </div>
    );
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-1 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-lg text-ink">Loans</h3>
          <AddWithOwner label="+" ariaLabel="Add loan" onAdd={add} className="" />
        </div>
        <span className="font-mono text-sm tabular text-brick">{formatCurrency(totalBalance, currency)}</span>
      </div>
      <p className="text-xs text-inkfaint mb-4">
        Mortgages and other debt — amortized monthly (interest accrues, then the payment reduces
        the balance). Payments stop automatically once paid off. Overpay via a one-off event below.
        Link a loan to an asset (set up on the Investments &amp; Assets tab) to see the equity you
        actually have.
      </p>

      <OwnerGroupedList
        items={loans}
        getOwnerId={(l) => l.ownerId}
        total={(list) => formatCurrency(list.reduce((s, l) => s + l.balance, 0), currency)}
        totalClassName="text-brick"
      >
        {(list, ownerId) => renderTable(list, ownerId)}
      </OwnerGroupedList>
    </Card>
  );
}
