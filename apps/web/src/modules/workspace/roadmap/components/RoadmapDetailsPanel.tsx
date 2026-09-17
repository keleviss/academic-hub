import { useState } from 'react';
import {
  Clock3,
  ExternalLink,
  FileText,
  Lock,
  Pencil,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ProfessorRoadmapNode,
  RoadmapResource,
  StudentRoadmapNode,
} from '@web-app/contracts';

const difficultyLabels = {
  low: 'Χαμηλή',
  medium: 'Μεσαία',
  high: 'Υψηλή',
} as const;

function resourceLabel(resource: RoadmapResource): string {
  if (resource.title) return resource.title;
  if (resource.resourceType === 'document_section') {
    return resource.sectionLabel ?? resource.document?.title ?? 'Ενότητα PDF';
  }
  if (resource.resourceType === 'document_page') {
    return resource.document?.title ?? 'Σελίδα PDF';
  }
  return resource.resourceType === 'text_note' ? 'Σημείωση' : 'Σύνδεσμος';
}

function ResourceIcon({ type }: { type: RoadmapResource['resourceType'] }) {
  if (type === 'external_url') return <ExternalLink size={16} />;
  if (type === 'text_note') return <StickyNote size={16} />;
  return <FileText size={16} />;
}

export function RoadmapDetailsPanel({
  node,
  nodes,
  progressPending,
  onClose,
  onDelete,
  onEdit,
  onOpenResource,
  onProgress,
}: {
  node: ProfessorRoadmapNode | StudentRoadmapNode;
  nodes: (ProfessorRoadmapNode | StudentRoadmapNode)[];
  progressPending: boolean;
  onClose: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onOpenResource: (resource: RoadmapResource) => void;
  onProgress: (status: 'in_progress' | 'completed') => void;
}): React.JSX.Element {
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const isStudent = 'progress' in node;
  const prerequisiteTitles = node.prerequisiteNodeIds.map(
    (id) => nodes.find((candidate) => candidate.id === id)?.title ?? id,
  );

  return (
    <aside className="roadmap-details-panel" aria-label="Λεπτομέρειες κόμβου">
      <header>
        <div>
          <span className="roadmap-panel-kicker">Ενότητα χάρτη</span>
          <h2>{node.title}</h2>
        </div>
        <button
          aria-label="Κλείσιμο λεπτομερειών"
          className="icon-button"
          type="button"
          onClick={onClose}
        >
          <X aria-hidden="true" size={18} />
        </button>
      </header>

      <div className="roadmap-panel-scroll">
        {node.description && (
          <p className="roadmap-description">{node.description}</p>
        )}
        <dl className="roadmap-node-facts">
          <div>
            <dt>Δυσκολία</dt>
            <dd>
              {node.difficulty
                ? difficultyLabels[node.difficulty]
                : 'Δεν ορίστηκε'}
            </dd>
          </div>
          <div>
            <dt>Χρόνος</dt>
            <dd>
              {node.estimatedMinutes ? `${node.estimatedMinutes} λεπτά` : '—'}
            </dd>
          </div>
        </dl>

        {node.learningObjective && (
          <section className="roadmap-panel-section">
            <h3>Μαθησιακός στόχος</h3>
            <p>{node.learningObjective}</p>
          </section>
        )}

        <section className="roadmap-panel-section">
          <h3>Προαπαιτούμενα</h3>
          {prerequisiteTitles.length === 0 ? (
            <p>Δεν υπάρχουν προαπαιτούμενα.</p>
          ) : (
            <ul>
              {prerequisiteTitles.map((title, index) => (
                <li key={node.prerequisiteNodeIds[index]}>{title}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="roadmap-panel-section">
          <h3>Πόροι μελέτης</h3>
          {node.resources.length === 0 ? (
            <p>Δεν έχουν προστεθεί πόροι.</p>
          ) : (
            <div className="roadmap-resource-list">
              {node.resources.map((resource) => (
                <div className="roadmap-resource-item" key={resource.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenResource(resource);
                      if (resource.resourceType === 'text_note') {
                        setExpandedNoteId((current) =>
                          current === resource.id ? null : resource.id,
                        );
                      }
                    }}
                  >
                    <ResourceIcon type={resource.resourceType} />
                    <span>
                      <strong>{resourceLabel(resource)}</strong>
                      {(resource.pageStart || resource.sectionLabel) && (
                        <small>
                          {resource.sectionLabel
                            ? resource.sectionLabel
                            : `Σελίδα ${resource.pageStart}`}
                        </small>
                      )}
                    </span>
                  </button>
                  {resource.resourceType === 'text_note' &&
                    expandedNoteId === resource.id && (
                      <p className="roadmap-text-note">{resource.content}</p>
                    )}
                </div>
              ))}
            </div>
          )}
        </section>

        {isStudent ? (
          <StudentProgressSection
            node={node}
            pending={progressPending}
            onProgress={onProgress}
          />
        ) : (
          <ProfessorProgressSection node={node} />
        )}
      </div>

      {!isStudent && onEdit && onDelete && (
        <div className="roadmap-panel-actions">
          <button className="primary-button" type="button" onClick={onEdit}>
            <Pencil aria-hidden="true" size={16} />
            Επεξεργασία
          </button>
          <button className="danger-button" type="button" onClick={onDelete}>
            <Trash2 aria-hidden="true" size={16} />
            Διαγραφή
          </button>
        </div>
      )}
    </aside>
  );
}

function StudentProgressSection({
  node,
  pending,
  onProgress,
}: {
  node: StudentRoadmapNode;
  pending: boolean;
  onProgress: (status: 'in_progress' | 'completed') => void;
}) {
  if (node.isLocked) {
    return (
      <section className="roadmap-progress-callout is-locked">
        <Lock aria-hidden="true" size={18} />
        <div>
          <strong>Η ενότητα είναι κλειδωμένη</strong>
          <p>Ολοκλήρωσε όλα τα προαπαιτούμενα για να συνεχίσεις.</p>
        </div>
      </section>
    );
  }

  const status = node.progress.status;
  const isResourceBased = node.completionRule === 'view_resource';
  let label = 'Έναρξη';
  let nextStatus: 'in_progress' | 'completed' = 'in_progress';

  if (status === 'in_progress') {
    label = isResourceBased ? 'Ολοκλήρωσα τη μελέτη' : 'Ολοκλήρωση';
    nextStatus = 'completed';
  } else if (status === 'completed' || status === 'needs_review') {
    label = 'Επιστροφή σε εξέλιξη';
  }

  return (
    <section className="roadmap-progress-callout">
      <Clock3 aria-hidden="true" size={18} />
      <div>
        <strong>Προσωπική πρόοδος</strong>
        {status === 'not_started' && isResourceBased ? (
          <p>Άνοιξε έναν πόρο για να ξεκινήσεις τη μελέτη.</p>
        ) : (
          <button
            className="primary-button"
            disabled={pending}
            type="button"
            onClick={() => onProgress(nextStatus)}
          >
            {pending ? 'Ενημέρωση…' : label}
          </button>
        )}
      </div>
    </section>
  );
}

function ProfessorProgressSection({ node }: { node: ProfessorRoadmapNode }) {
  const summary = node.progressSummary;
  return (
    <section className="roadmap-panel-section">
      <h3>Συγκεντρωτική πρόοδος</h3>
      <div className="roadmap-progress-summary">
        <strong>{summary.completionPercentage}%</strong>
        <span>
          {summary.completedCount} από {summary.enrolledStudentCount} ενεργούς
          φοιτητές ολοκλήρωσαν την ενότητα
        </span>
      </div>
      <dl className="roadmap-progress-counts">
        <div>
          <dt>Δεν ξεκίνησαν</dt>
          <dd>{summary.notStartedCount}</dd>
        </div>
        <div>
          <dt>Σε εξέλιξη</dt>
          <dd>{summary.inProgressCount}</dd>
        </div>
        <div>
          <dt>Επανάληψη</dt>
          <dd>{summary.needsReviewCount}</dd>
        </div>
      </dl>
    </section>
  );
}
