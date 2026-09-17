import { z } from 'zod';

import { CourseIdParamsSchema } from './course-management.js';
import {
  CompletionRuleSchema,
  DifficultyLevelSchema,
  RoadmapProgressStatusSchema,
  RoadmapResourceTypeSchema,
} from './enums.js';

export const RoadmapNodeIdParamsSchema = CourseIdParamsSchema.extend({
  nodeId: z.uuid(),
});

const NullableTrimmedTextSchema = (max: number) =>
  z.string().trim().max(max).nullable();

export const RoadmapDocumentSummarySchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
});

export const RoadmapResourceSchema = z.object({
  id: z.uuid(),
  resourceType: RoadmapResourceTypeSchema,
  document: RoadmapDocumentSummarySchema.nullable(),
  pageStart: z.number().int().positive().nullable(),
  pageEnd: z.number().int().positive().nullable(),
  sectionLabel: z.string().nullable(),
  externalUrl: z.string().nullable(),
  title: z.string().nullable(),
  content: z.string().nullable(),
  orderIndex: z.number().int().nonnegative(),
});

export const RoadmapEdgeSchema = z.object({
  id: z.uuid(),
  fromNodeId: z.uuid(),
  toNodeId: z.uuid(),
});

const RoadmapNodeBaseSchema = z.object({
  id: z.uuid(),
  conceptId: z.uuid().nullable(),
  title: z.string().min(1),
  description: z.string().nullable(),
  learningObjective: z.string().nullable(),
  estimatedMinutes: z.number().int().positive().nullable(),
  difficulty: DifficultyLevelSchema.nullable(),
  completionRule: CompletionRuleSchema,
  orderIndex: z.number().int().nonnegative(),
  prerequisiteNodeIds: z.array(z.uuid()),
  resources: z.array(RoadmapResourceSchema),
});

export const StudentRoadmapProgressSchema = z.object({
  status: RoadmapProgressStatusSchema,
  startedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  needsReviewReason: z.string().nullable(),
});

export const StudentRoadmapNodeSchema = RoadmapNodeBaseSchema.extend({
  progress: StudentRoadmapProgressSchema,
  isLocked: z.boolean(),
  unmetPrerequisiteNodeIds: z.array(z.uuid()),
});

export const ProfessorRoadmapProgressSummarySchema = z.object({
  enrolledStudentCount: z.number().int().nonnegative(),
  notStartedCount: z.number().int().nonnegative(),
  inProgressCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  needsReviewCount: z.number().int().nonnegative(),
  completionPercentage: z.number().min(0).max(100),
});

export const ProfessorRoadmapNodeSchema = RoadmapNodeBaseSchema.extend({
  progressSummary: ProfessorRoadmapProgressSummarySchema,
});

const RoadmapGraphBaseSchema = z.object({
  edges: z.array(RoadmapEdgeSchema),
});

export const StudentRoadmapGraphSchema = RoadmapGraphBaseSchema.extend({
  view: z.literal('student'),
  nodes: z.array(StudentRoadmapNodeSchema),
});

export const ProfessorRoadmapGraphSchema = RoadmapGraphBaseSchema.extend({
  view: z.literal('professor'),
  nodes: z.array(ProfessorRoadmapNodeSchema),
});

export const RoadmapGraphSchema = z.discriminatedUnion('view', [
  StudentRoadmapGraphSchema,
  ProfessorRoadmapGraphSchema,
]);

export const RoadmapResponseSchema = z.object({ data: RoadmapGraphSchema });

const DocumentPageResourceInputSchema = z.object({
  resourceType: z.literal('document_page'),
  documentId: z.uuid(),
  pageStart: z.number().int().positive(),
  pageEnd: z.number().int().positive().nullable().default(null),
  title: NullableTrimmedTextSchema(160).default(null),
});

const DocumentSectionResourceInputSchema = z.object({
  resourceType: z.literal('document_section'),
  documentId: z.uuid(),
  pageStart: z.number().int().positive(),
  pageEnd: z.number().int().positive(),
  sectionLabel: z.string().trim().min(1).max(160),
  title: NullableTrimmedTextSchema(160).default(null),
});

const ExternalUrlResourceInputSchema = z.object({
  resourceType: z.literal('external_url'),
  externalUrl: z.url().refine((value) => /^https?:\/\//i.test(value), {
    message: 'Only HTTP and HTTPS URLs are supported.',
  }),
  title: z.string().trim().min(1).max(160),
});

const TextNoteResourceInputSchema = z.object({
  resourceType: z.literal('text_note'),
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().min(1).max(10_000),
});

export const RoadmapResourceInputSchema = z
  .discriminatedUnion('resourceType', [
    DocumentPageResourceInputSchema,
    DocumentSectionResourceInputSchema,
    ExternalUrlResourceInputSchema,
    TextNoteResourceInputSchema,
  ])
  .refine(
    (resource) =>
      (resource.resourceType !== 'document_page' ||
        resource.pageEnd === null ||
        resource.pageEnd >= resource.pageStart) &&
      (resource.resourceType !== 'document_section' ||
        resource.pageEnd >= resource.pageStart),
    { message: 'Page end must be greater than or equal to page start.' },
  );

export const UpsertRoadmapNodeRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: NullableTrimmedTextSchema(4_000).default(null),
    learningObjective: NullableTrimmedTextSchema(1_000).default(null),
    estimatedMinutes: z.number().int().positive().max(10_080).nullable(),
    difficulty: DifficultyLevelSchema.nullable(),
    completionRule: z.enum(['manual', 'view_resource']),
    prerequisiteNodeIds: z.array(z.uuid()).max(100),
    resources: z.array(RoadmapResourceInputSchema).max(50),
  })
  .superRefine((value, context) => {
    if (
      new Set(value.prerequisiteNodeIds).size !==
      value.prerequisiteNodeIds.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['prerequisiteNodeIds'],
        message: 'Prerequisites must be unique.',
      });
    }

    if (
      value.completionRule === 'view_resource' &&
      value.resources.length === 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['resources'],
        message: 'A resource-based node must include at least one resource.',
      });
    }
  });

export const UpdateRoadmapProgressRequestSchema = z.object({
  status: z.enum(['in_progress', 'completed']),
});

export const RoadmapNodeMutationResponseSchema = z.object({
  data: z.object({ id: z.uuid() }),
});

export const RoadmapNodeDeleteResponseSchema = z.object({
  data: z.object({ id: z.uuid(), deleted: z.literal(true) }),
});

export type RoadmapNodeIdParams = z.infer<typeof RoadmapNodeIdParamsSchema>;
export type RoadmapResource = z.infer<typeof RoadmapResourceSchema>;
export type RoadmapEdge = z.infer<typeof RoadmapEdgeSchema>;
export type StudentRoadmapNode = z.infer<typeof StudentRoadmapNodeSchema>;
export type ProfessorRoadmapNode = z.infer<typeof ProfessorRoadmapNodeSchema>;
export type StudentRoadmapGraph = z.infer<typeof StudentRoadmapGraphSchema>;
export type ProfessorRoadmapGraph = z.infer<typeof ProfessorRoadmapGraphSchema>;
export type RoadmapResponse = z.infer<typeof RoadmapResponseSchema>;
export type RoadmapResourceInput = z.infer<typeof RoadmapResourceInputSchema>;
export type UpsertRoadmapNodeRequest = z.infer<
  typeof UpsertRoadmapNodeRequestSchema
>;
export type UpdateRoadmapProgressRequest = z.infer<
  typeof UpdateRoadmapProgressRequestSchema
>;
export type RoadmapNodeMutationResponse = z.infer<
  typeof RoadmapNodeMutationResponseSchema
>;
export type RoadmapNodeDeleteResponse = z.infer<
  typeof RoadmapNodeDeleteResponseSchema
>;
