interface Props {
  onClick: () => void;
  label: string;
  /** Smaller size for buttons inside nested/inline rows (deductions, bonuses, tax bands). */
  size?: 'sm' | 'xs';
}

export default function RemoveButton({ onClick, label, size = 'sm' }: Props) {
  const sizeClass = size === 'sm' ? 'text-sm px-1' : 'text-xs px-0.5';
  return (
    <button onClick={onClick} aria-label={label} className={`text-inkfaint hover:text-brick ${sizeClass}`}>
      ×
    </button>
  );
}
