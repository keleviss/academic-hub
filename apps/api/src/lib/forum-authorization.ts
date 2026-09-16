import type { Prisma, PrismaClient, UserRole } from '@prisma/client';

type ForumAuthorizationPrismaClient = Pick<
  PrismaClient,
  'courseInstructor'
>;

export function forumThreadVisibilityWhere(
  actorId: string,
  role: UserRole,
): Prisma.ForumThreadWhereInput[] {
  return [
    { visibility: 'public' },
    ...(role === 'admin' || role === 'professor'
      ? [{ visibility: 'instructor_only' as const }]
      : [{ authorId: actorId, visibility: 'instructor_only' as const }]),
  ];
}

export async function isCourseInstructor(
  prisma: ForumAuthorizationPrismaClient,
  actorId: string,
  role: UserRole,
  courseId: string,
): Promise<boolean> {
  if (role === 'admin') return true;
  if (role !== 'professor') return false;

  const assignment = await prisma.courseInstructor.findUnique({
    where: {
      courseId_instructorId: {
        courseId,
        instructorId: actorId,
      },
    },
  });

  return assignment !== null;
}

type RecomputeThreadStatusTransaction = Pick<
  Prisma.TransactionClient,
  'forumThread' | 'forumPost'
>;

export async function recomputeThreadStatus(
  transaction: RecomputeThreadStatusTransaction,
  threadId: string,
): Promise<'open' | 'instructor_answered' | 'verified'> {
  const thread = await transaction.forumThread.findUniqueOrThrow({
    select: { verifiedPostId: true },
    where: { id: threadId },
  });

  let status: 'open' | 'instructor_answered' | 'verified';
  if (thread.verifiedPostId) {
    status = 'verified';
  } else {
    const instructorPost = await transaction.forumPost.findFirst({
      where: {
        threadId,
        isDeleted: false,
        author: { role: { in: ['admin', 'professor'] } },
      },
    });
    status = instructorPost ? 'instructor_answered' : 'open';
  }

  await transaction.forumThread.update({
    data: { status },
    where: { id: threadId },
  });

  return status;
}
