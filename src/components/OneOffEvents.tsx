import type { Account, Asset, Loan, OneOffEvent, OneOffKind } from '../types';
import { newId } from '../lib/storage';
import { selectOnFocus } from '../lib/selectOnFocus';
import { useAppSettings } from '../lib/AppSettingsContext';
import NumberInput from './NumberInput';
import Card from './Card';
import RemoveButton from './RemoveButton';

interface Props {
  events: OneOffEvent[];
  accounts: Account[];
  loans: Loan[];
  assets: Asset[];
  onChange: (events: OneOffEvent[]) => void;
  /** Which card this is — restricts what can be targeted and whether the amount can go negative. */
  fixedKind: OneOffKind;
}

export default function OneOffEvents({ events, accounts, loans, assets, onChange, fixedKind }: Props) {
  const { currency } = useAppSettings();
  function update(id: string, patch: Partial<OneOffEvent>) {
    onChange(events.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function remove(id: string) {
    onChange(events.filter((e) => e.id !== id));
  }

  function add() {
    const today = new Date();
    today.setFullYear(today.getFullYear() + 1);
    onChange([
      ...events,
      {
        id: newId(),
        name: '',
        kind: fixedKind,
        amount: fixedKind === 'income' ? 1000 : -1000,
        date: today.toISOString().slice(0, 10),
        accountId: fixedKind === 'expense' ? accounts[0]?.id : undefined,
      },
    ]);
  }

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const isExpense = fixedKind === 'expense';

  return (
    <Card>
      <div className="flex items-center gap-3 mb-1">
        <h3 className="font-display text-lg text-ink">
          {isExpense ? 'One-off spending' : 'One-off income'}
        </h3>
        <button
          onClick={add}
          aria-label={isExpense ? 'Add one-off spending' : 'Add one-off income'}
          className="text-xs font-mono text-teal hover:text-ink border border-teal/40 hover:border-teal rounded-sm px-2 py-1"
        >
          +
        </button>
      </div>
      {isExpense && (
        <p className="text-xs text-inkfaint mb-4">
          Targeting a loan always applies the amount as an extra repayment, regardless of sign.
        </p>
      )}

      <div className="space-y-2">
        {sorted.map((e) => (
          <div key={e.id} className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={e.date}
              onChange={(ev) => update(e.id, { date: ev.target.value })}
              className="bg-transparent border-b border-rule py-1 text-sm font-mono focus:outline-none focus-visible:border-brass"
            />
            <input
              type="text"
              value={e.name}
              onChange={(ev) => update(e.id, { name: ev.target.value })}
              onFocus={selectOnFocus}
              placeholder="Description"
              className="flex-1 min-w-[8rem] bg-transparent border-b border-rule py-1 text-sm focus:outline-none focus-visible:border-brass"
            />
            <div className="flex items-center gap-1">
              <span className="text-xs text-inkfaint font-mono">{currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€'}</span>
              <NumberInput
                value={e.amount}
                onChange={(amount) => update(e.id, { amount })}
                allowNegative={isExpense}
                className={`w-24 bg-transparent border-b border-rule py-1 text-sm font-mono text-right tabular focus:outline-none focus-visible:border-brass ${
                  e.amount < 0 ? 'text-brick' : 'text-teal'
                }`}
              />
            </div>
            <select
              value={
                e.loanId
                  ? `loan:${e.loanId}`
                  : e.assetId
                    ? `asset:${e.assetId}`
                    : e.accountId
                      ? `account:${e.accountId}`
                      : ''
              }
              onChange={(ev) => {
                const [target, id] = ev.target.value.split(':');
                update(e.id, {
                  accountId: target === 'account' ? id : undefined,
                  loanId: target === 'loan' ? id : undefined,
                  assetId: target === 'asset' ? id : undefined,
                });
              }}
              className="bg-transparent border-b border-rule py-1 text-xs focus:outline-none"
            >
              <option value="">Cash flow only</option>
              {accounts.length > 0 && (
                <optgroup label="Accounts">
                  {accounts.map((a) => (
                    <option key={a.id} value={`account:${a.id}`}>
                      {a.name || 'Unnamed account'}
                    </option>
                  ))}
                </optgroup>
              )}
              {isExpense && loans.length > 0 && (
                <optgroup label="Loans (overpayment)">
                  {loans.map((l) => (
                    <option key={l.id} value={`loan:${l.id}`}>
                      {l.name || 'Unnamed loan'}
                    </option>
                  ))}
                </optgroup>
              )}
              {isExpense && assets.length > 0 && (
                <optgroup label="Assets">
                  {assets.map((a) => (
                    <option key={a.id} value={`asset:${a.id}`}>
                      {a.name || 'Unnamed asset'}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <RemoveButton onClick={() => remove(e.id)} label={`Remove ${e.name || 'event'}`} />
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="text-sm text-inkfaint italic">Nothing yet.</p>
        )}
      </div>
    </Card>
  );
}
