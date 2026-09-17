import { useAuthenticatedUser } from '../../../../auth/authenticatedUser';
import { roleLabels } from '../../../../auth/session';
import { PageLayout } from '../../../../components/PageLayout';

export function AccountSettingsPage(): React.JSX.Element {
  const user = useAuthenticatedUser();

  return (
    <PageLayout
      title="Ρυθμίσεις"
      subtitle="Στοιχεία λογαριασμού και πρόσβασης."
    >
      <div className="course-summary profile-summary">
        <h2>Λογαριασμός</h2>
        <dl>
          <div>
            <dt>Συνδεδεμένος ως</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Ρόλος πρόσβασης</dt>
            <dd>{roleLabels[user.role]}</dd>
          </div>
        </dl>
        <p className="profile-settings-note">
          Ρυθμίσεις ειδοποιήσεων, γλώσσας και προσβασιμότητας θα προστεθούν σε
          επόμενη έκδοση.
        </p>
      </div>
    </PageLayout>
  );
}
