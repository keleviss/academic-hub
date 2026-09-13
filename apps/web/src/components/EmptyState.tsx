export function EmptyState({
  message,
  action,
}: {
  message: React.ReactNode;
  action?: { label: string; onClick: () => void };
}): React.JSX.Element {
  return (
    <div className="course-empty">
      <p>{message}</p>
      {action && (
        <button className="secondary-button" type="button" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
