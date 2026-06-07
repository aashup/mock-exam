import type {ReactNode} from 'react';

export function Badge({children, color = 'slate'}: {children: ReactNode; color?: 'slate' | 'brand' | 'green' | 'amber'}) {
  const colors = {
    slate: 'bg-slate-100 text-slate-700',
    brand: 'bg-brand-100 text-brand-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
  } as const;
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}
