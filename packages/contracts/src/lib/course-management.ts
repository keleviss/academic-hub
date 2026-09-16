import { z } from 'zod';

import { PaginationMetaSchema, PaginationQuerySchema } from './common.js';
import {
  AnnotationTypeSchema,
  AnnotationVisibilitySchema,
  CourseInstructorRoleSchema,
  DocumentStatusSchema,
  DocumentVisibilitySchema,
  EnrollmentStatusSchema,
  ForumThreadStatusSchema,
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

export const CourseDocumentAnnotationIdParamsSchema =
  CourseDocumentIdParamsSchema.extend({
    annotationId: z.uuid(),
  });

export const CourseDocumentQuestionIdParamsSchema =
  CourseDocumentIdParamsSchema.extend({
    threadId: z.uuid(),
  });

export const CourseStatusFilterSchema = z.enum(['all', 'active', 'inactive']);

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

export const CourseMemberCandidateRoleSchema = z.enum(['professor', 'student']);

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

// The uploaded PDF's filename, MIME type, size, and page count are derived
// server-side from the actual file, never trusted from client-supplied fields.
export const CreateCourseDocumentRequestSchema = z.object({
  title: CourseDocumentTitleSchema,
  description: CourseDocumentDescriptionInputSchema,
  visibility: DocumentVisibilitySchema.default('hidden_from_students'),
});

export const MAX_COURSE_DOCUMENT_UPLOAD_BYTES = 50 * 1024 * 1024;

// originalFilename/mimeType/fileSizeBytes/pageCount are derived from the stored file and are not client-editable.
export const UpdateCourseDocumentMetadataRequestSchema = z
  .object({
    title: CourseDocumentTitleSchema.optional(),
    description: CourseDocumentDescriptionInputSchema.optional(),
    status: DocumentStatusSchema.optional(),
    visibility: DocumentVisibilitySchema.optional(),
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

export const CourseDocumentAnnotationBodySchema = z
  .string()
  .trim()
  .max(2_000)
  .nullable()
  .optional();

export const CourseDocumentAnnotationSelectedTextSchema = z
  .string()
  .trim()
  .max(1_000)
  .nullable()
  .optional();

export const CourseDocumentAnnotationTargetSchema = z.object({
  id: z.uuid(),
  pageNumber: z.number().int().min(1),
  selectedText: z.string().nullable(),
});

export const CourseDocumentAnnotationAuthorSchema = z.object({
  id: z.uuid(),
  fullName: z.string().min(1),
  role: UserRoleSchema,
});

export const CourseDocumentAnnotationSchema = z.object({
  id: z.uuid(),
  courseId: z.uuid(),
  documentId: z.uuid(),
  target: CourseDocumentAnnotationTargetSchema,
  author: CourseDocumentAnnotationAuthorSchema,
  type: AnnotationTypeSchema,
  visibility: AnnotationVisibilitySchema,
  body: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const CreateCourseDocumentAnnotationRequestSchema = z.object({
  pageNumber: z.coerce.number().int().min(1).max(10_000),
  type: AnnotationTypeSchema,
  visibility: AnnotationVisibilitySchema,
  body: CourseDocumentAnnotationBodySchema,
  selectedText: CourseDocumentAnnotationSelectedTextSchema,
});

export const UpdateCourseDocumentAnnotationRequestSchema = z
  .object({
    type: AnnotationTypeSchema.optional(),
    visibility: AnnotationVisibilitySchema.optional(),
    body: CourseDocumentAnnotationBodySchema,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one annotation field must be provided.',
  });

export const CourseDocumentAnnotationsResponseSchema = z.object({
  data: z.array(CourseDocumentAnnotationSchema),
});

export const CourseDocumentAnnotationResponseSchema = z.object({
  data: CourseDocumentAnnotationSchema,
});

export const ContextualQuestionAuthorSchema = z.object({
  id: z.uuid(),
  fullName: z.string().min(1),
  role: UserRoleSchema,
});

export const ContextualQuestionAnswerSchema = z.object({
  id: z.uuid(),
  body: z.string().min(1),
  isVerified: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  author: ContextualQuestionAuthorSchema,
});

export const ContextualQuestionSchema = z.object({
  id: z.uuid(),
  courseId: z.uuid(),
  documentId: z.uuid().nullable(),
  annotationId: z.uuid().nullable(),
  title: z.string().min(1),
  status: ForumThreadStatusSchema,
  visibility: AnnotationVisibilitySchema,
  pageNumber: z.number().int().min(1).nullable(),
  selectedText: z.string().nullable(),
  documentTitle: z.string().nullable(),
  question: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  author: ContextualQuestionAuthorSchema,
  answer: ContextualQuestionAnswerSchema.nullable(),
});

export const ContextualQuestionsResponseSchema = z.object({
  data: z.array(ContextualQuestionSchema),
});

export const CreateContextualQuestionAnswerRequestSchema = z.object({
  body: z.string().trim().min(1).max(2_000),
  verified: z.boolean().optional().default(false),
});

export const UpdateContextualQuestionStatusRequestSchema = z.object({
  status: z.enum(['open', 'resolved']),
});

export const VerifyContextualQuestionAnswerRequestSchema = z.object({
  answerId: z.uuid(),
});

export const ContextualQuestionResponseSchema = z.object({
  data: ContextualQuestionSchema,
});

export const StudentDocumentActivitySummarySchema = z.object({
  annotations: z.array(CourseDocumentAnnotationSchema),
  openQuestions: z.array(ContextualQuestionSchema),
  verifiedAnswers: z.array(ContextualQuestionSchema),
});

export const StudentDocumentActivitySummaryResponseSchema = z.object({
  data: StudentDocumentActivitySummarySchema,
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

export const ProfessorCourseListItemSchema = z.object({
  id: z.uuid(),
  code: CourseCodeSchema,
  title: z.string().min(1),
  description: z.string().nullable(),
  semester: CourseSemesterSchema,
  ectsCredits: CourseEctsCreditsSchema,
  isActive: z.boolean(),
  instructorRole: CourseInstructorRoleSchema,
  counts: z.object({
    documentCount: z.number().int().nonnegative(),
    visibleDocumentCount: z.number().int().nonnegative(),
  }),
});

export const ProfessorCourseListResponseSchema = z.object({
  data: z.array(ProfessorCourseListItemSchema),
  summary: z.object({
    assignedCourseCount: z.number().int().nonnegative(),
  }),
});

export const ProfessorCourseDetailSchema = ProfessorCourseListItemSchema.extend(
  {
    studentCount: z.number().int().nonnegative(),
    instructors: z.array(CourseInstructorSchema),
  },
);

export const ProfessorCourseDetailResponseSchema = z.object({
  data: ProfessorCourseDetailSchema,
});

export const StudentCourseListItemSchema = z.object({
  id: z.uuid(),
  code: CourseCodeSchema,
  title: z.string().min(1),
  description: z.string().nullable(),
  semester: CourseSemesterSchema,
  ectsCredits: CourseEctsCreditsSchema,
  isActive: z.boolean(),
  counts: z.object({
    documentCount: z.number().int().nonnegative(),
  }),
  primaryInstructor: z
    .object({
      fullName: z.string().min(1),
    })
    .nullable(),
});

export const StudentCourseListResponseSchema = z.object({
  data: z.array(StudentCourseListItemSchema),
  summary: z.object({
    enrolledCourseCount: z.number().int().nonnegative(),
  }),
});

export const StudentCourseDetailSchema = StudentCourseListItemSchema.extend({
  instructors: z.array(CourseInstructorSchema),
});

export const StudentCourseDetailResponseSchema = z.object({
  data: StudentCourseDetailSchema,
});

export type CourseIdParams = z.infer<typeof CourseIdParamsSchema>;
export type CourseMemberIdParams = z.infer<typeof CourseMemberIdParamsSchema>;
export type CourseDocumentIdParams = z.infer<
  typeof CourseDocumentIdParamsSchema
>;
export type CourseDocumentAnnotationIdParams = z.infer<
  typeof CourseDocumentAnnotationIdParamsSchema
>;
export type CourseDocumentQuestionIdParams = z.infer<
  typeof CourseDocumentQuestionIdParamsSchema
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
export type CourseMemberCandidate = z.infer<typeof CourseMemberCandidateSchema>;
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
export type CourseDocumentAnnotation = z.infer<
  typeof CourseDocumentAnnotationSchema
>;
export type CreateCourseDocumentAnnotationRequest = z.infer<
  typeof CreateCourseDocumentAnnotationRequestSchema
>;
export type UpdateCourseDocumentAnnotationRequest = z.infer<
  typeof UpdateCourseDocumentAnnotationRequestSchema
>;
export type CourseDocumentAnnotationsResponse = z.infer<
  typeof CourseDocumentAnnotationsResponseSchema
>;
export type CourseDocumentAnnotationResponse = z.infer<
  typeof CourseDocumentAnnotationResponseSchema
>;
export type ContextualQuestionAuthor = z.infer<
  typeof ContextualQuestionAuthorSchema
>;
export type ContextualQuestionAnswer = z.infer<
  typeof ContextualQuestionAnswerSchema
>;
export type ContextualQuestion = z.infer<typeof ContextualQuestionSchema>;
export type ContextualQuestionsResponse = z.infer<
  typeof ContextualQuestionsResponseSchema
>;
export type CreateContextualQuestionAnswerRequest = z.infer<
  typeof CreateContextualQuestionAnswerRequestSchema
>;
export type UpdateContextualQuestionStatusRequest = z.infer<
  typeof UpdateContextualQuestionStatusRequestSchema
>;
export type VerifyContextualQuestionAnswerRequest = z.infer<
  typeof VerifyContextualQuestionAnswerRequestSchema
>;
export type ContextualQuestionResponse = z.infer<
  typeof ContextualQuestionResponseSchema
>;
export type StudentDocumentActivitySummary = z.infer<
  typeof StudentDocumentActivitySummarySchema
>;
export type StudentDocumentActivitySummaryResponse = z.infer<
  typeof StudentDocumentActivitySummaryResponseSchema
>;
export type CourseDetail = z.infer<typeof CourseDetailSchema>;
export type CourseDetailResponse = z.infer<typeof CourseDetailResponseSchema>;
export type CourseMutationResponse = z.infer<
  typeof CourseMutationResponseSchema
>;
export type ProfessorCourseListItem = z.infer<
  typeof ProfessorCourseListItemSchema
>;
export type ProfessorCourseListResponse = z.infer<
  typeof ProfessorCourseListResponseSchema
>;
export type ProfessorCourseDetail = z.infer<typeof ProfessorCourseDetailSchema>;
export type ProfessorCourseDetailResponse = z.infer<
  typeof ProfessorCourseDetailResponseSchema
>;
export type StudentCourseListItem = z.infer<typeof StudentCourseListItemSchema>;
export type StudentCourseListResponse = z.infer<
  typeof StudentCourseListResponseSchema
>;
export type StudentCourseDetail = z.infer<typeof StudentCourseDetailSchema>;
export type StudentCourseDetailResponse = z.infer<
  typeof StudentCourseDetailResponseSchema
>;
