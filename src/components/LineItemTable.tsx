import type { ExpenseCategory, Frequency, RecurringItem } from '../types';
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

interface Props {
  title: string;
  hint: string;
  items: RecurringItem[];
  accent: 'teal' | 'brick';
  onChange: (items: RecurringItem[]) => void;
  /** When provided, new items added from this table are tagged with this category. */
  fixedCategory?: ExpenseCategory;
}

const FREQUENCIES: Frequency[] = ['weekly', 'monthly', 'annual'];

export default function LineItemTable({ title, hint, items, accent, onChange, fixedCategory }: Props) {
  const { currency } = useAppSettings();
  const total = items.reduce((s, i) => s + toMonthlyAmount(i.amount, i.frequency), 0);
  const accentClass = accent === 'teal' ? 'text-teal' : 'text-brick';

  function update(id: string, patch: Partial<RecurringItem>) {
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function remove(id: string) {
    onChange(items.filter((i) => i.id !== id));
  }

  function add(ownerId: string) {
    onChange([...items, { id: newId(), name: '', amount: 0, frequency: 'monthly', ownerId, category: fixedCategory }]);
  }

  function renderRow(item: RecurringItem) {
    return (
      <div key={item.id} className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={item.name}
          onChange={(e) => update(item.id, { name: e.target.value })}
          onFocus={selectOnFocus}
          placeholder="Name"
          className="flex-1 min-w-[6rem] bg-transparent border-b border-rule py-1 text-sm focus:outline-none focus-visible:border-brass"
        />
        <div className="flex items-center gap-1">
          <span className="text-xs text-inkfaint font-mono">{currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€'}</span>
          <NumberInput
            value={item.amount}
            onChange={(amount) => update(item.id, { amount })}
            className="w-20 bg-transparent border-b border-rule py-1 text-sm font-mono text-right tabular focus:outline-none focus-visible:border-brass"
          />
        </div>
        <select
          value={item.frequency}
          onChange={(e) => update(item.id, { frequency: e.target.value as Frequency })}
          className="bg-transparent border-b border-rule py-1 text-xs focus:outline-none"
        >
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <RemoveButton onClick={() => remove(item.id)} label={`Remove ${item.name || 'item'}`} />
      </div>
    );
  }

  function renderList(list: RecurringItem[]) {
    return (
      <div className="space-y-2">
        {list.map((item) => renderRow(item))}
        {list.length === 0 && <p className="text-xs text-inkfaint italic">Nothing yet.</p>}
      </div>
    );
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-1 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-lg text-ink">{title}</h3>
          <AddWithOwner label="+" ariaLabel={`Add ${title.toLowerCase()} line`} onAdd={add} className="" />
        </div>
        <span className={`font-mono text-sm tabular ${accentClass}`}>
          {formatCurrency(total, currency)}/mo
        </span>
      </div>
      <p className="text-xs text-inkfaint mb-4">{hint}</p>

      <OwnerGroupedList
        items={items}
        getOwnerId={(i) => i.ownerId}
        total={(list) => `${formatCurrency(list.reduce((s, i) => s + toMonthlyAmount(i.amount, i.frequency), 0), currency)}/mo`}
        totalClassName={accentClass}
      >
        {(list) => renderList(list)}
      </OwnerGroupedList>
    </Card>
  );
}
