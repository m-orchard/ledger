import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
}

export default function Card({ children, className = '' }: Props) {
  return <div className={`bg-surface border border-rule rounded-sm p-5 ${className}`}>{children}</div>;
}
