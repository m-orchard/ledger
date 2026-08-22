import { useRef } from 'react';
import type { Person, Settings } from '../types';
import TaxSettingsPanel from './TaxSettingsPanel';
import People from './People';
import NumberInput from './NumberInput';
import Card from './Card';

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
  people: Person[];
  onPeopleChange: (people: Person[]) => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs text-inkfaint block mb-1">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-inkfaint block mt-1">{hint}</span>}
    </label>
  );
}

export default function SettingsPanel({ settings, onChange, people, onPeopleChange, onExport, onImport }: Props) {
  function update(patch: Partial<Settings>) {
    onChange({ ...settings, ...patch });
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  const inputClass =
    'w-full bg-transparent border-b border-rule py-1 text-sm font-mono tabular focus:outline-none focus-visible:border-brass';

  return (
    <div className="space-y-6">
    <Card>
      <h3 className="font-display text-lg text-ink mb-1">Data</h3>
      <p className="text-xs text-inkfaint mb-4">
        Everything is stored only in this browser. Export a backup regularly, or move your data to
        another device by exporting here and importing it there.
      </p>
      <div className="flex gap-2 text-xs font-mono">
        <button
          onClick={onExport}
          className="border border-rule hover:border-teal text-inkfaint hover:text-teal rounded-sm px-3 py-1.5"
        >
          Export data
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="border border-rule hover:border-teal text-inkfaint hover:text-teal rounded-sm px-3 py-1.5"
        >
          Import data
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImport(file);
            e.target.value = '';
          }}
        />
      </div>
    </Card>

    <People
      people={people}
      sharedColor={settings.sharedColor}
      onChange={onPeopleChange}
      onSharedColorChange={(sharedColor) => update({ sharedColor })}
    />

    <Card>
      <h3 className="font-display text-lg text-ink mb-1">Settings</h3>
      <p className="text-xs text-inkfaint mb-4">The assumptions the whole forecast runs on.</p>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Current age">
          <NumberInput
            value={settings.currentAge}
            onChange={(currentAge) => update({ currentAge })}
            decimalScale={0}
            className={inputClass}
          />
        </Field>
        <Field label="Target retirement age">
          <NumberInput
            value={settings.retirementAge}
            onChange={(retirementAge) => update({ retirementAge })}
            decimalScale={0}
            className={inputClass}
          />
        </Field>
        <Field label="Project forward to age">
          <NumberInput
            value={settings.projectionEndAge}
            onChange={(projectionEndAge) => update({ projectionEndAge })}
            decimalScale={0}
            className={inputClass}
          />
        </Field>
        <Field label="Assumed inflation" hint="Used to show today's-money values alongside future values">
          <div className="flex items-center gap-1">
            <NumberInput
              value={settings.inflationRate}
              onChange={(inflationRate) => update({ inflationRate })}
              className={inputClass}
            />
            <span className="text-xs text-inkfaint">%</span>
          </div>
        </Field>
        <Field label="Currency">
          <select
            value={settings.currency}
            onChange={(e) => update({ currency: e.target.value as Settings['currency'] })}
            className={inputClass}
          >
            <option value="GBP">£ GBP</option>
            <option value="USD">$ USD</option>
            <option value="EUR">€ EUR</option>
          </select>
        </Field>
      </div>

      <p className="text-[11px] text-inkfaint mt-4 leading-relaxed">
        This is a fixed-rate model: it assumes your growth and inflation figures hold every year.
        Real markets don't move in a straight line — treat the projection as a planning baseline,
        not a guarantee.
      </p>
    </Card>

    <TaxSettingsPanel tax={settings.tax} onChange={(tax) => update({ tax })} />
    </div>
  );
}
