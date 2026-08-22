interface Props {
  color: string;
  className?: string;
}

export default function ColorDot({ color, className = '' }: Props) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${className}`}
      style={{ backgroundColor: color }}
    />
  );
}
