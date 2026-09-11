import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { hashPassword } from '../src/auth/password.js';
import { env } from '../src/config/env.js';

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const ids = {
  admin: '11111111-1111-4111-8111-111111111111',
  professor: '22222222-2222-4222-8222-222222222222',
  studentMaria: '33333333-3333-4333-8333-333333333333',
  studentNikos: '44444444-4444-4444-8444-444444444444',
  course: '55555555-5555-4555-8555-555555555555',
  document: '66666666-6666-4666-8666-666666666666',
  conceptActiveReading: '77777777-7777-4777-8777-777777777771',
  conceptRoadmaps: '77777777-7777-4777-8777-777777777772',
  conceptAnalytics: '77777777-7777-4777-8777-777777777773',
  nodeActiveReading: '88888888-8888-4888-8888-888888888881',
  nodeRoadmaps: '88888888-8888-4888-8888-888888888882',
  nodeAnalytics: '88888888-8888-4888-8888-888888888883',
  edgeReadingToRoadmaps: '99999999-9999-4999-8999-999999999991',
  edgeRoadmapsToAnalytics: '99999999-9999-4999-8999-999999999992',
  resourceReading: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  resourceRoadmaps: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  categoryDocument: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  categoryGeneral: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  categoryArchived: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
  targetQuestion: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  targetConfusing: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
  annotationQuestion: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  annotationConfusing: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
  threadQuestion: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  threadConfusing: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
  postQuestion: 'ffffffff-ffff-4fff-8fff-fffffffffff1',
  postAnswer: 'ffffffff-ffff-4fff-8fff-fffffffffff2',
  threadLink: '12121212-1212-4121-8121-121212121212',
  selfCheck: '13131313-1313-4131-8131-131313131313',
  attemptMaria: '14141414-1414-4141-8141-141414141414',
  attemptNikos: '15151515-1515-4151-8151-151515151515',
  progressMariaReading: '16161616-1616-4161-8161-161616161611',
  progressMariaRoadmaps: '16161616-1616-4161-8161-161616161612',
  progressNikosReading: '16161616-1616-4161-8161-161616161613',
  intervention: '17171717-1717-4171-8171-171717171717',
  analyticsOpened: '18181818-1818-4181-8181-181818181811',
  analyticsPageViewed: '18181818-1818-4181-8181-181818181812',
  analyticsAnnotation: '18181818-1818-4181-8181-181818181813',
  analyticsThread: '18181818-1818-4181-8181-181818181814',
  analyticsProgress: '18181818-1818-4181-8181-181818181815',
  analyticsSelfCheck: '18181818-1818-4181-8181-181818181816',
  analyticsIntervention: '18181818-1818-4181-8181-181818181817',
  auditCourse: '19191919-1919-4191-8191-191919191911',
  auditDocument: '19191919-1919-4191-8191-191919191912',
  auditEnrollment: '19191919-1919-4191-8191-191919191913',
} as const;

const demoPassword = 'AcademicHubDemo2026!';

const extraProfessorUsers = [
  {
    id: '20202020-2020-4020-8020-202020202021',
    email: 'markos.professor@academic-hub.local',
    fullName: 'Dr. Markos Ioannidis',
    isActive: true,
  },
  {
    id: '20202020-2020-4020-8020-202020202022',
    email: 'sofia.professor@academic-hub.local',
    fullName: 'Dr. Sofia Nikolaidou',
    isActive: true,
  },
  {
    id: '20202020-2020-4020-8020-202020202023',
    email: 'dimitris.professor@academic-hub.local',
    fullName: 'Dr. Dimitris Karamitros',
    isActive: true,
  },
  {
    id: '20202020-2020-4020-8020-202020202024',
    email: 'ioanna.professor@academic-hub.local',
    fullName: 'Dr. Ioanna Spyrou',
    isActive: true,
  },
  {
    id: '20202020-2020-4020-8020-202020202025',
    email: 'andreas.inactive-professor@academic-hub.local',
    fullName: 'Dr. Andreas Vasileiou',
    isActive: false,
  },
] as const;

const extraStudentUsers = [
  {
    id: '30303030-3030-4030-8030-303030303031',
    email: 'eleni.student@academic-hub.local',
    fullName: 'Eleni Papageorgiou',
    isActive: true,
  },
  {
    id: '30303030-3030-4030-8030-303030303032',
    email: 'petros.student@academic-hub.local',
    fullName: 'Petros Dimitriou',
    isActive: true,
  },
  {
    id: '30303030-3030-4030-8030-303030303033',
    email: 'sofia.student@academic-hub.local',
    fullName: 'Sofia Karagianni',
    isActive: true,
  },
  {
    id: '30303030-3030-4030-8030-303030303034',
    email: 'giorgos.student@academic-hub.local',
    fullName: 'Giorgos Stavrou',
    isActive: true,
  },
  {
    id: '30303030-3030-4030-8030-303030303035',
    email: 'christina.student@academic-hub.local',
    fullName: 'Christina Oikonomou',
    isActive: true,
  },
  {
    id: '30303030-3030-4030-8030-303030303036',
    email: 'dimitra.student@academic-hub.local',
    fullName: 'Dimitra Alexiou',
    isActive: true,
  },
  {
    id: '30303030-3030-4030-8030-303030303037',
    email: 'kostas.student@academic-hub.local',
    fullName: 'Kostas Theodorou',
    isActive: true,
  },
  {
    id: '30303030-3030-4030-8030-303030303038',
    email: 'alex.inactive-student@academic-hub.local',
    fullName: 'Alex Kouris',
    isActive: false,
  },
] as const;

const extraCourses = [
  {
    id: '40404040-4040-4040-8040-404040404041',
    code: 'CS-ALG-201',
    title: 'Algorithms and Complexity',
    description:
      'Algorithm design, asymptotic analysis, and complexity trade-offs.',
    semester: 3,
    ectsCredits: 6,
    isActive: true,
  },
  {
    id: '40404040-4040-4040-8040-404040404042',
    code: 'CS-DB-301',
    title: 'Database Systems',
    description:
      'Relational modeling, SQL, transactions, indexing, and query planning.',
    semester: 4,
    ectsCredits: 6,
    isActive: true,
  },
  {
    id: '40404040-4040-4040-8040-404040404043',
    code: 'CS-HCI-410',
    title: 'Human-Centered Learning Systems',
    description:
      'Designing accessible and feedback-rich educational software.',
    semester: 7,
    ectsCredits: 5,
    isActive: false,
  },
  {
    id: '40404040-4040-4040-8040-404040404044',
    code: 'CS-DIST-501',
    title: 'Distributed Web Platforms',
    description:
      'Service boundaries, asynchronous workflows, and resilient web systems.',
    semester: 6,
    ectsCredits: 6,
    isActive: true,
  },
  {
    id: '40404040-4040-4040-8040-404040404045',
    code: 'CS-RM-601',
    title: 'Research Methods in Computing',
    description:
      'Research design, evaluation methods, ethics, and academic writing.',
    semester: 8,
    ectsCredits: 4,
    isActive: true,
  },
  {
    id: '40404040-4040-4040-8040-404040404046',
    code: 'CS-ELECT-350',
    title: 'Emerging Topics in Academic Technology',
    description:
      'Seminar-style course reserved for testing unassigned course states.',
    semester: 5,
    ectsCredits: 3,
    isActive: true,
  },
] as const;

type SeedUserInput = {
  email: string;
  fullName: string;
  id: string;
  isActive?: boolean;
  role: 'admin' | 'professor' | 'student';
};

async function upsertSeedUser(user: SeedUserInput): Promise<void> {
  const passwordHash = await hashPassword(demoPassword);

  await prisma.user.upsert({
    where: { id: user.id },
    update: {
      email: user.email,
      fullName: user.fullName,
      passwordHash,
      role: user.role,
      isActive: user.isActive ?? true,
    },
    create: {
      id: user.id,
      email: user.email,
      passwordHash,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive ?? true,
    },
  });
}

async function seedUsers(): Promise<void> {
  for (const user of [
    {
      id: ids.admin,
      email: 'admin@academic-hub.local',
      fullName: 'Demo Admin',
      role: 'admin' as const,
    },
    {
      id: ids.professor,
      email: 'professor@academic-hub.local',
      fullName: 'Dr. Eleni Papadopoulou',
      role: 'professor' as const,
    },
    {
      id: ids.studentMaria,
      email: 'maria.student@academic-hub.local',
      fullName: 'Maria Antoniou',
      role: 'student' as const,
    },
    {
      id: ids.studentNikos,
      email: 'nikos.student@academic-hub.local',
      fullName: 'Nikos Georgiou',
      role: 'student' as const,
    },
  ] satisfies SeedUserInput[]) {
    await upsertSeedUser(user);
  }

  for (const professor of extraProfessorUsers) {
    await upsertSeedUser({
      ...professor,
      role: 'professor',
    });
  }

  for (const student of extraStudentUsers) {
    await upsertSeedUser({
      ...student,
      role: 'student',
    });
  }
}

async function seedCourse(): Promise<void> {
  await prisma.course.upsert({
    where: { id: ids.course },
    update: {
      code: 'CS-LMS-101',
      title: 'Interactive Academic Content',
      description:
        'Demo course for the content-centered and feedback-driven LMS prototype.',
      semester: 1,
      ectsCredits: 6,
      isActive: true,
    },
    create: {
      id: ids.course,
      code: 'CS-LMS-101',
      title: 'Interactive Academic Content',
      description:
        'Demo course for the content-centered and feedback-driven LMS prototype.',
      semester: 1,
      ectsCredits: 6,
    },
  });

  for (const course of extraCourses) {
    await prisma.course.upsert({
      where: { id: course.id },
      update: course,
      create: course,
    });
  }

  await prisma.courseInstructor.upsert({
    where: { id: '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a' },
    update: {
      instructorRole: 'owner',
    },
    create: {
      id: '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a',
      courseId: ids.course,
      instructorId: ids.professor,
      instructorRole: 'owner',
    },
  });

  await prisma.courseInstructor.upsert({
    where: { id: '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5b' },
    update: {
      instructorRole: 'assistant',
    },
    create: {
      id: '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5b',
      courseId: ids.course,
      instructorId: extraProfessorUsers[0].id,
      instructorRole: 'assistant',
    },
  });

  for (const assignment of [
    {
      id: '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a61',
      courseId: extraCourses[0].id,
      instructorId: ids.professor,
      instructorRole: 'owner' as const,
    },
    {
      id: '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a62',
      courseId: extraCourses[0].id,
      instructorId: extraProfessorUsers[1].id,
      instructorRole: 'assistant' as const,
    },
    {
      id: '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a63',
      courseId: extraCourses[1].id,
      instructorId: extraProfessorUsers[2].id,
      instructorRole: 'owner' as const,
    },
    {
      id: '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a64',
      courseId: extraCourses[2].id,
      instructorId: extraProfessorUsers[3].id,
      instructorRole: 'owner' as const,
    },
    {
      id: '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a65',
      courseId: extraCourses[3].id,
      instructorId: extraProfessorUsers[0].id,
      instructorRole: 'owner' as const,
    },
  ]) {
    await prisma.courseInstructor.upsert({
      where: { id: assignment.id },
      update: {
        instructorRole: assignment.instructorRole,
      },
      create: assignment,
    });
  }

  for (const enrollment of [
    {
      id: '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a61',
      studentId: ids.studentMaria,
      status: 'active' as const,
    },
    {
      id: '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a62',
      studentId: ids.studentNikos,
      status: 'active' as const,
    },
    {
      id: '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a63',
      studentId: extraStudentUsers[0].id,
      status: 'active' as const,
    },
    {
      id: '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a64',
      studentId: extraStudentUsers[1].id,
      status: 'active' as const,
    },
    {
      id: '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a65',
      studentId: extraStudentUsers[2].id,
      status: 'completed' as const,
    },
    {
      id: '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a66',
      studentId: extraStudentUsers[3].id,
      status: 'inactive' as const,
      courseId: ids.course,
    },
    {
      id: '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a67',
      courseId: extraCourses[0].id,
      studentId: ids.studentMaria,
      status: 'completed' as const,
    },
    {
      id: '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a68',
      courseId: extraCourses[0].id,
      studentId: extraStudentUsers[4].id,
      status: 'active' as const,
    },
    {
      id: '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a69',
      courseId: extraCourses[1].id,
      studentId: ids.studentNikos,
      status: 'active' as const,
    },
    {
      id: '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a70',
      courseId: extraCourses[1].id,
      studentId: extraStudentUsers[5].id,
      status: 'inactive' as const,
    },
    {
      id: '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a71',
      courseId: extraCourses[3].id,
      studentId: extraStudentUsers[6].id,
      status: 'active' as const,
    },
  ]) {
    await prisma.enrollment.upsert({
      where: { id: enrollment.id },
      update: {
        status: enrollment.status,
      },
      create: {
        id: enrollment.id,
        courseId: enrollment.courseId ?? ids.course,
        studentId: enrollment.studentId,
        status: enrollment.status,
      },
    });
  }
}

async function seedDocumentsAndRoadmap(): Promise<void> {
  await prisma.document.upsert({
    where: { id: ids.document },
    update: {
      title: 'Week 1 - Active Reading and Feedback Loops',
      visibility: 'visible_to_students',
      status: 'active',
      pageCount: 18,
    },
    create: {
      id: ids.document,
      courseId: ids.course,
      title: 'Week 1 - Active Reading and Feedback Loops',
      description: 'Introductory PDF used by the demo course.',
      status: 'active',
      visibility: 'visible_to_students',
      objectKey: 'courses/cs-lms-101/week-1-active-reading.pdf',
      originalFilename: 'week-1-active-reading.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 1_284_000n,
      checksumSha256:
        '77e3b7f79f5a6ebfb7cb5d7737d921c0b5e14f7c9ad1f3eacb2e8a92ef8cc001',
      pageCount: 18,
      createdById: ids.professor,
    },
  });

  const concepts = [
    {
      id: ids.conceptActiveReading,
      slug: 'active-reading',
      title: 'Active reading',
      description:
        'Studying directly on learning material with anchored notes.',
      learningObjective:
        'Explain how highlights, notes, and questions stay connected to PDF context.',
      orderIndex: 1,
    },
    {
      id: ids.conceptRoadmaps,
      slug: 'conceptual-roadmaps',
      title: 'Conceptual roadmaps',
      description: 'Course structure based on concepts and prerequisites.',
      learningObjective:
        'Describe how roadmap nodes connect concepts, resources, and progress.',
      orderIndex: 2,
    },
    {
      id: ids.conceptAnalytics,
      slug: 'teaching-intelligence',
      title: 'Teaching intelligence',
      description: 'Analytics that produce actionable teaching signals.',
      learningObjective:
        'Identify confusion signals and translate them into teaching interventions.',
      orderIndex: 3,
    },
  ] as const;

  for (const concept of concepts) {
    await prisma.concept.upsert({
      where: { id: concept.id },
      update: concept,
      create: {
        ...concept,
        courseId: ids.course,
        createdById: ids.professor,
      },
    });
  }

  const nodes = [
    {
      id: ids.nodeActiveReading,
      conceptId: ids.conceptActiveReading,
      title: 'Annotate learning material',
      description: 'Practice anchored highlights, notes, and questions.',
      learningObjective: 'Create an annotation that preserves context.',
      estimatedMinutes: 25,
      difficulty: 'low' as const,
      completionRule: 'view_resource' as const,
      orderIndex: 1,
    },
    {
      id: ids.nodeRoadmaps,
      conceptId: ids.conceptRoadmaps,
      title: 'Follow prerequisite-aware roadmap nodes',
      description: 'Understand how concepts guide study order.',
      learningObjective: 'Read a roadmap dependency and pick the next node.',
      estimatedMinutes: 35,
      difficulty: 'medium' as const,
      completionRule: 'self_check' as const,
      orderIndex: 2,
    },
    {
      id: ids.nodeAnalytics,
      conceptId: ids.conceptAnalytics,
      title: 'Interpret confusion signals',
      description: 'Use learner interactions to decide a teaching action.',
      learningObjective:
        'Explain why a repeated question should appear in the teaching queue.',
      estimatedMinutes: 45,
      difficulty: 'high' as const,
      completionRule: 'manual' as const,
      orderIndex: 3,
    },
  ];

  for (const node of nodes) {
    await prisma.roadmapNode.upsert({
      where: { id: node.id },
      update: node,
      create: {
        ...node,
        courseId: ids.course,
        createdById: ids.professor,
      },
    });
  }

  for (const edge of [
    {
      id: ids.edgeReadingToRoadmaps,
      fromNodeId: ids.nodeActiveReading,
      toNodeId: ids.nodeRoadmaps,
    },
    {
      id: ids.edgeRoadmapsToAnalytics,
      fromNodeId: ids.nodeRoadmaps,
      toNodeId: ids.nodeAnalytics,
    },
  ] as const) {
    await prisma.roadmapEdge.upsert({
      where: { id: edge.id },
      update: edge,
      create: {
        ...edge,
        courseId: ids.course,
      },
    });
  }

  await prisma.roadmapNodeResource.upsert({
    where: { id: ids.resourceReading },
    update: {
      resourceType: 'document_page',
      pageStart: 2,
      pageEnd: 5,
      title: 'Active reading overview',
    },
    create: {
      id: ids.resourceReading,
      roadmapNodeId: ids.nodeActiveReading,
      resourceType: 'document_page',
      documentId: ids.document,
      pageStart: 2,
      pageEnd: 5,
      title: 'Active reading overview',
      orderIndex: 1,
    },
  });

  await prisma.roadmapNodeResource.upsert({
    where: { id: ids.resourceRoadmaps },
    update: {
      resourceType: 'document_section',
      pageStart: 6,
      pageEnd: 10,
      sectionLabel: 'Concept roadmap examples',
      title: 'Roadmap examples',
    },
    create: {
      id: ids.resourceRoadmaps,
      roadmapNodeId: ids.nodeRoadmaps,
      resourceType: 'document_section',
      documentId: ids.document,
      pageStart: 6,
      pageEnd: 10,
      sectionLabel: 'Concept roadmap examples',
      title: 'Roadmap examples',
      orderIndex: 1,
    },
  });
}

async function seedForumAndAnnotations(): Promise<void> {
  for (const category of [
    {
      id: ids.categoryDocument,
      name: 'Document discussions',
      kind: 'document_discussion' as const,
      description:
        'Threads created from public or instructor-only annotations.',
      orderIndex: 1,
    },
    {
      id: ids.categoryGeneral,
      name: 'General course questions',
      kind: 'general' as const,
      description: 'General discussion space kept outside the MVP focus.',
      orderIndex: 2,
    },
    {
      id: ids.categoryArchived,
      name: 'Archived document discussions',
      kind: 'archived_document_discussion' as const,
      description: 'Preserved threads for replaced or deleted documents.',
      orderIndex: 3,
    },
  ]) {
    await prisma.forumCategory.upsert({
      where: { id: category.id },
      update: category,
      create: {
        ...category,
        courseId: ids.course,
      },
    });
  }

  await prisma.annotationTarget.upsert({
    where: { id: ids.targetQuestion },
    update: {
      pageNumber: 4,
      selectedText: 'feedback loop',
      documentTitleSnapshot: 'Week 1 - Active Reading and Feedback Loops',
    },
    create: {
      id: ids.targetQuestion,
      documentId: ids.document,
      pageNumber: 4,
      selectedText: 'feedback loop',
      textQuoteExact: 'feedback loop',
      textQuotePrefix: 'The platform closes the ',
      textQuoteSuffix: ' between student activity and instructor action.',
      normalizedRects: [{ x: 0.18, y: 0.42, width: 0.34, height: 0.03 }],
      selectorMetadata: { source: 'seed', selector: 'text-quote' },
      documentTitleSnapshot: 'Week 1 - Active Reading and Feedback Loops',
      documentFilenameSnapshot: 'week-1-active-reading.pdf',
      documentChecksumSnapshot:
        '77e3b7f79f5a6ebfb7cb5d7737d921c0b5e14f7c9ad1f3eacb2e8a92ef8cc001',
    },
  });

  await prisma.annotationTarget.upsert({
    where: { id: ids.targetConfusing },
    update: {
      pageNumber: 8,
      selectedText: 'confusion heatmap',
      documentTitleSnapshot: 'Week 1 - Active Reading and Feedback Loops',
    },
    create: {
      id: ids.targetConfusing,
      documentId: ids.document,
      pageNumber: 8,
      selectedText: 'confusion heatmap',
      textQuoteExact: 'confusion heatmap',
      textQuotePrefix: 'Repeated signals are summarized as a ',
      textQuoteSuffix: ' for instructors.',
      normalizedRects: [{ x: 0.22, y: 0.36, width: 0.29, height: 0.03 }],
      selectorMetadata: { source: 'seed', selector: 'text-quote' },
      documentTitleSnapshot: 'Week 1 - Active Reading and Feedback Loops',
      documentFilenameSnapshot: 'week-1-active-reading.pdf',
      documentChecksumSnapshot:
        '77e3b7f79f5a6ebfb7cb5d7737d921c0b5e14f7c9ad1f3eacb2e8a92ef8cc001',
    },
  });

  await prisma.annotation.upsert({
    where: { id: ids.annotationQuestion },
    update: {
      body: 'How does the system decide that a repeated question needs instructor action?',
      visibility: 'public',
    },
    create: {
      id: ids.annotationQuestion,
      courseId: ids.course,
      documentId: ids.document,
      targetId: ids.targetQuestion,
      authorId: ids.studentMaria,
      conceptId: ids.conceptActiveReading,
      roadmapNodeId: ids.nodeActiveReading,
      type: 'question',
      visibility: 'public',
      body: 'How does the system decide that a repeated question needs instructor action?',
    },
  });

  await prisma.annotation.upsert({
    where: { id: ids.annotationConfusing },
    update: {
      body: 'The difference between raw activity and a confusion signal is still unclear.',
      visibility: 'instructor_only',
    },
    create: {
      id: ids.annotationConfusing,
      courseId: ids.course,
      documentId: ids.document,
      targetId: ids.targetConfusing,
      authorId: ids.studentNikos,
      conceptId: ids.conceptAnalytics,
      roadmapNodeId: ids.nodeAnalytics,
      type: 'confusing',
      visibility: 'instructor_only',
      body: 'The difference between raw activity and a confusion signal is still unclear.',
    },
  });

  await prisma.forumThread.upsert({
    where: { id: ids.threadQuestion },
    update: {
      status: 'verified',
      title: 'When does a repeated question become a teaching action?',
    },
    create: {
      id: ids.threadQuestion,
      courseId: ids.course,
      categoryId: ids.categoryDocument,
      annotationId: ids.annotationQuestion,
      targetId: ids.targetQuestion,
      documentId: ids.document,
      authorId: ids.studentMaria,
      conceptId: ids.conceptActiveReading,
      roadmapNodeId: ids.nodeActiveReading,
      title: 'When does a repeated question become a teaching action?',
      status: 'verified',
      visibility: 'public',
      pageNumberSnapshot: 4,
      selectedTextSnapshot: 'feedback loop',
      documentTitleSnapshot: 'Week 1 - Active Reading and Feedback Loops',
      resolvedAt: new Date('2026-08-27T12:00:00.000Z'),
    },
  });

  await prisma.forumThread.upsert({
    where: { id: ids.threadConfusing },
    update: {
      status: 'open',
      title: 'Confusion heatmap interpretation',
    },
    create: {
      id: ids.threadConfusing,
      courseId: ids.course,
      categoryId: ids.categoryDocument,
      annotationId: ids.annotationConfusing,
      targetId: ids.targetConfusing,
      documentId: ids.document,
      authorId: ids.studentNikos,
      conceptId: ids.conceptAnalytics,
      roadmapNodeId: ids.nodeAnalytics,
      title: 'Confusion heatmap interpretation',
      status: 'open',
      visibility: 'instructor_only',
      pageNumberSnapshot: 8,
      selectedTextSnapshot: 'confusion heatmap',
      documentTitleSnapshot: 'Week 1 - Active Reading and Feedback Loops',
    },
  });

  await prisma.forumPost.upsert({
    where: { id: ids.postQuestion },
    update: {
      body: 'I understand the annotation, but not the threshold for escalation.',
    },
    create: {
      id: ids.postQuestion,
      threadId: ids.threadQuestion,
      authorId: ids.studentMaria,
      body: 'I understand the annotation, but not the threshold for escalation.',
    },
  });

  await prisma.forumPost.upsert({
    where: { id: ids.postAnswer },
    update: {
      body: 'The queue uses transparent rules: repeated unresolved questions, recent activity, and concept importance.',
      isVerified: true,
    },
    create: {
      id: ids.postAnswer,
      threadId: ids.threadQuestion,
      authorId: ids.professor,
      body: 'The queue uses transparent rules: repeated unresolved questions, recent activity, and concept importance.',
      isVerified: true,
    },
  });

  await prisma.forumThread.update({
    where: { id: ids.threadQuestion },
    data: {
      verifiedPostId: ids.postAnswer,
    },
  });

  await prisma.threadLink.upsert({
    where: { id: ids.threadLink },
    update: {
      linkType: 'related',
    },
    create: {
      id: ids.threadLink,
      sourceThreadId: ids.threadConfusing,
      targetThreadId: ids.threadQuestion,
      linkType: 'related',
      createdById: ids.professor,
    },
  });
}

async function seedProgressAndSignals(): Promise<void> {
  await prisma.selfCheck.upsert({
    where: { id: ids.selfCheck },
    update: {
      prompt: 'Which signal is strongest evidence for a teaching intervention?',
      passingScore: 100,
    },
    create: {
      id: ids.selfCheck,
      courseId: ids.course,
      roadmapNodeId: ids.nodeRoadmaps,
      conceptId: ids.conceptRoadmaps,
      type: 'single_choice',
      prompt: 'Which signal is strongest evidence for a teaching intervention?',
      options: [
        { id: 'a', label: 'A single page view' },
        { id: 'b', label: 'Repeated unresolved contextual questions' },
        { id: 'c', label: 'A private note from one student' },
      ],
      correctAnswer: { optionId: 'b' },
      passingScore: 100,
      orderIndex: 1,
      createdById: ids.professor,
    },
  });

  for (const progress of [
    {
      id: ids.progressMariaReading,
      roadmapNodeId: ids.nodeActiveReading,
      studentId: ids.studentMaria,
      status: 'completed' as const,
      startedAt: new Date('2026-08-26T09:00:00.000Z'),
      completedAt: new Date('2026-08-26T09:30:00.000Z'),
      needsReviewReason: null,
    },
    {
      id: ids.progressMariaRoadmaps,
      roadmapNodeId: ids.nodeRoadmaps,
      studentId: ids.studentMaria,
      status: 'in_progress' as const,
      startedAt: new Date('2026-08-27T10:00:00.000Z'),
      completedAt: null,
      needsReviewReason: null,
    },
    {
      id: ids.progressNikosReading,
      roadmapNodeId: ids.nodeAnalytics,
      studentId: ids.studentNikos,
      status: 'needs_review' as const,
      startedAt: new Date('2026-08-27T08:45:00.000Z'),
      completedAt: null,
      needsReviewReason: 'Marked confusion on the analytics explanation.',
    },
  ]) {
    await prisma.roadmapProgress.upsert({
      where: { id: progress.id },
      update: progress,
      create: progress,
    });
  }

  await prisma.selfCheckAttempt.upsert({
    where: { id: ids.attemptMaria },
    update: {
      answer: { optionId: 'b' },
      score: 100,
      status: 'passed',
    },
    create: {
      id: ids.attemptMaria,
      selfCheckId: ids.selfCheck,
      studentId: ids.studentMaria,
      answer: { optionId: 'b' },
      score: 100,
      status: 'passed',
      submittedAt: new Date('2026-08-27T10:20:00.000Z'),
    },
  });

  await prisma.selfCheckAttempt.upsert({
    where: { id: ids.attemptNikos },
    update: {
      answer: { optionId: 'a' },
      score: 0,
      status: 'failed',
    },
    create: {
      id: ids.attemptNikos,
      selfCheckId: ids.selfCheck,
      studentId: ids.studentNikos,
      answer: { optionId: 'a' },
      score: 0,
      status: 'failed',
      submittedAt: new Date('2026-08-27T11:05:00.000Z'),
    },
  });

  await prisma.teachingIntervention.upsert({
    where: { id: ids.intervention },
    update: {
      title: 'Clarify how the teaching queue ranks confusion signals',
      sourceAction: 'verified_answer',
    },
    create: {
      id: ids.intervention,
      courseId: ids.course,
      createdById: ids.professor,
      type: 'answer_thread',
      title: 'Clarify how the teaching queue ranks confusion signals',
      description:
        'Verified answer added to a repeated question about escalation rules.',
      sourceAction: 'verified_answer',
      sourceEntityType: 'forum_post',
      sourceEntityId: ids.postAnswer,
      conceptId: ids.conceptActiveReading,
      roadmapNodeId: ids.nodeActiveReading,
      threadId: ids.threadQuestion,
      targetId: ids.targetQuestion,
      followUpAt: new Date('2026-09-03T09:00:00.000Z'),
    },
  });
}

async function seedEventsAndAuditLogs(): Promise<void> {
  const events = [
    {
      id: ids.analyticsOpened,
      eventType: 'document_opened' as const,
      userId: ids.studentMaria,
      documentId: ids.document,
      conceptId: ids.conceptActiveReading,
      roadmapNodeId: ids.nodeActiveReading,
      targetId: null,
      annotationId: null,
      threadId: null,
      selfCheckId: null,
      interventionId: null,
      metadata: { source: 'viewer', page: 1 },
    },
    {
      id: ids.analyticsPageViewed,
      eventType: 'document_page_viewed' as const,
      userId: ids.studentMaria,
      documentId: ids.document,
      conceptId: ids.conceptActiveReading,
      roadmapNodeId: ids.nodeActiveReading,
      targetId: ids.targetQuestion,
      annotationId: null,
      threadId: null,
      selfCheckId: null,
      interventionId: null,
      metadata: { pageNumber: 4 },
    },
    {
      id: ids.analyticsAnnotation,
      eventType: 'annotation_created' as const,
      userId: ids.studentMaria,
      documentId: ids.document,
      conceptId: ids.conceptActiveReading,
      roadmapNodeId: ids.nodeActiveReading,
      targetId: ids.targetQuestion,
      annotationId: ids.annotationQuestion,
      threadId: ids.threadQuestion,
      selfCheckId: null,
      interventionId: null,
      metadata: { annotationType: 'question', visibility: 'public' },
    },
    {
      id: ids.analyticsThread,
      eventType: 'forum_thread_created' as const,
      userId: ids.studentMaria,
      documentId: ids.document,
      conceptId: ids.conceptActiveReading,
      roadmapNodeId: ids.nodeActiveReading,
      targetId: ids.targetQuestion,
      annotationId: ids.annotationQuestion,
      threadId: ids.threadQuestion,
      selfCheckId: null,
      interventionId: null,
      metadata: { status: 'open' },
    },
    {
      id: ids.analyticsProgress,
      eventType: 'roadmap_node_completed' as const,
      userId: ids.studentMaria,
      documentId: ids.document,
      conceptId: ids.conceptActiveReading,
      roadmapNodeId: ids.nodeActiveReading,
      targetId: null,
      annotationId: null,
      threadId: null,
      selfCheckId: null,
      interventionId: null,
      metadata: { completionRule: 'view_resource' },
    },
    {
      id: ids.analyticsSelfCheck,
      eventType: 'self_check_completed' as const,
      userId: ids.studentMaria,
      documentId: null,
      conceptId: ids.conceptRoadmaps,
      roadmapNodeId: ids.nodeRoadmaps,
      targetId: null,
      annotationId: null,
      threadId: null,
      selfCheckId: ids.selfCheck,
      interventionId: null,
      metadata: { score: 100, status: 'passed' },
    },
    {
      id: ids.analyticsIntervention,
      eventType: 'intervention_created' as const,
      userId: ids.professor,
      documentId: ids.document,
      conceptId: ids.conceptActiveReading,
      roadmapNodeId: ids.nodeActiveReading,
      targetId: ids.targetQuestion,
      annotationId: ids.annotationQuestion,
      threadId: ids.threadQuestion,
      selfCheckId: null,
      interventionId: ids.intervention,
      metadata: { sourceAction: 'verified_answer' },
    },
  ];

  for (const event of events) {
    await prisma.analyticsEvent.upsert({
      where: { id: event.id },
      update: event,
      create: {
        ...event,
        courseId: ids.course,
      },
    });
  }

  for (const log of [
    {
      id: ids.auditCourse,
      actorId: ids.admin,
      action: 'course_created' as const,
      entityType: 'course',
      entityId: ids.course,
      metadata: { code: 'CS-LMS-101' },
    },
    {
      id: ids.auditDocument,
      actorId: ids.professor,
      action: 'document_uploaded' as const,
      entityType: 'document',
      entityId: ids.document,
      metadata: { objectKey: 'courses/cs-lms-101/week-1-active-reading.pdf' },
    },
    {
      id: ids.auditEnrollment,
      actorId: ids.admin,
      action: 'enrollment_changed' as const,
      entityType: 'enrollment',
      entityId: ids.studentMaria,
      metadata: { status: 'active' },
    },
  ]) {
    await prisma.auditLog.upsert({
      where: { id: log.id },
      update: log,
      create: {
        ...log,
        courseId: ids.course,
      },
    });
  }
}

async function main(): Promise<void> {
  await seedUsers();
  await seedCourse();
  await seedDocumentsAndRoadmap();
  await seedForumAndAnnotations();
  await seedProgressAndSignals();
  await seedEventsAndAuditLogs();
}

main()
  .then(async () => {
    console.log('Seeded demo Academic Hub course data.');
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error('Failed to seed demo data.', error);
    await prisma.$disconnect();
    process.exit(1);
  });
