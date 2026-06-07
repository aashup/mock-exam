export interface Option {
  value: number;
  label: string;
}

interface Props {
  label?: string;
  options: Option[];
  selected: number[];
  onChange: (next: number[]) => void;
  emptyHint?: string;
}

/** A simple checkbox-list multi-select (no extra deps). */
export function MultiSelect({label, options, selected, onChange, emptyHint}: Props) {
  const toggle = (value: number) => {
    onChange(
      selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value],
    );
  };

  return (
    <div>
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      {options.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-400">
          {emptyHint ?? 'Nothing available yet.'}
        </p>
      ) : (
        <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {options.map(opt => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              <span className="text-slate-700">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
