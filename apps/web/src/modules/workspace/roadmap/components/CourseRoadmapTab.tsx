import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Map, Plus } from 'lucide-react';
import type {
  CourseDocumentMetadata,
  ProfessorRoadmapNode,
  RoadmapResource,
  UpsertRoadmapNodeRequest,
} from '@web-app/contracts';

import { Dialog } from '../../../../components/Dialog';
import { EmptyState } from '../../../../components/EmptyState';
import { ErrorNotice } from '../../../../components/feedback';
import { QueryState } from '../../../../components/QueryState';
import { getErrorMessage } from '../../../../lib/api-error';
import { useCourseRoadmap } from '../hooks/useCourseRoadmap';
import { RoadmapDetailsPanel } from './RoadmapDetailsPanel';
import { RoadmapGraph } from './RoadmapGraph';
import { RoadmapNodeForm } from './RoadmapNodeForm';

type FormState =
  | { mode: 'create' }
  | { mode: 'edit'; node: ProfessorRoadmapNode };

export function CourseRoadmapTab({
  courseId,
  documents,
  selectedNodeId,
  onSelectedNodeChange,
}: {
  courseId: string;
  documents: CourseDocumentMetadata[];
  selectedNodeId: string | null;
  onSelectedNodeChange: (nodeId: string | null) => void;
}): React.JSX.Element {
  const navigate = useNavigate();
  const {
    query,
    createMutation,
    updateMutation,
    deleteMutation,
    progressMutation,
  } = useCourseRoadmap(courseId);
  const [form, setForm] = useState<FormState | null>(null);
  const [deleteNode, setDeleteNode] = useState<ProfessorRoadmapNode | null>(
    null,
  );

  const graph = query.data?.data;
  const selectedNode = useMemo(
    () => graph?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [graph, selectedNodeId],
  );

  useEffect(() => {
    if (graph && selectedNodeId && !selectedNode) onSelectedNodeChange(null);
  }, [graph, onSelectedNodeChange, selectedNode, selectedNodeId]);

  const openResource = (resource: RoadmapResource) => {
    if (
      selectedNode &&
      'progress' in selectedNode &&
      selectedNode.progress.status === 'not_started' &&
      !selectedNode.isLocked
    ) {
      progressMutation.mutate({
        nodeId: selectedNode.id,
        input: { status: 'in_progress' },
      });
    }

    if (resource.resourceType === 'external_url' && resource.externalUrl) {
      window.open(resource.externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (
      (resource.resourceType === 'document_page' ||
        resource.resourceType === 'document_section') &&
      resource.document
    ) {
      const page = resource.pageStart ? `?page=${resource.pageStart}` : '';
      navigate(
        `/app/courses/${courseId}/documents/${resource.document.id}${page}`,
        { state: { courseTab: 'roadmap' } },
      );
    }
  };

  return (
    <section className="course-roadmap-tab">
      <QueryState
        query={query}
        loadingLabel="Φόρτωση χάρτη ύλης…"
        errorOptions={{
          fallback: 'Ο χάρτης ύλης δεν ήταν δυνατό να φορτωθεί.',
          statuses: {
            403: 'Δεν έχεις πρόσβαση στον χάρτη ύλης.',
            404: 'Το μάθημα δεν βρέθηκε.',
          },
        }}
        onRetry={() => void query.refetch()}
      >
        {(response) => {
          const currentGraph = response.data;
          const professorView = currentGraph.view === 'professor';

          return (
            <>
              <div className="roadmap-toolbar">
                <div>
                  <span className="roadmap-toolbar-icon" aria-hidden="true">
                    <Map size={18} />
                  </span>
                  <div>
                    <h2>Χάρτης ύλης</h2>
                    <p>
                      {professorView
                        ? 'Οργάνωσε τη μαθησιακή διαδρομή και τα προαπαιτούμενα.'
                        : 'Ακολούθησε τις ενότητες με τη σειρά που ξεκλειδώνουν.'}
                    </p>
                  </div>
                </div>
                {professorView && (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      onSelectedNodeChange(null);
                      setForm({ mode: 'create' });
                    }}
                  >
                    <Plus aria-hidden="true" size={16} />
                    Νέος κόμβος
                  </button>
                )}
              </div>

              {currentGraph.nodes.length === 0 && !form ? (
                <EmptyState
                  message={
                    professorView
                      ? 'Ο χάρτης ύλης είναι κενός. Δημιούργησε την πρώτη ενότητα.'
                      : 'Ο διδάσκων δεν έχει προσθέσει ακόμη ενότητες.'
                  }
                  action={
                    professorView
                      ? {
                          label: 'Νέος κόμβος',
                          onClick: () => setForm({ mode: 'create' }),
                        }
                      : undefined
                  }
                />
              ) : (
                <div
                  className={`roadmap-workspace${
                    selectedNode || form ? ' has-panel' : ''
                  }`}
                >
                  <RoadmapGraph
                    graph={currentGraph}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={(nodeId) => {
                      setForm(null);
                      onSelectedNodeChange(nodeId);
                    }}
                  />
                  {selectedNode && !form && (
                    <RoadmapDetailsPanel
                      node={selectedNode}
                      nodes={currentGraph.nodes}
                      progressPending={progressMutation.isPending}
                      onClose={() => onSelectedNodeChange(null)}
                      onDelete={
                        professorView
                          ? () =>
                              setDeleteNode(
                                selectedNode as ProfessorRoadmapNode,
                              )
                          : undefined
                      }
                      onEdit={
                        professorView
                          ? () =>
                              setForm({
                                mode: 'edit',
                                node: selectedNode as ProfessorRoadmapNode,
                              })
                          : undefined
                      }
                      onOpenResource={openResource}
                      onProgress={(status) =>
                        progressMutation.mutate({
                          nodeId: selectedNode.id,
                          input: { status },
                        })
                      }
                    />
                  )}
                  {professorView && form && (
                    <aside
                      className="roadmap-details-panel roadmap-authoring-panel"
                      aria-label={
                        form.mode === 'create'
                          ? 'Δημιουργία κόμβου'
                          : 'Επεξεργασία κόμβου'
                      }
                    >
                      <header>
                        <div>
                          <span className="roadmap-panel-kicker">
                            {form.mode === 'create'
                              ? 'Νέα ενότητα'
                              : 'Επεξεργασία ενότητας'}
                          </span>
                          <h2>
                            {form.mode === 'create'
                              ? 'Δημιουργία κόμβου'
                              : form.node.title}
                          </h2>
                        </div>
                      </header>
                      {(createMutation.error || updateMutation.error) && (
                        <ErrorNotice>
                          {getErrorMessage(
                            createMutation.error ?? updateMutation.error,
                          )}
                        </ErrorNotice>
                      )}
                      <div className="roadmap-panel-scroll">
                        <RoadmapNodeForm
                          key={
                            form.mode === 'create'
                              ? 'create'
                              : `edit-${form.node.id}`
                          }
                          node={form.mode === 'edit' ? form.node : null}
                          nodes={currentGraph.nodes}
                          documents={documents}
                          pending={
                            createMutation.isPending || updateMutation.isPending
                          }
                          onCancel={() => setForm(null)}
                          onSubmit={(input: UpsertRoadmapNodeRequest) => {
                            if (form.mode === 'create') {
                              createMutation.mutate(input, {
                                onSuccess: (result) => {
                                  setForm(null);
                                  onSelectedNodeChange(result.data.id);
                                },
                              });
                            } else {
                              updateMutation.mutate(
                                { nodeId: form.node.id, input },
                                { onSuccess: () => setForm(null) },
                              );
                            }
                          }}
                        />
                      </div>
                    </aside>
                  )}
                </div>
              )}
            </>
          );
        }}
      </QueryState>

      {deleteNode && (
        <Dialog title="Διαγραφή κόμβου" onClose={() => setDeleteNode(null)}>
          <div className="course-form">
            <p>
              Θέλεις να διαγράψεις τον κόμβο «{deleteNode.title}»; Η διαγραφή
              επιτρέπεται μόνο όταν δεν υπάρχει μαθησιακή δραστηριότητα.
            </p>
            {deleteMutation.error && (
              <ErrorNotice>{getErrorMessage(deleteMutation.error)}</ErrorNotice>
            )}
            <div className="roadmap-panel-actions">
              <button
                className="danger-button"
                disabled={deleteMutation.isPending}
                type="button"
                onClick={() =>
                  deleteMutation.mutate(deleteNode.id, {
                    onSuccess: () => {
                      setDeleteNode(null);
                      onSelectedNodeChange(null);
                    },
                  })
                }
              >
                {deleteMutation.isPending ? 'Διαγραφή…' : 'Διαγραφή'}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setDeleteNode(null)}
              >
                Άκυρο
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}
