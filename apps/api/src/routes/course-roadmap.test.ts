import type { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { RoadmapResponseSchema } from '@web-app/contracts';

import { createApp } from '../app.js';
import type { AuditLogger } from '../auth/audit-log.js';
import type { SessionService } from '../auth/session.js';
import { env } from '../config/env.js';

const courseId = '11111111-1111-4111-8111-111111111111';
const professorId = '22222222-2222-4222-8222-222222222222';
const studentId = '33333333-3333-4333-8333-333333333333';
const secondStudentId = '44444444-4444-4444-8444-444444444444';
const nodeAId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const nodeBId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const conceptAId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const conceptBId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const documentId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const hiddenDocumentId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const createdNodeId = '99999999-9999-4999-8999-999999999999';
const createdConceptId = '88888888-8888-4888-8888-888888888888';
const now = new Date('2026-09-17T10:00:00.000Z');

interface TestOptions {
  completedPrerequisite?: boolean;
  completedSecondNode?: boolean;
  nodeInUse?: boolean;
}

function authCookie(): string {
  return `${env.SESSION_COOKIE_NAME}=test-token`;
}

function nodeRecord(
  id: string,
  conceptId: string,
  title: string,
  incomingEdges: { fromNodeId: string }[],
  progress: Array<{
    studentId: string;
    status: 'in_progress' | 'completed' | 'needs_review';
    startedAt: Date | null;
    completedAt: Date | null;
    needsReviewReason: string | null;
  }>,
) {
  return {
    id,
    courseId,
    conceptId,
    createdById: professorId,
    title,
    description: `${title} description`,
    learningObjective: `${title} objective`,
    estimatedMinutes: 30,
    difficulty: 'medium' as const,
    completionRule: 'manual' as const,
    orderIndex: id === nodeAId ? 1 : 2,
    createdAt: now,
    updatedAt: now,
    incomingEdges,
    progress,
    resources: [],
  };
}

function createTestContext(options: TestOptions = {}) {
  const auditLogger: AuditLogger = {
    logAuditEvent: vi.fn().mockResolvedValue(undefined),
  };
  const events: Array<Record<string, unknown>> = [];
  const progressRows: Array<Record<string, unknown>> = [];
  const completedProgress = options.completedPrerequisite
    ? [
        {
          studentId,
          status: 'completed' as const,
          startedAt: now,
          completedAt: now,
          needsReviewReason: null,
        },
      ]
    : [];
  const secondNodeProgress = options.completedSecondNode
    ? [
        {
          studentId,
          status: 'completed' as const,
          startedAt: now,
          completedAt: now,
          needsReviewReason: null,
        },
      ]
    : [];
  const nodes = [
    nodeRecord(nodeAId, conceptAId, 'Βασικές έννοιες', [], completedProgress),
    nodeRecord(
      nodeBId,
      conceptBId,
      'Επόμενη ενότητα',
      [{ fromNodeId: nodeAId }],
      secondNodeProgress,
    ),
  ];
  const edges = [
    {
      id: '12121212-1212-4121-8121-121212121212',
      courseId,
      fromNodeId: nodeAId,
      toNodeId: nodeBId,
      createdAt: now,
    },
  ];

  const course = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      where.id === courseId ? { id: courseId, isActive: true } : null,
    ),
  };
  const courseInstructor = {
    findUnique: vi.fn(async () => ({ id: 'assignment' })),
  };
  const enrollment = {
    findUnique: vi.fn(async () => ({ status: 'active' })),
    findMany: vi.fn(async () => [
      { studentId },
      { studentId: secondStudentId },
    ]),
  };
  const roadmapNode = {
    aggregate: vi.fn(async () => ({ _max: { orderIndex: 2 } })),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: createdNodeId,
      ...data,
    })),
    delete: vi.fn(),
    findFirst: vi.fn(
      async ({
        where,
        include,
      }: {
        where: { id: string };
        include?: unknown;
      }) => {
        const node = nodes.find((item) => item.id === where.id) ?? null;
        if (!node) return null;
        if (include && '_count' in (include as Record<string, unknown>)) {
          return { ...node, _count: { resources: node.resources.length } };
        }
        return node;
      },
    ),
    findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
      const ids = (where?.id as { in?: string[] } | undefined)?.in;
      if (ids) return nodes.filter((node) => ids.includes(node.id));
      return nodes;
    }),
    update: vi.fn(),
  };
  const roadmapEdge = {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(async () => edges),
  };
  const roadmapProgress = {
    count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      if (options.nodeInUse && where.roadmapNodeId === nodeBId) return 1;
      if (where.status === 'completed') {
        return options.completedPrerequisite ? 1 : 0;
      }
      return 0;
    }),
    upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => {
      progressRows.push(create);
      return create;
    }),
  };
  const document = {
    findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.includes(documentId) ? [{ id: documentId }] : [],
    ),
  };
  const concept = {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: createdConceptId,
      ...data,
    })),
    delete: vi.fn(),
    findUnique: vi.fn(async () => null),
    update: vi.fn(),
  };
  const analyticsEvent = {
    count: vi.fn(async () => 0),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      events.push(data);
      return data;
    }),
  };
  const emptyCountDelegate = { count: vi.fn(async () => 0) };
  const roadmapNodeResource = {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const delegates = {
    analyticsEvent,
    annotation: emptyCountDelegate,
    concept,
    course,
    courseInstructor,
    document,
    enrollment,
    forumThread: emptyCountDelegate,
    roadmapEdge,
    roadmapNode,
    roadmapNodeResource,
    roadmapProgress,
    selfCheck: emptyCountDelegate,
    teachingIntervention: emptyCountDelegate,
  };
  const prisma = {
    ...delegates,
    $transaction: vi.fn(
      async <T>(callback: (tx: typeof delegates) => Promise<T>) =>
        callback(delegates),
    ),
  };

  function sessionServiceFor(role: UserRole, userId: string): SessionService {
    return {
      createSession: vi.fn(),
      getSession: vi.fn(async (token) =>
        token
          ? {
              id: 'test-session',
              expiresAt: new Date(now.getTime() + 60_000),
              user: {
                id: userId,
                email: `${userId}@example.edu`,
                fullName: 'Test User',
                role,
                isActive: true,
              },
            }
          : null,
      ),
      revokeSession: vi.fn(),
    };
  }

  function appAs(role: UserRole, userId: string) {
    return createApp({
      auditLogger,
      courseRoadmapPrisma: prisma as unknown as Pick<
        PrismaClient,
        | '$transaction'
        | 'analyticsEvent'
        | 'annotation'
        | 'concept'
        | 'course'
        | 'courseInstructor'
        | 'document'
        | 'enrollment'
        | 'forumThread'
        | 'roadmapEdge'
        | 'roadmapNode'
        | 'roadmapNodeResource'
        | 'roadmapProgress'
        | 'selfCheck'
        | 'teachingIntervention'
      >,
      sessionService: sessionServiceFor(role, userId),
    });
  }

  return {
    appAs,
    concept,
    events,
    progressRows,
    roadmapEdge,
    roadmapNode,
    roadmapNodeResource,
  };
}

const validNodeInput = {
  title: 'Νέα ενότητα',
  description: null,
  learningObjective: null,
  estimatedMinutes: 20,
  difficulty: 'low',
  completionRule: 'manual',
  prerequisiteNodeIds: [] as string[],
  resources: [] as unknown[],
};

describe('course roadmap routes', () => {
  it('returns student progress and locks nodes until every prerequisite is complete', async () => {
    const { appAs } = createTestContext();
    const response = await request(appAs('student', studentId))
      .get(`/api/courses/${courseId}/roadmap`)
      .set('Cookie', authCookie())
      .expect(200);

    const body = RoadmapResponseSchema.parse(response.body);
    expect(body.data.view).toBe('student');
    if (body.data.view !== 'student') return;
    expect(body.data.nodes.find((node) => node.id === nodeBId)).toMatchObject({
      isLocked: true,
      unmetPrerequisiteNodeIds: [nodeAId],
      progress: { status: 'not_started' },
    });
  });

  it('returns anonymous aggregate progress to professors', async () => {
    const { appAs } = createTestContext({ completedPrerequisite: true });
    const response = await request(appAs('professor', professorId))
      .get(`/api/courses/${courseId}/roadmap`)
      .set('Cookie', authCookie())
      .expect(200);

    const body = RoadmapResponseSchema.parse(response.body);
    expect(body.data.view).toBe('professor');
    if (body.data.view !== 'professor') return;
    expect(body.data.nodes[0].progressSummary).toEqual({
      enrolledStudentCount: 2,
      notStartedCount: 1,
      inProgressCount: 0,
      completedCount: 1,
      needsReviewCount: 0,
      completionPercentage: 50,
    });
    expect(JSON.stringify(body)).not.toContain(studentId);
  });

  it('keeps an already completed node unlocked after a new prerequisite', async () => {
    const { appAs } = createTestContext({ completedSecondNode: true });
    const response = await request(appAs('student', studentId))
      .get(`/api/courses/${courseId}/roadmap`)
      .set('Cookie', authCookie())
      .expect(200);

    const body = RoadmapResponseSchema.parse(response.body);
    if (body.data.view !== 'student') return;
    expect(body.data.nodes.find((node) => node.id === nodeBId)).toMatchObject({
      isLocked: false,
      unmetPrerequisiteNodeIds: [nodeAId],
      progress: { status: 'completed' },
    });
  });

  it('rejects student authoring', async () => {
    const { appAs } = createTestContext();
    await request(appAs('student', studentId))
      .post(`/api/courses/${courseId}/roadmap/nodes`)
      .set('Cookie', authCookie())
      .send(validNodeInput)
      .expect(403);
  });

  it('rejects hidden or cross-course document resources', async () => {
    const { appAs } = createTestContext();
    const response = await request(appAs('professor', professorId))
      .post(`/api/courses/${courseId}/roadmap/nodes`)
      .set('Cookie', authCookie())
      .send({
        ...validNodeInput,
        completionRule: 'view_resource',
        resources: [
          {
            resourceType: 'document_page',
            documentId: hiddenDocumentId,
            pageStart: 1,
            pageEnd: null,
            title: null,
          },
        ],
      })
      .expect(400);

    expect(response.body.error.code).toBe('ROADMAP_INVALID_DOCUMENT_RESOURCE');
  });

  it('creates the concept, node, prerequisites and resources in one transaction', async () => {
    const { appAs, concept, roadmapEdge, roadmapNode, roadmapNodeResource } =
      createTestContext();
    const response = await request(appAs('professor', professorId))
      .post(`/api/courses/${courseId}/roadmap/nodes`)
      .set('Cookie', authCookie())
      .send({
        ...validNodeInput,
        prerequisiteNodeIds: [nodeAId],
        resources: [
          {
            resourceType: 'text_note',
            title: 'Σημείωση',
            content: 'Μελέτησε πρώτα τον βασικό ορισμό.',
          },
        ],
      })
      .expect(201);

    expect(response.body.data.id).toBe(createdNodeId);
    expect(concept.create).toHaveBeenCalledOnce();
    expect(roadmapNode.create).toHaveBeenCalledOnce();
    expect(roadmapEdge.createMany).toHaveBeenCalledOnce();
    expect(roadmapNodeResource.createMany).toHaveBeenCalledOnce();
  });

  it('rejects prerequisite cycles on update', async () => {
    const { appAs } = createTestContext();
    const response = await request(appAs('professor', professorId))
      .patch(`/api/courses/${courseId}/roadmap/nodes/${nodeAId}`)
      .set('Cookie', authCookie())
      .send({ ...validNodeInput, prerequisiteNodeIds: [nodeBId] })
      .expect(409);

    expect(response.body.error.code).toBe('ROADMAP_CYCLE_DETECTED');
  });

  it('rejects progress updates while prerequisites remain incomplete', async () => {
    const { appAs } = createTestContext();
    const response = await request(appAs('student', studentId))
      .patch(`/api/courses/${courseId}/roadmap/nodes/${nodeBId}/progress`)
      .set('Cookie', authCookie())
      .send({ status: 'in_progress' })
      .expect(409);

    expect(response.body.error.code).toBe('ROADMAP_PREREQUISITES_INCOMPLETE');
  });

  it('records start and completion events for a direct completion', async () => {
    const { appAs, events, progressRows } = createTestContext();
    await request(appAs('student', studentId))
      .patch(`/api/courses/${courseId}/roadmap/nodes/${nodeAId}/progress`)
      .set('Cookie', authCookie())
      .send({ status: 'completed' })
      .expect(200);

    expect(progressRows[0]).toMatchObject({
      roadmapNodeId: nodeAId,
      studentId,
      status: 'completed',
    });
    expect(events.map((event) => event.eventType)).toEqual([
      'roadmap_node_started',
      'roadmap_node_completed',
    ]);
  });

  it('blocks deletion when the node has learning activity', async () => {
    const { appAs, roadmapNode } = createTestContext({ nodeInUse: true });
    const response = await request(appAs('professor', professorId))
      .delete(`/api/courses/${courseId}/roadmap/nodes/${nodeBId}`)
      .set('Cookie', authCookie())
      .expect(409);

    expect(response.body.error.code).toBe('ROADMAP_NODE_IN_USE');
    expect(roadmapNode.delete).not.toHaveBeenCalled();
  });
});
