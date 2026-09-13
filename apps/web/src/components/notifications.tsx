import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { CircleAlert, Check, X } from 'lucide-react';

const notificationTimeoutMs = 5_000;

type NotificationKind = 'success' | 'error';
type NotificationInput = {
  kind: NotificationKind;
  message: string;
};
type ActiveNotification = NotificationInput & { id: number };
type NotificationContextValue = {
  notify: (notification: NotificationInput) => void;
  dismissNotification: () => void;
};

const noopNotificationContext: NotificationContextValue = {
  notify: () => undefined,
  dismissNotification: () => undefined,
};

const NotificationContext = createContext<NotificationContextValue>(
  noopNotificationContext,
);

export function NotificationProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [notification, setNotification] = useState<ActiveNotification | null>(
    null,
  );
  const notificationRef = useRef<HTMLDivElement>(null);
  const nextNotificationId = useRef(0);

  const dismissNotification = useCallback(() => {
    setNotification(null);
  }, []);

  const notify = useCallback((next: NotificationInput) => {
    nextNotificationId.current += 1;
    setNotification({ ...next, id: nextNotificationId.current });
  }, []);

  useEffect(() => {
    if (!notification) return;

    const timeoutId = window.setTimeout(
      dismissNotification,
      notificationTimeoutMs,
    );

    return () => window.clearTimeout(timeoutId);
  }, [dismissNotification, notification]);

  useEffect(() => {
    if (!notification) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && notificationRef.current?.contains(target)) {
        return;
      }

      dismissNotification();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () =>
      document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [dismissNotification, notification]);

  const value = useMemo(
    () => ({ notify, dismissNotification }),
    [dismissNotification, notify],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationPopup
        notification={notification}
        notificationRef={notificationRef}
        onDismiss={dismissNotification}
      />
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextValue {
  return useContext(NotificationContext);
}

function NotificationPopup({
  notification,
  notificationRef,
  onDismiss,
}: {
  notification: ActiveNotification | null;
  notificationRef: RefObject<HTMLDivElement | null>;
  onDismiss: () => void;
}): React.JSX.Element | null {
  if (!notification) return null;

  const role = notification.kind === 'error' ? 'alert' : 'status';

  return (
    <div className="workspace-notification-viewport">
      <div
        ref={notificationRef}
        className={`popup-notification is-${notification.kind}`}
        role={role}
      >
        <span className="popup-notification-icon" aria-hidden="true">
          {notification.kind === 'error' ? (
            <CircleAlert size={16} strokeWidth={2.4} />
          ) : (
            <Check size={16} strokeWidth={2.7} />
          )}
        </span>
        <p>{notification.message}</p>
        <button
          aria-label="Κλείσιμο ειδοποίησης"
          className="popup-notification-close"
          type="button"
          onClick={onDismiss}
        >
          <X size={16} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
