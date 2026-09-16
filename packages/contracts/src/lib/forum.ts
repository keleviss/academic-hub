import { z } from 'zod';

import { CourseIdParamsSchema, CourseDocumentAnnotationSchema } from './course-management.js';
import {
  ForumCategoryKindSchema,
  ForumThreadStatusSchema,
  UserRoleSchema,
} from './enums.js';

export const ForumThreadIdParamsSchema = CourseIdParamsSchema.extend({
  threadId: z.uuid(),
});

export const ForumPostIdParamsSchema = ForumThreadIdParamsSchema.extend({
  postId: z.uuid(),
});

export const forumThreadVisibilityValues = ['public', 'instructor_only'] as const;
export const ForumThreadVisibilitySchema = z.enum(forumThreadVisibilityValues);

export const forumThreadFilterValues = [
  'all',
  'general',
  'document',
  'unanswered',
  'resolved',
] as const;
export const ForumThreadFilterSchema = z.enum(forumThreadFilterValues);

export const ForumThreadListQuerySchema = z.object({
  filter: ForumThreadFilterSchema.default('all'),
  documentId: z.uuid().optional(),
});

export const ForumThreadAuthorSchema = z.object({
  id: z.uuid(),
  fullName: z.string().min(1),
  role: UserRoleSchema,
});

export const ForumPostSchema = z.object({
  id: z.uuid(),
  threadId: z.uuid(),
  author: ForumThreadAuthorSchema,
  body: z.string().min(1),
  isVerified: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const ForumThreadListItemSchema = z.object({
  id: z.uuid(),
  courseId: z.uuid(),
  categoryKind: ForumCategoryKindSchema,
  documentId: z.uuid().nullable(),
  annotationId: z.uuid().nullable(),
  title: z.string().min(1),
  status: ForumThreadStatusSchema,
  visibility: ForumThreadVisibilitySchema,
  pageNumber: z.number().int().min(1).nullable(),
  selectedText: z.string().nullable(),
  documentTitle: z.string().nullable(),
  author: ForumThreadAuthorSchema,
  postCount: z.number().int().nonnegative(),
  verifiedPostId: z.uuid().nullable(),
  lastPostAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const ForumThreadDetailSchema = ForumThreadListItemSchema.extend({
  openingBody: z.string().nullable(),
  posts: z.array(ForumPostSchema),
});

export const CreateForumThreadRequestSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(4_000),
  visibility: ForumThreadVisibilitySchema,
});

export const UpdateForumThreadRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    visibility: ForumThreadVisibilitySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one thread field must be provided.',
  });

export const CreateForumPostRequestSchema = z.object({
  body: z.string().trim().min(1).max(4_000),
});

export const UpdateForumPostRequestSchema = z.object({
  body: z.string().trim().min(1).max(4_000),
});

export const ForumThreadsResponseSchema = z.object({
  data: z.array(ForumThreadListItemSchema),
});

export const ForumThreadResponseSchema = z.object({
  data: ForumThreadDetailSchema,
});

export const StudentDocumentActivitySummarySchema = z.object({
  annotations: z.array(CourseDocumentAnnotationSchema),
  openQuestions: z.array(ForumThreadListItemSchema),
  verifiedAnswers: z.array(ForumThreadListItemSchema),
});

export const StudentDocumentActivitySummaryResponseSchema = z.object({
  data: StudentDocumentActivitySummarySchema,
});

export type ForumThreadIdParams = z.infer<typeof ForumThreadIdParamsSchema>;
export type ForumPostIdParams = z.infer<typeof ForumPostIdParamsSchema>;
export type ForumThreadVisibility = z.infer<typeof ForumThreadVisibilitySchema>;
export type ForumThreadFilter = z.infer<typeof ForumThreadFilterSchema>;
export type ForumThreadListQuery = z.infer<typeof ForumThreadListQuerySchema>;
export type ForumThreadAuthor = z.infer<typeof ForumThreadAuthorSchema>;
export type ForumPost = z.infer<typeof ForumPostSchema>;
export type ForumThreadListItem = z.infer<typeof ForumThreadListItemSchema>;
export type ForumThreadDetail = z.infer<typeof ForumThreadDetailSchema>;
export type CreateForumThreadRequest = z.infer<
  typeof CreateForumThreadRequestSchema
>;
export type UpdateForumThreadRequest = z.infer<
  typeof UpdateForumThreadRequestSchema
>;
export type CreateForumPostRequest = z.infer<
  typeof CreateForumPostRequestSchema
>;
export type UpdateForumPostRequest = z.infer<
  typeof UpdateForumPostRequestSchema
>;
export type ForumThreadsResponse = z.infer<typeof ForumThreadsResponseSchema>;
export type ForumThreadResponse = z.infer<typeof ForumThreadResponseSchema>;
export type StudentDocumentActivitySummary = z.infer<
  typeof StudentDocumentActivitySummarySchema
>;
export type StudentDocumentActivitySummaryResponse = z.infer<
  typeof StudentDocumentActivitySummaryResponseSchema
>;
