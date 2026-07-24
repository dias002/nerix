type FilterOption<T extends string> = {
  id: T;
  label: string;
};

type FilterBarProps<T extends string> = {
  options: Array<FilterOption<T>>;
  value: T;
  onChange: (value: T) => void;
  label?: string;
};

export default function FilterBar<T extends string>({
  options,
  value,
  onChange,
  label = "Фильтр",
}: FilterBarProps<T>) {
  return (
    <div className="ns-filter-bar" role="list" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className="ns-filter-chip"
          data-active={option.id === value}
          onClick={() => onChange(option.id)}
          aria-pressed={option.id === value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
