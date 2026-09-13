import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type WorkspaceBreadcrumb = { label: string; to?: string };

type ContextValue = {
  trail: WorkspaceBreadcrumb[] | null;
  setTrail: (trail: WorkspaceBreadcrumb[] | null) => void;
};

const WorkspaceBreadcrumbContext = createContext<ContextValue | null>(null);

export function WorkspaceBreadcrumbProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [trail, setTrail] = useState<WorkspaceBreadcrumb[] | null>(null);
  return (
    <WorkspaceBreadcrumbContext.Provider value={{ trail, setTrail }}>
      {children}
    </WorkspaceBreadcrumbContext.Provider>
  );
}

function useWorkspaceBreadcrumbContext(): ContextValue {
  const context = useContext(WorkspaceBreadcrumbContext);
  if (!context) {
    throw new Error(
      'Workspace breadcrumb hooks must be used within a WorkspaceBreadcrumbProvider.',
    );
  }
  return context;
}

/** Reads the trailing breadcrumb segments the current page has published, if any. */
export function useWorkspaceBreadcrumb(): WorkspaceBreadcrumb[] | null {
  return useWorkspaceBreadcrumbContext().trail;
}

/**
 * Lets a page publish its own already-fetched data (e.g. a course code, a document title) as
 * the toolbar's trailing breadcrumb segments, instead of the toolbar re-fetching that data.
 * Pass `null` while the data isn't loaded yet to fall back to the toolbar's static route labels.
 */
export function useSetWorkspaceBreadcrumb(
  trail: WorkspaceBreadcrumb[] | null,
): void {
  const { setTrail } = useWorkspaceBreadcrumbContext();
  const serialized = trail ? JSON.stringify(trail) : null;

  useEffect(() => {
    setTrail(trail);
    return () => setTrail(null);
    // `serialized` stands in for `trail`'s content so this only re-runs on actual changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);
}
