import { useQuery } from '@tanstack/react-query';
import type {
  UpdateRoadmapProgressRequest,
  UpsertRoadmapNodeRequest,
} from '@web-app/contracts';

import {
  createRoadmapNode,
  deleteRoadmapNode,
  fetchCourseRoadmap,
  roadmapQueryKey,
  studentDashboardQueryKey,
  updateRoadmapNode,
  updateRoadmapProgress,
} from '../../../../api/client';
import { useNotifyingMutation } from '../../../../hooks/useNotifyingMutation';

export function useCourseRoadmap(courseId: string) {
  const queryKey = roadmapQueryKey(courseId);
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchCourseRoadmap(courseId, signal),
    enabled: !!courseId,
  });

  const createMutation = useNotifyingMutation({
    mutationFn: (input: UpsertRoadmapNodeRequest) =>
      createRoadmapNode(courseId, input),
    invalidateKeys: [queryKey],
    successMessage: 'Ο κόμβος δημιουργήθηκε.',
  });

  const updateMutation = useNotifyingMutation({
    mutationFn: ({
      nodeId,
      input,
    }: {
      nodeId: string;
      input: UpsertRoadmapNodeRequest;
    }) => updateRoadmapNode(courseId, nodeId, input),
    invalidateKeys: [queryKey],
    successMessage: 'Οι αλλαγές αποθηκεύτηκαν.',
  });

  const deleteMutation = useNotifyingMutation({
    mutationFn: (nodeId: string) => deleteRoadmapNode(courseId, nodeId),
    invalidateKeys: [queryKey],
    successMessage: 'Ο κόμβος διαγράφηκε.',
  });

  const progressMutation = useNotifyingMutation({
    mutationFn: ({
      nodeId,
      input,
    }: {
      nodeId: string;
      input: UpdateRoadmapProgressRequest;
    }) => updateRoadmapProgress(courseId, nodeId, input),
    invalidateKeys: [queryKey, studentDashboardQueryKey()],
    successMessage: (_data, variables) =>
      variables.input.status === 'completed'
        ? 'Η ενότητα ολοκληρώθηκε.'
        : 'Η ενότητα είναι σε εξέλιξη.',
    notifyOnError: true,
  });

  return {
    query,
    createMutation,
    updateMutation,
    deleteMutation,
    progressMutation,
  };
}
