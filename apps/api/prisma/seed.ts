import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { PrismaPg } from '@prisma/adapter-pg';
import {
  type Prisma,
  PrismaClient,
  type AnalyticsEventType,
  type AnnotationType,
  type AnnotationVisibility,
  type AuditAction,
  type CompletionRule,
  type CourseInstructorRole,
  type DifficultyLevel,
  type DocumentStatus,
  type DocumentVisibility,
  type EnrollmentStatus,
  type ForumCategoryKind,
  type ForumThreadStatus,
  type InterventionType,
  type RoadmapProgressStatus,
  type RoadmapResourceType,
  type SelfCheckAttemptStatus,
  type SelfCheckType,
  type ThreadLinkType,
  type UserRole,
} from '@prisma/client';
import { PDFDocument } from 'pdf-lib';

import { hashPassword } from '../src/auth/password.js';
import { env } from '../src/config/env.js';
import { createStorageService } from '../src/storage/storage-service.js';

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });
const storageService = createStorageService();

// ---------------------------------------------------------------------------
// Deterministic identifiers and dates
//
// Every seeded row gets a stable UUID derived from a human-readable key
// (e.g. `document:lms101:week1`) instead of a hand-typed literal, so the
// dataset can grow without maintaining a giant id lookup table. Dates are
// computed relative to "now" so recency-based UI (recent material badges,
// the 14-day confusion/verification windows) always looks correct whenever
// the seed is actually run, rather than drifting once a hard-coded date is
// in the past.
// ---------------------------------------------------------------------------

function sha256Hex(seed: string): string {
  return createHash('sha256').update(seed).digest('hex');
}

function deterministicId(...parts: string[]): string {
  const hex = sha256Hex(parts.join(':'));
  const timeLow = hex.slice(0, 8);
  const timeMid = hex.slice(8, 12);
  const timeHiAndVersion = `4${hex.slice(13, 16)}`;
  const variantNibble = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const clockSeq = `${variantNibble}${hex.slice(17, 20)}`;
  const node = hex.slice(20, 32);
  return `${timeLow}-${timeMid}-${timeHiAndVersion}-${clockSeq}-${node}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

function daysFromNow(days: number): Date {
  return daysAgo(-days);
}

type JsonValue = Prisma.InputJsonValue;

const userId = (key: string) => deterministicId('user', key);
const courseId = (key: string) => deterministicId('course', key);
const instructorAssignmentId = (courseKey: string, profKey: string) =>
  deterministicId('course-instructor', courseKey, profKey);
const enrollmentId = (studentKey: string, courseKey: string) =>
  deterministicId('enrollment', studentKey, courseKey);
const documentId = (courseKey: string, docKey: string) =>
  deterministicId('document', courseKey, docKey);
const conceptId = (courseKey: string, key: string) =>
  deterministicId('concept', courseKey, key);
const nodeId = (courseKey: string, key: string) =>
  deterministicId('roadmap-node', courseKey, key);
const edgeId = (courseKey: string, fromKey: string, toKey: string) =>
  deterministicId('roadmap-edge', courseKey, fromKey, toKey);
const resourceId = (courseKey: string, key: string) =>
  deterministicId('roadmap-resource', courseKey, key);
const progressId = (studentKey: string, courseKey: string, nodeKey: string) =>
  deterministicId('roadmap-progress', studentKey, courseKey, nodeKey);
const categoryId = (courseKey: string, kind: string) =>
  deterministicId('forum-category', courseKey, kind);
const targetId = (courseKey: string, key: string) =>
  deterministicId('annotation-target', courseKey, key);
const annotationId = (courseKey: string, key: string) =>
  deterministicId('annotation', courseKey, key);
const threadId = (courseKey: string, key: string) =>
  deterministicId('forum-thread', courseKey, key);
const postId = (courseKey: string, threadKey: string, key: string) =>
  deterministicId('forum-post', courseKey, threadKey, key);
const threadLinkId = (key: string) => deterministicId('thread-link', key);
const selfCheckId = (courseKey: string, key: string) =>
  deterministicId('self-check', courseKey, key);
const attemptId = (courseKey: string, key: string) =>
  deterministicId('self-check-attempt', courseKey, key);
const interventionId = (courseKey: string, key: string) =>
  deterministicId('intervention', courseKey, key);
const analyticsEventId = (key: string) =>
  deterministicId('analytics-event', key);
const auditLogId = (key: string) => deterministicId('audit-log', key);

function stockRects(): JsonValue {
  return [{ x: 0.18, y: 0.35, width: 0.32, height: 0.03 }];
}

const SELECTOR_METADATA: JsonValue = { source: 'seed', selector: 'text-quote' };

const demoPassword = 'AcademicHubDemo2026!';

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

interface PersonSeed {
  key: string;
  email: string;
  fullName: string;
}

const admins: PersonSeed[] = [
  {
    key: 'admin-main',
    email: 'admin@academic-hub.local',
    fullName: 'Διαχειριστής Επίδειξης',
  },
  {
    key: 'admin-registrar',
    email: 'grammateia@academic-hub.local',
    fullName: 'Παναγιώτα Ρούσσου',
  },
];

const professors: PersonSeed[] = [
  {
    key: 'eleni',
    email: 'professor@academic-hub.local',
    fullName: 'Ελένη Παπαδοπούλου',
  },
  {
    key: 'markos',
    email: 'markos.professor@academic-hub.local',
    fullName: 'Μάρκος Ιωαννίδης',
  },
  {
    key: 'sofiaN',
    email: 'sofia.professor@academic-hub.local',
    fullName: 'Σοφία Νικολαΐδου',
  },
  {
    key: 'dimitris',
    email: 'dimitris.professor@academic-hub.local',
    fullName: 'Δημήτρης Καραμήτρος',
  },
  {
    key: 'ioanna',
    email: 'ioanna.professor@academic-hub.local',
    fullName: 'Ιωάννα Σπύρου',
  },
];

const students: PersonSeed[] = [
  {
    key: 'maria',
    email: 'maria.student@academic-hub.local',
    fullName: 'Μαρία Αντωνίου',
  },
  {
    key: 'nikos',
    email: 'nikos.student@academic-hub.local',
    fullName: 'Νίκος Γεωργίου',
  },
  {
    key: 'eleniP',
    email: 'eleni.student@academic-hub.local',
    fullName: 'Ελένη Παπαγεωργίου',
  },
  {
    key: 'petros',
    email: 'petros.student@academic-hub.local',
    fullName: 'Πέτρος Δημητρίου',
  },
  {
    key: 'sofiaK',
    email: 'sofia.student@academic-hub.local',
    fullName: 'Σοφία Καραγιάννη',
  },
  {
    key: 'giorgos',
    email: 'giorgos.student@academic-hub.local',
    fullName: 'Γιώργος Σταύρου',
  },
  {
    key: 'christina',
    email: 'christina.student@academic-hub.local',
    fullName: 'Χριστίνα Οικονόμου',
  },
  {
    key: 'dimitraA',
    email: 'dimitra.student@academic-hub.local',
    fullName: 'Δήμητρα Αλεξίου',
  },
  {
    key: 'kostas',
    email: 'kostas.student@academic-hub.local',
    fullName: 'Κώστας Θεοδώρου',
  },
  {
    key: 'anna',
    email: 'anna.student@academic-hub.local',
    fullName: 'Άννα Βλάχου',
  },
  {
    key: 'thanasis',
    email: 'thanasis.student@academic-hub.local',
    fullName: 'Θανάσης Ρίζος',
  },
  {
    key: 'katerina',
    email: 'katerina.student@academic-hub.local',
    fullName: 'Κατερίνα Μιχαηλίδη',
  },
  {
    key: 'panagiotis',
    email: 'panagiotis.student@academic-hub.local',
    fullName: 'Παναγιώτης Λαμπρόπουλος',
  },
  {
    key: 'evangelia',
    email: 'evangelia.student@academic-hub.local',
    fullName: 'Ευαγγελία Τσιρώνη',
  },
  {
    key: 'stelios',
    email: 'stelios.student@academic-hub.local',
    fullName: 'Στέλιος Καββαδίας',
  },
  {
    key: 'marina',
    email: 'marina.student@academic-hub.local',
    fullName: 'Μαρίνα Χατζή',
  },
  {
    key: 'vasilis',
    email: 'vasilis.student@academic-hub.local',
    fullName: 'Βασίλης Παπανικολάου',
  },
  {
    key: 'ioannaK',
    email: 'ioanna.student@academic-hub.local',
    fullName: 'Ιωάννα Κοντού',
  },
];

// ---------------------------------------------------------------------------
// Courses, instructor assignments and enrollments
// ---------------------------------------------------------------------------

interface CourseSeed {
  key: string;
  code: string;
  title: string;
  description: string;
  semester: number;
  ectsCredits: number;
  ownerKey: string;
  assistantKey?: string;
}

const courses: CourseSeed[] = [
  {
    key: 'lms101',
    code: 'CS-LMS-101',
    title: 'Διαδραστικό Ακαδημαϊκό Περιεχόμενο',
    description:
      'Μάθημα επίδειξης του προτύπου LMS με έμφαση στο διαδραστικό περιεχόμενο, τους χάρτες ύλης και την ανατροφοδότηση προς τους διδάσκοντες.',
    semester: 1,
    ectsCredits: 6,
    ownerKey: 'eleni',
    assistantKey: 'sofiaN',
  },
  {
    key: 'web305',
    code: 'CS-WEB-305',
    title: 'Ανάπτυξη Διαδικτυακών Εφαρμογών',
    description:
      'Σχεδίαση και ανάπτυξη σύγχρονων διαδικτυακών εφαρμογών: αρχιτεκτονική client-server, REST APIs και αυθεντικοποίηση χρηστών.',
    semester: 5,
    ectsCredits: 6,
    ownerKey: 'eleni',
  },
  {
    key: 'hci410',
    code: 'CS-HCI-410',
    title: 'Ανθρωποκεντρικά Συστήματα Μάθησης',
    description:
      'Σχεδίαση προσβάσιμου και ανθρωποκεντρικού εκπαιδευτικού λογισμικού με πλούσια ανατροφοδότηση προς τον χρήστη.',
    semester: 7,
    ectsCredits: 5,
    ownerKey: 'eleni',
  },
  {
    key: 'alg201',
    code: 'CS-ALG-201',
    title: 'Αλγόριθμοι και Πολυπλοκότητα',
    description:
      'Σχεδίαση αλγορίθμων, ασυμπτωτική ανάλυση, τεχνικές απόδειξης ορθότητας και συμβιβασμοί πολυπλοκότητας.',
    semester: 3,
    ectsCredits: 6,
    ownerKey: 'markos',
  },
  {
    key: 'ds210',
    code: 'CS-DS-210',
    title: 'Δομές Δεδομένων',
    description:
      'Θεμελιώδεις δομές δεδομένων (λίστες, στοίβες, ουρές, δέντρα) και ανάλυση της απόδοσής τους.',
    semester: 2,
    ectsCredits: 6,
    ownerKey: 'markos',
    assistantKey: 'eleni',
  },
  {
    key: 'db301',
    code: 'CS-DB-301',
    title: 'Συστήματα Βάσεων Δεδομένων',
    description:
      'Σχεσιακή μοντελοποίηση, γλώσσα SQL, διαχείριση συναλλαγών, ευρετήρια και σχεδιασμός ερωτημάτων.',
    semester: 4,
    ectsCredits: 6,
    ownerKey: 'sofiaN',
    assistantKey: 'markos',
  },
  {
    key: 'os320',
    code: 'CS-OS-320',
    title: 'Λειτουργικά Συστήματα',
    description:
      'Διεργασίες, χρονοπρογραμματισμός, διαχείριση μνήμης και συγχρονισμός σε σύγχρονα λειτουργικά συστήματα.',
    semester: 4,
    ectsCredits: 6,
    ownerKey: 'sofiaN',
  },
  {
    key: 'net330',
    code: 'CS-NET-330',
    title: 'Δίκτυα Υπολογιστών',
    description:
      'Αρχές δικτύωσης υπολογιστών, το μοντέλο TCP/IP, δρομολόγηση και ασφάλεια δικτύων.',
    semester: 5,
    ectsCredits: 5,
    ownerKey: 'dimitris',
  },
  {
    key: 'dist501',
    code: 'CS-DIST-501',
    title: 'Κατανεμημένες Διαδικτυακές Πλατφόρμες',
    description:
      'Όρια υπηρεσιών, ασύγχρονες ροές εργασίας και σχεδιασμός ανθεκτικών κατανεμημένων συστημάτων.',
    semester: 6,
    ectsCredits: 6,
    ownerKey: 'dimitris',
  },
  {
    key: 'ml440',
    code: 'CS-ML-440',
    title: 'Μηχανική Μάθηση',
    description:
      'Επιβλεπόμενη και μη επιβλεπόμενη μάθηση, γραμμικά μοντέλα, κανονικοποίηση και αξιολόγηση μοντέλων.',
    semester: 7,
    ectsCredits: 6,
    ownerKey: 'ioanna',
  },
  {
    key: 'rm601',
    code: 'CS-RM-601',
    title: 'Μεθοδολογία Έρευνας στην Πληροφορική',
    description:
      'Σχεδιασμός ερευνητικής πρότασης, μεθοδολογία αξιολόγησης, ακαδημαϊκή δεοντολογία και επιστημονική γραφή.',
    semester: 8,
    ectsCredits: 4,
    ownerKey: 'ioanna',
  },
];

const enrollmentPlan: Record<string, string[]> = {
  maria: ['lms101', 'alg201', 'web305', 'db301', 'ml440', 'rm601'],
  nikos: ['lms101', 'alg201', 'ds210', 'os320', 'net330'],
  eleniP: ['lms101', 'web305', 'alg201', 'db301', 'dist501'],
  petros: ['lms101', 'alg201', 'ds210', 'hci410', 'ml440'],
  sofiaK: ['lms101', 'web305', 'os320', 'net330', 'rm601'],
  giorgos: ['lms101', 'ds210', 'db301', 'dist501', 'ml440', 'hci410'],
  christina: ['lms101', 'alg201', 'os320', 'net330', 'web305'],
  dimitraA: ['lms101', 'hci410', 'ds210', 'db301', 'ml440'],
  kostas: ['lms101', 'alg201', 'net330', 'dist501', 'rm601'],
  anna: ['web305', 'alg201', 'ds210', 'os320', 'ml440'],
  thanasis: ['web305', 'db301', 'os320', 'dist501', 'rm601'],
  katerina: ['web305', 'alg201', 'db301', 'net330', 'hci410'],
  panagiotis: ['hci410', 'ds210', 'os320', 'dist501', 'ml440'],
  evangelia: ['hci410', 'alg201', 'db301', 'net330', 'ml440', 'rm601'],
  stelios: ['ds210', 'db301', 'os320', 'net330', 'dist501'],
  marina: ['ds210', 'alg201', 'net330', 'ml440', 'web305'],
  vasilis: ['db301', 'os320', 'dist501', 'ml440', 'rm601'],
  ioannaK: ['web305', 'hci410', 'net330', 'dist501', 'ml440'],
};

// A handful of enrollments are deliberately not "active", for realism, on
// student/course pairs that carry no other narrative content (no
// annotation, thread, self-check attempt or roadmap progress references
// them), so the demo shows every EnrollmentStatus value without
// contradicting anything shown elsewhere.
const enrollmentStatusOverrides: Record<string, EnrollmentStatus> = {
  'thanasis:rm601': 'completed',
  'vasilis:os320': 'completed',
  'panagiotis:dist501': 'inactive',
  'marina:web305': 'completed',
  'katerina:net330': 'inactive',
};

function enrollmentStatusFor(
  studentKey: string,
  courseKey: string,
): EnrollmentStatus {
  return enrollmentStatusOverrides[`${studentKey}:${courseKey}`] ?? 'active';
}

function assertUniqueValues(values: string[], label: string): void {
  const duplicate = values.find(
    (value, index) => values.indexOf(value) !== index,
  );
  if (duplicate) {
    throw new Error(`Duplicate ${label} in demo seed: ${duplicate}`);
  }
}

function assertSeedPlan(): void {
  const professorKeys = new Set(professors.map((professor) => professor.key));
  const courseKeys = new Set(courses.map((course) => course.key));

  assertUniqueValues(
    [...admins, ...professors, ...students].map((person) => person.key),
    'person key',
  );
  assertUniqueValues(
    [...admins, ...professors, ...students].map((person) => person.email),
    'person email',
  );
  assertUniqueValues(
    courses.map((course) => course.key),
    'course key',
  );
  assertUniqueValues(
    courses.map((course) => course.code),
    'course code',
  );

  const assignmentCounts = new Map<string, number>();
  for (const course of courses) {
    if (!professorKeys.has(course.ownerKey)) {
      throw new Error(
        `Unknown owner ${course.ownerKey} for course ${course.key}`,
      );
    }
    assignmentCounts.set(
      course.ownerKey,
      (assignmentCounts.get(course.ownerKey) ?? 0) + 1,
    );

    if (course.assistantKey) {
      if (!professorKeys.has(course.assistantKey)) {
        throw new Error(
          `Unknown assistant ${course.assistantKey} for course ${course.key}`,
        );
      }
      if (course.assistantKey === course.ownerKey) {
        throw new Error(
          `Course ${course.key} cannot have the owner as assistant`,
        );
      }
      assignmentCounts.set(
        course.assistantKey,
        (assignmentCounts.get(course.assistantKey) ?? 0) + 1,
      );
    }
  }

  for (const professor of professors) {
    const assignmentCount = assignmentCounts.get(professor.key) ?? 0;
    if (assignmentCount < 2 || assignmentCount > 4) {
      throw new Error(
        `Professor ${professor.key} must have 2-4 course assignments, found ${assignmentCount}`,
      );
    }
  }

  for (const student of students) {
    const plannedCourses = enrollmentPlan[student.key];
    if (
      !plannedCourses ||
      plannedCourses.length < 5 ||
      plannedCourses.length > 6
    ) {
      throw new Error(
        `Student ${student.key} must have 5-6 courses, found ${plannedCourses?.length ?? 0}`,
      );
    }
    assertUniqueValues(plannedCourses, `course enrollment for ${student.key}`);
    for (const courseKey of plannedCourses) {
      if (!courseKeys.has(courseKey)) {
        throw new Error(
          `Unknown course ${courseKey} in enrollment plan for ${student.key}`,
        );
      }
    }
  }

  for (const overrideKey of Object.keys(enrollmentStatusOverrides)) {
    const [studentKey, courseKey] = overrideKey.split(':');
    if (!enrollmentPlan[studentKey]?.includes(courseKey)) {
      throw new Error(
        `Enrollment status override has no matching enrollment: ${overrideKey}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Users, courses, instructors, enrollments
// ---------------------------------------------------------------------------

async function upsertPerson(
  person: PersonSeed,
  role: UserRole,
  passwordHash: string,
): Promise<void> {
  const id = userId(person.key);

  await prisma.user.upsert({
    where: { id },
    update: {
      email: person.email,
      fullName: person.fullName,
      passwordHash,
      role,
      isActive: true,
    },
    create: {
      id,
      email: person.email,
      passwordHash,
      fullName: person.fullName,
      role,
      isActive: true,
    },
  });
}

async function seedUsers(): Promise<void> {
  const passwordHash = await hashPassword(demoPassword);

  for (const admin of admins) await upsertPerson(admin, 'admin', passwordHash);
  for (const professor of professors)
    await upsertPerson(professor, 'professor', passwordHash);
  for (const student of students)
    await upsertPerson(student, 'student', passwordHash);
}

async function upsertCourseRecord(course: CourseSeed): Promise<void> {
  const id = courseId(course.key);
  const data = {
    code: course.code,
    title: course.title,
    description: course.description,
    semester: course.semester,
    ectsCredits: course.ectsCredits,
    isActive: true,
  };

  await prisma.course.upsert({
    where: { id },
    update: data,
    create: { id, ...data },
  });
}

async function upsertInstructor(
  courseKey: string,
  profKey: string,
  instructorRole: CourseInstructorRole,
): Promise<void> {
  await prisma.courseInstructor.upsert({
    where: {
      courseId_instructorId: {
        courseId: courseId(courseKey),
        instructorId: userId(profKey),
      },
    },
    update: { instructorRole },
    create: {
      id: instructorAssignmentId(courseKey, profKey),
      courseId: courseId(courseKey),
      instructorId: userId(profKey),
      instructorRole,
    },
  });
}

async function upsertEnrollment(
  studentKey: string,
  courseKey: string,
  status: EnrollmentStatus,
): Promise<void> {
  await prisma.enrollment.upsert({
    where: {
      courseId_studentId: {
        courseId: courseId(courseKey),
        studentId: userId(studentKey),
      },
    },
    update: { status },
    create: {
      id: enrollmentId(studentKey, courseKey),
      courseId: courseId(courseKey),
      studentId: userId(studentKey),
      status,
    },
  });
}

async function seedCoursesInstructorsEnrollments(): Promise<void> {
  for (const course of courses) {
    await upsertCourseRecord(course);
    await upsertInstructor(course.key, course.ownerKey, 'owner');
    if (course.assistantKey) {
      await upsertInstructor(course.key, course.assistantKey, 'assistant');
    }
  }

  for (const student of students) {
    const courseKeys = enrollmentPlan[student.key] ?? [];
    for (const courseKey of courseKeys) {
      await upsertEnrollment(
        student.key,
        courseKey,
        enrollmentStatusFor(student.key, courseKey),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

interface DocumentMeta {
  title: string;
  filename: string;
  checksum: string;
}

const documentMetaStore = new Map<string, DocumentMeta>();

function documentMetaFor(courseKey: string, docKey: string): DocumentMeta {
  const meta = documentMetaStore.get(`${courseKey}:${docKey}`);
  if (!meta) {
    throw new Error(`Unknown seed document reference: ${courseKey}:${docKey}`);
  }
  return meta;
}

interface DocumentInput {
  courseKey: string;
  docKey: string;
  title: string;
  description: string;
  status: DocumentStatus;
  visibility: DocumentVisibility;
  filename: string;
  pageCount: number;
  createdByKey: string;
  updatedByKey?: string;
  createdAt: Date;
  replacedAt?: Date;
  deletedAt?: Date;
}

async function upsertDocument(input: DocumentInput): Promise<void> {
  const id = documentId(input.courseKey, input.docKey);
  const createdById = userId(input.createdByKey);
  const updatedById = userId(input.updatedByKey ?? input.createdByKey);
  const objectKey = `courses/${input.courseKey}/${input.filename}`;
  const assetUrl = new URL(
    `./seed-assets/documents/${input.courseKey}-${input.docKey}.pdf`,
    import.meta.url,
  );
  const pdfBuffer = await readFile(assetUrl);
  const pdfDocument = await PDFDocument.load(pdfBuffer, {
    ignoreEncryption: false,
    updateMetadata: false,
  });
  const actualPageCount = pdfDocument.getPageCount();

  if (actualPageCount !== input.pageCount) {
    throw new Error(
      `Demo PDF page count mismatch for ${input.courseKey}:${input.docKey}: ` +
        `expected ${input.pageCount}, found ${actualPageCount}`,
    );
  }

  const checksumSha256 = createHash('sha256').update(pdfBuffer).digest('hex');
  const fileSizeBytes = BigInt(pdfBuffer.byteLength);

  await storageService.putObject({
    body: pdfBuffer,
    contentLength: pdfBuffer.byteLength,
    contentType: 'application/pdf',
    key: objectKey,
    metadata: { checksumSha256, source: 'demo-seed' },
  });

  const sharedData = {
    title: input.title,
    description: input.description,
    status: input.status,
    visibility: input.visibility,
    objectKey,
    originalFilename: input.filename,
    mimeType: 'application/pdf',
    fileSizeBytes,
    checksumSha256,
    pageCount: actualPageCount,
    replacedAt: input.replacedAt ?? null,
    deletedAt: input.deletedAt ?? null,
    updatedById,
  };

  await prisma.document.upsert({
    where: { id },
    update: sharedData,
    create: {
      id,
      courseId: courseId(input.courseKey),
      createdById,
      createdAt: input.createdAt,
      ...sharedData,
    },
  });

  documentMetaStore.set(`${input.courseKey}:${input.docKey}`, {
    title: input.title,
    filename: input.filename,
    checksum: checksumSha256,
  });
}

// ---------------------------------------------------------------------------
// Roadmap: concepts, nodes, edges, resources, progress
// ---------------------------------------------------------------------------

interface ConceptInput {
  courseKey: string;
  key: string;
  slug: string;
  title: string;
  description: string;
  learningObjective: string;
  orderIndex: number;
  createdByKey: string;
}

async function upsertConcept(input: ConceptInput): Promise<void> {
  const id = conceptId(input.courseKey, input.key);
  const data = {
    slug: input.slug,
    title: input.title,
    description: input.description,
    learningObjective: input.learningObjective,
    orderIndex: input.orderIndex,
  };

  await prisma.concept.upsert({
    where: { id },
    update: data,
    create: {
      id,
      courseId: courseId(input.courseKey),
      createdById: userId(input.createdByKey),
      ...data,
    },
  });
}

interface RoadmapNodeInput {
  courseKey: string;
  key: string;
  conceptKey: string;
  title: string;
  description: string;
  learningObjective: string;
  estimatedMinutes: number;
  difficulty: DifficultyLevel;
  completionRule: CompletionRule;
  orderIndex: number;
  createdByKey: string;
}

async function upsertRoadmapNode(input: RoadmapNodeInput): Promise<void> {
  const id = nodeId(input.courseKey, input.key);
  const data = {
    title: input.title,
    description: input.description,
    learningObjective: input.learningObjective,
    estimatedMinutes: input.estimatedMinutes,
    difficulty: input.difficulty,
    completionRule: input.completionRule,
    orderIndex: input.orderIndex,
  };

  await prisma.roadmapNode.upsert({
    where: { id },
    update: data,
    create: {
      id,
      courseId: courseId(input.courseKey),
      conceptId: conceptId(input.courseKey, input.conceptKey),
      createdById: userId(input.createdByKey),
      ...data,
    },
  });
}

async function upsertRoadmapEdge(
  courseKey: string,
  fromKey: string,
  toKey: string,
): Promise<void> {
  const fromNodeId = nodeId(courseKey, fromKey);
  const toNodeId = nodeId(courseKey, toKey);

  await prisma.roadmapEdge.upsert({
    where: { fromNodeId_toNodeId: { fromNodeId, toNodeId } },
    update: {},
    create: {
      id: edgeId(courseKey, fromKey, toKey),
      courseId: courseId(courseKey),
      fromNodeId,
      toNodeId,
    },
  });
}

interface RoadmapResourceInput {
  courseKey: string;
  nodeKey: string;
  key: string;
  resourceType: RoadmapResourceType;
  docKey: string;
  pageStart: number;
  pageEnd: number;
  sectionLabel?: string;
  title: string;
  orderIndex?: number;
}

async function upsertRoadmapResource(
  input: RoadmapResourceInput,
): Promise<void> {
  const id = resourceId(input.courseKey, input.key);
  const data = {
    resourceType: input.resourceType,
    pageStart: input.pageStart,
    pageEnd: input.pageEnd,
    sectionLabel: input.sectionLabel ?? null,
    title: input.title,
  };

  await prisma.roadmapNodeResource.upsert({
    where: { id },
    update: data,
    create: {
      id,
      roadmapNodeId: nodeId(input.courseKey, input.nodeKey),
      documentId: documentId(input.courseKey, input.docKey),
      orderIndex: input.orderIndex ?? 1,
      ...data,
    },
  });
}

interface RoadmapProgressInput {
  courseKey: string;
  nodeKey: string;
  studentKey: string;
  status: RoadmapProgressStatus;
  startedAt?: Date;
  completedAt?: Date;
  needsReviewReason?: string;
}

async function upsertRoadmapProgress(
  input: RoadmapProgressInput,
): Promise<void> {
  const roadmapNodeId = nodeId(input.courseKey, input.nodeKey);
  const studentId = userId(input.studentKey);
  const data = {
    status: input.status,
    startedAt: input.startedAt ?? null,
    completedAt: input.completedAt ?? null,
    needsReviewReason: input.needsReviewReason ?? null,
  };

  await prisma.roadmapProgress.upsert({
    where: { roadmapNodeId_studentId: { roadmapNodeId, studentId } },
    update: data,
    create: {
      id: progressId(input.studentKey, input.courseKey, input.nodeKey),
      roadmapNodeId,
      studentId,
      ...data,
    },
  });
}

// ---------------------------------------------------------------------------
// Forum: categories, annotations/targets, threads, posts, thread links
// ---------------------------------------------------------------------------

const CATEGORY_NAMES: Record<ForumCategoryKind, string> = {
  general: 'Γενικές ερωτήσεις μαθήματος',
  document_discussion: 'Συζητήσεις εγγράφων',
  archived_document_discussion: 'Αρχειοθετημένες συζητήσεις εγγράφων',
};

async function upsertForumCategories(
  courseKey: string,
  kinds: ForumCategoryKind[],
): Promise<void> {
  for (const [index, kind] of kinds.entries()) {
    const id = categoryId(courseKey, kind);
    const data = { name: CATEGORY_NAMES[kind], kind, orderIndex: index + 1 };

    await prisma.forumCategory.upsert({
      where: { id },
      update: data,
      create: { id, courseId: courseId(courseKey), ...data },
    });
  }
}

interface AnnotationInput {
  courseKey: string;
  key: string;
  docKey: string;
  page: number;
  quote: string;
  prefix?: string;
  suffix?: string;
  type: AnnotationType;
  visibility: AnnotationVisibility;
  body: string | null;
  authorKey: string;
  conceptKey?: string;
  nodeKey?: string;
  createdAt: Date;
}

async function upsertAnnotationWithTarget(
  input: AnnotationInput,
): Promise<void> {
  const meta = documentMetaFor(input.courseKey, input.docKey);
  const targetIdValue = targetId(input.courseKey, input.key);
  const annotationIdValue = annotationId(input.courseKey, input.key);
  const documentIdValue = documentId(input.courseKey, input.docKey);

  await prisma.annotationTarget.upsert({
    where: { id: targetIdValue },
    update: {
      pageNumber: input.page,
      selectedText: input.quote,
      documentTitleSnapshot: meta.title,
    },
    create: {
      id: targetIdValue,
      documentId: documentIdValue,
      pageNumber: input.page,
      selectedText: input.quote,
      textQuoteExact: input.quote,
      textQuotePrefix: input.prefix ?? '',
      textQuoteSuffix: input.suffix ?? '',
      normalizedRects: stockRects(),
      selectorMetadata: SELECTOR_METADATA,
      documentTitleSnapshot: meta.title,
      documentFilenameSnapshot: meta.filename,
      documentChecksumSnapshot: meta.checksum,
    },
  });

  await prisma.annotation.upsert({
    where: { id: annotationIdValue },
    update: {
      body: input.body,
      visibility: input.visibility,
      type: input.type,
    },
    create: {
      id: annotationIdValue,
      courseId: courseId(input.courseKey),
      documentId: documentIdValue,
      targetId: targetIdValue,
      authorId: userId(input.authorKey),
      conceptId: input.conceptKey
        ? conceptId(input.courseKey, input.conceptKey)
        : null,
      roadmapNodeId: input.nodeKey
        ? nodeId(input.courseKey, input.nodeKey)
        : null,
      type: input.type,
      visibility: input.visibility,
      body: input.body,
      createdAt: input.createdAt,
    },
  });
}

interface ThreadInput {
  courseKey: string;
  key: string;
  categoryKind: ForumCategoryKind;
  title: string;
  authorKey: string;
  status: ForumThreadStatus;
  visibility: AnnotationVisibility;
  annotationKey?: string;
  docKey?: string;
  conceptKey?: string;
  nodeKey?: string;
  pageNumberSnapshot?: number;
  selectedTextSnapshot?: string;
  resolvedAt?: Date;
  archivedAt?: Date;
  createdAt: Date;
}

async function upsertThread(input: ThreadInput): Promise<void> {
  const id = threadId(input.courseKey, input.key);
  const meta = input.docKey
    ? documentMetaFor(input.courseKey, input.docKey)
    : null;
  const sharedData = {
    title: input.title,
    status: input.status,
    visibility: input.visibility,
    resolvedAt: input.resolvedAt ?? null,
    archivedAt: input.archivedAt ?? null,
  };

  await prisma.forumThread.upsert({
    where: { id },
    update: sharedData,
    create: {
      id,
      courseId: courseId(input.courseKey),
      categoryId: categoryId(input.courseKey, input.categoryKind),
      annotationId: input.annotationKey
        ? annotationId(input.courseKey, input.annotationKey)
        : null,
      targetId: input.annotationKey
        ? targetId(input.courseKey, input.annotationKey)
        : null,
      documentId: input.docKey
        ? documentId(input.courseKey, input.docKey)
        : null,
      authorId: userId(input.authorKey),
      conceptId: input.conceptKey
        ? conceptId(input.courseKey, input.conceptKey)
        : null,
      roadmapNodeId: input.nodeKey
        ? nodeId(input.courseKey, input.nodeKey)
        : null,
      pageNumberSnapshot: input.pageNumberSnapshot ?? null,
      selectedTextSnapshot: input.selectedTextSnapshot ?? null,
      documentTitleSnapshot: meta ? meta.title : null,
      createdAt: input.createdAt,
      ...sharedData,
    },
  });
}

interface PostInput {
  courseKey: string;
  threadKey: string;
  key: string;
  authorKey: string;
  body: string;
  isVerified?: boolean;
  createdAt: Date;
}

async function upsertPost(input: PostInput): Promise<void> {
  const id = postId(input.courseKey, input.threadKey, input.key);
  const data = { body: input.body, isVerified: input.isVerified ?? false };

  await prisma.forumPost.upsert({
    where: { id },
    update: data,
    create: {
      id,
      threadId: threadId(input.courseKey, input.threadKey),
      authorId: userId(input.authorKey),
      createdAt: input.createdAt,
      ...data,
    },
  });
}

async function setVerifiedPost(
  courseKey: string,
  threadKey: string,
  postKey: string,
): Promise<void> {
  await prisma.forumThread.update({
    where: { id: threadId(courseKey, threadKey) },
    data: { verifiedPostId: postId(courseKey, threadKey, postKey) },
  });
}

async function upsertThreadLink(
  key: string,
  courseKey: string,
  sourceThreadKey: string,
  targetThreadKey: string,
  linkType: ThreadLinkType,
  createdByKey: string,
): Promise<void> {
  const sourceThreadId = threadId(courseKey, sourceThreadKey);
  const targetThreadId = threadId(courseKey, targetThreadKey);

  await prisma.threadLink.upsert({
    where: {
      sourceThreadId_targetThreadId_linkType: {
        sourceThreadId,
        targetThreadId,
        linkType,
      },
    },
    update: {},
    create: {
      id: threadLinkId(key),
      sourceThreadId,
      targetThreadId,
      linkType,
      createdById: userId(createdByKey),
    },
  });
}

// ---------------------------------------------------------------------------
// Self-checks, teaching interventions, analytics events, audit logs
// ---------------------------------------------------------------------------

interface SelfCheckInput {
  courseKey: string;
  key: string;
  nodeKey: string;
  conceptKey?: string;
  type: SelfCheckType;
  prompt: string;
  options: JsonValue;
  correctAnswer: JsonValue;
  passingScore: number;
  orderIndex?: number;
  createdByKey: string;
}

async function upsertSelfCheck(input: SelfCheckInput): Promise<void> {
  const id = selfCheckId(input.courseKey, input.key);
  const data = {
    type: input.type,
    prompt: input.prompt,
    options: input.options,
    correctAnswer: input.correctAnswer,
    passingScore: input.passingScore,
    orderIndex: input.orderIndex ?? 1,
  };

  await prisma.selfCheck.upsert({
    where: { id },
    update: data,
    create: {
      id,
      courseId: courseId(input.courseKey),
      roadmapNodeId: nodeId(input.courseKey, input.nodeKey),
      conceptId: input.conceptKey
        ? conceptId(input.courseKey, input.conceptKey)
        : null,
      createdById: userId(input.createdByKey),
      ...data,
    },
  });
}

interface SelfCheckAttemptInput {
  courseKey: string;
  selfCheckKey: string;
  key: string;
  studentKey: string;
  answer: JsonValue;
  score: number;
  status: SelfCheckAttemptStatus;
  submittedAt: Date;
}

async function upsertSelfCheckAttempt(
  input: SelfCheckAttemptInput,
): Promise<void> {
  const id = attemptId(input.courseKey, input.key);
  const data = {
    answer: input.answer,
    score: input.score,
    status: input.status,
  };

  await prisma.selfCheckAttempt.upsert({
    where: { id },
    update: data,
    create: {
      id,
      selfCheckId: selfCheckId(input.courseKey, input.selfCheckKey),
      studentId: userId(input.studentKey),
      submittedAt: input.submittedAt,
      ...data,
    },
  });
}

interface InterventionInput {
  courseKey: string;
  key: string;
  createdByKey: string;
  type: InterventionType;
  title: string;
  description: string;
  sourceAction: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  conceptKey?: string;
  nodeKey?: string;
  threadKey?: string;
  targetKey?: string;
  createdAt: Date;
  followUpAt?: Date;
}

async function upsertIntervention(input: InterventionInput): Promise<void> {
  const id = interventionId(input.courseKey, input.key);
  const data = {
    type: input.type,
    title: input.title,
    description: input.description,
    sourceAction: input.sourceAction,
    sourceEntityType: input.sourceEntityType ?? null,
    sourceEntityId: input.sourceEntityId ?? null,
    conceptId: input.conceptKey
      ? conceptId(input.courseKey, input.conceptKey)
      : null,
    roadmapNodeId: input.nodeKey
      ? nodeId(input.courseKey, input.nodeKey)
      : null,
    threadId: input.threadKey
      ? threadId(input.courseKey, input.threadKey)
      : null,
    targetId: input.targetKey
      ? targetId(input.courseKey, input.targetKey)
      : null,
    followUpAt: input.followUpAt ?? null,
  };

  await prisma.teachingIntervention.upsert({
    where: { id },
    update: data,
    create: {
      id,
      courseId: courseId(input.courseKey),
      createdById: userId(input.createdByKey),
      createdAt: input.createdAt,
      ...data,
    },
  });
}

interface AnalyticsEventInput {
  key: string;
  eventType: AnalyticsEventType;
  courseKey: string;
  userKey?: string;
  docKey?: string;
  conceptKey?: string;
  nodeKey?: string;
  annotationKey?: string;
  threadKey?: string;
  selfCheckKey?: string;
  interventionKey?: string;
  targetKey?: string;
  metadata: JsonValue;
  createdAt: Date;
}

async function upsertAnalyticsEvent(input: AnalyticsEventInput): Promise<void> {
  const id = analyticsEventId(input.key);
  const data = {
    eventType: input.eventType,
    userId: input.userKey ? userId(input.userKey) : null,
    documentId: input.docKey ? documentId(input.courseKey, input.docKey) : null,
    conceptId: input.conceptKey
      ? conceptId(input.courseKey, input.conceptKey)
      : null,
    roadmapNodeId: input.nodeKey
      ? nodeId(input.courseKey, input.nodeKey)
      : null,
    annotationId: input.annotationKey
      ? annotationId(input.courseKey, input.annotationKey)
      : null,
    threadId: input.threadKey
      ? threadId(input.courseKey, input.threadKey)
      : null,
    selfCheckId: input.selfCheckKey
      ? selfCheckId(input.courseKey, input.selfCheckKey)
      : null,
    interventionId: input.interventionKey
      ? interventionId(input.courseKey, input.interventionKey)
      : null,
    targetId: input.targetKey
      ? targetId(input.courseKey, input.targetKey)
      : null,
    metadata: input.metadata,
  };

  await prisma.analyticsEvent.upsert({
    where: { id },
    update: data,
    create: {
      id,
      courseId: courseId(input.courseKey),
      createdAt: input.createdAt,
      ...data,
    },
  });
}

interface AuditLogInput {
  key: string;
  actorKey?: string;
  courseKey?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  metadata: JsonValue;
  createdAt: Date;
}

async function upsertAuditLog(input: AuditLogInput): Promise<void> {
  const id = auditLogId(input.key);
  const data = {
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    metadata: input.metadata,
  };

  await prisma.auditLog.upsert({
    where: { id },
    update: data,
    create: {
      id,
      actorId: input.actorKey ? userId(input.actorKey) : null,
      courseId: input.courseKey ? courseId(input.courseKey) : null,
      createdAt: input.createdAt,
      ...data,
    },
  });
}

// ---------------------------------------------------------------------------
// Flagship course 1: CS-LMS-101 — the richest narrative, exercising every
// forum thread status, the document lifecycle (active/replaced/deleted),
// a 3-node roadmap, a confusion-signal cluster and a teaching intervention.
// ---------------------------------------------------------------------------

async function seedLms101(): Promise<void> {
  const c = 'lms101';

  await upsertDocument({
    courseKey: c,
    docKey: 'week1',
    title: 'Εβδομάδα 1 - Ενεργή Ανάγνωση και Βρόχοι Ανατροφοδότησης',
    description:
      'Εισαγωγικό υλικό για την ενεργή ανάγνωση και τη σύνδεση σχολίων με το περιεχόμενο.',
    status: 'active',
    visibility: 'visible_to_students',
    filename: 'εβδομαδα-1-ενεργη-αναγνωση.pdf',
    pageCount: 18,
    createdByKey: 'eleni',
    createdAt: daysAgo(40),
  });
  await upsertDocument({
    courseKey: c,
    docKey: 'week2',
    title: 'Εβδομάδα 2 - Εννοιολογικοί Χάρτες και Διαδρομές Μελέτης',
    description:
      'Πώς οι έννοιες, τα προαπαιτούμενα και οι κόμβοι του χάρτη καθοδηγούν τη μελέτη.',
    status: 'active',
    visibility: 'visible_to_students',
    filename: 'εβδομαδα-2-εννοιολογικοι-χαρτες.pdf',
    pageCount: 22,
    createdByKey: 'eleni',
    createdAt: daysAgo(33),
  });
  await upsertDocument({
    courseKey: c,
    docKey: 'week3',
    title: 'Εβδομάδα 3 - Σήματα Σύγχυσης και Διδακτική Ανατροφοδότηση',
    description:
      'Νέο υλικό: πώς τα σήματα σύγχυσης φοιτητών μετατρέπονται σε διδακτικές ενέργειες.',
    status: 'active',
    visibility: 'visible_to_students',
    filename: 'εβδομαδα-3-σηματα-συγχυσης.pdf',
    pageCount: 14,
    createdByKey: 'eleni',
    createdAt: daysAgo(1),
  });
  await upsertDocument({
    courseKey: c,
    docKey: 'professor-notes',
    title: 'Σημειώσεις Διδάσκοντα - Ανασκόπηση Σημάτων Σύγχυσης',
    description:
      'Ιδιωτικές σημειώσεις προετοιμασίας παρεμβάσεων από σήματα φοιτητών.',
    status: 'active',
    visibility: 'hidden_from_students',
    filename: 'σημειωσεις-διδασκοντα-σηματα-συγχυσης.pdf',
    pageCount: 11,
    createdByKey: 'eleni',
    createdAt: daysAgo(20),
  });
  await upsertDocument({
    courseKey: c,
    docKey: 'week0-old',
    title: 'Εβδομάδα 0 - Διαφάνειες Εισαγωγής (Παλαιά Έκδοση)',
    description:
      'Αντικατεστημένο εισαγωγικό υλικό, διατηρείται για ιστορικούς λόγους.',
    status: 'replaced',
    visibility: 'visible_to_students',
    filename: 'εβδομαδα-0-εισαγωγη-v1.pdf',
    pageCount: 9,
    createdByKey: 'eleni',
    updatedByKey: 'sofiaN',
    createdAt: daysAgo(45),
    replacedAt: daysAgo(35),
  });
  await upsertDocument({
    courseKey: c,
    docKey: 'old-forum-export',
    title: 'Εξαγωγή Παλαιού Φόρουμ Μαθήματος',
    description:
      'Παλαιότερο υλικό αναφοράς από προηγούμενο εξάμηνο, αφαιρέθηκε ως ξεπερασμένο.',
    status: 'deleted',
    visibility: 'hidden_from_students',
    filename: 'εξαγωγη-παλαιου-φορουμ.pdf',
    pageCount: 5,
    createdByKey: 'eleni',
    createdAt: daysAgo(46),
    deletedAt: daysAgo(38),
  });

  await upsertConcept({
    courseKey: c,
    key: 'active-reading',
    slug: 'active-reading',
    title: 'Ενεργή ανάγνωση',
    description:
      'Μελέτη απευθείας πάνω στο μαθησιακό υλικό με αγκυρωμένες σημειώσεις.',
    learningObjective:
      'Να εξηγείται πώς οι επισημάνσεις, οι σημειώσεις και οι ερωτήσεις παραμένουν συνδεδεμένες με το πλαίσιο του PDF.',
    orderIndex: 1,
    createdByKey: 'eleni',
  });
  await upsertConcept({
    courseKey: c,
    key: 'roadmaps',
    slug: 'conceptual-roadmaps',
    title: 'Εννοιολογικοί χάρτες',
    description: 'Δομή μαθήματος βασισμένη σε έννοιες και προαπαιτούμενα.',
    learningObjective:
      'Να περιγράφεται πώς οι κόμβοι χάρτη συνδέουν έννοιες, πόρους και πρόοδο.',
    orderIndex: 2,
    createdByKey: 'eleni',
  });
  await upsertConcept({
    courseKey: c,
    key: 'teaching-intel',
    slug: 'teaching-intelligence',
    title: 'Διδακτική νοημοσύνη',
    description:
      'Αναλυτικά στοιχεία που παράγουν αξιοποιήσιμα διδακτικά σήματα.',
    learningObjective:
      'Να αναγνωρίζονται σήματα σύγχυσης και να μετατρέπονται σε διδακτικές παρεμβάσεις.',
    orderIndex: 3,
    createdByKey: 'eleni',
  });

  await upsertRoadmapNode({
    courseKey: c,
    key: 'active-reading',
    conceptKey: 'active-reading',
    title: 'Σχολιασμός μαθησιακού υλικού',
    description:
      'Πρακτική σε αγκυρωμένες επισημάνσεις, σημειώσεις και ερωτήσεις.',
    learningObjective: 'Δημιουργία σχολίου που διατηρεί το πλαίσιο του υλικού.',
    estimatedMinutes: 25,
    difficulty: 'low',
    completionRule: 'view_resource',
    orderIndex: 1,
    createdByKey: 'eleni',
  });
  await upsertRoadmapNode({
    courseKey: c,
    key: 'roadmaps',
    conceptKey: 'roadmaps',
    title: 'Μελέτη κόμβων με προαπαιτούμενα',
    description:
      'Κατανόηση του τρόπου με τον οποίο οι έννοιες καθοδηγούν τη σειρά μελέτης.',
    learningObjective:
      'Ανάγνωση μιας εξάρτησης χάρτη και επιλογή του επόμενου κόμβου.',
    estimatedMinutes: 35,
    difficulty: 'medium',
    completionRule: 'manual',
    orderIndex: 2,
    createdByKey: 'eleni',
  });
  await upsertRoadmapNode({
    courseKey: c,
    key: 'teaching-intel',
    conceptKey: 'teaching-intel',
    title: 'Ερμηνεία σημάτων σύγχυσης',
    description:
      'Χρήση αλληλεπιδράσεων μαθητών για επιλογή διδακτικής ενέργειας.',
    learningObjective:
      'Να εξηγείται γιατί μια επαναλαμβανόμενη ερώτηση πρέπει να εμφανίζεται στη διδακτική ουρά.',
    estimatedMinutes: 45,
    difficulty: 'high',
    completionRule: 'manual',
    orderIndex: 3,
    createdByKey: 'eleni',
  });

  await upsertRoadmapEdge(c, 'active-reading', 'roadmaps');
  await upsertRoadmapEdge(c, 'roadmaps', 'teaching-intel');

  await upsertRoadmapResource({
    courseKey: c,
    nodeKey: 'active-reading',
    key: 'reading-overview',
    resourceType: 'document_page',
    docKey: 'week1',
    pageStart: 2,
    pageEnd: 5,
    title: 'Επισκόπηση ενεργής ανάγνωσης',
  });
  await upsertRoadmapResource({
    courseKey: c,
    nodeKey: 'roadmaps',
    key: 'roadmap-examples',
    resourceType: 'document_section',
    docKey: 'week2',
    pageStart: 3,
    pageEnd: 9,
    sectionLabel: 'Παραδείγματα εννοιολογικών χαρτών',
    title: 'Παραδείγματα χάρτη',
  });
  await upsertRoadmapResource({
    courseKey: c,
    nodeKey: 'teaching-intel',
    key: 'signal-to-action',
    resourceType: 'document_page',
    docKey: 'week3',
    pageStart: 2,
    pageEnd: 6,
    title: 'Από τα σήματα στη δράση',
  });

  await upsertForumCategories(c, [
    'general',
    'document_discussion',
    'archived_document_discussion',
  ]);

  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'question-feedback',
    docKey: 'week3',
    page: 4,
    quote: 'βρόχος ανατροφοδότησης',
    prefix: 'Η πλατφόρμα κλείνει τον ',
    suffix:
      ' ανάμεσα στη δραστηριότητα των φοιτητών και την ενέργεια του διδάσκοντα.',
    type: 'question',
    visibility: 'public',
    authorKey: 'maria',
    conceptKey: 'active-reading',
    nodeKey: 'active-reading',
    body: 'Πώς αποφασίζει το σύστημα ότι μια επαναλαμβανόμενη ερώτηση χρειάζεται ενέργεια από τον διδάσκοντα;',
    createdAt: daysAgo(9),
  });
  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'confusing-heatmap',
    docKey: 'week3',
    page: 8,
    quote: 'θερμικός χάρτης σύγχυσης',
    prefix: 'Τα επαναλαμβανόμενα σήματα συνοψίζονται ως ',
    suffix: ' για τους διδάσκοντες.',
    type: 'confusing',
    visibility: 'instructor_only',
    authorKey: 'nikos',
    conceptKey: 'teaching-intel',
    nodeKey: 'teaching-intel',
    body: 'Η διαφορά ανάμεσα στην ακατέργαστη δραστηριότητα και σε ένα σήμα σύγχυσης δεν είναι ακόμη σαφής.',
    createdAt: daysAgo(6),
  });
  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'confusing-bulk-petros',
    docKey: 'week3',
    page: 11,
    quote: 'ουρά διδακτικών ενεργειών',
    prefix: 'Οι επαληθευμένες απαντήσεις τροφοδοτούν την ',
    suffix: ' με νέα προτεραιότητα.',
    type: 'question',
    visibility: 'public',
    authorKey: 'petros',
    body: 'Ποιος καθορίζει τη σειρά προτεραιότητας μέσα στην ουρά διδακτικών ενεργειών;',
    createdAt: daysAgo(3),
  });
  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'highlight-eleniP',
    docKey: 'week1',
    page: 3,
    quote: 'άγκυρα σχολιασμού',
    type: 'highlight',
    visibility: 'private',
    authorKey: 'eleniP',
    body: null,
    createdAt: daysAgo(25),
  });
  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'note-sofiaK',
    docKey: 'week2',
    page: 6,
    quote: 'προαπαιτούμενο',
    type: 'note',
    visibility: 'private',
    authorKey: 'sofiaK',
    body: 'Καλό σημείο εκκίνησης πριν τον χάρτη ύλης.',
    createdAt: daysAgo(18),
  });
  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'note-giorgos',
    docKey: 'week1',
    page: 10,
    quote: 'βρόχος ανατροφοδότησης εφαρμογής',
    type: 'note',
    visibility: 'public',
    authorKey: 'giorgos',
    body: 'Χρήσιμο παράδειγμα εφαρμογής σε πραγματικό μάθημα.',
    createdAt: daysAgo(15),
  });
  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'highlight-christina',
    docKey: 'week2',
    page: 12,
    quote: 'κόμβος χάρτη',
    type: 'highlight',
    visibility: 'private',
    authorKey: 'christina',
    body: null,
    createdAt: daysAgo(11),
  });

  await upsertThread({
    courseKey: c,
    key: 'q-feedback-loop',
    categoryKind: 'document_discussion',
    title: 'Πότε μια επαναλαμβανόμενη ερώτηση γίνεται διδακτική ενέργεια;',
    authorKey: 'maria',
    status: 'verified',
    visibility: 'public',
    annotationKey: 'question-feedback',
    docKey: 'week3',
    conceptKey: 'active-reading',
    nodeKey: 'active-reading',
    pageNumberSnapshot: 4,
    selectedTextSnapshot: 'βρόχος ανατροφοδότησης',
    resolvedAt: daysAgo(8),
    createdAt: daysAgo(9),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'q-feedback-loop',
    key: 'p1',
    authorKey: 'maria',
    body: 'Καταλαβαίνω το σχόλιο, αλλά όχι το όριο για την κλιμάκωση.',
    createdAt: daysAgo(9),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'q-feedback-loop',
    key: 'p2',
    authorKey: 'eleni',
    body: 'Η ουρά χρησιμοποιεί διαφανείς κανόνες: επαναλαμβανόμενες άλυτες ερωτήσεις, πρόσφατη δραστηριότητα και σημασία της έννοιας.',
    isVerified: true,
    createdAt: daysAgo(8),
  });
  await setVerifiedPost(c, 'q-feedback-loop', 'p2');

  await upsertThread({
    courseKey: c,
    key: 'confusing-heatmap',
    categoryKind: 'document_discussion',
    title: 'Ερμηνεία θερμικού χάρτη σύγχυσης',
    authorKey: 'nikos',
    status: 'open',
    visibility: 'instructor_only',
    annotationKey: 'confusing-heatmap',
    docKey: 'week3',
    conceptKey: 'teaching-intel',
    nodeKey: 'teaching-intel',
    pageNumberSnapshot: 8,
    selectedTextSnapshot: 'θερμικός χάρτης σύγχυσης',
    createdAt: daysAgo(6),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'confusing-heatmap',
    key: 'p1',
    authorKey: 'nikos',
    body: 'Η κλίμακα χρωμάτων δείχνει ένταση σήματος ή αριθμό φοιτητών;',
    createdAt: daysAgo(6),
  });

  await upsertThreadLink(
    'lms101-confusion-related',
    c,
    'confusing-heatmap',
    'q-feedback-loop',
    'related',
    'eleni',
  );

  await upsertThread({
    courseKey: c,
    key: 'study-group',
    categoryKind: 'general',
    title: 'Πώς οργανώνουμε ομαδική μελέτη για το τεστ της Εβδομάδας 2;',
    authorKey: 'giorgos',
    status: 'instructor_answered',
    visibility: 'public',
    createdAt: daysAgo(20),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'study-group',
    key: 'p1',
    authorKey: 'giorgos',
    body: 'Θέλει κανείς άλλος να συναντηθούμε online πριν το τεστ της Εβδομάδας 2;',
    createdAt: daysAgo(20),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'study-group',
    key: 'p2',
    authorKey: 'christina',
    body: 'Ναι, μέσα είμαι. Προτείνω Τετάρτη απόγευμα.',
    createdAt: daysAgo(19),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'study-group',
    key: 'p3',
    authorKey: 'eleni',
    body: 'Καλή ιδέα. Θα ανεβάσω επιπλέον ασκήσεις επανάληψης μέχρι Τρίτη.',
    createdAt: daysAgo(19),
  });

  await upsertThread({
    courseKey: c,
    key: 'deadline-clarification',
    categoryKind: 'general',
    title: 'Διευκρίνιση για την προθεσμία παράδοσης της εργασίας',
    authorKey: 'dimitraA',
    status: 'resolved',
    visibility: 'public',
    resolvedAt: daysAgo(14),
    createdAt: daysAgo(15),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'deadline-clarification',
    key: 'p1',
    authorKey: 'dimitraA',
    body: 'Η προθεσμία παράδοσης ισχύει και για όσους έχουν εργαστηριακή εξέταση;',
    createdAt: daysAgo(15),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'deadline-clarification',
    key: 'p2',
    authorKey: 'eleni',
    body: 'Ναι, ισχύει για όλους. Θα υπάρξει παράταση 2 ημερών μόνο για όσους έχουν επικαλυπτόμενες εξετάσεις.',
    createdAt: daysAgo(14),
  });

  await upsertThread({
    courseKey: c,
    key: 'progress-metric',
    categoryKind: 'general',
    title: 'Ασάφεια στον ορισμό του δείκτη προόδου ανά ενότητα',
    authorKey: 'kostas',
    status: 'verified',
    visibility: 'public',
    createdAt: daysAgo(12),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'progress-metric',
    key: 'p1',
    authorKey: 'kostas',
    body: 'Ο δείκτης προόδου μετράει σελίδες ή ολοκληρωμένες ενότητες;',
    createdAt: daysAgo(12),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'progress-metric',
    key: 'p2',
    authorKey: 'eleni',
    body: 'Μετράει ολοκληρωμένες ενότητες, όχι σελίδες.',
    isVerified: true,
    createdAt: daysAgo(11),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'progress-metric',
    key: 'p3',
    authorKey: 'kostas',
    body: 'Ευχαριστώ! Και τι γίνεται αν μια ενότητα δεν έχει self-check; Μετράει ως ολοκληρωμένη με απλή προβολή;',
    createdAt: daysAgo(2),
  });
  await setVerifiedPost(c, 'progress-metric', 'p2');

  await upsertThread({
    courseKey: c,
    key: 'old-forum-archive',
    categoryKind: 'archived_document_discussion',
    title: 'Σχόλια στην παλιά εξαγωγή φόρουμ (αρχειοθετημένο)',
    authorKey: 'sofiaK',
    status: 'archived',
    visibility: 'public',
    docKey: 'old-forum-export',
    archivedAt: daysAgo(37),
    createdAt: daysAgo(44),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'old-forum-archive',
    key: 'p1',
    authorKey: 'sofiaK',
    body: 'Το παλιό υλικό δεν αναφέρει τίποτα για τους χάρτες ύλης.',
    createdAt: daysAgo(44),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'old-forum-archive',
    key: 'p2',
    authorKey: 'eleni',
    body: 'Σωστά, αντικαταστάθηκε πλήρως από το νέο πρόγραμμα μαθήματος.',
    createdAt: daysAgo(43),
  });

  await upsertSelfCheck({
    courseKey: c,
    key: 'signal-priority',
    nodeKey: 'teaching-intel',
    conceptKey: 'teaching-intel',
    type: 'single_choice',
    prompt:
      'Ποιο σήμα αποτελεί την ισχυρότερη ένδειξη για διδακτική παρέμβαση;',
    options: [
      { id: 'a', label: 'Μία μεμονωμένη προβολή σελίδας' },
      { id: 'b', label: 'Επαναλαμβανόμενες άλυτες ερωτήσεις με πλαίσιο' },
      { id: 'c', label: 'Μία ιδιωτική σημείωση από έναν φοιτητή' },
    ],
    correctAnswer: { optionId: 'b' },
    passingScore: 100,
    createdByKey: 'eleni',
  });
  await upsertSelfCheckAttempt({
    courseKey: c,
    selfCheckKey: 'signal-priority',
    key: 'maria',
    studentKey: 'maria',
    answer: { optionId: 'b' },
    score: 100,
    status: 'passed',
    submittedAt: daysAgo(5),
  });
  await upsertSelfCheckAttempt({
    courseKey: c,
    selfCheckKey: 'signal-priority',
    key: 'nikos',
    studentKey: 'nikos',
    answer: { optionId: 'a' },
    score: 0,
    status: 'failed',
    submittedAt: daysAgo(4),
  });

  await upsertRoadmapProgress({
    courseKey: c,
    nodeKey: 'active-reading',
    studentKey: 'maria',
    status: 'completed',
    startedAt: daysAgo(10),
    completedAt: daysAgo(9),
  });
  await upsertRoadmapProgress({
    courseKey: c,
    nodeKey: 'roadmaps',
    studentKey: 'maria',
    status: 'in_progress',
    startedAt: daysAgo(7),
  });
  await upsertRoadmapProgress({
    courseKey: c,
    nodeKey: 'teaching-intel',
    studentKey: 'nikos',
    status: 'needs_review',
    startedAt: daysAgo(6),
    needsReviewReason:
      'Σημείωσε σύγχυση στην επεξήγηση των αναλυτικών στοιχείων.',
  });
  await upsertRoadmapProgress({
    courseKey: c,
    nodeKey: 'active-reading',
    studentKey: 'eleniP',
    status: 'completed',
    startedAt: daysAgo(20),
    completedAt: daysAgo(19),
  });

  await upsertIntervention({
    courseKey: c,
    key: 'clarify-escalation',
    createdByKey: 'eleni',
    type: 'answer_thread',
    title:
      'Αποσαφήνιση του τρόπου κατάταξης σημάτων σύγχυσης στη διδακτική ουρά',
    description:
      'Προστέθηκε επαληθευμένη απάντηση σε επαναλαμβανόμενη ερώτηση για τους κανόνες κλιμάκωσης.',
    sourceAction: 'verified_answer',
    sourceEntityType: 'forum_post',
    sourceEntityId: postId(c, 'q-feedback-loop', 'p2'),
    conceptKey: 'active-reading',
    nodeKey: 'active-reading',
    threadKey: 'q-feedback-loop',
    targetKey: 'question-feedback',
    createdAt: daysAgo(8),
    followUpAt: daysFromNow(5),
  });
  await upsertIntervention({
    courseKey: c,
    key: 'new-example-set',
    createdByKey: 'eleni',
    type: 'additional_resource',
    title: 'Προσθήκη νέου υλικού παραδειγμάτων για τον βρόχο ανατροφοδότησης',
    description:
      'Νέο τμήμα παραδειγμάτων στην Εβδομάδα 3, ως απάντηση στα σήματα σύγχυσης.',
    sourceAction: 'confusion_signal',
    sourceEntityType: 'document',
    sourceEntityId: documentId(c, 'week3'),
    conceptKey: 'teaching-intel',
    nodeKey: 'teaching-intel',
    threadKey: 'confusing-heatmap',
    targetKey: 'confusing-heatmap',
    createdAt: daysAgo(3),
    followUpAt: daysFromNow(4),
  });

  await upsertAnalyticsEvent({
    key: 'lms101-doc-opened-maria',
    eventType: 'document_opened',
    courseKey: c,
    userKey: 'maria',
    docKey: 'week3',
    conceptKey: 'active-reading',
    nodeKey: 'active-reading',
    metadata: { source: 'viewer' },
    createdAt: daysAgo(9),
  });
  await upsertAnalyticsEvent({
    key: 'lms101-page-viewed-maria',
    eventType: 'document_page_viewed',
    courseKey: c,
    userKey: 'maria',
    docKey: 'week3',
    conceptKey: 'active-reading',
    nodeKey: 'active-reading',
    targetKey: 'question-feedback',
    metadata: { pageNumber: 4 },
    createdAt: daysAgo(9),
  });
  await upsertAnalyticsEvent({
    key: 'lms101-annotation-maria',
    eventType: 'annotation_created',
    courseKey: c,
    userKey: 'maria',
    docKey: 'week3',
    conceptKey: 'active-reading',
    nodeKey: 'active-reading',
    targetKey: 'question-feedback',
    annotationKey: 'question-feedback',
    threadKey: 'q-feedback-loop',
    metadata: { annotationType: 'question', visibility: 'public' },
    createdAt: daysAgo(9),
  });
  await upsertAnalyticsEvent({
    key: 'lms101-thread-created-maria',
    eventType: 'forum_thread_created',
    courseKey: c,
    userKey: 'maria',
    docKey: 'week3',
    threadKey: 'q-feedback-loop',
    metadata: { status: 'open' },
    createdAt: daysAgo(9),
  });
  await upsertAnalyticsEvent({
    key: 'lms101-thread-resolved-eleni',
    eventType: 'forum_thread_resolved',
    courseKey: c,
    userKey: 'eleni',
    docKey: 'week3',
    threadKey: 'q-feedback-loop',
    metadata: { status: 'verified' },
    createdAt: daysAgo(8),
  });
  await upsertAnalyticsEvent({
    key: 'lms101-annotation-nikos',
    eventType: 'annotation_created',
    courseKey: c,
    userKey: 'nikos',
    docKey: 'week3',
    conceptKey: 'teaching-intel',
    nodeKey: 'teaching-intel',
    targetKey: 'confusing-heatmap',
    annotationKey: 'confusing-heatmap',
    threadKey: 'confusing-heatmap',
    metadata: { annotationType: 'confusing', visibility: 'instructor_only' },
    createdAt: daysAgo(6),
  });
  await upsertAnalyticsEvent({
    key: 'lms101-node-completed-maria',
    eventType: 'roadmap_node_completed',
    courseKey: c,
    userKey: 'maria',
    conceptKey: 'active-reading',
    nodeKey: 'active-reading',
    metadata: { completionRule: 'view_resource' },
    createdAt: daysAgo(9),
  });
  await upsertAnalyticsEvent({
    key: 'lms101-self-check-maria',
    eventType: 'self_check_completed',
    courseKey: c,
    userKey: 'maria',
    conceptKey: 'roadmaps',
    nodeKey: 'roadmaps',
    selfCheckKey: 'signal-priority',
    metadata: { score: 100, status: 'passed' },
    createdAt: daysAgo(5),
  });
  await upsertAnalyticsEvent({
    key: 'lms101-intervention-escalation',
    eventType: 'intervention_created',
    courseKey: c,
    userKey: 'eleni',
    docKey: 'week3',
    conceptKey: 'active-reading',
    nodeKey: 'active-reading',
    targetKey: 'question-feedback',
    annotationKey: 'question-feedback',
    threadKey: 'q-feedback-loop',
    interventionKey: 'clarify-escalation',
    metadata: { sourceAction: 'verified_answer' },
    createdAt: daysAgo(8),
  });
  await upsertAnalyticsEvent({
    key: 'lms101-intervention-examples',
    eventType: 'intervention_created',
    courseKey: c,
    userKey: 'eleni',
    docKey: 'week3',
    conceptKey: 'teaching-intel',
    nodeKey: 'teaching-intel',
    threadKey: 'confusing-heatmap',
    interventionKey: 'new-example-set',
    metadata: { sourceAction: 'confusion_signal' },
    createdAt: daysAgo(3),
  });
}

// ---------------------------------------------------------------------------
// Flagship course 2: CS-ALG-201 — a second, independent confusion-signal
// cluster and teaching intervention, owned by a different professor, so the
// "teaching intelligence" feature is shown working across the platform.
// ---------------------------------------------------------------------------

async function seedAlg201(): Promise<void> {
  const c = 'alg201';

  await upsertDocument({
    courseKey: c,
    docKey: 'week1',
    title: 'Εβδομάδα 1 - Ασυμπτωτική Ανάλυση και Ορθότητα Αλγορίθμων',
    description:
      'Εισαγωγή στον συμβολισμό Big-O/Ω/Θ και στην απόδειξη ορθότητας αλγορίθμων.',
    status: 'active',
    visibility: 'visible_to_students',
    filename: 'εβδομαδα-1-ασυμπτωτικη-αναλυση.pdf',
    pageCount: 16,
    createdByKey: 'markos',
    createdAt: daysAgo(38),
  });
  await upsertDocument({
    courseKey: c,
    docKey: 'proof-worksheet',
    title: 'Φύλλο Εργασίας Τεχνικών Απόδειξης',
    description:
      'Ασκήσεις πάνω σε επαγωγικές αποδείξεις και επιχειρήματα ανταλλαγής.',
    status: 'active',
    visibility: 'visible_to_students',
    filename: 'φυλλο-εργασιας-τεχνικων-αποδειξης.pdf',
    pageCount: 16,
    createdByKey: 'markos',
    createdAt: daysAgo(25),
  });
  await upsertDocument({
    courseKey: c,
    docKey: 'week5',
    title: 'Εβδομάδα 5 - Διαίρει και Βασίλευε: Ταξινόμηση και Αναδρομή',
    description:
      'Νέο υλικό: αλγόριθμοι διαίρει-και-βασίλευε και ανάλυση αναδρομικών σχέσεων.',
    status: 'active',
    visibility: 'visible_to_students',
    filename: 'εβδομαδα-5-διαιρει-και-βασιλευε.pdf',
    pageCount: 20,
    createdByKey: 'markos',
    createdAt: daysAgo(2),
  });
  await upsertDocument({
    courseKey: c,
    docKey: 'ta-notes',
    title: 'Σημειώσεις Βοηθού Διδασκαλίας - Συνήθη Λάθη σε Αποδείξεις',
    description:
      'Ιδιωτικές σημειώσεις με τα πιο συχνά λάθη φοιτητών σε επαγωγικές αποδείξεις.',
    status: 'active',
    visibility: 'hidden_from_students',
    filename: 'σημειωσεις-βοηθου-διδασκαλιας.pdf',
    pageCount: 9,
    createdByKey: 'markos',
    createdAt: daysAgo(15),
  });

  await upsertConcept({
    courseKey: c,
    key: 'asymptotic',
    slug: 'asymptotic-analysis',
    title: 'Ασυμπτωτική ανάλυση',
    description:
      'Συμβολισμός Big-O, Big-Ω και Big-Θ για την πολυπλοκότητα αλγορίθμων.',
    learningObjective:
      'Να ταξινομούνται αλγόριθμοι με βάση την ασυμπτωτική τους συμπεριφορά.',
    orderIndex: 1,
    createdByKey: 'markos',
  });
  await upsertConcept({
    courseKey: c,
    key: 'induction',
    slug: 'recursion-induction',
    title: 'Αναδρομή και επαγωγικές αποδείξεις',
    description:
      'Απόδειξη ορθότητας αναδρομικών αλγορίθμων με μαθηματική επαγωγή.',
    learningObjective:
      'Να γράφεται μια πλήρης επαγωγική απόδειξη με βασική περίπτωση και επαγωγικό βήμα.',
    orderIndex: 2,
    createdByKey: 'markos',
  });
  await upsertConcept({
    courseKey: c,
    key: 'divide-conquer',
    slug: 'divide-and-conquer',
    title: 'Διαίρει και βασίλευε',
    description:
      'Σχεδίαση αλγορίθμων με διάσπαση, αναδρομική επίλυση και συνδυασμό.',
    learningObjective:
      'Να αναλύεται η πολυπλοκότητα ενός αλγορίθμου διαίρει-και-βασίλευε.',
    orderIndex: 3,
    createdByKey: 'markos',
  });

  await upsertRoadmapNode({
    courseKey: c,
    key: 'asymptotic',
    conceptKey: 'asymptotic',
    title: 'Ταξινόμηση αλγορίθμων κατά πολυπλοκότητα',
    description: 'Σύγκριση αλγορίθμων μέσω ασυμπτωτικών ορίων.',
    learningObjective:
      'Κατάταξη ενός συνόλου αλγορίθμων από την πιο αργή στην πιο γρήγορη ασυμπτωτική συμπεριφορά.',
    estimatedMinutes: 30,
    difficulty: 'low',
    completionRule: 'view_resource',
    orderIndex: 1,
    createdByKey: 'markos',
  });
  await upsertRoadmapNode({
    courseKey: c,
    key: 'induction',
    conceptKey: 'induction',
    title: 'Απόδειξη ορθότητας με επαγωγή',
    description: 'Δόμηση μιας πλήρους επαγωγικής απόδειξης.',
    learningObjective:
      'Γραφή βασικής περίπτωσης και επαγωγικού βήματος για έναν αναδρομικό αλγόριθμο.',
    estimatedMinutes: 40,
    difficulty: 'high',
    completionRule: 'manual',
    orderIndex: 2,
    createdByKey: 'markos',
  });
  await upsertRoadmapNode({
    courseKey: c,
    key: 'divide-conquer',
    conceptKey: 'divide-conquer',
    title: 'Ανάλυση αλγορίθμων διαίρει-και-βασίλευε',
    description: 'Επίλυση αναδρομικών σχέσεων για αλγορίθμους ταξινόμησης.',
    learningObjective:
      'Εφαρμογή του κύριου θεωρήματος για την εύρεση πολυπλοκότητας.',
    estimatedMinutes: 40,
    difficulty: 'medium',
    completionRule: 'manual',
    orderIndex: 3,
    createdByKey: 'markos',
  });

  await upsertRoadmapEdge(c, 'asymptotic', 'induction');
  await upsertRoadmapEdge(c, 'induction', 'divide-conquer');

  await upsertRoadmapResource({
    courseKey: c,
    nodeKey: 'asymptotic',
    key: 'asymptotic-overview',
    resourceType: 'document_page',
    docKey: 'week1',
    pageStart: 2,
    pageEnd: 6,
    title: 'Επισκόπηση ασυμπτωτικού συμβολισμού',
  });
  await upsertRoadmapResource({
    courseKey: c,
    nodeKey: 'induction',
    key: 'induction-worksheet',
    resourceType: 'document_page',
    docKey: 'proof-worksheet',
    pageStart: 1,
    pageEnd: 8,
    title: 'Ασκήσεις επαγωγικής απόδειξης',
  });
  await upsertRoadmapResource({
    courseKey: c,
    nodeKey: 'divide-conquer',
    key: 'divide-conquer-overview',
    resourceType: 'document_page',
    docKey: 'week5',
    pageStart: 2,
    pageEnd: 10,
    title: 'Παραδείγματα διαίρει-και-βασίλευε',
  });

  await upsertForumCategories(c, ['general', 'document_discussion']);

  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'confusing-induction-nikos',
    docKey: 'proof-worksheet',
    page: 5,
    quote: 'επαγωγικό βήμα',
    prefix: 'Η απόδειξη ολοκληρώνεται με το ',
    suffix: ' που συνδέει την περίπτωση n με την n+1.',
    type: 'confusing',
    visibility: 'instructor_only',
    authorKey: 'nikos',
    conceptKey: 'induction',
    nodeKey: 'induction',
    body: 'Δεν είναι σαφές γιατί η υπόθεση αναδρομής ισχύει αυτόματα για n-1.',
    createdAt: daysAgo(7),
  });
  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'question-induction-eleniP',
    docKey: 'proof-worksheet',
    page: 5,
    quote: 'επαγωγικό βήμα',
    prefix: 'Η απόδειξη ολοκληρώνεται με το ',
    suffix: ' που συνδέει την περίπτωση n με την n+1.',
    type: 'question',
    visibility: 'public',
    authorKey: 'eleniP',
    conceptKey: 'induction',
    nodeKey: 'induction',
    body: 'Πρέπει να αποδείξουμε και τη βασική περίπτωση n=0 ξεχωριστά σε κάθε άσκηση;',
    createdAt: daysAgo(5),
  });
  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'question-induction-christina',
    docKey: 'proof-worksheet',
    page: 7,
    quote: 'ισχυρή επαγωγή',
    type: 'question',
    visibility: 'public',
    authorKey: 'christina',
    body: 'Πότε προτιμάμε ισχυρή επαγωγή αντί για απλή;',
    createdAt: daysAgo(4),
  });

  await upsertThread({
    courseKey: c,
    key: 'induction-confusion',
    categoryKind: 'document_discussion',
    title: 'Ασάφεια στο επαγωγικό βήμα της απόδειξης',
    authorKey: 'nikos',
    status: 'open',
    visibility: 'instructor_only',
    annotationKey: 'confusing-induction-nikos',
    docKey: 'proof-worksheet',
    conceptKey: 'induction',
    nodeKey: 'induction',
    pageNumberSnapshot: 5,
    selectedTextSnapshot: 'επαγωγικό βήμα',
    createdAt: daysAgo(7),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'induction-confusion',
    key: 'p1',
    authorKey: 'nikos',
    body: 'Το βήμα n→n+1 προϋποθέτει κάτι που δεν έχουμε αποδείξει ακόμα;',
    createdAt: daysAgo(7),
  });

  await upsertThread({
    courseKey: c,
    key: 'induction-question',
    categoryKind: 'document_discussion',
    title: 'Χρειάζεται ξεχωριστή απόδειξη για τη βασική περίπτωση;',
    authorKey: 'eleniP',
    status: 'verified',
    visibility: 'public',
    annotationKey: 'question-induction-eleniP',
    docKey: 'proof-worksheet',
    conceptKey: 'induction',
    nodeKey: 'induction',
    pageNumberSnapshot: 5,
    selectedTextSnapshot: 'επαγωγικό βήμα',
    resolvedAt: daysAgo(4),
    createdAt: daysAgo(5),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'induction-question',
    key: 'p1',
    authorKey: 'eleniP',
    body: 'Πρέπει να αποδείξουμε και τη βασική περίπτωση n=0 ξεχωριστά σε κάθε άσκηση;',
    createdAt: daysAgo(5),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'induction-question',
    key: 'p2',
    authorKey: 'markos',
    body: 'Ναι, πάντα ξεχωριστά. Χωρίς τη βασική περίπτωση η επαγωγή δεν είναι έγκυρη.',
    isVerified: true,
    createdAt: daysAgo(4),
  });
  await setVerifiedPost(c, 'induction-question', 'p2');

  await upsertThread({
    courseKey: c,
    key: 'textbook-recommendation',
    categoryKind: 'general',
    title: 'Προτεινόμενο βιβλίο για επιπλέον ασκήσεις αλγορίθμων',
    authorKey: 'maria',
    status: 'instructor_answered',
    visibility: 'public',
    createdAt: daysAgo(18),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'textbook-recommendation',
    key: 'p1',
    authorKey: 'maria',
    body: 'Υπάρχει κάποιο βιβλίο που να ταιριάζει με την ύλη του μαθήματος για επιπλέον εξάσκηση;',
    createdAt: daysAgo(18),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'textbook-recommendation',
    key: 'p2',
    authorKey: 'markos',
    body: 'Το CLRS καλύπτει όλη την ύλη. Θα ανεβάσω και επιπλέον ασκήσεις στην πλατφόρμα.',
    createdAt: daysAgo(17),
  });

  await upsertThread({
    courseKey: c,
    key: 'midterm-scope',
    categoryKind: 'general',
    title: 'Διευκρίνιση ύλης για το ενδιάμεσο διαγώνισμα',
    authorKey: 'kostas',
    status: 'resolved',
    visibility: 'public',
    resolvedAt: daysAgo(9),
    createdAt: daysAgo(10),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'midterm-scope',
    key: 'p1',
    authorKey: 'kostas',
    body: 'Το ενδιάμεσο καλύπτει και τη μέθοδο του δέντρου αναδρομής ή μόνο το κύριο θεώρημα;',
    createdAt: daysAgo(10),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'midterm-scope',
    key: 'p2',
    authorKey: 'markos',
    body: 'Καλύπτει και τα δύο. Θα δοθεί φύλλο επανάληψης την επόμενη εβδομάδα.',
    createdAt: daysAgo(9),
  });

  await upsertSelfCheck({
    courseKey: c,
    key: 'induction-check',
    nodeKey: 'induction',
    conceptKey: 'induction',
    type: 'single_choice',
    prompt:
      'Ποιο βήμα είναι απαραίτητο σε μια απόδειξη με απλή μαθηματική επαγωγή;',
    options: [
      { id: 'a', label: 'Μόνο η επαλήθευση για μεγάλες τιμές του n' },
      { id: 'b', label: 'Βασική περίπτωση και επαγωγικό βήμα' },
      { id: 'c', label: 'Μόνο το επαγωγικό βήμα' },
    ],
    correctAnswer: { optionId: 'b' },
    passingScore: 100,
    createdByKey: 'markos',
  });
  await upsertSelfCheckAttempt({
    courseKey: c,
    selfCheckKey: 'induction-check',
    key: 'nikos',
    studentKey: 'nikos',
    answer: { optionId: 'c' },
    score: 0,
    status: 'failed',
    submittedAt: daysAgo(4),
  });
  await upsertSelfCheckAttempt({
    courseKey: c,
    selfCheckKey: 'induction-check',
    key: 'petros',
    studentKey: 'petros',
    answer: { optionId: 'b' },
    score: 100,
    status: 'passed',
    submittedAt: daysAgo(3),
  });

  await upsertRoadmapProgress({
    courseKey: c,
    nodeKey: 'asymptotic',
    studentKey: 'nikos',
    status: 'in_progress',
    startedAt: daysAgo(20),
  });
  await upsertRoadmapProgress({
    courseKey: c,
    nodeKey: 'asymptotic',
    studentKey: 'petros',
    status: 'completed',
    startedAt: daysAgo(19),
    completedAt: daysAgo(18),
  });
  await upsertRoadmapProgress({
    courseKey: c,
    nodeKey: 'induction',
    studentKey: 'eleniP',
    status: 'needs_review',
    startedAt: daysAgo(5),
    needsReviewReason: 'Σύγχυση στο επαγωγικό βήμα.',
  });

  await upsertIntervention({
    courseKey: c,
    key: 'proof-examples',
    createdByKey: 'markos',
    type: 'additional_resource',
    title: 'Προσθήκη νέων παραδειγμάτων επαγωγικών αποδείξεων',
    description:
      'Νέα λυμένα παραδείγματα στο φύλλο εργασίας, ως απάντηση στα σήματα σύγχυσης.',
    sourceAction: 'confusion_signal',
    sourceEntityType: 'document',
    sourceEntityId: documentId(c, 'proof-worksheet'),
    conceptKey: 'induction',
    nodeKey: 'induction',
    threadKey: 'induction-confusion',
    targetKey: 'confusing-induction-nikos',
    createdAt: daysAgo(6),
    followUpAt: daysFromNow(3),
  });

  await upsertAnalyticsEvent({
    key: 'alg201-doc-opened-nikos',
    eventType: 'document_opened',
    courseKey: c,
    userKey: 'nikos',
    docKey: 'proof-worksheet',
    conceptKey: 'induction',
    nodeKey: 'induction',
    metadata: { source: 'viewer' },
    createdAt: daysAgo(7),
  });
  await upsertAnalyticsEvent({
    key: 'alg201-annotation-nikos',
    eventType: 'annotation_created',
    courseKey: c,
    userKey: 'nikos',
    docKey: 'proof-worksheet',
    conceptKey: 'induction',
    nodeKey: 'induction',
    targetKey: 'confusing-induction-nikos',
    annotationKey: 'confusing-induction-nikos',
    threadKey: 'induction-confusion',
    metadata: { annotationType: 'confusing', visibility: 'instructor_only' },
    createdAt: daysAgo(7),
  });
  await upsertAnalyticsEvent({
    key: 'alg201-thread-created-nikos',
    eventType: 'forum_thread_created',
    courseKey: c,
    userKey: 'nikos',
    docKey: 'proof-worksheet',
    threadKey: 'induction-confusion',
    metadata: { status: 'open' },
    createdAt: daysAgo(7),
  });
  await upsertAnalyticsEvent({
    key: 'alg201-annotation-eleniP',
    eventType: 'annotation_created',
    courseKey: c,
    userKey: 'eleniP',
    docKey: 'proof-worksheet',
    conceptKey: 'induction',
    nodeKey: 'induction',
    targetKey: 'question-induction-eleniP',
    annotationKey: 'question-induction-eleniP',
    threadKey: 'induction-question',
    metadata: { annotationType: 'question', visibility: 'public' },
    createdAt: daysAgo(5),
  });
  await upsertAnalyticsEvent({
    key: 'alg201-thread-resolved-markos',
    eventType: 'forum_thread_resolved',
    courseKey: c,
    userKey: 'markos',
    docKey: 'proof-worksheet',
    threadKey: 'induction-question',
    metadata: { status: 'verified' },
    createdAt: daysAgo(4),
  });
  await upsertAnalyticsEvent({
    key: 'alg201-intervention-examples',
    eventType: 'intervention_created',
    courseKey: c,
    userKey: 'markos',
    docKey: 'proof-worksheet',
    conceptKey: 'induction',
    nodeKey: 'induction',
    threadKey: 'induction-confusion',
    interventionKey: 'proof-examples',
    metadata: { sourceAction: 'confusion_signal' },
    createdAt: daysAgo(6),
  });
}

// ---------------------------------------------------------------------------
// Medium-tier courses: two documents, a small roadmap, a couple of forum
// threads and annotations each — enough to feel real without the full
// flagship depth.
// ---------------------------------------------------------------------------

async function seedWeb305(): Promise<void> {
  const c = 'web305';

  await upsertDocument({
    courseKey: c,
    docKey: 'week1',
    title: 'Εβδομάδα 1 - Αρχιτεκτονική Client-Server και HTTP',
    description:
      'Θεμέλια της επικοινωνίας client-server και του πρωτοκόλλου HTTP.',
    status: 'active',
    visibility: 'visible_to_students',
    filename: 'εβδομαδα-1-client-server-http.pdf',
    pageCount: 14,
    createdByKey: 'eleni',
    createdAt: daysAgo(30),
  });
  await upsertDocument({
    courseKey: c,
    docKey: 'week4',
    title: 'Εβδομάδα 4 - REST API Σχεδιασμός και Αυθεντικοποίηση',
    description:
      'Νέο υλικό: αρχές σχεδίασης RESTful API και μηχανισμοί αυθεντικοποίησης.',
    status: 'active',
    visibility: 'visible_to_students',
    filename: 'εβδομαδα-4-rest-api-σχεδιασμος.pdf',
    pageCount: 19,
    createdByKey: 'eleni',
    createdAt: daysAgo(3),
  });

  await upsertConcept({
    courseKey: c,
    key: 'http',
    slug: 'http-fundamentals',
    title: 'Θεμέλια HTTP',
    description: 'Αιτήματα, αποκρίσεις, μέθοδοι και κωδικοί κατάστασης HTTP.',
    learningObjective: 'Να περιγράφεται ο κύκλος ζωής ενός αιτήματος HTTP.',
    orderIndex: 1,
    createdByKey: 'eleni',
  });
  await upsertConcept({
    courseKey: c,
    key: 'rest',
    slug: 'rest-api-design',
    title: 'Σχεδίαση REST API',
    description:
      'Σχεδιασμός RESTful τελικών σημείων και σωστή χρήση μεθόδων HTTP.',
    learningObjective:
      'Να σχεδιάζεται ένα σύνολο RESTful endpoints για έναν πόρο.',
    orderIndex: 2,
    createdByKey: 'eleni',
  });

  await upsertRoadmapNode({
    courseKey: c,
    key: 'http',
    conceptKey: 'http',
    title: 'Κατανόηση αιτημάτων και αποκρίσεων HTTP',
    description: 'Ανάλυση κεφαλίδων, μεθόδων και κωδικών κατάστασης.',
    learningObjective: 'Ερμηνεία μιας ανταλλαγής HTTP αίτησης/απόκρισης.',
    estimatedMinutes: 25,
    difficulty: 'low',
    completionRule: 'view_resource',
    orderIndex: 1,
    createdByKey: 'eleni',
  });
  await upsertRoadmapNode({
    courseKey: c,
    key: 'rest',
    conceptKey: 'rest',
    title: 'Σχεδίαση RESTful τελικών σημείων',
    description:
      'Σχεδιασμός endpoints με σωστή χρήση GET/POST/PUT/PATCH/DELETE.',
    learningObjective:
      'Σχεδίαση ενός συνόλου endpoints για διαχείριση ενός πόρου.',
    estimatedMinutes: 35,
    difficulty: 'medium',
    completionRule: 'manual',
    orderIndex: 2,
    createdByKey: 'eleni',
  });
  await upsertRoadmapEdge(c, 'http', 'rest');

  await upsertRoadmapResource({
    courseKey: c,
    nodeKey: 'http',
    key: 'http-overview',
    resourceType: 'document_page',
    docKey: 'week1',
    pageStart: 1,
    pageEnd: 6,
    title: 'Επισκόπηση HTTP',
  });
  await upsertRoadmapResource({
    courseKey: c,
    nodeKey: 'rest',
    key: 'rest-overview',
    resourceType: 'document_page',
    docKey: 'week4',
    pageStart: 3,
    pageEnd: 12,
    title: 'Σχεδίαση REST endpoints',
  });

  await upsertForumCategories(c, ['general', 'document_discussion']);

  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'put-vs-patch',
    docKey: 'week4',
    page: 5,
    quote: 'μερική ενημέρωση πόρου',
    type: 'question',
    visibility: 'public',
    authorKey: 'sofiaK',
    conceptKey: 'rest',
    nodeKey: 'rest',
    body: 'Πότε χρησιμοποιούμε PATCH αντί για PUT σε ένα REST endpoint;',
    createdAt: daysAgo(6),
  });
  await upsertThread({
    courseKey: c,
    key: 'put-vs-patch',
    categoryKind: 'document_discussion',
    title: 'PUT ή PATCH για μερική ενημέρωση πόρου;',
    authorKey: 'sofiaK',
    status: 'verified',
    visibility: 'public',
    annotationKey: 'put-vs-patch',
    docKey: 'week4',
    conceptKey: 'rest',
    nodeKey: 'rest',
    pageNumberSnapshot: 5,
    selectedTextSnapshot: 'μερική ενημέρωση πόρου',
    resolvedAt: daysAgo(5),
    createdAt: daysAgo(6),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'put-vs-patch',
    key: 'p1',
    authorKey: 'sofiaK',
    body: 'Πότε χρησιμοποιούμε PATCH αντί για PUT σε ένα REST endpoint;',
    createdAt: daysAgo(6),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'put-vs-patch',
    key: 'p2',
    authorKey: 'eleni',
    body: 'Το PUT αντικαθιστά ολόκληρο τον πόρο, το PATCH στέλνει μόνο τις αλλαγές.',
    isVerified: true,
    createdAt: daysAgo(5),
  });
  await setVerifiedPost(c, 'put-vs-patch', 'p2');

  await upsertThread({
    courseKey: c,
    key: 'node-version',
    categoryKind: 'general',
    title: 'Ποια έκδοση Node.js προτείνεται για την εργασία;',
    authorKey: 'christina',
    status: 'instructor_answered',
    visibility: 'public',
    createdAt: daysAgo(12),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'node-version',
    key: 'p1',
    authorKey: 'christina',
    body: 'Ποια έκδοση Node.js πρέπει να χρησιμοποιήσουμε για το project;',
    createdAt: daysAgo(12),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'node-version',
    key: 'p2',
    authorKey: 'eleni',
    body: 'Χρησιμοποιήστε την τελευταία LTS έκδοση για συμβατότητα με τις βιβλιοθήκες του μαθήματος.',
    createdAt: daysAgo(11),
  });

  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'highlight-anna',
    docKey: 'week1',
    page: 2,
    quote: 'stateless επικοινωνία',
    type: 'highlight',
    visibility: 'private',
    authorKey: 'anna',
    body: null,
    createdAt: daysAgo(20),
  });
  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'note-katerina',
    docKey: 'week4',
    page: 9,
    quote: 'κωδικοί κατάστασης',
    type: 'note',
    visibility: 'private',
    authorKey: 'katerina',
    body: 'Καλή σύνοψη των status codes 4xx/5xx.',
    createdAt: daysAgo(4),
  });

  await upsertRoadmapProgress({
    courseKey: c,
    nodeKey: 'http',
    studentKey: 'sofiaK',
    status: 'completed',
    startedAt: daysAgo(25),
    completedAt: daysAgo(24),
  });
  await upsertRoadmapProgress({
    courseKey: c,
    nodeKey: 'rest',
    studentKey: 'christina',
    status: 'in_progress',
    startedAt: daysAgo(6),
  });
}

async function seedDb301(): Promise<void> {
  const c = 'db301';

  await upsertDocument({
    courseKey: c,
    docKey: 'transactions',
    title: 'Παραδείγματα Απομόνωσης Συναλλαγών',
    description:
      'Λυμένα παραδείγματα για ανωμαλίες και επίπεδα απομόνωσης συναλλαγών.',
    status: 'active',
    visibility: 'visible_to_students',
    filename: 'παραδειγματα-απομονωσης-συναλλαγων.pdf',
    pageCount: 12,
    createdByKey: 'sofiaN',
    createdAt: daysAgo(20),
  });
  await upsertDocument({
    courseKey: c,
    docKey: 'indexing',
    title: 'Οδηγίες Εργαστηρίου Ευρετηρίων',
    description:
      'Πρακτικές οδηγίες εργαστηρίου για πλάνα ερωτημάτων και επιλογή ευρετηρίων.',
    status: 'active',
    visibility: 'visible_to_students',
    filename: 'οδηγιες-εργαστηριου-ευρετηριων.pdf',
    pageCount: 7,
    createdByKey: 'sofiaN',
    createdAt: daysAgo(12),
  });

  await upsertConcept({
    courseKey: c,
    key: 'transactions',
    slug: 'transactions',
    title: 'Συναλλαγές και απομόνωση',
    description: 'Ιδιότητες ACID και επίπεδα απομόνωσης συναλλαγών.',
    learningObjective:
      'Να αναγνωρίζονται ανωμαλίες συναλλαγών ανά επίπεδο απομόνωσης.',
    orderIndex: 1,
    createdByKey: 'sofiaN',
  });
  await upsertConcept({
    courseKey: c,
    key: 'indexing',
    slug: 'indexing',
    title: 'Ευρετήρια',
    description: 'Σχεδιασμός ευρετηρίων για τη βελτιστοποίηση ερωτημάτων.',
    learningObjective:
      'Να επιλέγεται ο κατάλληλος τύπος ευρετηρίου για ένα ερώτημα.',
    orderIndex: 2,
    createdByKey: 'sofiaN',
  });

  await upsertRoadmapNode({
    courseKey: c,
    key: 'transactions',
    conceptKey: 'transactions',
    title: 'Επίπεδα απομόνωσης και ανωμαλίες',
    description:
      'READ UNCOMMITTED έως SERIALIZABLE και οι ανωμαλίες που αποτρέπουν.',
    learningObjective:
      'Αντιστοίχιση κάθε επιπέδου απομόνωσης με τις ανωμαλίες που αποτρέπει.',
    estimatedMinutes: 35,
    difficulty: 'medium',
    completionRule: 'manual',
    orderIndex: 1,
    createdByKey: 'sofiaN',
  });
  await upsertRoadmapNode({
    courseKey: c,
    key: 'indexing',
    conceptKey: 'indexing',
    title: 'Σχεδιασμός ευρετηρίων για ερωτήματα',
    description: 'Επιλογή ευρετηρίου ανάλογα με τον τύπο ερωτήματος.',
    learningObjective: 'Πρόταση ευρετηρίου για ένα δοθέν ερώτημα εύρους τιμών.',
    estimatedMinutes: 30,
    difficulty: 'medium',
    completionRule: 'self_check',
    orderIndex: 2,
    createdByKey: 'sofiaN',
  });
  await upsertRoadmapEdge(c, 'transactions', 'indexing');

  await upsertRoadmapResource({
    courseKey: c,
    nodeKey: 'transactions',
    key: 'transactions-overview',
    resourceType: 'document_page',
    docKey: 'transactions',
    pageStart: 1,
    pageEnd: 6,
    title: 'Επίπεδα απομόνωσης',
  });
  await upsertRoadmapResource({
    courseKey: c,
    nodeKey: 'indexing',
    key: 'indexing-overview',
    resourceType: 'document_page',
    docKey: 'indexing',
    pageStart: 1,
    pageEnd: 4,
    title: 'Τύποι ευρετηρίων',
  });

  await upsertForumCategories(c, ['general', 'document_discussion']);

  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'phantom-read-dimitraA',
    docKey: 'transactions',
    page: 4,
    quote: 'φαινομενική εγγραφή',
    type: 'confusing',
    visibility: 'instructor_only',
    authorKey: 'dimitraA',
    conceptKey: 'transactions',
    nodeKey: 'transactions',
    body: 'Δεν καταλαβαίνω γιατί το phantom read δεν εμφανίζεται στο επίπεδο REPEATABLE READ.',
    createdAt: daysAgo(8),
  });
  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'isolation-question-giorgos',
    docKey: 'transactions',
    page: 6,
    quote: 'επίπεδο SERIALIZABLE',
    type: 'question',
    visibility: 'public',
    authorKey: 'giorgos',
    body: 'Το SERIALIZABLE αποκλείει εντελώς τα phantom reads ή απλώς τα μειώνει;',
    createdAt: daysAgo(5),
  });
  await upsertThread({
    courseKey: c,
    key: 'phantom-read',
    categoryKind: 'document_discussion',
    title: 'Γιατί δεν εμφανίζεται phantom read σε REPEATABLE READ;',
    authorKey: 'dimitraA',
    status: 'open',
    visibility: 'instructor_only',
    annotationKey: 'phantom-read-dimitraA',
    docKey: 'transactions',
    conceptKey: 'transactions',
    nodeKey: 'transactions',
    pageNumberSnapshot: 4,
    selectedTextSnapshot: 'φαινομενική εγγραφή',
    createdAt: daysAgo(8),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'phantom-read',
    key: 'p1',
    authorKey: 'dimitraA',
    body: 'Δεν καταλαβαίνω γιατί το phantom read δεν εμφανίζεται στο επίπεδο REPEATABLE READ.',
    createdAt: daysAgo(8),
  });

  await upsertThread({
    courseKey: c,
    key: 'lab-format',
    categoryKind: 'general',
    title: 'Μορφή παράδοσης εργαστηριακής άσκησης ευρετηρίων',
    authorKey: 'evangelia',
    status: 'resolved',
    visibility: 'public',
    resolvedAt: daysAgo(8),
    createdAt: daysAgo(9),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'lab-format',
    key: 'p1',
    authorKey: 'evangelia',
    body: 'Θέλετε το SQL script ξεχωριστά ή μέσα στην αναφορά PDF;',
    createdAt: daysAgo(9),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'lab-format',
    key: 'p2',
    authorKey: 'sofiaN',
    body: 'Και τα δύο: το script ως συνημμένο και τα ευρήματα μέσα στην αναφορά.',
    createdAt: daysAgo(8),
  });

  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'highlight-katerina',
    docKey: 'indexing',
    page: 3,
    quote: 'σύνθετο ευρετήριο',
    type: 'highlight',
    visibility: 'private',
    authorKey: 'katerina',
    body: null,
    createdAt: daysAgo(6),
  });

  await upsertSelfCheck({
    courseKey: c,
    key: 'index-type',
    nodeKey: 'indexing',
    conceptKey: 'indexing',
    type: 'single_choice',
    prompt:
      'Ποιος τύπος ευρετηρίου ταιριάζει καλύτερα σε ερωτήματα εύρους τιμών;',
    options: [
      { id: 'a', label: 'B-tree' },
      { id: 'b', label: 'Hash' },
      { id: 'c', label: 'Bitmap' },
    ],
    correctAnswer: { optionId: 'a' },
    passingScore: 100,
    createdByKey: 'sofiaN',
  });
  await upsertSelfCheckAttempt({
    courseKey: c,
    selfCheckKey: 'index-type',
    key: 'giorgos',
    studentKey: 'giorgos',
    answer: { optionId: 'a' },
    score: 100,
    status: 'passed',
    submittedAt: daysAgo(4),
  });
  await upsertSelfCheckAttempt({
    courseKey: c,
    selfCheckKey: 'index-type',
    key: 'stelios',
    studentKey: 'stelios',
    answer: { optionId: 'b' },
    score: 0,
    status: 'failed',
    submittedAt: daysAgo(3),
  });

  await upsertRoadmapProgress({
    courseKey: c,
    nodeKey: 'transactions',
    studentKey: 'giorgos',
    status: 'completed',
    startedAt: daysAgo(15),
    completedAt: daysAgo(14),
  });
  await upsertRoadmapProgress({
    courseKey: c,
    nodeKey: 'indexing',
    studentKey: 'katerina',
    status: 'in_progress',
    startedAt: daysAgo(5),
  });
}

async function seedMl440(): Promise<void> {
  const c = 'ml440';

  await upsertDocument({
    courseKey: c,
    docKey: 'week1',
    title: 'Εβδομάδα 1 - Επιβλεπόμενη Μάθηση και Γραμμική Παλινδρόμηση',
    description:
      'Εισαγωγή στην επιβλεπόμενη μάθηση και τη γραμμική παλινδρόμηση.',
    status: 'active',
    visibility: 'visible_to_students',
    filename: 'εβδομαδα-1-γραμμικη-παλινδρομηση.pdf',
    pageCount: 16,
    createdByKey: 'ioanna',
    createdAt: daysAgo(18),
  });
  await upsertDocument({
    courseKey: c,
    docKey: 'week6',
    title:
      'Εβδομάδα 6 - Υπερπροσαρμογή, Κανονικοποίηση και Διασταυρούμενη Επικύρωση',
    description:
      'Νέο υλικό: τεχνικές αποφυγής υπερπροσαρμογής και αξιολόγησης μοντέλων.',
    status: 'active',
    visibility: 'visible_to_students',
    filename: 'εβδομαδα-6-κανονικοποιηση.pdf',
    pageCount: 21,
    createdByKey: 'ioanna',
    createdAt: daysAgo(2),
  });

  await upsertConcept({
    courseKey: c,
    key: 'supervised',
    slug: 'supervised-learning',
    title: 'Επιβλεπόμενη μάθηση',
    description: 'Γραμμικά μοντέλα και συνάρτηση κόστους.',
    learningObjective:
      'Να υπολογίζεται η συνάρτηση κόστους ενός γραμμικού μοντέλου.',
    orderIndex: 1,
    createdByKey: 'ioanna',
  });
  await upsertConcept({
    courseKey: c,
    key: 'generalization',
    slug: 'generalization',
    title: 'Γενίκευση μοντέλου',
    description: 'Υπερπροσαρμογή, κανονικοποίηση και διασταυρούμενη επικύρωση.',
    learningObjective:
      'Να επιλέγεται τεχνική κανονικοποίησης κατάλληλη για το πρόβλημα.',
    orderIndex: 2,
    createdByKey: 'ioanna',
  });

  await upsertRoadmapNode({
    courseKey: c,
    key: 'supervised',
    conceptKey: 'supervised',
    title: 'Γραμμικά μοντέλα και συνάρτηση κόστους',
    description: 'Εκπαίδευση γραμμικού μοντέλου με ελαχιστοποίηση σφάλματος.',
    learningObjective: 'Υπολογισμός MSE για ένα σύνολο προβλέψεων.',
    estimatedMinutes: 30,
    difficulty: 'medium',
    completionRule: 'view_resource',
    orderIndex: 1,
    createdByKey: 'ioanna',
  });
  await upsertRoadmapNode({
    courseKey: c,
    key: 'generalization',
    conceptKey: 'generalization',
    title: 'Υπερπροσαρμογή και κανονικοποίηση',
    description: 'Αναγνώριση υπερπροσαρμογής και εφαρμογή κανονικοποίησης.',
    learningObjective:
      'Επιλογή τιμής υπερπαραμέτρου κανονικοποίησης μέσω διασταυρούμενης επικύρωσης.',
    estimatedMinutes: 40,
    difficulty: 'high',
    completionRule: 'manual',
    orderIndex: 2,
    createdByKey: 'ioanna',
  });
  await upsertRoadmapEdge(c, 'supervised', 'generalization');

  await upsertRoadmapResource({
    courseKey: c,
    nodeKey: 'supervised',
    key: 'supervised-overview',
    resourceType: 'document_page',
    docKey: 'week1',
    pageStart: 2,
    pageEnd: 8,
    title: 'Γραμμική παλινδρόμηση βήμα-βήμα',
  });
  await upsertRoadmapResource({
    courseKey: c,
    nodeKey: 'generalization',
    key: 'generalization-overview',
    resourceType: 'document_page',
    docKey: 'week6',
    pageStart: 2,
    pageEnd: 12,
    title: 'Κανονικοποίηση και k-fold επικύρωση',
  });

  await upsertForumCategories(c, ['general', 'document_discussion']);

  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'regularization-question-petros',
    docKey: 'week6',
    page: 5,
    quote: 'όρος κανονικοποίησης',
    type: 'question',
    visibility: 'public',
    authorKey: 'petros',
    conceptKey: 'generalization',
    nodeKey: 'generalization',
    body: 'Γιατί η προσθήκη όρου κανονικοποίησης μειώνει τη διακύμανση του μοντέλου;',
    createdAt: daysAgo(6),
  });
  await upsertThread({
    courseKey: c,
    key: 'regularization',
    categoryKind: 'document_discussion',
    title: 'Γιατί η κανονικοποίηση μειώνει τη διακύμανση;',
    authorKey: 'petros',
    status: 'verified',
    visibility: 'public',
    annotationKey: 'regularization-question-petros',
    docKey: 'week6',
    conceptKey: 'generalization',
    nodeKey: 'generalization',
    pageNumberSnapshot: 5,
    selectedTextSnapshot: 'όρος κανονικοποίησης',
    resolvedAt: daysAgo(5),
    createdAt: daysAgo(6),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'regularization',
    key: 'p1',
    authorKey: 'petros',
    body: 'Γιατί η προσθήκη όρου κανονικοποίησης μειώνει τη διακύμανση του μοντέλου;',
    createdAt: daysAgo(6),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'regularization',
    key: 'p2',
    authorKey: 'ioanna',
    body: 'Περιορίζει το μέγεθος των συντελεστών, εμποδίζοντας το μοντέλο να προσαρμοστεί υπερβολικά στον θόρυβο.',
    isVerified: true,
    createdAt: daysAgo(5),
  });
  await setVerifiedPost(c, 'regularization', 'p2');

  await upsertThread({
    courseKey: c,
    key: 'project-dataset',
    categoryKind: 'general',
    title: 'Πρόταση για dataset στην τελική εργασία',
    authorKey: 'anna',
    status: 'instructor_answered',
    visibility: 'public',
    createdAt: daysAgo(14),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'project-dataset',
    key: 'p1',
    authorKey: 'anna',
    body: 'Μπορούμε να χρησιμοποιήσουμε δικό μας dataset για την τελική εργασία;',
    createdAt: daysAgo(14),
  });
  await upsertPost({
    courseKey: c,
    threadKey: 'project-dataset',
    key: 'p2',
    authorKey: 'ioanna',
    body: 'Ναι, αρκεί να έχει τουλάχιστον 1000 δείγματα και σαφή ετικέτα-στόχο.',
    createdAt: daysAgo(13),
  });

  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'overfitting-confusing-panagiotis',
    docKey: 'week6',
    page: 9,
    quote: 'διασταυρούμενη επικύρωση k-fold',
    type: 'confusing',
    visibility: 'instructor_only',
    authorKey: 'panagiotis',
    body: 'Δεν είναι σαφές πώς επιλέγουμε το k στο k-fold cross-validation.',
    createdAt: daysAgo(4),
  });
  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'overfitting-question-evangelia',
    docKey: 'week6',
    page: 9,
    quote: 'διασταυρούμενη επικύρωση k-fold',
    type: 'question',
    visibility: 'public',
    authorKey: 'evangelia',
    body: 'Υπάρχει κανόνας για την τιμή του k ή είναι πάντα εμπειρικό;',
    createdAt: daysAgo(3),
  });
  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'note-giorgos-ml',
    docKey: 'week1',
    page: 4,
    quote: 'συνάρτηση κόστους MSE',
    type: 'note',
    visibility: 'public',
    authorKey: 'giorgos',
    body: 'Καλό παράδειγμα υπολογισμού MSE βήμα-βήμα.',
    createdAt: daysAgo(15),
  });
  await upsertAnnotationWithTarget({
    courseKey: c,
    key: 'highlight-dimitraA-ml',
    docKey: 'week6',
    page: 2,
    quote: 'διακύμανση μοντέλου',
    type: 'highlight',
    visibility: 'private',
    authorKey: 'dimitraA',
    body: null,
    createdAt: daysAgo(10),
  });

  await upsertRoadmapProgress({
    courseKey: c,
    nodeKey: 'supervised',
    studentKey: 'petros',
    status: 'completed',
    startedAt: daysAgo(12),
    completedAt: daysAgo(11),
  });
  await upsertRoadmapProgress({
    courseKey: c,
    nodeKey: 'generalization',
    studentKey: 'dimitraA',
    status: 'in_progress',
    startedAt: daysAgo(4),
  });
}

async function seedAuditLogs(): Promise<void> {
  await upsertAuditLog({
    key: 'course-created-lms101',
    actorKey: 'admin-main',
    courseKey: 'lms101',
    action: 'course_created',
    entityType: 'course',
    entityId: courseId('lms101'),
    metadata: { code: 'CS-LMS-101', source: 'demo_seed' },
    createdAt: daysAgo(55),
  });
  await upsertAuditLog({
    key: 'enrollment-changed-maria-lms101',
    actorKey: 'admin-registrar',
    courseKey: 'lms101',
    action: 'enrollment_changed',
    entityType: 'enrollment',
    entityId: enrollmentId('maria', 'lms101'),
    metadata: { student: 'maria', status: 'active' },
    createdAt: daysAgo(50),
  });
  await upsertAuditLog({
    key: 'document-uploaded-lms101-week3',
    actorKey: 'eleni',
    courseKey: 'lms101',
    action: 'document_uploaded',
    entityType: 'document',
    entityId: documentId('lms101', 'week3'),
    metadata: { visibility: 'visible_to_students' },
    createdAt: daysAgo(1),
  });
  await upsertAuditLog({
    key: 'thread-archived-lms101-old-forum',
    actorKey: 'eleni',
    courseKey: 'lms101',
    action: 'thread_category_changed',
    entityType: 'forum_thread',
    entityId: threadId('lms101', 'old-forum-archive'),
    metadata: { category: 'archived_document_discussion' },
    createdAt: daysAgo(37),
  });
}

async function main(): Promise<void> {
  assertSeedPlan();

  const storageReadiness = await storageService.ensureBucketReady();
  if (storageReadiness.status !== 'ok') {
    throw new Error(
      `Demo PDF storage is unavailable: ${storageReadiness.reason}`,
    );
  }

  await seedUsers();
  await seedCoursesInstructorsEnrollments();

  await seedLms101();
  await seedAlg201();
  await seedWeb305();
  await seedDb301();
  await seedMl440();
  await seedAuditLogs();

  const assignmentCount = courses.reduce(
    (total, course) => total + 1 + (course.assistantKey ? 1 : 0),
    0,
  );
  const enrollmentCount = Object.values(enrollmentPlan).reduce(
    (total, courseKeys) => total + courseKeys.length,
    0,
  );

  console.log(
    `Τα δεδομένα επίδειξης δημιουργήθηκαν: ${admins.length} admins, ` +
      `${professors.length} καθηγητές, ${students.length} φοιτητές, ` +
      `${courses.length} μαθήματα, ${assignmentCount} αναθέσεις και ` +
      `${enrollmentCount} εγγραφές.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Αποτυχία δημιουργίας δεδομένων επίδειξης.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
