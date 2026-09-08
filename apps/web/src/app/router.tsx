import { Navigate, Route, Routes } from 'react-router';

import { appPath } from '../auth/session';
import { LoginRoute, RequireSession } from '../auth/routes';
import { LoggedLayout } from '../modules/workspace/LoggedLayout';

export function AppRouter(): React.JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<LoginRoute />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route
        path={`${appPath}/*`}
        element={
          <RequireSession>
            <LoggedLayout />
          </RequireSession>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
