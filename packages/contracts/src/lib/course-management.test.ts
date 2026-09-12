import { describe, expect, it } from 'vitest';

import {
  AssignCourseInstructorRequestSchema,
  CourseCreateRequestSchema,
  CourseDetailResponseSchema,
  CourseDocumentIdParamsSchema,
  CourseDocumentMetadataSchema,
  CourseDocumentResponseSchema,
  CourseIdParamsSchema,
  CourseListQuerySchema,
  CourseListResponseSchema,
  CourseUpdateRequestSchema,
  CreateCourseDocumentRequestSchema,
  EnrollStudentRequestSchema,
  ProfessorCourseDetailResponseSchema,
  ProfessorCourseListResponseSchema,
  UpdateCourseDocumentMetadataRequestSchema,
  UpdateEnrollmentStatusRequestSchema,
} from './course-management.js';

const courseId = '11111111-1111-4111-8111-111111111111';
const instructorId = '22222222-2222-4222-8222-222222222222';
const studentId = '33333333-3333-4333-8333-333333333333';
const documentId = '44444444-4444-4444-8444-444444444444';
const now = '2026-09-11T20:30:00.000Z';

const courseListItem = {
  id: courseId,
  code: 'ICE-302',
  title: 'Ηλεκτρονική',
  description: 'Αναλογικά και ψηφιακά ηλεκτρονικά κυκλώματα.',
  semester: 3,
  ectsCredits: 5,
  isActive: true,
  counts: {
    documentCount: 0,
    instructorCount: 1,
    studentCount: 2,
  },
  primaryInstructor: {
    id: instructorId,
    fullName: 'Μαρία Δημητρίου',
  },
};

const instructor = {
  id: '55555555-5555-4555-8555-555555555555',
  userId: instructorId,
  fullName: 'Μαρία Δημητρίου',
  email: 'maria.dimitriou@example.edu',
  role: 'owner',
  assignedAt: now,
};

const enrollment = {
  id: '66666666-6666-4666-8666-666666666666',
  studentId,
  fullName: 'Ιωάννα Δημητρίου',
  email: 'ioanna.dimitriou@example.edu',
  status: 'active',
  enrolledAt: now,
  updatedAt: now,
};

const documentMetadata = {
  id: documentId,
  title: 'Εισαγωγή στα κυκλώματα',
  description: null,
  status: 'active',
  visibility: 'visible_to_students',
  originalFilename: 'circuits-intro.pdf',
  mimeType: 'application/pdf',
  fileSizeBytes: 1_024_000,
  pageCount: 18,
  createdAt: now,
  updatedAt: now,
};

describe('course management contracts', () => {
  it('parses and normalizes course create payloads', () => {
    expect(
      CourseCreateRequestSchema.parse({
        code: ' ICE-302 ',
        description: '  Εργαστηριακό μάθημα.  ',
        ectsCredits: '5',
        semester: '3',
        title: '  Ηλεκτρονική  ',
      }),
    ).toEqual({
      code: 'ICE-302',
      description: 'Εργαστηριακό μάθημα.',
      ectsCredits: 5,
      semester: 3,
      title: 'Ηλεκτρονική',
    });
  });

  it('rejects missing and invalid course fields', () => {
    expect(() =>
      CourseCreateRequestSchema.parse({
        code: 'ICE-302',
        ectsCredits: 5,
        semester: 3,
      }),
    ).toThrow();

    expect(() =>
      CourseCreateRequestSchema.parse({
        code: 'ice 302',
        ectsCredits: 0,
        semester: 0,
        title: 'Ηλεκτρονική',
      }),
    ).toThrow();
  });

  it('accepts partial course updates but rejects empty updates', () => {
    expect(CourseUpdateRequestSchema.parse({ isActive: false })).toEqual({
      isActive: false,
    });

    expect(
      CourseUpdateRequestSchema.parse({
        description: null,
        ectsCredits: 6,
      }),
    ).toEqual({
      description: null,
      ectsCredits: 6,
    });

    expect(() => CourseUpdateRequestSchema.parse({})).toThrow();
  });

  it('parses list query defaults and filters', () => {
    expect(CourseListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
      status: 'all',
    });

    expect(
      CourseListQuerySchema.parse({
        page: '2',
        pageSize: '10',
        search: '  ICE  ',
        semester: '3',
        status: 'active',
      }),
    ).toEqual({
      page: 2,
      pageSize: 10,
      search: 'ICE',
      semester: 3,
      status: 'active',
    });
  });

  it('parses course list responses with dashboard summary counts', () => {
    const response = CourseListResponseSchema.parse({
      data: [courseListItem],
      meta: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
      summary: {
        activeCourses: 1,
        totalCourses: 1,
        unassignedCourses: 0,
      },
    });

    expect(response.data[0]?.counts.instructorCount).toBe(1);
    expect(response.summary.activeCourses).toBe(1);
  });

  it('parses course detail responses with assignments, enrollments, and documents', () => {
    const response = CourseDetailResponseSchema.parse({
      data: {
        ...courseListItem,
        createdAt: now,
        documents: [documentMetadata],
        enrollments: [enrollment],
        instructors: [instructor],
        updatedAt: now,
      },
    });

    expect(response.data.instructors[0]?.role).toBe('owner');
    expect(response.data.enrollments[0]?.status).toBe('active');
    expect(response.data.documents[0]?.visibility).toBe('visible_to_students');
  });

  it('validates route params and rejects invalid UUIDs', () => {
    expect(CourseIdParamsSchema.parse({ courseId })).toEqual({ courseId });
    expect(CourseDocumentIdParamsSchema.parse({ courseId, documentId })).toEqual(
      { courseId, documentId },
    );
    expect(() =>
      CourseIdParamsSchema.parse({ courseId: 'not-a-uuid' }),
    ).toThrow();
  });

  it('validates assignment and enrollment requests against shared enums', () => {
    expect(
      AssignCourseInstructorRequestSchema.parse({ instructorId }),
    ).toEqual({
      instructorId,
      role: 'owner',
    });

    expect(
      EnrollStudentRequestSchema.parse({ studentId }),
    ).toEqual({
      status: 'active',
      studentId,
    });

    expect(
      UpdateEnrollmentStatusRequestSchema.parse({ status: 'completed' }),
    ).toEqual({
      status: 'completed',
    });

    expect(() =>
      AssignCourseInstructorRequestSchema.parse({
        instructorId,
        role: 'primary',
      }),
    ).toThrow();

    expect(() =>
      UpdateEnrollmentStatusRequestSchema.parse({ status: 'paused' }),
    ).toThrow();
  });

  it('validates document metadata status, visibility, and numeric fields', () => {
    expect(CourseDocumentMetadataSchema.parse(documentMetadata).pageCount).toBe(
      18,
    );

    expect(() =>
      CourseDocumentMetadataSchema.parse({
        ...documentMetadata,
        fileSizeBytes: -1,
      }),
    ).toThrow();

    expect(() =>
      CourseDocumentMetadataSchema.parse({
        ...documentMetadata,
        visibility: 'public',
      }),
    ).toThrow();
  });

  it('normalizes document metadata create requests', () => {
    expect(
      CreateCourseDocumentRequestSchema.parse({
        title: '  Lecture 1  ',
        description: '  Introductory material.  ',
        visibility: 'visible_to_students',
        originalFilename: '  lecture-1.pdf  ',
        mimeType: '  application/pdf  ',
        fileSizeBytes: '2048',
        pageCount: '12',
      }),
    ).toEqual({
      title: 'Lecture 1',
      description: 'Introductory material.',
      visibility: 'visible_to_students',
      originalFilename: 'lecture-1.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 2048,
      pageCount: 12,
    });

    expect(
      CreateCourseDocumentRequestSchema.parse({
        title: 'Draft material',
      }),
    ).toEqual({
      title: 'Draft material',
      visibility: 'hidden_from_students',
    });
  });

  it('validates document metadata updates', () => {
    expect(
      UpdateCourseDocumentMetadataRequestSchema.parse({
        description: null,
        status: 'deleted',
        visibility: 'hidden_from_students',
      }),
    ).toEqual({
      description: null,
      status: 'deleted',
      visibility: 'hidden_from_students',
    });

    expect(() => UpdateCourseDocumentMetadataRequestSchema.parse({})).toThrow();
    expect(() =>
      UpdateCourseDocumentMetadataRequestSchema.parse({ status: 'archived' }),
    ).toThrow();
  });

  it('parses single document metadata responses', () => {
    const response = CourseDocumentResponseSchema.parse({
      data: documentMetadata,
    });

    expect(response.data.id).toBe(documentId);
  });
});

describe('professor course contracts', () => {
  const professorListItem = {
    id: courseId,
    code: 'ICE-302',
    title: 'Ηλεκτρονική',
    description: 'Αναλογικά και ψηφιακά ηλεκτρονικά κυκλώματα.',
    semester: 3,
    ectsCredits: 5,
    isActive: true,
    instructorRole: 'owner',
    counts: {
      documentCount: 4,
      visibleDocumentCount: 2,
    },
  };

  it('parses professor course list responses with assignment summary', () => {
    const response = ProfessorCourseListResponseSchema.parse({
      data: [professorListItem],
      summary: { assignedCourseCount: 1 },
    });

    expect(response.data[0]?.instructorRole).toBe('owner');
    expect(response.summary.assignedCourseCount).toBe(1);
  });

  it('parses professor course detail responses with instructors and student count', () => {
    const response = ProfessorCourseDetailResponseSchema.parse({
      data: {
        ...professorListItem,
        studentCount: 42,
        instructors: [instructor],
      },
    });

    expect(response.data.studentCount).toBe(42);
    expect(response.data.instructors[0]?.role).toBe('owner');
  });
});
