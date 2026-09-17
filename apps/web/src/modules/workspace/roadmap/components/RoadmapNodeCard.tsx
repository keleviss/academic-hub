import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  BarChart3,
  CheckCircle2,
  Circle,
  Clock3,
  Lock,
  RotateCcw,
} from 'lucide-react';
import type {
  ProfessorRoadmapNode,
  StudentRoadmapNode,
} from '@web-app/contracts';

export interface RoadmapFlowNodeData extends Record<string, unknown> {
  direction: 'horizontal' | 'vertical';
  node: ProfessorRoadmapNode | StudentRoadmapNode;
  selected: boolean;
}

function studentStatus(node: StudentRoadmapNode) {
  if (node.isLocked) {
    return { Icon: Lock, className: 'is-locked', label: 'Κλειδωμένο' };
  }
  switch (node.progress.status) {
    case 'completed':
      return {
        Icon: CheckCircle2,
        className: 'is-completed',
        label: 'Ολοκληρώθηκε',
      };
    case 'in_progress':
      return { Icon: Clock3, className: 'is-progress', label: 'Σε εξέλιξη' };
    case 'needs_review':
      return {
        Icon: RotateCcw,
        className: 'is-review',
        label: 'Χρειάζεται επανάληψη',
      };
    default:
      return { Icon: Circle, className: 'is-pending', label: 'Δεν ξεκίνησε' };
  }
}

function RoadmapNodeCardComponent({ data }: NodeProps) {
  const typedData = data as RoadmapFlowNodeData;
  const { direction, node, selected } = typedData;
  const isStudent = 'progress' in node;
  const status = isStudent ? studentStatus(node) : null;
  const StatusIcon = status?.Icon;
  const horizontal = direction === 'horizontal';

  return (
    <article
      className={`roadmap-node-card${selected ? ' is-selected' : ''}${
        status ? ` ${status.className}` : ''
      }`}
    >
      <Handle
        type="target"
        position={horizontal ? Position.Left : Position.Top}
        isConnectable={false}
      />
      <div className="roadmap-node-card-heading">
        {isStudent && StatusIcon ? (
          <span className="roadmap-node-status-icon" aria-hidden="true">
            <StatusIcon size={16} />
          </span>
        ) : (
          <span className="roadmap-node-status-icon" aria-hidden="true">
            <BarChart3 size={16} />
          </span>
        )}
        <span className="roadmap-node-kicker">
          {isStudent
            ? status?.label
            : `${node.progressSummary.completionPercentage}% ολοκλήρωση`}
        </span>
      </div>
      <strong>{node.title}</strong>
      <span className="roadmap-node-meta">
        {node.estimatedMinutes
          ? `${node.estimatedMinutes} λεπτά`
          : 'Χωρίς εκτίμηση χρόνου'}
      </span>
      <Handle
        type="source"
        position={horizontal ? Position.Right : Position.Bottom}
        isConnectable={false}
      />
    </article>
  );
}

export const RoadmapNodeCard = memo(RoadmapNodeCardComponent);
