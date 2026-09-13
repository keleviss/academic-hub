export interface TabItem<T extends string> {
  value: T;
  label: string;
}

export function Tabs<T extends string>({
  value,
  items,
  onChange,
  ariaLabel,
}: {
  value: T;
  items: TabItem<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
}): React.JSX.Element {
  return (
    <div className="course-filter-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.value}
          className={value === item.value ? 'is-active' : ''}
          type="button"
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
