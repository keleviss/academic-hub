import type { Prisma, PrismaClient } from '@prisma/client';
import { Router, type Request } from 'express';
import {
  CourseIdParamsSchema,
  RoadmapNodeDeleteResponseSchema,
  RoadmapNodeIdParamsSchema,
  RoadmapNodeMutationResponseSchema,
  RoadmapResponseSchema,
  UpdateRoadmapProgressRequestSchema,
  UpsertRoadmapNodeRequestSchema,
  type RoadmapResourceInput,
  type UpdateRoadmapProgressRequest,
  type UpsertRoadmapNodeRequest,
} from '@web-app/contracts';

import { createAuditLogger, type AuditLogger } from '../auth/audit-log.js';
import {
  createAuthorizationService,
  type AuthorizationService,
} from '../auth/authorization-service.js';
import {
  requireRole,
  type AuthorizationMiddlewareOptions,
} from '../auth/authorization-middleware.js';
import type { SessionService } from '../auth/session.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/http-error.js';
import { prisma as defaultPrisma } from '../lib/prisma.js';
import { validateRequest } from '../lib/request-validation.js';
import { sendJson } from '../lib/send-json.js';

type RoadmapPrismaClient = Pick<
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
>;

export interface CourseRoadmapRouteOptions {
  auditLogger?: AuditLogger;
  authorizationService?: AuthorizationService;
  prisma?: RoadmapPrismaClient;
  sessionService?: SessionService;
}

const roadmapNodeInclude = {
  incomingEdges: { select: { fromNodeId: true } },
  progress: true,
  resources: {
    include: { document: true },
    orderBy: { orderIndex: 'asc' as const },
  },
} satisfies Prisma.RoadmapNodeInclude;

type RoadmapNodeRecord = Prisma.RoadmapNodeGetPayload<{
  include: typeof roadmapNodeInclude;
}>;

export function createCourseRoadmapRouter(
  options: CourseRoadmapRouteOptions = {},
): Router {
  const router = Router({ mergeParams: true });
  const prisma = options.prisma ?? defaultPrisma;
  const auditLogger = options.auditLogger ?? createAuditLogger();
  const authorization =
    options.authorizationService ??
    createAuthorizationService({ auditLogger, prisma });
  const gateOptions: AuthorizationMiddlewareOptions = {
    auditLogger,
    sessionService: options.sessionService,
  };

  router.get(
    '/',
    requireRole(['professor', 'student'], gateOptions),
    validateRequest({ params: CourseIdParamsSchema }),
    asyncHandler(async (request, response) => {
      const { courseId } = request.params as { courseId: string };
      const user = request.currentSession!.user;

      if (user.role === 'professor') {
        await authorization.assertProfessorCourseAccess(
          user,
          courseId,
          requestContext(request),
        );
      } else {
        await authorization.assertStudentCourseAccess(
          user,
          courseId,
          requestContext(request),
        );
      }

      const [nodeResults, edges] = await Promise.all([
        prisma.roadmapNode.findMany({
          where: { courseId },
          include: roadmapNodeInclude,
          orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
        }),
        prisma.roadmapEdge.findMany({
          where: { courseId },
          orderBy: { createdAt: 'asc' },
        }),
      ]);
      const nodes = nodeResults as RoadmapNodeRecord[];

      const data =
        user.role === 'professor'
          ? await professorGraph(prisma, courseId, nodes, edges)
          : studentGraph(nodes, edges, user.id);

      sendJson(response, 200, RoadmapResponseSchema, { data });
    }),
  );

  router.post(
    '/nodes',
    requireRole(['professor'], gateOptions),
    validateRequest({ body: UpsertRoadmapNodeRequestSchema }),
    asyncHandler(async (request, response) => {
      const { courseId } = request.params as { courseId: string };
      const user = request.currentSession!.user;
      const input = request.body as UpsertRoadmapNodeRequest;
      await authorization.assertProfessorCourseAccess(
        user,
        courseId,
        requestContext(request),
      );
      await validateRoadmapInput(prisma, courseId, null, input);

      const node = await prisma.$transaction(async (tx) => {
        const order = await tx.roadmapNode.aggregate({
          where: { courseId },
          _max: { orderIndex: true },
        });
        const concept = await tx.concept.create({
          data: {
            courseId,
            createdById: user.id,
            slug: await uniqueConceptSlug(tx, courseId, input.title),
            title: input.title,
            description: input.description,
            learningObjective: input.learningObjective,
            orderIndex: (order._max?.orderIndex ?? 0) + 1,
          },
        });
        const created = await tx.roadmapNode.create({
          data: {
            courseId,
            conceptId: concept.id,
            createdById: user.id,
            title: input.title,
            description: input.description,
            learningObjective: input.learningObjective,
            estimatedMinutes: input.estimatedMinutes,
            difficulty: input.difficulty,
            completionRule: input.completionRule,
            orderIndex: concept.orderIndex,
          },
        });
        await replaceNodeRelations(tx, created.id, courseId, input);
        return created;
      });

      sendJson(response, 201, RoadmapNodeMutationResponseSchema, {
        data: { id: node.id },
      });
    }),
  );

  router.patch(
    '/nodes/:nodeId',
    requireRole(['professor'], gateOptions),
    validateRequest({
      params: RoadmapNodeIdParamsSchema,
      body: UpsertRoadmapNodeRequestSchema,
    }),
    asyncHandler(async (request, response) => {
      const { courseId, nodeId } = request.params as {
        courseId: string;
        nodeId: string;
      };
      const user = request.currentSession!.user;
      const input = request.body as UpsertRoadmapNodeRequest;
      await authorization.assertProfessorCourseAccess(
        user,
        courseId,
        requestContext(request),
      );
      const existing = await findCourseNode(prisma, courseId, nodeId);
      await validateRoadmapInput(prisma, courseId, nodeId, input);

      await prisma.$transaction(async (tx) => {
        let conceptId = existing.conceptId;
        if (conceptId) {
          await tx.concept.update({
            where: { id: conceptId },
            data: {
              title: input.title,
              description: input.description,
              learningObjective: input.learningObjective,
            },
          });
        } else {
          const concept = await tx.concept.create({
            data: {
              courseId,
              createdById: user.id,
              slug: await uniqueConceptSlug(tx, courseId, input.title),
              title: input.title,
              description: input.description,
              learningObjective: input.learningObjective,
              orderIndex: existing.orderIndex,
            },
          });
          conceptId = concept.id;
        }

        await tx.roadmapNode.update({
          where: { id: nodeId },
          data: {
            conceptId,
            title: input.title,
            description: input.description,
            learningObjective: input.learningObjective,
            estimatedMinutes: input.estimatedMinutes,
            difficulty: input.difficulty,
            completionRule: input.completionRule,
          },
        });
        await replaceNodeRelations(tx, nodeId, courseId, input);
      });

      sendJson(response, 200, RoadmapNodeMutationResponseSchema, {
        data: { id: nodeId },
      });
    }),
  );

  router.delete(
    '/nodes/:nodeId',
    requireRole(['professor'], gateOptions),
    validateRequest({ params: RoadmapNodeIdParamsSchema }),
    asyncHandler(async (request, response) => {
      const { courseId, nodeId } = request.params as {
        courseId: string;
        nodeId: string;
      };
      const user = request.currentSession!.user;
      await authorization.assertProfessorCourseAccess(
        user,
        courseId,
        requestContext(request),
      );
      const node = await findCourseNode(prisma, courseId, nodeId);
      await assertNodeCanBeDeleted(prisma, nodeId);

      await prisma.$transaction(async (tx) => {
        await tx.roadmapNode.delete({ where: { id: nodeId } });
        if (node.conceptId) {
          const concept = await tx.concept.findUnique({
            where: { id: node.conceptId },
            select: {
              _count: {
                select: {
                  analyticsEvents: true,
                  annotations: true,
                  forumThreads: true,
                  roadmapNodes: true,
                  selfChecks: true,
                  teachingInterventions: true,
                },
              },
            },
          });
          if (
            concept &&
            Object.values(concept._count).every((count) => count === 0)
          ) {
            await tx.concept.delete({ where: { id: node.conceptId } });
          }
        }
      });

      sendJson(response, 200, RoadmapNodeDeleteResponseSchema, {
        data: { id: nodeId, deleted: true },
      });
    }),
  );

  router.patch(
    '/nodes/:nodeId/progress',
    requireRole(['student'], gateOptions),
    validateRequest({
      params: RoadmapNodeIdParamsSchema,
      body: UpdateRoadmapProgressRequestSchema,
    }),
    asyncHandler(async (request, response) => {
      const { courseId, nodeId } = request.params as {
        courseId: string;
        nodeId: string;
      };
      const user = request.currentSession!.user;
      const input = request.body as UpdateRoadmapProgressRequest;
      await authorization.assertStudentCourseAccess(
        user,
        courseId,
        requestContext(request),
      );
      const nodeResult = await prisma.roadmapNode.findFirst({
        where: { id: nodeId, courseId },
        include: {
          incomingEdges: { select: { fromNodeId: true } },
          progress: { where: { studentId: user.id } },
          _count: { select: { resources: true } },
        },
      });
      const node = nodeResult as Prisma.RoadmapNodeGetPayload<{
        include: {
          incomingEdges: { select: { fromNodeId: true } };
          progress: true;
          _count: { select: { resources: true } };
        };
      }> | null;
      if (!node) throw notFound();
      if (node.completionRule === 'self_check') {
        throw new HttpError(
          409,
          'This node requires a self-check.',
          undefined,
          'ROADMAP_SELF_CHECK_REQUIRED',
        );
      }
      if (
        node.completionRule === 'view_resource' &&
        node._count.resources === 0
      ) {
        throw new HttpError(
          409,
          'This node has no available resource.',
          undefined,
          'ROADMAP_RESOURCE_REQUIRED',
        );
      }

      const current = node.progress[0] ?? null;
      const revertingCompleted =
        current?.status === 'completed' && input.status === 'in_progress';
      if (!revertingCompleted && current?.status !== 'completed') {
        await assertPrerequisitesCompleted(
          prisma,
          node.incomingEdges.map((edge) => edge.fromNodeId),
          user.id,
        );
      }

      const now = new Date();
      await prisma.$transaction(async (tx) => {
        await tx.roadmapProgress.upsert({
          where: {
            roadmapNodeId_studentId: {
              roadmapNodeId: nodeId,
              studentId: user.id,
            },
          },
          create: {
            roadmapNodeId: nodeId,
            studentId: user.id,
            status: input.status,
            startedAt: now,
            completedAt: input.status === 'completed' ? now : null,
          },
          update: {
            status: input.status,
            startedAt: current?.startedAt ?? now,
            completedAt: input.status === 'completed' ? now : null,
            needsReviewReason: null,
          },
        });

        if (!current && input.status === 'in_progress') {
          await createProgressEvent(tx, {
            courseId,
            conceptId: node.conceptId,
            nodeId,
            studentId: user.id,
            eventType: 'roadmap_node_started',
          });
        }
        if (input.status === 'completed' && current?.status !== 'completed') {
          if (!current) {
            await createProgressEvent(tx, {
              courseId,
              conceptId: node.conceptId,
              nodeId,
              studentId: user.id,
              eventType: 'roadmap_node_started',
            });
          }
          await createProgressEvent(tx, {
            courseId,
            conceptId: node.conceptId,
            nodeId,
            studentId: user.id,
            eventType: 'roadmap_node_completed',
          });
        }
      });

      sendJson(response, 200, RoadmapNodeMutationResponseSchema, {
        data: { id: nodeId },
      });
    }),
  );

  return router;
}

async function professorGraph(
  prisma: RoadmapPrismaClient,
  courseId: string,
  nodes: RoadmapNodeRecord[],
  edges: { id: string; fromNodeId: string; toNodeId: string }[],
) {
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId, status: 'active' },
    select: { studentId: true },
  });
  const studentIds = new Set(enrollments.map((item) => item.studentId));
  const enrolledStudentCount = studentIds.size;

  return {
    view: 'professor' as const,
    edges: edges.map(toEdge),
    nodes: nodes.map((node) => {
      const progress = node.progress.filter((item) =>
        studentIds.has(item.studentId),
      );
      const completedCount = progress.filter(
        (item) => item.status === 'completed',
      ).length;
      return {
        ...toBaseNode(node, false),
        progressSummary: {
          enrolledStudentCount,
          notStartedCount: Math.max(enrolledStudentCount - progress.length, 0),
          inProgressCount: progress.filter(
            (item) => item.status === 'in_progress',
          ).length,
          completedCount,
          needsReviewCount: progress.filter(
            (item) => item.status === 'needs_review',
          ).length,
          completionPercentage:
            enrolledStudentCount === 0
              ? 0
              : Math.round((completedCount / enrolledStudentCount) * 100),
        },
      };
    }),
  };
}

function studentGraph(
  nodes: RoadmapNodeRecord[],
  edges: { id: string; fromNodeId: string; toNodeId: string }[],
  studentId: string,
) {
  const completedNodeIds = new Set(
    nodes
      .filter((node) =>
        node.progress.some(
          (progress) =>
            progress.studentId === studentId && progress.status === 'completed',
        ),
      )
      .map((node) => node.id),
  );

  return {
    view: 'student' as const,
    edges: edges.map(toEdge),
    nodes: nodes.map((node) => {
      const progress =
        node.progress.find((item) => item.studentId === studentId) ?? null;
      const unmetPrerequisiteNodeIds = node.incomingEdges
        .map((edge) => edge.fromNodeId)
        .filter((id) => !completedNodeIds.has(id));
      const completed = progress?.status === 'completed';
      return {
        ...toBaseNode(node, true),
        progress: {
          status: progress?.status ?? 'not_started',
          startedAt: progress?.startedAt?.toISOString() ?? null,
          completedAt: progress?.completedAt?.toISOString() ?? null,
          needsReviewReason: progress?.needsReviewReason ?? null,
        },
        isLocked: !completed && unmetPrerequisiteNodeIds.length > 0,
        unmetPrerequisiteNodeIds,
      };
    }),
  };
}

function toBaseNode(node: RoadmapNodeRecord, studentView: boolean) {
  return {
    id: node.id,
    conceptId: node.conceptId,
    title: node.title,
    description: node.description,
    learningObjective: node.learningObjective,
    estimatedMinutes: node.estimatedMinutes,
    difficulty: node.difficulty,
    completionRule: node.completionRule,
    orderIndex: node.orderIndex,
    prerequisiteNodeIds: node.incomingEdges.map((edge) => edge.fromNodeId),
    resources: node.resources
      .filter(
        (resource) =>
          !studentView ||
          !resource.document ||
          (resource.document.status === 'active' &&
            resource.document.visibility === 'visible_to_students'),
      )
      .map((resource) => ({
        id: resource.id,
        resourceType: resource.resourceType,
        document: resource.document
          ? { id: resource.document.id, title: resource.document.title }
          : null,
        pageStart: resource.pageStart,
        pageEnd: resource.pageEnd,
        sectionLabel: resource.sectionLabel,
        externalUrl: resource.externalUrl,
        title: resource.title,
        content: resource.content,
        orderIndex: resource.orderIndex,
      })),
  };
}

function toEdge(edge: { id: string; fromNodeId: string; toNodeId: string }) {
  return {
    id: edge.id,
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
  };
}

async function validateRoadmapInput(
  prisma: RoadmapPrismaClient,
  courseId: string,
  nodeId: string | null,
  input: UpsertRoadmapNodeRequest,
): Promise<void> {
  if (nodeId && input.prerequisiteNodeIds.includes(nodeId)) {
    throw new HttpError(
      400,
      'A node cannot be its own prerequisite.',
      undefined,
      'ROADMAP_SELF_PREREQUISITE',
    );
  }

  const prerequisites = await prisma.roadmapNode.findMany({
    where: { id: { in: input.prerequisiteNodeIds }, courseId },
    select: { id: true },
  });
  if (prerequisites.length !== input.prerequisiteNodeIds.length) {
    throw new HttpError(
      400,
      'Every prerequisite must belong to the course.',
      undefined,
      'ROADMAP_INVALID_PREREQUISITE',
    );
  }

  const documentIds = [
    ...new Set(
      input.resources.flatMap((resource) =>
        resource.resourceType === 'document_page' ||
        resource.resourceType === 'document_section'
          ? [resource.documentId]
          : [],
      ),
    ),
  ];
  const documents = await prisma.document.findMany({
    where: {
      id: { in: documentIds },
      courseId,
      status: 'active',
      visibility: 'visible_to_students',
    },
    select: { id: true, pageCount: true },
  });
  if (documents.length !== documentIds.length) {
    throw new HttpError(
      400,
      'Document resources must be active and visible in this course.',
      undefined,
      'ROADMAP_INVALID_DOCUMENT_RESOURCE',
    );
  }
  const pageCountByDocumentId = new Map(
    documents.map((document) => [document.id, document.pageCount]),
  );
  const hasInvalidPageRange = input.resources.some((resource) => {
    if (
      resource.resourceType !== 'document_page' &&
      resource.resourceType !== 'document_section'
    ) {
      return false;
    }
    const pageCount = pageCountByDocumentId.get(resource.documentId);
    if (!pageCount) return false;
    const lastPage = resource.pageEnd ?? resource.pageStart;
    return resource.pageStart > pageCount || lastPage > pageCount;
  });
  if (hasInvalidPageRange) {
    throw new HttpError(
      400,
      'Document page ranges must stay within the PDF page count.',
      undefined,
      'ROADMAP_INVALID_PAGE_RANGE',
    );
  }

  if (nodeId) {
    const existingEdges = await prisma.roadmapEdge.findMany({
      where: { courseId },
      select: { fromNodeId: true, toNodeId: true },
    });
    const proposedEdges = [
      ...existingEdges.filter((edge) => edge.toNodeId !== nodeId),
      ...input.prerequisiteNodeIds.map((fromNodeId) => ({
        fromNodeId,
        toNodeId: nodeId,
      })),
    ];
    if (containsCycle(proposedEdges)) {
      throw new HttpError(
        409,
        'Prerequisites cannot create a cycle.',
        undefined,
        'ROADMAP_CYCLE_DETECTED',
      );
    }
  }
}

function containsCycle(
  edges: { fromNodeId: string; toNodeId: string }[],
): boolean {
  const outgoing = new Map<string, string[]>();
  const nodeIds = new Set<string>();
  for (const edge of edges) {
    nodeIds.add(edge.fromNodeId);
    nodeIds.add(edge.toNodeId);
    outgoing.set(edge.fromNodeId, [
      ...(outgoing.get(edge.fromNodeId) ?? []),
      edge.toNodeId,
    ]);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const target of outgoing.get(id) ?? []) {
      if (visit(target)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return [...nodeIds].some(visit);
}

async function replaceNodeRelations(
  tx: Prisma.TransactionClient,
  nodeId: string,
  courseId: string,
  input: UpsertRoadmapNodeRequest,
): Promise<void> {
  await tx.roadmapEdge.deleteMany({ where: { toNodeId: nodeId } });
  if (input.prerequisiteNodeIds.length > 0) {
    await tx.roadmapEdge.createMany({
      data: input.prerequisiteNodeIds.map((fromNodeId) => ({
        courseId,
        fromNodeId,
        toNodeId: nodeId,
      })),
    });
  }
  await tx.roadmapNodeResource.deleteMany({ where: { roadmapNodeId: nodeId } });
  if (input.resources.length > 0) {
    await tx.roadmapNodeResource.createMany({
      data: input.resources.map((resource, index) =>
        toResourceData(nodeId, resource, index),
      ),
    });
  }
}

function toResourceData(
  roadmapNodeId: string,
  resource: RoadmapResourceInput,
  orderIndex: number,
): Prisma.RoadmapNodeResourceCreateManyInput {
  const base = {
    roadmapNodeId,
    resourceType: resource.resourceType,
    orderIndex,
  };
  switch (resource.resourceType) {
    case 'document_page':
      return {
        ...base,
        documentId: resource.documentId,
        pageStart: resource.pageStart,
        pageEnd: resource.pageEnd,
        title: resource.title,
      };
    case 'document_section':
      return {
        ...base,
        documentId: resource.documentId,
        pageStart: resource.pageStart,
        pageEnd: resource.pageEnd,
        sectionLabel: resource.sectionLabel,
        title: resource.title,
      };
    case 'external_url':
      return {
        ...base,
        externalUrl: resource.externalUrl,
        title: resource.title,
      };
    case 'text_note':
      return {
        ...base,
        title: resource.title,
        content: resource.content,
      };
  }
}

async function findCourseNode(
  prisma: RoadmapPrismaClient,
  courseId: string,
  nodeId: string,
) {
  const node = await prisma.roadmapNode.findFirst({
    where: { id: nodeId, courseId },
  });
  if (!node) throw notFound();
  return node;
}

async function assertNodeCanBeDeleted(
  prisma: RoadmapPrismaClient,
  nodeId: string,
): Promise<void> {
  const counts = await Promise.all([
    prisma.roadmapProgress.count({ where: { roadmapNodeId: nodeId } }),
    prisma.selfCheck.count({ where: { roadmapNodeId: nodeId } }),
    prisma.annotation.count({ where: { roadmapNodeId: nodeId } }),
    prisma.forumThread.count({ where: { roadmapNodeId: nodeId } }),
    prisma.analyticsEvent.count({ where: { roadmapNodeId: nodeId } }),
    prisma.teachingIntervention.count({ where: { roadmapNodeId: nodeId } }),
  ]);
  if (counts.some((count) => count > 0)) {
    throw new HttpError(
      409,
      'A roadmap node with learning activity cannot be deleted.',
      undefined,
      'ROADMAP_NODE_IN_USE',
    );
  }
}

async function assertPrerequisitesCompleted(
  prisma: RoadmapPrismaClient,
  prerequisiteNodeIds: string[],
  studentId: string,
): Promise<void> {
  if (prerequisiteNodeIds.length === 0) return;
  const completedCount = await prisma.roadmapProgress.count({
    where: {
      roadmapNodeId: { in: prerequisiteNodeIds },
      studentId,
      status: 'completed',
    },
  });
  if (completedCount !== prerequisiteNodeIds.length) {
    throw new HttpError(
      409,
      'Complete every prerequisite before continuing.',
      { prerequisiteNodeIds },
      'ROADMAP_PREREQUISITES_INCOMPLETE',
    );
  }
}

async function createProgressEvent(
  tx: Prisma.TransactionClient,
  input: {
    courseId: string;
    conceptId: string | null;
    eventType: 'roadmap_node_started' | 'roadmap_node_completed';
    nodeId: string;
    studentId: string;
  },
): Promise<void> {
  await tx.analyticsEvent.create({
    data: {
      courseId: input.courseId,
      conceptId: input.conceptId,
      eventType: input.eventType,
      roadmapNodeId: input.nodeId,
      userId: input.studentId,
      metadata: {},
    },
  });
}

async function uniqueConceptSlug(
  tx: Prisma.TransactionClient,
  courseId: string,
  title: string,
): Promise<string> {
  const base =
    title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('el-GR')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'concept';
  let slug = base;
  let suffix = 2;
  while (
    await tx.concept.findUnique({
      where: { courseId_slug: { courseId, slug } },
    })
  ) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

function notFound(): HttpError {
  return new HttpError(404, 'Resource not found', undefined, 'NOT_FOUND');
}

function requestContext(request: Request) {
  return { method: request.method, route: request.originalUrl };
}
