# Authentication and authorization helpers

Import the guards and policy service from `auth/index.ts`. Backend sessions are
trusted identity; never construct the authorization user from a request body or
accept a browser-supplied role. These helpers do not create public domain routes.

## Middleware

- `optionalAuth(sessionService?, cookieName?)` attaches `request.currentSession`
  without rejecting anonymous requests. `attachCurrentSession` remains an alias
  for existing callers.
- `requireAuth({ sessionService?, auditLogger?, cookieName? })` requires a valid
  session and returns `401 / UNAUTHENTICATED` otherwise.
- `requireRole(roles, options?)` also requires authentication, then returns
  `403 / FORBIDDEN` when the role is not listed. Include `admin` explicitly when
  needed; there is no implicit role hierarchy.

Guards load sessions themselves when needed. Composed middleware reuse the
request-local result, including `null`; the next HTTP request checks again.
Database errors propagate as 500 rather than becoming anonymous or granting access.
Health, readiness and the existing auth endpoints retain their current behavior.

## Resource policies

`createAuthorizationService({ prisma?, auditLogger? })` exposes four async
assertions accepting `(user, resourceId, context?)`:

| Assertion                     | Allowed access                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| `assertProfessorCourseAccess` | Professor assigned as owner or assistant, including inactive courses                    |
| `assertStudentCourseAccess`   | Student with active enrollment in an active course                                      |
| `assertCourseAccess`          | Admin for any existing course; otherwise the respective role policy                     |
| `assertDocumentAccess`        | Course access plus active document; students additionally require `visible_to_students` |

Assertions return the authorized Prisma course/document. Deleted/replaced documents
are denied to everyone by this document helper; active hidden documents are allowed
for admins and assigned professors. Inactive users are denied. The specialized
professor/student helpers enforce those exact roles. Enrollment `inactive` or
`completed` does not grant student access.

For a future document route, the intended composition is:

```ts
const authorization = createAuthorizationService();

router.get(
  '/documents/:documentId',
  requireAuth(),
  asyncHandler(async (request, response) => {
    const document = await authorization.assertDocumentAccess(
      request.currentSession!.user,
      request.params.documentId as string,
      { method: request.method, route: '/documents/:documentId' },
    );
    // Return an explicit DTO, not the raw Prisma record or its storage key.
    response.json({ id: document.id, title: document.title });
  }),
);
```

The document's stored `courseId` determines membership checks. IDs are validated
before resource queries (400); missing resources return 404, policy denials 403,
and unexpected database errors 500 through the existing error handler. A successful
read assertion does not grant permission to edit or delete: future write routes
must also apply their action-specific role checks and CSRF protection.

Denials record `auth.denied` with actor/resource identifiers and an internal reason.
Optional audit context permits only method and route; query strings/fragments are
removed and other context fields are ignored. Use route templates. Cookies and
session tokens must never be passed as context. Audit failure preserves the denial.
Private annotations, historical document access and action-specific management
permissions belong to later tasks.
