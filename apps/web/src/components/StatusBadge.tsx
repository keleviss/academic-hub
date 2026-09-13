export function StatusBadge({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}): React.JSX.Element {
  return (
    <span className={active ? 'status-badge is-active' : 'status-badge is-inactive'}>
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}
