import type { TaxBand, TaxSettings } from '../types';
import NumberInput from './NumberInput';
import Card from './Card';
import RemoveButton from './RemoveButton';

interface Props {
  tax: TaxSettings;
  onChange: (tax: TaxSettings) => void;
}

export default function TaxSettingsPanel({ tax, onChange }: Props) {
  function updateBand(index: number, patch: Partial<TaxBand>) {
    onChange({
      ...tax,
      incomeTaxBands: tax.incomeTaxBands.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    });
  }

  function removeBand(index: number) {
    onChange({ ...tax, incomeTaxBands: tax.incomeTaxBands.filter((_, i) => i !== index) });
  }

  function addBand() {
    onChange({ ...tax, incomeTaxBands: [...tax.incomeTaxBands, { threshold: 0, rate: 0 }] });
  }

  const inputClass =
    'w-full bg-transparent border-b border-rule py-1 text-sm font-mono tabular focus:outline-none focus-visible:border-brass';

  return (
    <Card className="mt-6">
      <h3 className="font-display text-lg text-ink mb-1">Income Tax &amp; National Insurance</h3>
      <p className="text-xs text-inkfaint mb-4">
        Defaults to 2024/25 rest-of-UK rates. Edit these when rates change, or to model Scottish
        bands (add more rows).
      </p>

      <div className="mb-4">
        <p className="text-xs text-inkfaint mb-2">
          Income tax bands — band 1's threshold is your personal allowance; each row's rate
          applies above its threshold, up to the next row's.
        </p>
        <div className="space-y-2">
          {tax.incomeTaxBands.map((band, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-inkfaint font-mono w-4">{i + 1}.</span>
              <div className="flex items-center gap-1 flex-1">
                <span className="text-xs text-inkfaint">from £</span>
                <NumberInput
                  value={band.threshold}
                  onChange={(threshold) => updateBand(i, { threshold })}
                  className="w-24 bg-transparent border-b border-rule py-1 text-sm font-mono text-right tabular focus:outline-none focus-visible:border-brass"
                />
              </div>
              <div className="flex items-center gap-1">
                <NumberInput
                  value={band.rate}
                  onChange={(rate) => updateBand(i, { rate })}
                  className="w-14 bg-transparent border-b border-rule py-1 text-sm font-mono text-right tabular focus:outline-none focus-visible:border-brass"
                />
                <span className="text-xs text-inkfaint">%</span>
              </div>
              <RemoveButton onClick={() => removeBand(i)} label={`Remove band ${i + 1}`} />
            </div>
          ))}
        </div>
        <button
          onClick={addBand}
          className="mt-2 text-xs font-mono text-teal hover:text-ink border border-teal/40 hover:border-teal rounded-sm px-2 py-1"
        >
          + add band
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs text-inkfaint block mb-1">Allowance taper starts at</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-inkfaint">£</span>
            <NumberInput
              value={tax.personalAllowanceTaperStart}
              onChange={(personalAllowanceTaperStart) => onChange({ ...tax, personalAllowanceTaperStart })}
              className={inputClass}
            />
          </div>
          <span className="text-[11px] text-inkfaint block mt-1">
            Personal allowance drops £1 per £2 of income above this
          </span>
        </label>
        <div />
        <label className="block">
          <span className="text-xs text-inkfaint block mb-1">NI primary threshold</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-inkfaint">£</span>
            <NumberInput
              value={tax.niPrimaryThreshold}
              onChange={(niPrimaryThreshold) => onChange({ ...tax, niPrimaryThreshold })}
              className={inputClass}
            />
          </div>
        </label>
        <label className="block">
          <span className="text-xs text-inkfaint block mb-1">NI upper earnings limit</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-inkfaint">£</span>
            <NumberInput
              value={tax.niUpperEarningsLimit}
              onChange={(niUpperEarningsLimit) => onChange({ ...tax, niUpperEarningsLimit })}
              className={inputClass}
            />
          </div>
        </label>
        <label className="block">
          <span className="text-xs text-inkfaint block mb-1">NI rate (main)</span>
          <div className="flex items-center gap-1">
            <NumberInput
              value={tax.niMainRate}
              onChange={(niMainRate) => onChange({ ...tax, niMainRate })}
              className={inputClass}
            />
            <span className="text-xs text-inkfaint">%</span>
          </div>
        </label>
        <label className="block">
          <span className="text-xs text-inkfaint block mb-1">NI rate (above upper limit)</span>
          <div className="flex items-center gap-1">
            <NumberInput
              value={tax.niUpperRate}
              onChange={(niUpperRate) => onChange({ ...tax, niUpperRate })}
              className={inputClass}
            />
            <span className="text-xs text-inkfaint">%</span>
          </div>
        </label>
      </div>
    </Card>
  );
}
