import { Search } from "lucide-react";

type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
};

export default function SearchField({ value, onChange, placeholder, label = "Поиск" }: SearchFieldProps) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" strokeWidth={1.8} />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-[var(--radius-input)] border border-[var(--line-subtle)] bg-[var(--surface-1)] pl-10 pr-4 text-sm text-[var(--text-primary)] outline-none transition-[background-color,border-color] duration-[var(--duration-fast)] ease-[var(--ease-standard)] placeholder:text-[var(--text-tertiary)] hover:border-[var(--line-default)] focus-visible:border-[rgba(115,230,194,0.35)] focus-visible:outline-2 focus-visible:outline-[var(--signal-mint)] focus-visible:outline-offset-2"
      />
    </label>
  );
}
