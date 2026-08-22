import type { Asset } from '../types';
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
  assets: Asset[];
  onChange: (assets: Asset[]) => void;
}

export default function Assets({ assets, onChange }: Props) {
  const { currency } = useAppSettings();
  function update(id: string, patch: Partial<Asset>) {
    onChange(assets.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function remove(id: string) {
    onChange(assets.filter((a) => a.id !== id));
  }

  function add(ownerId: string) {
    onChange([
      ...assets,
      {
        id: newId(),
        name: '',
        value: 0,
        annualGrowthRate: 3,
        ownerId,
      },
    ]);
  }

  const totalValue = assets.reduce((s, a) => s + a.value, 0);

  function renderTable(list: Asset[]) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-inkfaint border-b border-rule">
              <th className="pb-2 pr-3 font-normal">Name</th>
              <th className="pb-2 pr-3 font-normal text-right">Value</th>
              <th className="pb-2 pr-3 font-normal text-right">Growth/yr</th>
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
                    placeholder="Asset name"
                    className="w-full bg-transparent focus:outline-none focus-visible:border-b focus-visible:border-brass"
                  />
                </td>
                <td className="py-2 pr-2 text-right">
                  <NumberInput
                    value={a.value}
                    onChange={(value) => update(a.id, { value })}
                    className="w-24 bg-transparent text-right font-mono tabular focus:outline-none"
                  />
                </td>
                <td className="py-2 pr-2 text-right">
                  <NumberInput
                    value={a.annualGrowthRate}
                    onChange={(annualGrowthRate) => update(a.id, { annualGrowthRate })}
                    allowNegative
                    className="w-16 bg-transparent text-right font-mono tabular focus:outline-none"
                  />
                  <span className="text-inkfaint text-xs">%</span>
                </td>
                <td className="py-2 text-right">
                  <RemoveButton onClick={() => remove(a.id)} label={`Remove ${a.name || 'asset'}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="text-xs text-inkfaint italic mt-2">Nothing yet.</p>}
      </div>
    );
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-1 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-lg text-ink">Assets</h3>
          <AddWithOwner label="+" ariaLabel="Add asset" onAdd={add} className="" />
        </div>
        <span className="font-mono text-sm tabular text-brass">{formatCurrency(totalValue, currency)}</span>
      </div>
      <p className="text-xs text-inkfaint mb-4">
        Property, vehicles, or anything else with real value — with its own growth (or
        depreciation, using a negative rate) assumption. Link a loan to one (on the Outgoings tab)
        to see its equity — the asset's value minus what's still owed.
      </p>

      <OwnerGroupedList
        items={assets}
        getOwnerId={(a) => a.ownerId}
        total={(list) => formatCurrency(list.reduce((s, a) => s + a.value, 0), currency)}
        totalClassName="text-brass"
      >
        {(list) => renderTable(list)}
      </OwnerGroupedList>
    </Card>
  );
}
