import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Home,
  LogOut,
  Mail,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  StickyNote,
  UserCircle,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { CurrentUser } from '@web-app/contracts';

import { appPath, roleLabels } from '../auth/session';
import type {
  WorkspaceNavIcon,
  WorkspaceNavItem,
  WorkspaceRoute,
} from '../modules/workspace/routing/workspaceRoutes';

const iconMap: Record<WorkspaceNavIcon, LucideIcon> = {
  activity: BarChart3,
  analytics: BarChart3,
  calendar: CalendarDays,
  courses: BookOpen,
  home: Home,
  messages: Mail,
  notes: StickyNote,
  settings: Settings,
  shield: ShieldCheck,
  users: Users,
};

type LoggedSidebarProps = {
  state: 'logged';
  user: CurrentUser;
  navItems: WorkspaceRoute[];
  onLogout: () => void;
  logoutPending: boolean;
  onNavigate?: () => void;
};

type GuestSidebarProps = {
  state: 'guest';
};

export type AppSidebarProps = GuestSidebarProps | LoggedSidebarProps;

function BrandLockup({
  compact = false,
}: {
  compact?: boolean;
}): React.JSX.Element {
  return (
    <div
      className={
        compact ? 'sidebar-brand sidebar-brand--compact' : 'sidebar-brand'
      }
    >
      <span className="sidebar-seal" aria-hidden="true">
        AH
      </span>
      <div>
        <span>UNIWA</span>
        <p>Academic Hub</p>
      </div>
    </div>
  );
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('el-GR')
    .trim();
}

function navTarget(path: string): string {
  return path ? `${appPath}/${path}` : appPath;
}

function matchesNavItem(item: WorkspaceNavItem, query: string): boolean {
  if (!query) return true;
  const haystack = [item.label, item.path, ...(item.keywords ?? [])]
    .map(normalizeSearch)
    .join(' ');
  return haystack.includes(query);
}

function useFilteredNavItems(items: WorkspaceRoute[], query: string) {
  const normalizedQuery = normalizeSearch(query);

  return useMemo(() => {
    const filtered: WorkspaceNavItem[] = [];

    for (const item of items) {
      if (!item.nav) continue;

      const children = item.children?.filter((child) =>
        matchesNavItem(child, normalizedQuery),
      );
      const parentMatches = matchesNavItem(item, normalizedQuery);

      if (parentMatches || children?.length) {
        filtered.push({ ...item, children });
      }
    }

    return filtered;
  }, [items, normalizedQuery]);
}

function isActivePath(path: string, currentPath: string): boolean {
  const target = navTarget(path);
  if (path === '') return currentPath === appPath;
  return currentPath === target || currentPath.startsWith(`${target}/`);
}

function initialsFor(user: CurrentUser): string {
  const initials = user.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
  return (initials || user.email[0] || 'U').toLocaleUpperCase('el-GR');
}

function NavItem({
  item,
  onNavigate,
}: {
  item: WorkspaceNavItem;
  onNavigate?: () => void;
}): React.JSX.Element {
  const location = useLocation();
  const currentPath = `${location.pathname}${location.search}`;
  const Icon = item.icon ? iconMap[item.icon] : Home;
  const childActive = item.children?.some(
    (child) => navTarget(child.path) === currentPath,
  );
  const active = childActive || isActivePath(item.path, currentPath);

  return (
    <li>
      <Link
        to={navTarget(item.path)}
        className={active ? 'sidebar-nav-link is-active' : 'sidebar-nav-link'}
        aria-current={active ? 'page' : undefined}
        onClick={onNavigate}
      >
        <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
        <span>{item.label}</span>
        {!!item.children?.length && (
          <ChevronDown
            aria-hidden="true"
            className="sidebar-nav-chevron"
            size={15}
          />
        )}
      </Link>
      {!!item.children?.length && (
        <ul className="sidebar-subnav">
          {item.children.map((child) => {
            const childTarget = navTarget(child.path);
            const childIsActive = childTarget === currentPath;
            return (
              <li key={`${child.path}-${child.label}`}>
                <Link
                  to={childTarget}
                  className={
                    childIsActive
                      ? 'sidebar-subnav-link is-active'
                      : 'sidebar-subnav-link'
                  }
                  aria-current={childIsActive ? 'page' : undefined}
                  onClick={onNavigate}
                >
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function GuestSidebar(): React.JSX.Element {
  return (
    <aside
      className="auth-institution app-sidebar app-sidebar--guest"
      aria-label="Academic Hub"
    >
      <BrandLockup />
      <div className="auth-introduction">
        <span className="status-pill">Ακαδημαϊκό περιβάλλον</span>
        <h2>Ο χώρος σου για μελέτη και αλληλεπίδραση.</h2>
        <p>
          Το εκπαιδευτικό υλικό, οι απορίες και η μαθησιακή σου πορεία σε ένα
          κοινό περιβάλλον.
        </p>
      </div>
      <p className="institution-footer">Πανεπιστήμιο Δυτικής Αττικής</p>
    </aside>
  );
}

function LoggedSidebar({
  user,
  navItems,
  onLogout,
  logoutPending,
  onNavigate,
}: Omit<LoggedSidebarProps, 'state'>): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const filteredNavItems = useFilteredNavItems(navItems, query);

  useEffect(() => {
    if (!profileOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setProfileOpen(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [profileOpen]);

  function closeAfterNavigate() {
    setProfileOpen(false);
    onNavigate?.();
  }

  return (
    <aside
      className="app-sidebar app-sidebar--logged"
      aria-label="Academic Hub"
    >
      <div className="sidebar-main">
        <BrandLockup />
        <label className="sidebar-search">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Αναζήτηση διαθέσιμων σελίδων</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Αναζήτηση"
            aria-label="Αναζήτηση διαθέσιμων σελίδων"
          />
          <kbd>⌘ K</kbd>
        </label>
        <nav className="sidebar-nav" aria-label="Πλοήγηση workspace">
          {filteredNavItems.length ? (
            <ul>
              {filteredNavItems.map((item) => (
                <NavItem
                  key={item.path || 'index'}
                  item={item}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          ) : (
            <p className="sidebar-empty">Δεν βρέθηκαν διαθέσιμες σελίδες.</p>
          )}
        </nav>
      </div>
      <div className="sidebar-profile">
        {profileOpen && (
          <div className="profile-popover" role="menu">
            <Link
              to={`${appPath}/profile`}
              role="menuitem"
              onClick={closeAfterNavigate}
            >
              <UserCircle aria-hidden="true" size={16} />
              <span>Προφίλ</span>
            </Link>
            <Link
              to={`${appPath}/settings`}
              role="menuitem"
              onClick={closeAfterNavigate}
            >
              <Settings aria-hidden="true" size={16} />
              <span>Ρυθμίσεις</span>
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={onLogout}
              disabled={logoutPending}
            >
              <LogOut aria-hidden="true" size={16} />
              <span>
                {logoutPending ? 'Γίνεται αποσύνδεση...' : 'Αποσύνδεση'}
              </span>
            </button>
          </div>
        )}
        <button
          type="button"
          className="profile-card-button"
          aria-label={`Μενού χρήστη ${user.fullName}`}
          aria-haspopup="menu"
          aria-expanded={profileOpen}
          onClick={() => setProfileOpen((open) => !open)}
        >
          <span className="profile-avatar" aria-hidden="true">
            {initialsFor(user)}
          </span>
          <span className="profile-copy">
            <strong>{user.fullName}</strong>
            <span>{roleLabels[user.role]}</span>
          </span>
        </button>
      </div>
    </aside>
  );
}

export function MobileWorkspaceHeader({
  onOpenSidebar,
}: {
  onOpenSidebar: () => void;
}): React.JSX.Element {
  return (
    <header className="mobile-workspace-header">
      <button
        type="button"
        className="mobile-icon-button"
        aria-label="Άνοιγμα sidebar"
        onClick={onOpenSidebar}
      >
        <Menu aria-hidden="true" size={21} />
      </button>
      <BrandLockup compact />
      <div className="mobile-header-actions">
        <button
          type="button"
          className="mobile-icon-button"
          aria-label="Ειδοποιήσεις"
        >
          <Bell aria-hidden="true" size={20} />
        </button>
        <Link
          to={`${appPath}/profile`}
          className="mobile-icon-button"
          aria-label="Προφίλ"
        >
          <UserCircle aria-hidden="true" size={20} />
        </Link>
      </div>
    </header>
  );
}

export function MobileSidebarDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return <></>;

  return (
    <div className="mobile-sidebar-layer" role="presentation">
      <button
        type="button"
        className="mobile-sidebar-backdrop"
        aria-label="Κλείσιμο sidebar"
        onClick={onClose}
      />
      <div className="mobile-sidebar-panel">
        <button
          type="button"
          className="mobile-sidebar-close"
          aria-label="Κλείσιμο sidebar"
          onClick={onClose}
        >
          <X aria-hidden="true" size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}

export function AppSidebar(props: AppSidebarProps): React.JSX.Element {
  if (props.state === 'guest') return <GuestSidebar />;
  return <LoggedSidebar {...props} />;
}
