import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  CourseDocumentMetadata,
  ProfessorRoadmapNode,
  RoadmapResourceInput,
  UpsertRoadmapNodeRequest,
} from '@web-app/contracts';

type ResourceType = RoadmapResourceInput['resourceType'];

interface ResourceDraft {
  content: string;
  documentId: string;
  externalUrl: string;
  pageEnd: string;
  pageStart: string;
  resourceType: ResourceType;
  sectionLabel: string;
  title: string;
}

const resourceTypeLabels: Record<ResourceType, string> = {
  document_page: 'Σελίδα PDF',
  document_section: 'Ενότητα PDF',
  external_url: 'Εξωτερικός σύνδεσμος',
  text_note: 'Σημείωση κειμένου',
};

function emptyResource(
  resourceType: ResourceType = 'document_page',
): ResourceDraft {
  return {
    content: '',
    documentId: '',
    externalUrl: '',
    pageEnd: '',
    pageStart: '1',
    resourceType,
    sectionLabel: '',
    title: '',
  };
}

function existingResources(node: ProfessorRoadmapNode | null): ResourceDraft[] {
  return (
    node?.resources.map((resource) => ({
      content: resource.content ?? '',
      documentId: resource.document?.id ?? '',
      externalUrl: resource.externalUrl ?? '',
      pageEnd: resource.pageEnd ? String(resource.pageEnd) : '',
      pageStart: resource.pageStart ? String(resource.pageStart) : '1',
      resourceType: resource.resourceType,
      sectionLabel: resource.sectionLabel ?? '',
      title: resource.title ?? '',
    })) ?? []
  );
}

function toResourceInput(resource: ResourceDraft): RoadmapResourceInput {
  const title = resource.title.trim();
  switch (resource.resourceType) {
    case 'document_page':
      return {
        resourceType: 'document_page',
        documentId: resource.documentId,
        pageStart: Number(resource.pageStart),
        pageEnd: resource.pageEnd ? Number(resource.pageEnd) : null,
        title: title || null,
      };
    case 'document_section':
      return {
        resourceType: 'document_section',
        documentId: resource.documentId,
        pageStart: Number(resource.pageStart),
        pageEnd: Number(resource.pageEnd),
        sectionLabel: resource.sectionLabel.trim(),
        title: title || null,
      };
    case 'external_url':
      return {
        resourceType: 'external_url',
        externalUrl: resource.externalUrl.trim(),
        title,
      };
    case 'text_note':
      return {
        resourceType: 'text_note',
        title,
        content: resource.content.trim(),
      };
  }
}

export function RoadmapNodeForm({
  node,
  nodes,
  documents,
  pending,
  onCancel,
  onSubmit,
}: {
  node: ProfessorRoadmapNode | null;
  nodes: ProfessorRoadmapNode[];
  documents: CourseDocumentMetadata[];
  pending: boolean;
  onCancel: () => void;
  onSubmit: (input: UpsertRoadmapNodeRequest) => void;
}): React.JSX.Element {
  const [title, setTitle] = useState(node?.title ?? '');
  const [description, setDescription] = useState(node?.description ?? '');
  const [learningObjective, setLearningObjective] = useState(
    node?.learningObjective ?? '',
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    node?.estimatedMinutes ? String(node.estimatedMinutes) : '',
  );
  const [difficulty, setDifficulty] = useState<'' | 'low' | 'medium' | 'high'>(
    node?.difficulty ?? '',
  );
  const [completionRule, setCompletionRule] = useState<
    'manual' | 'view_resource'
  >(node?.completionRule === 'view_resource' ? 'view_resource' : 'manual');
  const [prerequisiteNodeIds, setPrerequisiteNodeIds] = useState(
    node?.prerequisiteNodeIds ?? [],
  );
  const [resources, setResources] = useState(() => existingResources(node));

  const eligibleDocuments = documents.filter(
    (document) =>
      document.status === 'active' &&
      document.visibility === 'visible_to_students',
  );

  const updateResource = (index: number, patch: Partial<ResourceDraft>) => {
    setResources((current) =>
      current.map((resource, resourceIndex) =>
        resourceIndex === index ? { ...resource, ...patch } : resource,
      ),
    );
  };

  return (
    <form
      className="roadmap-node-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          title: title.trim(),
          description: description.trim() || null,
          learningObjective: learningObjective.trim() || null,
          estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null,
          difficulty: difficulty || null,
          completionRule,
          prerequisiteNodeIds,
          resources: resources.map(toResourceInput),
        });
      }}
    >
      <label>
        Τίτλος
        <input
          required
          maxLength={160}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label>
        Περιγραφή
        <textarea
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label>
        Μαθησιακός στόχος
        <textarea
          rows={2}
          value={learningObjective}
          onChange={(event) => setLearningObjective(event.target.value)}
        />
      </label>
      <div className="roadmap-form-grid">
        <label>
          Εκτιμώμενος χρόνος (λεπτά)
          <input
            min={1}
            type="number"
            value={estimatedMinutes}
            onChange={(event) => setEstimatedMinutes(event.target.value)}
          />
        </label>
        <label>
          Δυσκολία
          <select
            value={difficulty}
            onChange={(event) =>
              setDifficulty(
                event.target.value as '' | 'low' | 'medium' | 'high',
              )
            }
          >
            <option value="">Χωρίς επιλογή</option>
            <option value="low">Χαμηλή</option>
            <option value="medium">Μεσαία</option>
            <option value="high">Υψηλή</option>
          </select>
        </label>
      </div>
      <label>
        Τρόπος ολοκλήρωσης
        <select
          value={completionRule}
          onChange={(event) =>
            setCompletionRule(event.target.value as 'manual' | 'view_resource')
          }
        >
          <option value="manual">Χειροκίνητη επιβεβαίωση</option>
          <option value="view_resource">Μελέτη πόρου</option>
        </select>
      </label>
      <label>
        Προαπαιτούμενα
        <select
          multiple
          size={Math.min(Math.max(nodes.length - 1, 2), 5)}
          value={prerequisiteNodeIds}
          onChange={(event) =>
            setPrerequisiteNodeIds(
              Array.from(
                event.target.selectedOptions,
                (option) => option.value,
              ),
            )
          }
        >
          {nodes
            .filter((candidate) => candidate.id !== node?.id)
            .map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.title}
              </option>
            ))}
        </select>
        <small>Χρησιμοποίησε Ctrl/Cmd για πολλαπλή επιλογή.</small>
      </label>

      <section className="roadmap-resource-editor">
        <div className="roadmap-section-heading">
          <div>
            <h3>Πόροι</h3>
            <p>PDF, σύνδεσμοι ή σύντομες σημειώσεις μελέτης.</p>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              setResources((current) => [...current, emptyResource()])
            }
          >
            <Plus aria-hidden="true" size={16} />
            Προσθήκη
          </button>
        </div>
        {resources.map((resource, index) => (
          <fieldset className="roadmap-resource-form" key={index}>
            <legend>Πόρος {index + 1}</legend>
            <button
              aria-label={`Αφαίρεση πόρου ${index + 1}`}
              className="icon-button roadmap-resource-remove"
              type="button"
              onClick={() =>
                setResources((current) =>
                  current.filter((_, resourceIndex) => resourceIndex !== index),
                )
              }
            >
              <Trash2 aria-hidden="true" size={16} />
            </button>
            <label>
              Τύπος
              <select
                value={resource.resourceType}
                onChange={(event) =>
                  updateResource(
                    index,
                    emptyResource(event.target.value as ResourceType),
                  )
                }
              >
                {Object.entries(resourceTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {(resource.resourceType === 'document_page' ||
              resource.resourceType === 'document_section') && (
              <>
                <label>
                  Έγγραφο
                  <select
                    required
                    value={resource.documentId}
                    onChange={(event) =>
                      updateResource(index, { documentId: event.target.value })
                    }
                  >
                    <option value="">Επιλογή εγγράφου</option>
                    {eligibleDocuments.map((document) => (
                      <option key={document.id} value={document.id}>
                        {document.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="roadmap-form-grid">
                  <label>
                    Από σελίδα
                    <input
                      required
                      min={1}
                      type="number"
                      value={resource.pageStart}
                      onChange={(event) =>
                        updateResource(index, { pageStart: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Έως σελίδα
                    <input
                      required={resource.resourceType === 'document_section'}
                      min={resource.pageStart || 1}
                      type="number"
                      value={resource.pageEnd}
                      onChange={(event) =>
                        updateResource(index, { pageEnd: event.target.value })
                      }
                    />
                  </label>
                </div>
              </>
            )}
            {resource.resourceType === 'document_section' && (
              <label>
                Ονομασία ενότητας
                <input
                  required
                  value={resource.sectionLabel}
                  onChange={(event) =>
                    updateResource(index, { sectionLabel: event.target.value })
                  }
                />
              </label>
            )}
            {resource.resourceType === 'external_url' && (
              <label>
                URL
                <input
                  required
                  type="url"
                  placeholder="https://…"
                  value={resource.externalUrl}
                  onChange={(event) =>
                    updateResource(index, { externalUrl: event.target.value })
                  }
                />
              </label>
            )}
            <label>
              Τίτλος
              <input
                required={
                  resource.resourceType === 'external_url' ||
                  resource.resourceType === 'text_note'
                }
                value={resource.title}
                onChange={(event) =>
                  updateResource(index, { title: event.target.value })
                }
              />
            </label>
            {resource.resourceType === 'text_note' && (
              <label>
                Κείμενο
                <textarea
                  required
                  rows={4}
                  value={resource.content}
                  onChange={(event) =>
                    updateResource(index, { content: event.target.value })
                  }
                />
              </label>
            )}
          </fieldset>
        ))}
      </section>
      <div className="roadmap-panel-actions">
        <button className="primary-button" disabled={pending} type="submit">
          {pending ? 'Αποθήκευση…' : node ? 'Αποθήκευση' : 'Δημιουργία'}
        </button>
        <button className="secondary-button" type="button" onClick={onCancel}>
          Άκυρο
        </button>
      </div>
    </form>
  );
}
