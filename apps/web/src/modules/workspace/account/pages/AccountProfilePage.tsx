import { useAuthenticatedUser } from '../../../../auth/authenticatedUser';
import { roleLabels } from '../../../../auth/session';
import { Avatar } from '../../../../components/Avatar';
import { PageLayout } from '../../../../components/PageLayout';
import { StatusBadge } from '../../../../components/StatusBadge';

export function AccountProfilePage(): React.JSX.Element {
  const user = useAuthenticatedUser();

  return (
    <PageLayout
      title="Προφίλ"
      subtitle="Τα βασικά στοιχεία του λογαριασμού σου."
    >
      <div className="course-summary profile-summary">
        <div className="profile-header-row">
          <Avatar name={user.fullName} fallback="?" />
          <div>
            <strong>{user.fullName}</strong>
            <span>{roleLabels[user.role]}</span>
          </div>
        </div>
        <dl>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Ρόλος</dt>
            <dd>{roleLabels[user.role]}</dd>
          </div>
          <div>
            <dt>Κατάσταση λογαριασμού</dt>
            <dd>
              <StatusBadge
                active={user.isActive}
                activeLabel="Ενεργός"
                inactiveLabel="Ανενεργός"
              />
            </dd>
          </div>
        </dl>
      </div>
    </PageLayout>
  );
}
