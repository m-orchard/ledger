import type { Person } from '../types';
import { PERSON_COLOR_PALETTE } from '../types';
import { newId } from '../lib/storage';
import { selectOnFocus } from '../lib/selectOnFocus';
import Card from './Card';
import RemoveButton from './RemoveButton';

interface Props {
  people: Person[];
  sharedColor: string;
  onChange: (people: Person[]) => void;
  onSharedColorChange: (color: string) => void;
}

const colorInputClass = 'w-4 h-4 rounded-full border border-rule bg-transparent p-0 cursor-pointer';

export default function People({ people, sharedColor, onChange, onSharedColorChange }: Props) {
  function update(id: string, patch: Partial<Person>) {
    onChange(people.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function remove(id: string) {
    onChange(people.filter((p) => p.id !== id));
  }

  function add() {
    onChange([...people, { id: newId(), name: '', color: PERSON_COLOR_PALETTE[people.length % PERSON_COLOR_PALETTE.length] }]);
  }

  return (
    <Card>
      <h3 className="font-display text-lg text-ink mb-1">Household</h3>
      <p className="text-xs text-inkfaint mb-4">
        Add each person whose income, accounts, or debts you want to track separately. Anything
        not assigned to a person is treated as shared.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {people.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-1.5 bg-black/[0.03] border border-rule/60 rounded-sm pl-1.5 pr-2 py-1"
          >
            <input
              type="color"
              value={p.color}
              onChange={(e) => update(p.id, { color: e.target.value })}
              aria-label={`Colour for ${p.name || 'person'}`}
              className={colorInputClass}
            />
            <input
              type="text"
              value={p.name}
              onChange={(e) => update(p.id, { name: e.target.value })}
              onFocus={selectOnFocus}
              placeholder="Name"
              className="w-24 bg-transparent text-sm focus:outline-none"
            />
            <RemoveButton onClick={() => remove(p.id)} label={`Remove ${p.name || 'person'}`} size="xs" />
          </div>
        ))}
        <div className="flex items-center gap-1.5 bg-black/[0.03] border border-rule/60 rounded-sm pl-1.5 pr-2 py-1">
          <input
            type="color"
            value={sharedColor}
            onChange={(e) => onSharedColorChange(e.target.value)}
            aria-label="Colour for Shared"
            className={colorInputClass}
          />
          <span className="text-sm text-inkfaint">Shared</span>
        </div>
        <button
          onClick={add}
          className="text-xs font-mono text-teal hover:text-ink border border-teal/40 hover:border-teal rounded-sm px-2 py-1.5"
        >
          + add person
        </button>
      </div>
    </Card>
  );
}
