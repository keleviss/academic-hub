import type { ForumThreadStatus } from '@web-app/contracts';

export const forumThreadStatusLabels: Record<ForumThreadStatus, string> = {
  open: 'Ανοιχτή',
  instructor_answered: 'Απαντήθηκε',
  verified: 'Επαληθευμένη',
  resolved: 'Επιλυμένη',
  archived: 'Αρχειοθετημένη',
};
