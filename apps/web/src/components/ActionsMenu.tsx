import { MoreVertical, type LucideIcon } from 'lucide-react';

import { Popover } from './Popover';

export type ActionMenuItem = {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
};

export function ActionsMenu({
  label,
  items,
}: {
  label: string;
  items: ActionMenuItem[];
}): React.JSX.Element {
  return (
    <Popover
      align="end"
      panelClassName="actions-menu-popover"
      renderTrigger={({ open, triggerRef, toggle }) => (
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={label}
          className="actions-menu-trigger"
          ref={triggerRef}
          type="button"
          onClick={toggle}
        >
          <MoreVertical aria-hidden="true" size={18} />
        </button>
      )}
    >
      {(close) =>
        items.map((item) => (
          <button
            key={item.label}
            role="menuitem"
            type="button"
            onClick={() => {
              close();
              item.onSelect();
            }}
          >
            <item.icon aria-hidden="true" size={16} />
            <span>{item.label}</span>
          </button>
        ))
      }
    </Popover>
  );
}

