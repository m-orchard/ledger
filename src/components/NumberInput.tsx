import { NumericFormat } from 'react-number-format';

interface Props {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  /** Allow a leading minus sign — off by default since most fields here are amounts, not deltas. */
  allowNegative?: boolean;
  /** Fixed number of decimal places always shown, e.g. 0 for whole-number ages. Defaults to 2 (money/percentages). */
  decimalScale?: number;
  disabled?: boolean;
}

/**
 * A numeric input backed by react-number-format rather than a hand-rolled
 * parser: it tracks the typed string while editing (so partial states like a
 * trailing "." survive a keystroke) and formats with thousands separators,
 * without the native <input type="number"> footgun of resetting to empty on
 * anything it can't parse (e.g. a typed comma). Always shows a fixed number
 * of decimal places for consistency, and selects its full value on focus so
 * typing immediately replaces it.
 */
export default function NumberInput({
  value,
  onChange,
  placeholder,
  className,
  allowNegative = false,
  decimalScale = 2,
  disabled = false,
}: Props) {
  return (
    <NumericFormat
      value={value}
      onValueChange={(values) => onChange(values.floatValue ?? 0)}
      onFocus={(e) => e.target.select()}
      thousandSeparator=","
      decimalScale={decimalScale}
      fixedDecimalScale
      allowNegative={allowNegative}
      inputMode="decimal"
      placeholder={placeholder ?? '0'}
      className={className}
      disabled={disabled}
    />
  );
}
