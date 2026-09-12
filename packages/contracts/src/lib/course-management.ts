import { z } from 'zod';

import { PaginationMetaSchema, PaginationQuerySchema } from './common.js';
import {
  CourseInstructorRoleSchema,
  DocumentStatusSchema,
  DocumentVisibilitySchema,
  EnrollmentStatusSchema,
  UserRoleSchema,
} from './enums.js';

export const CourseIdParamsSchema = z.object({
  courseId: z.uuid(),
});

export const CourseMemberIdParamsSchema = CourseIdParamsSchema.extend({
  userId: z.uuid(),
});

export const CourseDocumentIdParamsSchema = CourseIdParamsSchema.extend({
  documentId: z.uuid(),
});

export const CourseStatusFilterSchema = z.enum([
  'all',
  'active',
  'inactive',
]);

export const CourseSemesterSchema = z.coerce.number().int().min(1).max(12);

export const CourseEctsCreditsSchema = z.coerce.number().int().min(1).max(60);

export const CourseCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/);

export const CourseDescriptionInputSchema = z
  .string()
  .trim()
  .max(2_000)
  .nullable()
  .optional();

export const CourseDocumentTitleSchema = z.string().trim().min(1).max(160);

export const CourseDocumentDescriptionInputSchema = z
  .string()
  .trim()
  .max(2_000)
  .nullable()
  .optional();

export const CourseDocumentFilenameInputSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .nullable()
  .optional();

export const CourseDocumentMimeTypeInputSchema = z
  .string()
  .trim()
  .min(1)
  .max(127)
  .nullable()
  .optional();

export const CourseDocumentFileSizeInputSchema = z.coerce
  .number()
  .int()
  .nonnegative()
  .nullable()
  .optional();

export const CourseDocumentPageCountInputSchema = z.coerce
  .number()
  .int()
  .nonnegative()
  .nullable()
  .optional();

export const CourseCreateRequestSchema = z.object({
  code: CourseCodeSchema,
  title: z.string().trim().min(1).max(160),
  semester: CourseSemesterSchema,
  ectsCredits: CourseEctsCreditsSchema,
  description: CourseDescriptionInputSchema,
});

export const CourseUpdateRequestSchema = CourseCreateRequestSchema.partial()
  .extend({
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one course field must be provided.',
  });

export const CourseListQuerySchema = PaginationQuerySchema.extend({
  search: z.string().trim().min(1).max(120).optional(),
  semester: CourseSemesterSchema.optional(),
  status: CourseStatusFilterSchema.default('all'),
});

export const CourseMemberCandidateRoleSchema = z.enum([
  'professor',
  'student',
]);

export const CourseMemberCandidatesQuerySchema = z.object({
  role: CourseMemberCandidateRoleSchema,
  search: z.string().trim().min(2).max(120),
});

export const CourseMemberCandidateSchema = z.object({
  id: z.uuid(),
  fullName: z.string().min(1),
  email: z.email(),
  role: UserRoleSchema,
});

export const CourseMemberCandidatesResponseSchema = z.object({
  data: z.array(CourseMemberCandidateSchema),
});

export const CourseSummaryCountsSchema = z.object({
  instructorCount: z.number().int().nonnegative(),
  studentCount: z.number().int().nonnegative(),
  documentCount: z.number().int().nonnegative(),
});

export const CourseListItemSchema = z.object({
  id: z.uuid(),
  code: CourseCodeSchema,
  title: z.string().min(1),
  description: z.string().nullable(),
  semester: CourseSemesterSchema,
  ectsCredits: CourseEctsCreditsSchema,
  isActive: z.boolean(),
  counts: CourseSummaryCountsSchema,
  primaryInstructor: z
    .object({
      id: z.uuid(),
      fullName: z.string().min(1),
    })
    .nullable(),
});

export const CourseListResponseSchema = z.object({
  data: z.array(CourseListItemSchema),
  meta: PaginationMetaSchema,
  summary: z.object({
    totalCourses: z.number().int().nonnegative(),
    activeCourses: z.number().int().nonnegative(),
    unassignedCourses: z.number().int().nonnegative(),
  }),
});

export const CourseInstructorSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  fullName: z.string().min(1),
  email: z.email(),
  role: CourseInstructorRoleSchema,
  assignedAt: z.iso.datetime(),
});

export const AssignCourseInstructorRequestSchema = z.object({
  instructorId: z.uuid(),
  role: CourseInstructorRoleSchema.default('owner'),
});

export const CourseInstructorsResponseSchema = z.object({
  data: z.array(CourseInstructorSchema),
});

export const CourseEnrollmentSchema = z.object({
  id: z.uuid(),
  studentId: z.uuid(),
  fullName: z.string().min(1),
  email: z.email(),
  status: EnrollmentStatusSchema,
  enrolledAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const EnrollStudentRequestSchema = z.object({
  studentId: z.uuid(),
  status: EnrollmentStatusSchema.default('active'),
});

export const UpdateEnrollmentStatusRequestSchema = z.object({
  status: EnrollmentStatusSchema,
});

export const CourseEnrollmentsResponseSchema = z.object({
  data: z.array(CourseEnrollmentSchema),
});

export const CourseDocumentMetadataSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  description: z.string().nullable(),
  status: DocumentStatusSchema,
  visibility: DocumentVisibilitySchema,
  originalFilename: z.string().nullable(),
  mimeType: z.string().nullable(),
  fileSizeBytes: z.number().int().nonnegative().nullable(),
  pageCount: z.number().int().nonnegative().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const CreateCourseDocumentRequestSchema = z.object({
  title: CourseDocumentTitleSchema,
  description: CourseDocumentDescriptionInputSchema,
  visibility: DocumentVisibilitySchema.default('hidden_from_students'),
  originalFilename: CourseDocumentFilenameInputSchema,
  mimeType: CourseDocumentMimeTypeInputSchema,
  fileSizeBytes: CourseDocumentFileSizeInputSchema,
  pageCount: CourseDocumentPageCountInputSchema,
});

export const UpdateCourseDocumentMetadataRequestSchema = z
  .object({
    title: CourseDocumentTitleSchema.optional(),
    description: CourseDocumentDescriptionInputSchema,
    status: DocumentStatusSchema.optional(),
    visibility: DocumentVisibilitySchema.optional(),
    originalFilename: CourseDocumentFilenameInputSchema,
    mimeType: CourseDocumentMimeTypeInputSchema,
    fileSizeBytes: CourseDocumentFileSizeInputSchema,
    pageCount: CourseDocumentPageCountInputSchema,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one document metadata field must be provided.',
  });

export const CourseDocumentsResponseSchema = z.object({
  data: z.array(CourseDocumentMetadataSchema),
});

export const CourseDocumentResponseSchema = z.object({
  data: CourseDocumentMetadataSchema,
});

export const CourseDetailSchema = CourseListItemSchema.extend({
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  instructors: z.array(CourseInstructorSchema),
  enrollments: z.array(CourseEnrollmentSchema),
  documents: z.array(CourseDocumentMetadataSchema),
});

export const CourseDetailResponseSchema = z.object({
  data: CourseDetailSchema,
});

export const CourseMutationResponseSchema = z.object({
  data: CourseDetailSchema,
});

export type CourseIdParams = z.infer<typeof CourseIdParamsSchema>;
export type CourseMemberIdParams = z.infer<typeof CourseMemberIdParamsSchema>;
export type CourseDocumentIdParams = z.infer<
  typeof CourseDocumentIdParamsSchema
>;
export type CourseStatusFilter = z.infer<typeof CourseStatusFilterSchema>;
export type CourseCreateRequest = z.infer<typeof CourseCreateRequestSchema>;
export type CourseUpdateRequest = z.infer<typeof CourseUpdateRequestSchema>;
export type CourseListQuery = z.infer<typeof CourseListQuerySchema>;
export type CourseMemberCandidateRole = z.infer<
  typeof CourseMemberCandidateRoleSchema
>;
export type CourseMemberCandidatesQuery = z.infer<
  typeof CourseMemberCandidatesQuerySchema
>;
export type CourseMemberCandidate = z.infer<
  typeof CourseMemberCandidateSchema
>;
export type CourseMemberCandidatesResponse = z.infer<
  typeof CourseMemberCandidatesResponseSchema
>;
export type CourseSummaryCounts = z.infer<typeof CourseSummaryCountsSchema>;
export type CourseListItem = z.infer<typeof CourseListItemSchema>;
export type CourseListResponse = z.infer<typeof CourseListResponseSchema>;
export type CourseInstructor = z.infer<typeof CourseInstructorSchema>;
export type AssignCourseInstructorRequest = z.infer<
  typeof AssignCourseInstructorRequestSchema
>;
export type CourseInstructorsResponse = z.infer<
  typeof CourseInstructorsResponseSchema
>;
export type CourseEnrollment = z.infer<typeof CourseEnrollmentSchema>;
export type EnrollStudentRequest = z.infer<typeof EnrollStudentRequestSchema>;
export type UpdateEnrollmentStatusRequest = z.infer<
  typeof UpdateEnrollmentStatusRequestSchema
>;
export type CourseEnrollmentsResponse = z.infer<
  typeof CourseEnrollmentsResponseSchema
>;
export type CourseDocumentMetadata = z.infer<
  typeof CourseDocumentMetadataSchema
>;
export type CreateCourseDocumentRequest = z.infer<
  typeof CreateCourseDocumentRequestSchema
>;
export type UpdateCourseDocumentMetadataRequest = z.infer<
  typeof UpdateCourseDocumentMetadataRequestSchema
>;
export type CourseDocumentsResponse = z.infer<
  typeof CourseDocumentsResponseSchema
>;
export type CourseDocumentResponse = z.infer<
  typeof CourseDocumentResponseSchema
>;
export type CourseDetail = z.infer<typeof CourseDetailSchema>;
export type CourseDetailResponse = z.infer<typeof CourseDetailResponseSchema>;
export type CourseMutationResponse = z.infer<
  typeof CourseMutationResponseSchema
>;
