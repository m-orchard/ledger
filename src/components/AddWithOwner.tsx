import { useEffect, useRef, useState } from 'react';
import { ownerBuckets } from '../lib/ownership';
import { useAppSettings } from '../lib/AppSettingsContext';
import ColorDot from './ColorDot';

interface Props {
  label: string;
  onAdd: (ownerId: string) => void;
  /** Wrapper classes — defaults to a top margin for placement below content; pass "" when placed inline (e.g. next to a header). */
  className?: string;
  /** Accessible name when `label` is just a symbol (e.g. "+"). Defaults to `label`. */
  ariaLabel?: string;
}

/**
 * A single "+ add" button. With more than one owner to choose from (any
 * household members, plus the always-present "Shared" bucket), clicking it
 * opens a small menu to pick who the new row belongs to; with only one
 * owner, it just adds directly.
 */
export default function AddWithOwner({ label, onAdd, className = 'mt-3', ariaLabel }: Props) {
  const { people, sharedColor } = useAppSettings();
  const buckets = ownerBuckets(people, sharedColor);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleButtonClick() {
    if (buckets.length > 1) {
      setOpen((o) => !o);
    } else {
      onAdd(buckets[0].id);
    }
  }

  function choose(ownerId: string) {
    onAdd(ownerId);
    setOpen(false);
  }

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        onClick={handleButtonClick}
        aria-label={ariaLabel ?? label}
        className="text-xs font-mono text-teal hover:text-ink border border-teal/40 hover:border-teal rounded-sm px-2 py-1"
      >
        {label}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 min-w-[8rem] bg-surface border border-rule rounded-sm shadow-md z-10 py-1"
        >
          {buckets.map((b) => (
            <button
              key={b.id}
              role="menuitem"
              onClick={() => choose(b.id)}
              className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs font-mono text-ink hover:bg-rule/30"
            >
              <ColorDot color={b.color} />
              {b.name || 'Unnamed'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
