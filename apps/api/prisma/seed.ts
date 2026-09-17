import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  type DocumentStatus,
  type DocumentVisibility,
} from '@prisma/client';

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
  threadGeneral: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3',
  threadResolved: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4',
  threadReopened: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5',
  postQuestion: 'ffffffff-ffff-4fff-8fff-fffffffffff1',
  postAnswer: 'ffffffff-ffff-4fff-8fff-fffffffffff2',
  postGeneralOpening: 'ffffffff-ffff-4fff-8fff-fffffffffff3',
  postGeneralReplyStudent: 'ffffffff-ffff-4fff-8fff-fffffffffff4',
  postGeneralReplyProfessor: 'ffffffff-ffff-4fff-8fff-fffffffffff5',
  postResolvedOpening: 'ffffffff-ffff-4fff-8fff-fffffffffff6',
  postReopenedOpening: 'ffffffff-ffff-4fff-8fff-fffffffffff7',
  postReopenedAnswer: 'ffffffff-ffff-4fff-8fff-fffffffffff8',
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
    fullName: 'Μάρκος Ιωαννίδης',
    isActive: true,
  },
  {
    id: '20202020-2020-4020-8020-202020202022',
    email: 'sofia.professor@academic-hub.local',
    fullName: 'Σοφία Νικολαΐδου',
    isActive: true,
  },
  {
    id: '20202020-2020-4020-8020-202020202023',
    email: 'dimitris.professor@academic-hub.local',
    fullName: 'Δημήτρης Καραμήτρος',
    isActive: true,
  },
  {
    id: '20202020-2020-4020-8020-202020202024',
    email: 'ioanna.professor@academic-hub.local',
    fullName: 'Ιωάννα Σπύρου',
    isActive: true,
  },
  {
    id: '20202020-2020-4020-8020-202020202025',
    email: 'andreas.inactive-professor@academic-hub.local',
    fullName: 'Ανδρέας Βασιλείου',
    isActive: false,
  },
] as const;

const extraStudentUsers = [
  {
    id: '30303030-3030-4030-8030-303030303031',
    email: 'eleni.student@academic-hub.local',
    fullName: 'Ελένη Παπαγεωργίου',
    isActive: true,
  },
  {
    id: '30303030-3030-4030-8030-303030303032',
    email: 'petros.student@academic-hub.local',
    fullName: 'Πέτρος Δημητρίου',
    isActive: true,
  },
  {
    id: '30303030-3030-4030-8030-303030303033',
    email: 'sofia.student@academic-hub.local',
    fullName: 'Σοφία Καραγιάννη',
    isActive: true,
  },
  {
    id: '30303030-3030-4030-8030-303030303034',
    email: 'giorgos.student@academic-hub.local',
    fullName: 'Γιώργος Σταύρου',
    isActive: true,
  },
  {
    id: '30303030-3030-4030-8030-303030303035',
    email: 'christina.student@academic-hub.local',
    fullName: 'Χριστίνα Οικονόμου',
    isActive: true,
  },
  {
    id: '30303030-3030-4030-8030-303030303036',
    email: 'dimitra.student@academic-hub.local',
    fullName: 'Δήμητρα Αλεξίου',
    isActive: true,
  },
  {
    id: '30303030-3030-4030-8030-303030303037',
    email: 'kostas.student@academic-hub.local',
    fullName: 'Κώστας Θεοδώρου',
    isActive: true,
  },
  {
    id: '30303030-3030-4030-8030-303030303038',
    email: 'alex.inactive-student@academic-hub.local',
    fullName: 'Αλέξης Κούρης',
    isActive: false,
  },
] as const;

const extraCourses = [
  {
    id: '40404040-4040-4040-8040-404040404041',
    code: 'CS-ALG-201',
    title: 'Αλγόριθμοι και Πολυπλοκότητα',
    description:
      'Σχεδίαση αλγορίθμων, ασυμπτωτική ανάλυση και συμβιβασμοί πολυπλοκότητας.',
    semester: 3,
    ectsCredits: 6,
    isActive: true,
  },
  {
    id: '40404040-4040-4040-8040-404040404042',
    code: 'CS-DB-301',
    title: 'Συστήματα Βάσεων Δεδομένων',
    description:
      'Σχεσιακή μοντελοποίηση, SQL, συναλλαγές, ευρετήρια και σχεδιασμός ερωτημάτων.',
    semester: 4,
    ectsCredits: 6,
    isActive: true,
  },
  {
    id: '40404040-4040-4040-8040-404040404043',
    code: 'CS-HCI-410',
    title: 'Ανθρωποκεντρικά Συστήματα Μάθησης',
    description:
      'Σχεδίαση προσβάσιμου εκπαιδευτικού λογισμικού με πλούσια ανατροφοδότηση.',
    semester: 7,
    ectsCredits: 5,
    isActive: false,
  },
  {
    id: '40404040-4040-4040-8040-404040404044',
    code: 'CS-DIST-501',
    title: 'Κατανεμημένες Διαδικτυακές Πλατφόρμες',
    description:
      'Όρια υπηρεσιών, ασύγχρονες ροές εργασίας και ανθεκτικά διαδικτυακά συστήματα.',
    semester: 6,
    ectsCredits: 6,
    isActive: true,
  },
  {
    id: '40404040-4040-4040-8040-404040404045',
    code: 'CS-RM-601',
    title: 'Μεθοδολογία Έρευνας στην Πληροφορική',
    description:
      'Σχεδιασμός έρευνας, μέθοδοι αξιολόγησης, δεοντολογία και ακαδημαϊκή γραφή.',
    semester: 8,
    ectsCredits: 4,
    isActive: true,
  },
  {
    id: '40404040-4040-4040-8040-404040404046',
    code: 'CS-ELECT-350',
    title: 'Σύγχρονα Θέματα Ακαδημαϊκής Τεχνολογίας',
    description:
      'Σεμιναριακό μάθημα για δοκιμή καταστάσεων μαθημάτων χωρίς ανάθεση διδάσκοντα.',
    semester: 5,
    ectsCredits: 3,
    isActive: true,
  },
] as const;

type SeedDocumentInput = {
  checksumSha256: string;
  courseId: string;
  createdById: string;
  deletedAt?: Date | null;
  description: string | null;
  fileSizeBytes: bigint;
  id: string;
  mimeType: string;
  objectKey: string;
  originalFilename: string;
  pageCount: number;
  replacedAt?: Date | null;
  status: DocumentStatus;
  title: string;
  updatedById?: string | null;
  visibility: DocumentVisibility;
};

const extraDocuments: ReadonlyArray<SeedDocumentInput> = [
  {
    id: '70707070-7070-4070-8070-707070707071',
    courseId: ids.course,
    title: 'Εβδομάδα 2 - Εννοιολογικοί Χάρτες και Διαδρομές Μελέτης',
    description:
      'Συμπληρωματικό PDF που συνδέει έννοιες, προαπαιτούμενα και κόμβους χάρτη μάθησης.',
    status: 'active',
    visibility: 'visible_to_students',
    objectKey: 'courses/cs-lms-101/εβδομαδα-2-εννοιολογικοι-χαρτες.pdf',
    originalFilename: 'εβδομαδα-2-εννοιολογικοι-χαρτες.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 1_568_000n,
    checksumSha256:
      '62df86819993dc26dcf97f1d5542528cf636d18e8e636f55608404477d7c51b5',
    pageCount: 22,
    createdById: ids.professor,
  },
  {
    id: '70707070-7070-4070-8070-707070707072',
    courseId: ids.course,
    title: 'Σημειώσεις Διδάσκοντα - Ανασκόπηση Σημάτων Σύγχυσης',
    description:
      'Ιδιωτικές σημειώσεις διδάσκοντα για προετοιμασία παρεμβάσεων από σήματα μαθητών.',
    status: 'active',
    visibility: 'hidden_from_students',
    objectKey: 'courses/cs-lms-101/σημειωσεις-διδασκοντα-σηματα-συγχυσης.pdf',
    originalFilename: 'σημειωσεις-διδασκοντα-σηματα-συγχυσης.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 836_000n,
    checksumSha256:
      '4d9f1eb3075fc9a6a6fd998d7515bd52d6a4038a1a940646e7c4835c16fc13b8',
    pageCount: 11,
    createdById: ids.professor,
  },
  {
    id: '70707070-7070-4070-8070-707070707073',
    courseId: ids.course,
    title: 'Εβδομάδα 0 - Διαφάνειες Εισαγωγής',
    description:
      'Αντικατεστημένο εισαγωγικό υλικό για δοκιμή ιστορικών καταστάσεων εγγράφων.',
    status: 'replaced',
    visibility: 'visible_to_students',
    objectKey: 'courses/cs-lms-101/εβδομαδα-0-εισαγωγη-v1.pdf',
    originalFilename: 'εβδομαδα-0-εισαγωγη-v1.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 624_000n,
    checksumSha256:
      '93017d5f61e4f0cf74d77d06c23201000dcbf2ae48d63c78e56c8b3c4d8cd978',
    pageCount: 9,
    replacedAt: new Date('2026-08-25T10:15:00.000Z'),
    createdById: ids.professor,
    updatedById: extraProfessorUsers[0].id,
  },
  {
    id: '70707070-7070-4070-8070-707070707074',
    courseId: ids.course,
    title: 'Εξαγωγή Παλαιού Φόρουμ',
    description:
      'Διαγραμμένο τεκμήριο εισαγωγής για δοκιμή μεταδεδομένων διαχειριστή και διδάσκοντα.',
    status: 'deleted',
    visibility: 'hidden_from_students',
    objectKey: 'courses/cs-lms-101/εξαγωγη-παλαιου-φορουμ.pdf',
    originalFilename: 'εξαγωγη-παλαιου-φορουμ.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 402_000n,
    checksumSha256:
      '1ca7a347d3ff420d8feb26452e920b7dbf40315d1eab9ce9a23ba1614b99a7f3',
    pageCount: 5,
    deletedAt: new Date('2026-08-28T08:40:00.000Z'),
    createdById: ids.professor,
    updatedById: ids.professor,
  },
  {
    id: '70707070-7070-4070-8070-707070707075',
    courseId: extraCourses[0].id,
    title: 'Σύνοψη Ασυμπτωτικής Ανάλυσης',
    description: 'Σύντομη αναφορά για Big-O, Big-Omega και Big-Theta.',
    status: 'active',
    visibility: 'visible_to_students',
    objectKey: 'courses/cs-alg-201/συνοψη-ασυμπτωτικης-αναλυσης.pdf',
    originalFilename: 'συνοψη-ασυμπτωτικης-αναλυσης.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 318_000n,
    checksumSha256:
      '95f6f0393534689c58263ee5d1fc412a8ee3b6e0a12966dbb7ccf00f9fb17264',
    pageCount: 4,
    createdById: ids.professor,
  },
  {
    id: '70707070-7070-4070-8070-707070707076',
    courseId: extraCourses[0].id,
    title: 'Φύλλο Εργασίας Τεχνικών Απόδειξης',
    description: 'Ασκήσεις διδάσκοντα για επαγωγή και επιχειρήματα ανταλλαγής.',
    status: 'active',
    visibility: 'hidden_from_students',
    objectKey: 'courses/cs-alg-201/φυλλο-εργασιας-τεχνικων-αποδειξης.pdf',
    originalFilename: 'φυλλο-εργασιας-τεχνικων-αποδειξης.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 1_104_000n,
    checksumSha256:
      '74ce92d30ed31812ee5810924e7f3b7b58ca329a2cf9f0dbb03b2cbe2644493e',
    pageCount: 16,
    createdById: extraProfessorUsers[1].id,
  },
  {
    id: '70707070-7070-4070-8070-707070707077',
    courseId: extraCourses[1].id,
    title: 'Παραδείγματα Απομόνωσης Συναλλαγών',
    description: 'Λυμένα παραδείγματα για ανωμαλίες και επίπεδα απομόνωσης.',
    status: 'active',
    visibility: 'visible_to_students',
    objectKey: 'courses/cs-db-301/παραδειγματα-απομονωσης-συναλλαγων.pdf',
    originalFilename: 'παραδειγματα-απομονωσης-συναλλαγων.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 742_000n,
    checksumSha256:
      'ec67a38d26f176ee7f2171ee7a14d66eb37e1ec82c71310f28b97d35ea5fe65a',
    pageCount: 12,
    createdById: extraProfessorUsers[2].id,
  },
  {
    id: '70707070-7070-4070-8070-707070707078',
    courseId: extraCourses[1].id,
    title: 'Οδηγίες Εργαστηρίου Ευρετηρίων',
    description:
      'Πρακτικές οδηγίες εργαστηρίου για πλάνα ερωτημάτων και επιλογή ευρετηρίων.',
    status: 'active',
    visibility: 'visible_to_students',
    objectKey: 'courses/cs-db-301/οδηγιες-εργαστηριου-ευρετηριων.pdf',
    originalFilename: 'οδηγιες-εργαστηριου-ευρετηριων.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 511_000n,
    checksumSha256:
      '2c9250790cf2bf4f8d0c745451edc3f25d27fe4456203047bd81afcbdb946d6d',
    pageCount: 7,
    createdById: extraProfessorUsers[2].id,
  },
  {
    id: '70707070-7070-4070-8070-707070707079',
    courseId: extraCourses[2].id,
    title: 'Ευρετικές Προσβασιμότητας για Εργαλεία Μάθησης',
    description:
      'Υλικό μελέτης για ανενεργό μάθημα, χρήσιμο για μετρήσεις λίστας διαχειριστή.',
    status: 'active',
    visibility: 'hidden_from_students',
    objectKey: 'courses/cs-hci-410/ευρετικες-προσβασιμοτητας.pdf',
    originalFilename: 'ευρετικες-προσβασιμοτητας.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 679_000n,
    checksumSha256:
      'd8137c275e80f98cef87817b2ca898c68672c5b657ca9f34c6aa2fd4f250b6e2',
    pageCount: 10,
    createdById: extraProfessorUsers[3].id,
  },
  {
    id: '70707070-7070-4070-8070-707070707080',
    courseId: extraCourses[3].id,
    title: 'Λίστα Ελέγχου Ανθεκτικών Ορίων Υπηρεσιών',
    description:
      'Λίστα ελέγχου για όρια API, επαναλήψεις αιτημάτων και διαχείριση αποτυχιών.',
    status: 'active',
    visibility: 'visible_to_students',
    objectKey: 'courses/cs-dist-501/λιστα-ελεγχου-οριων-υπηρεσιων.pdf',
    originalFilename: 'λιστα-ελεγχου-οριων-υπηρεσιων.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 289_000n,
    checksumSha256:
      'b1a8d2c41ebad193513285c2c30fa21b6203d90e3fab3e2d65fd220b40a1d063',
    pageCount: 6,
    createdById: extraProfessorUsers[0].id,
  },
];

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
      fullName: 'Διαχειριστής Επίδειξης',
      role: 'admin' as const,
    },
    {
      id: ids.professor,
      email: 'professor@academic-hub.local',
      fullName: 'Ελένη Παπαδοπούλου',
      role: 'professor' as const,
    },
    {
      id: ids.studentMaria,
      email: 'maria.student@academic-hub.local',
      fullName: 'Μαρία Αντωνίου',
      role: 'student' as const,
    },
    {
      id: ids.studentNikos,
      email: 'nikos.student@academic-hub.local',
      fullName: 'Νίκος Γεωργίου',
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
      title: 'Διαδραστικό Ακαδημαϊκό Περιεχόμενο',
      description:
        'Μάθημα επίδειξης για το πρωτότυπο LMS με επίκεντρο το περιεχόμενο και την ανατροφοδότηση.',
      semester: 1,
      ectsCredits: 6,
      isActive: true,
    },
    create: {
      id: ids.course,
      code: 'CS-LMS-101',
      title: 'Διαδραστικό Ακαδημαϊκό Περιεχόμενο',
      description:
        'Μάθημα επίδειξης για το πρωτότυπο LMS με επίκεντρο το περιεχόμενο και την ανατροφοδότηση.',
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

  for (const assignment of [
    {
      id: '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a',
      courseId: ids.course,
      instructorId: ids.professor,
      instructorRole: 'owner' as const,
    },
    {
      id: '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5b',
      courseId: ids.course,
      instructorId: extraProfessorUsers[0].id,
      instructorRole: 'assistant' as const,
    },
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
      where: {
        courseId_instructorId: {
          courseId: assignment.courseId,
          instructorId: assignment.instructorId,
        },
      },
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
    const courseId = enrollment.courseId ?? ids.course;

    await prisma.enrollment.upsert({
      where: {
        courseId_studentId: {
          courseId,
          studentId: enrollment.studentId,
        },
      },
      update: {
        status: enrollment.status,
      },
      create: {
        id: enrollment.id,
        courseId,
        studentId: enrollment.studentId,
        status: enrollment.status,
      },
    });
  }
}

async function upsertSeedDocument(document: SeedDocumentInput): Promise<void> {
  const deletedAt = document.deletedAt ?? null;
  const replacedAt = document.replacedAt ?? null;
  const updatedById = document.updatedById ?? document.createdById;

  await prisma.document.upsert({
    where: { id: document.id },
    update: {
      checksumSha256: document.checksumSha256,
      deletedAt,
      description: document.description,
      fileSizeBytes: document.fileSizeBytes,
      mimeType: document.mimeType,
      objectKey: document.objectKey,
      originalFilename: document.originalFilename,
      pageCount: document.pageCount,
      replacedAt,
      status: document.status,
      title: document.title,
      updatedById,
      visibility: document.visibility,
    },
    create: {
      checksumSha256: document.checksumSha256,
      courseId: document.courseId,
      createdById: document.createdById,
      deletedAt,
      description: document.description,
      fileSizeBytes: document.fileSizeBytes,
      id: document.id,
      mimeType: document.mimeType,
      objectKey: document.objectKey,
      originalFilename: document.originalFilename,
      pageCount: document.pageCount,
      replacedAt,
      status: document.status,
      title: document.title,
      updatedById,
      visibility: document.visibility,
    },
  });
}

async function seedDocumentsAndRoadmap(): Promise<void> {
  await upsertSeedDocument({
    id: ids.document,
    courseId: ids.course,
    title: 'Εβδομάδα 1 - Ενεργή Ανάγνωση και Βρόχοι Ανατροφοδότησης',
    description: 'Εισαγωγικό PDF που χρησιμοποιείται στο μάθημα επίδειξης.',
    status: 'active',
    visibility: 'visible_to_students',
    objectKey: 'courses/cs-lms-101/εβδομαδα-1-ενεργη-αναγνωση.pdf',
    originalFilename: 'εβδομαδα-1-ενεργη-αναγνωση.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 1_284_000n,
    checksumSha256:
      '77e3b7f79f5a6ebfb7cb5d7737d921c0b5e14f7c9ad1f3eacb2e8a92ef8cc001',
    pageCount: 18,
    createdById: ids.professor,
  });

  for (const document of extraDocuments) {
    await upsertSeedDocument(document);
  }

  const concepts = [
    {
      id: ids.conceptActiveReading,
      slug: 'active-reading',
      title: 'Ενεργή ανάγνωση',
      description:
        'Μελέτη απευθείας πάνω στο μαθησιακό υλικό με αγκυρωμένες σημειώσεις.',
      learningObjective:
        'Να εξηγείται πώς οι επισημάνσεις, οι σημειώσεις και οι ερωτήσεις παραμένουν συνδεδεμένες με το πλαίσιο του PDF.',
      orderIndex: 1,
    },
    {
      id: ids.conceptRoadmaps,
      slug: 'conceptual-roadmaps',
      title: 'Εννοιολογικοί χάρτες',
      description: 'Δομή μαθήματος βασισμένη σε έννοιες και προαπαιτούμενα.',
      learningObjective:
        'Να περιγράφεται πώς οι κόμβοι χάρτη συνδέουν έννοιες, πόρους και πρόοδο.',
      orderIndex: 2,
    },
    {
      id: ids.conceptAnalytics,
      slug: 'teaching-intelligence',
      title: 'Διδακτική νοημοσύνη',
      description:
        'Αναλυτικά στοιχεία που παράγουν αξιοποιήσιμα διδακτικά σήματα.',
      learningObjective:
        'Να αναγνωρίζονται σήματα σύγχυσης και να μετατρέπονται σε διδακτικές παρεμβάσεις.',
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
      title: 'Σχολιασμός μαθησιακού υλικού',
      description:
        'Πρακτική σε αγκυρωμένες επισημάνσεις, σημειώσεις και ερωτήσεις.',
      learningObjective:
        'Δημιουργία σχολίου που διατηρεί το πλαίσιο του υλικού.',
      estimatedMinutes: 25,
      difficulty: 'low' as const,
      completionRule: 'view_resource' as const,
      orderIndex: 1,
    },
    {
      id: ids.nodeRoadmaps,
      conceptId: ids.conceptRoadmaps,
      title: 'Μελέτη κόμβων με προαπαιτούμενα',
      description:
        'Κατανόηση του τρόπου με τον οποίο οι έννοιες καθοδηγούν τη σειρά μελέτης.',
      learningObjective:
        'Ανάγνωση μιας εξάρτησης χάρτη και επιλογή του επόμενου κόμβου.',
      estimatedMinutes: 35,
      difficulty: 'medium' as const,
      completionRule: 'manual' as const,
      orderIndex: 2,
    },
    {
      id: ids.nodeAnalytics,
      conceptId: ids.conceptAnalytics,
      title: 'Ερμηνεία σημάτων σύγχυσης',
      description:
        'Χρήση αλληλεπιδράσεων μαθητών για επιλογή διδακτικής ενέργειας.',
      learningObjective:
        'Να εξηγείται γιατί μια επαναλαμβανόμενη ερώτηση πρέπει να εμφανίζεται στη διδακτική ουρά.',
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
      where: {
        fromNodeId_toNodeId: {
          fromNodeId: edge.fromNodeId,
          toNodeId: edge.toNodeId,
        },
      },
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
      title: 'Επισκόπηση ενεργής ανάγνωσης',
    },
    create: {
      id: ids.resourceReading,
      roadmapNodeId: ids.nodeActiveReading,
      resourceType: 'document_page',
      documentId: ids.document,
      pageStart: 2,
      pageEnd: 5,
      title: 'Επισκόπηση ενεργής ανάγνωσης',
      orderIndex: 1,
    },
  });

  await prisma.roadmapNodeResource.upsert({
    where: { id: ids.resourceRoadmaps },
    update: {
      resourceType: 'document_section',
      pageStart: 6,
      pageEnd: 10,
      sectionLabel: 'Παραδείγματα εννοιολογικών χαρτών',
      title: 'Παραδείγματα χάρτη',
    },
    create: {
      id: ids.resourceRoadmaps,
      roadmapNodeId: ids.nodeRoadmaps,
      resourceType: 'document_section',
      documentId: ids.document,
      pageStart: 6,
      pageEnd: 10,
      sectionLabel: 'Παραδείγματα εννοιολογικών χαρτών',
      title: 'Παραδείγματα χάρτη',
      orderIndex: 1,
    },
  });
}

async function seedForumAndAnnotations(): Promise<void> {
  for (const category of [
    {
      id: ids.categoryDocument,
      name: 'Συζητήσεις εγγράφων',
      kind: 'document_discussion' as const,
      description:
        'Νήματα που δημιουργούνται από δημόσια ή μόνο προς διδάσκοντες σχόλια.',
      orderIndex: 1,
    },
    {
      id: ids.categoryGeneral,
      name: 'Γενικές ερωτήσεις μαθήματος',
      kind: 'general' as const,
      description:
        'Γενικές συζητήσεις μαθήματος, χωρίς σύνδεση με συγκεκριμένο έγγραφο.',
      orderIndex: 2,
    },
    {
      id: ids.categoryArchived,
      name: 'Αρχειοθετημένες συζητήσεις εγγράφων',
      kind: 'archived_document_discussion' as const,
      description:
        'Διατηρημένα νήματα για αντικατεστημένα ή διαγραμμένα έγγραφα.',
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
      selectedText: 'βρόχος ανατροφοδότησης',
      documentTitleSnapshot:
        'Εβδομάδα 1 - Ενεργή Ανάγνωση και Βρόχοι Ανατροφοδότησης',
    },
    create: {
      id: ids.targetQuestion,
      documentId: ids.document,
      pageNumber: 4,
      selectedText: 'βρόχος ανατροφοδότησης',
      textQuoteExact: 'βρόχος ανατροφοδότησης',
      textQuotePrefix: 'Η πλατφόρμα κλείνει τον ',
      textQuoteSuffix:
        ' ανάμεσα στη δραστηριότητα των φοιτητών και την ενέργεια του διδάσκοντα.',
      normalizedRects: [{ x: 0.18, y: 0.42, width: 0.34, height: 0.03 }],
      selectorMetadata: { source: 'seed', selector: 'text-quote' },
      documentTitleSnapshot:
        'Εβδομάδα 1 - Ενεργή Ανάγνωση και Βρόχοι Ανατροφοδότησης',
      documentFilenameSnapshot: 'εβδομαδα-1-ενεργη-αναγνωση.pdf',
      documentChecksumSnapshot:
        '77e3b7f79f5a6ebfb7cb5d7737d921c0b5e14f7c9ad1f3eacb2e8a92ef8cc001',
    },
  });

  await prisma.annotationTarget.upsert({
    where: { id: ids.targetConfusing },
    update: {
      pageNumber: 8,
      selectedText: 'θερμικός χάρτης σύγχυσης',
      documentTitleSnapshot:
        'Εβδομάδα 1 - Ενεργή Ανάγνωση και Βρόχοι Ανατροφοδότησης',
    },
    create: {
      id: ids.targetConfusing,
      documentId: ids.document,
      pageNumber: 8,
      selectedText: 'θερμικός χάρτης σύγχυσης',
      textQuoteExact: 'θερμικός χάρτης σύγχυσης',
      textQuotePrefix: 'Τα επαναλαμβανόμενα σήματα συνοψίζονται ως ',
      textQuoteSuffix: ' για τους διδάσκοντες.',
      normalizedRects: [{ x: 0.22, y: 0.36, width: 0.29, height: 0.03 }],
      selectorMetadata: { source: 'seed', selector: 'text-quote' },
      documentTitleSnapshot:
        'Εβδομάδα 1 - Ενεργή Ανάγνωση και Βρόχοι Ανατροφοδότησης',
      documentFilenameSnapshot: 'εβδομαδα-1-ενεργη-αναγνωση.pdf',
      documentChecksumSnapshot:
        '77e3b7f79f5a6ebfb7cb5d7737d921c0b5e14f7c9ad1f3eacb2e8a92ef8cc001',
    },
  });

  await prisma.annotation.upsert({
    where: { id: ids.annotationQuestion },
    update: {
      body: 'Πώς αποφασίζει το σύστημα ότι μια επαναλαμβανόμενη ερώτηση χρειάζεται ενέργεια από τον διδάσκοντα;',
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
      body: 'Πώς αποφασίζει το σύστημα ότι μια επαναλαμβανόμενη ερώτηση χρειάζεται ενέργεια από τον διδάσκοντα;',
    },
  });

  await prisma.annotation.upsert({
    where: { id: ids.annotationConfusing },
    update: {
      body: 'Η διαφορά ανάμεσα στην ακατέργαστη δραστηριότητα και σε ένα σήμα σύγχυσης δεν είναι ακόμη σαφής.',
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
      body: 'Η διαφορά ανάμεσα στην ακατέργαστη δραστηριότητα και σε ένα σήμα σύγχυσης δεν είναι ακόμη σαφής.',
    },
  });

  await prisma.forumThread.upsert({
    where: { id: ids.threadQuestion },
    update: {
      status: 'verified',
      title: 'Πότε μια επαναλαμβανόμενη ερώτηση γίνεται διδακτική ενέργεια;',
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
      title: 'Πότε μια επαναλαμβανόμενη ερώτηση γίνεται διδακτική ενέργεια;',
      status: 'verified',
      visibility: 'public',
      pageNumberSnapshot: 4,
      selectedTextSnapshot: 'βρόχος ανατροφοδότησης',
      documentTitleSnapshot:
        'Εβδομάδα 1 - Ενεργή Ανάγνωση και Βρόχοι Ανατροφοδότησης',
      resolvedAt: new Date('2026-08-27T12:00:00.000Z'),
    },
  });

  await prisma.forumThread.upsert({
    where: { id: ids.threadConfusing },
    update: {
      status: 'open',
      title: 'Ερμηνεία θερμικού χάρτη σύγχυσης',
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
      title: 'Ερμηνεία θερμικού χάρτη σύγχυσης',
      status: 'open',
      visibility: 'instructor_only',
      pageNumberSnapshot: 8,
      selectedTextSnapshot: 'θερμικός χάρτης σύγχυσης',
      documentTitleSnapshot:
        'Εβδομάδα 1 - Ενεργή Ανάγνωση και Βρόχοι Ανατροφοδότησης',
    },
  });

  await prisma.forumPost.upsert({
    where: { id: ids.postQuestion },
    update: {
      body: 'Καταλαβαίνω το σχόλιο, αλλά όχι το όριο για την κλιμάκωση.',
    },
    create: {
      id: ids.postQuestion,
      threadId: ids.threadQuestion,
      authorId: ids.studentMaria,
      body: 'Καταλαβαίνω το σχόλιο, αλλά όχι το όριο για την κλιμάκωση.',
    },
  });

  await prisma.forumPost.upsert({
    where: { id: ids.postAnswer },
    update: {
      body: 'Η ουρά χρησιμοποιεί διαφανείς κανόνες: επαναλαμβανόμενες άλυτες ερωτήσεις, πρόσφατη δραστηριότητα και σημασία της έννοιας.',
      isVerified: true,
    },
    create: {
      id: ids.postAnswer,
      threadId: ids.threadQuestion,
      authorId: ids.professor,
      body: 'Η ουρά χρησιμοποιεί διαφανείς κανόνες: επαναλαμβανόμενες άλυτες ερωτήσεις, πρόσφατη δραστηριότητα και σημασία της έννοιας.',
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
    where: {
      sourceThreadId_targetThreadId_linkType: {
        sourceThreadId: ids.threadConfusing,
        targetThreadId: ids.threadQuestion,
        linkType: 'related',
      },
    },
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

  // A general (not document-anchored) discussion with a flat reply chain:
  // one student opens it, a different student replies publicly, then the
  // professor answers, which is what moves it to `instructor_answered`.
  await prisma.forumThread.upsert({
    where: { id: ids.threadGeneral },
    update: {
      status: 'instructor_answered',
      title: 'Πώς οργανώνουμε ομαδική μελέτη για το τεστ της Εβδομάδας 2;',
    },
    create: {
      id: ids.threadGeneral,
      courseId: ids.course,
      categoryId: ids.categoryGeneral,
      authorId: ids.studentMaria,
      title: 'Πώς οργανώνουμε ομαδική μελέτη για το τεστ της Εβδομάδας 2;',
      status: 'instructor_answered',
      visibility: 'public',
    },
  });

  await prisma.forumPost.upsert({
    where: { id: ids.postGeneralOpening },
    update: {
      body: 'Θέλει κανείς άλλος να συναντηθούμε online πριν το τεστ της Εβδομάδας 2;',
    },
    create: {
      id: ids.postGeneralOpening,
      threadId: ids.threadGeneral,
      authorId: ids.studentMaria,
      body: 'Θέλει κανείς άλλος να συναντηθούμε online πριν το τεστ της Εβδομάδας 2;',
    },
  });

  await prisma.forumPost.upsert({
    where: { id: ids.postGeneralReplyStudent },
    update: {
      body: 'Ναι, μέσα είμαι. Προτείνω Τετάρτη απόγευμα.',
    },
    create: {
      id: ids.postGeneralReplyStudent,
      threadId: ids.threadGeneral,
      authorId: ids.studentNikos,
      body: 'Ναι, μέσα είμαι. Προτείνω Τετάρτη απόγευμα.',
    },
  });

  await prisma.forumPost.upsert({
    where: { id: ids.postGeneralReplyProfessor },
    update: {
      body: 'Καλή ιδέα. Θα ανεβάσω επιπλέον ασκήσεις επανάληψης μέχρι Τρίτη.',
    },
    create: {
      id: ids.postGeneralReplyProfessor,
      threadId: ids.threadGeneral,
      authorId: ids.professor,
      body: 'Καλή ιδέα. Θα ανεβάσω επιπλέον ασκήσεις επανάληψης μέχρι Τρίτη.',
    },
  });

  // A resolved general discussion, to exercise the `resolved` state.
  await prisma.forumThread.upsert({
    where: { id: ids.threadResolved },
    update: {
      status: 'resolved',
      title: 'Διευκρίνιση για την προθεσμία παράδοσης της εργασίας',
    },
    create: {
      id: ids.threadResolved,
      courseId: ids.course,
      categoryId: ids.categoryGeneral,
      authorId: ids.studentNikos,
      title: 'Διευκρίνιση για την προθεσμία παράδοσης της εργασίας',
      status: 'resolved',
      visibility: 'public',
      resolvedAt: new Date('2026-09-01T09:00:00.000Z'),
    },
  });

  await prisma.forumPost.upsert({
    where: { id: ids.postResolvedOpening },
    update: {
      body: 'Η προθεσμία παράδοσης ισχύει και για όσους έχουν εργαστηριακή εξέταση;',
    },
    create: {
      id: ids.postResolvedOpening,
      threadId: ids.threadResolved,
      authorId: ids.studentNikos,
      body: 'Η προθεσμία παράδοσης ισχύει και για όσους έχουν εργαστηριακή εξέταση;',
    },
  });

  // A discussion that was verified, then resolved, then reopened — seeded in
  // its post-reopen state (`verified`, `resolvedAt: null`, `verifiedPostId`
  // still set) since seed rows represent end states, not a transition replay.
  await prisma.forumThread.upsert({
    where: { id: ids.threadReopened },
    update: {
      status: 'verified',
      resolvedAt: null,
      title: 'Ασάφεια στον ορισμό του δείκτη προόδου ανά ενότητα',
    },
    create: {
      id: ids.threadReopened,
      courseId: ids.course,
      categoryId: ids.categoryGeneral,
      authorId: ids.studentMaria,
      title: 'Ασάφεια στον ορισμό του δείκτη προόδου ανά ενότητα',
      status: 'verified',
      visibility: 'public',
      resolvedAt: null,
    },
  });

  await prisma.forumPost.upsert({
    where: { id: ids.postReopenedOpening },
    update: {
      body: 'Ο δείκτης προόδου μετράει σελίδες ή ολοκληρωμένες ενότητες;',
    },
    create: {
      id: ids.postReopenedOpening,
      threadId: ids.threadReopened,
      authorId: ids.studentMaria,
      body: 'Ο δείκτης προόδου μετράει σελίδες ή ολοκληρωμένες ενότητες;',
    },
  });

  await prisma.forumPost.upsert({
    where: { id: ids.postReopenedAnswer },
    update: {
      body: 'Μετράει ολοκληρωμένες ενότητες, όχι σελίδες.',
      isVerified: true,
    },
    create: {
      id: ids.postReopenedAnswer,
      threadId: ids.threadReopened,
      authorId: ids.professor,
      body: 'Μετράει ολοκληρωμένες ενότητες, όχι σελίδες.',
      isVerified: true,
    },
  });

  await prisma.forumThread.update({
    where: { id: ids.threadReopened },
    data: {
      verifiedPostId: ids.postReopenedAnswer,
    },
  });
}

async function seedProgressAndSignals(): Promise<void> {
  await prisma.selfCheck.upsert({
    where: { id: ids.selfCheck },
    update: {
      prompt:
        'Ποιο σήμα αποτελεί την ισχυρότερη ένδειξη για διδακτική παρέμβαση;',
      passingScore: 100,
    },
    create: {
      id: ids.selfCheck,
      courseId: ids.course,
      roadmapNodeId: ids.nodeRoadmaps,
      conceptId: ids.conceptRoadmaps,
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
      needsReviewReason:
        'Σημείωσε σύγχυση στην επεξήγηση των αναλυτικών στοιχείων.',
    },
  ]) {
    await prisma.roadmapProgress.upsert({
      where: {
        roadmapNodeId_studentId: {
          roadmapNodeId: progress.roadmapNodeId,
          studentId: progress.studentId,
        },
      },
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
      title:
        'Αποσαφήνιση του τρόπου κατάταξης σημάτων σύγχυσης στη διδακτική ουρά',
      sourceAction: 'verified_answer',
    },
    create: {
      id: ids.intervention,
      courseId: ids.course,
      createdById: ids.professor,
      type: 'answer_thread',
      title:
        'Αποσαφήνιση του τρόπου κατάταξης σημάτων σύγχυσης στη διδακτική ουρά',
      description:
        'Προστέθηκε επαληθευμένη απάντηση σε επαναλαμβανόμενη ερώτηση για τους κανόνες κλιμάκωσης.',
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
      metadata: {
        objectKey: 'courses/cs-lms-101/εβδομαδα-1-ενεργη-αναγνωση.pdf',
      },
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
    console.log('Τα δεδομένα επίδειξης του Academic Hub δημιουργήθηκαν.');
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error('Αποτυχία δημιουργίας δεδομένων επίδειξης.', error);
    await prisma.$disconnect();
    process.exit(1);
  });
