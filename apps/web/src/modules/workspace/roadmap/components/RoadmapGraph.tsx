import { useEffect, useMemo, useState } from 'react';
import dagre from '@dagrejs/dagre';
import {
  Controls,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type {
  ProfessorRoadmapGraph,
  StudentRoadmapGraph,
} from '@web-app/contracts';

import { RoadmapNodeCard, type RoadmapFlowNodeData } from './RoadmapNodeCard';

const nodeTypes = { roadmapNode: RoadmapNodeCard };
const NODE_WIDTH = 264;
const NODE_HEIGHT = 116;

function useVerticalLayout(): boolean {
  const [vertical, setVertical] = useState(
    () => window.matchMedia('(max-width: 767px)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setVertical(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return vertical;
}

function layoutGraph(
  graph: StudentRoadmapGraph | ProfessorRoadmapGraph,
  vertical: boolean,
  selectedNodeId: string | null,
): { nodes: Node<RoadmapFlowNodeData>[]; edges: Edge[] } {
  const layout = new dagre.graphlib.Graph();
  layout.setGraph({
    rankdir: vertical ? 'TB' : 'LR',
    nodesep: 36,
    ranksep: 72,
    marginx: 28,
    marginy: 28,
  });
  layout.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) {
    layout.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of graph.edges) {
    layout.setEdge(edge.fromNodeId, edge.toNodeId);
  }
  dagre.layout(layout);

  return {
    nodes: graph.nodes.map((node) => {
      const position = layout.node(node.id) as { x: number; y: number };
      return {
        id: node.id,
        type: 'roadmapNode',
        position: {
          x: position.x - NODE_WIDTH / 2,
          y: position.y - NODE_HEIGHT / 2,
        },
        data: {
          direction: vertical ? 'vertical' : 'horizontal',
          node,
          selected: node.id === selectedNodeId,
        },
        draggable: false,
        connectable: false,
        selectable: true,
      };
    }),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.fromNodeId,
      target: edge.toNodeId,
      type: 'smoothstep',
      animated: false,
      style: { stroke: 'var(--color-hub-border)', strokeWidth: 1.5 },
    })),
  };
}

export function RoadmapGraph({
  graph,
  selectedNodeId,
  onSelectNode,
}: {
  graph: StudentRoadmapGraph | ProfessorRoadmapGraph;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}): React.JSX.Element {
  const vertical = useVerticalLayout();
  const flow = useMemo(
    () => layoutGraph(graph, vertical, selectedNodeId),
    [graph, selectedNodeId, vertical],
  );
  const handleNodeClick: NodeMouseHandler = (_, node) => onSelectNode(node.id);

  return (
    <div className="roadmap-graph" aria-label="Γράφος χάρτη ύλης">
      <ReactFlow
        key={vertical ? 'vertical' : 'horizontal'}
        nodes={flow.nodes}
        edges={flow.edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.35}
        maxZoom={1.5}
        onNodeClick={handleNodeClick}
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          showInteractive={false}
          position="bottom-left"
          aria-label="Χειριστήρια μεγέθυνσης χάρτη"
        />
      </ReactFlow>
    </div>
  );
}
