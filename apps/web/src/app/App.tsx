import { AppRouter } from './router';

import { useSessionSync } from '../auth/session';

export function App(): React.JSX.Element {
  useSessionSync();
  return <AppRouter />;
}
