import { z } from 'zod';
export declare const CourseIdParamsSchema: z.ZodObject<{
    courseId: z.ZodUUID;
}, z.core.$strip>;
export declare const CourseMemberIdParamsSchema: z.ZodObject<{
    courseId: z.ZodUUID;
    userId: z.ZodUUID;
}, z.core.$strip>;
export declare const CourseDocumentIdParamsSchema: z.ZodObject<{
    courseId: z.ZodUUID;
    documentId: z.ZodUUID;
}, z.core.$strip>;
export declare const CourseDocumentAnnotationIdParamsSchema: z.ZodObject<{
    courseId: z.ZodUUID;
    documentId: z.ZodUUID;
    annotationId: z.ZodUUID;
}, z.core.$strip>;
export declare const CourseStatusFilterSchema: z.ZodEnum<{
    all: "all";
    active: "active";
    inactive: "inactive";
}>;
export declare const CourseSemesterSchema: z.ZodCoercedNumber<unknown>;
export declare const CourseEctsCreditsSchema: z.ZodCoercedNumber<unknown>;
export declare const CourseCodeSchema: z.ZodString;
export declare const CourseDescriptionInputSchema: z.ZodOptional<z.ZodNullable<z.ZodString>>;
export declare const CourseDocumentTitleSchema: z.ZodString;
export declare const CourseDocumentDescriptionInputSchema: z.ZodOptional<z.ZodNullable<z.ZodString>>;
export declare const CourseCreateRequestSchema: z.ZodObject<{
    code: z.ZodString;
    title: z.ZodString;
    semester: z.ZodCoercedNumber<unknown>;
    ectsCredits: z.ZodCoercedNumber<unknown>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const CourseUpdateRequestSchema: z.ZodObject<{
    code: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    semester: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    ectsCredits: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    description: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const CourseListQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    search: z.ZodOptional<z.ZodString>;
    semester: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    status: z.ZodDefault<z.ZodEnum<{
        all: "all";
        active: "active";
        inactive: "inactive";
    }>>;
}, z.core.$strip>;
export declare const CourseMemberCandidateRoleSchema: z.ZodEnum<{
    professor: "professor";
    student: "student";
}>;
export declare const CourseMemberCandidatesQuerySchema: z.ZodObject<{
    role: z.ZodEnum<{
        professor: "professor";
        student: "student";
    }>;
    search: z.ZodString;
}, z.core.$strip>;
export declare const CourseMemberCandidateSchema: z.ZodObject<{
    id: z.ZodUUID;
    fullName: z.ZodString;
    email: z.ZodEmail;
    role: z.ZodEnum<{
        professor: "professor";
        student: "student";
        admin: "admin";
    }>;
}, z.core.$strip>;
export declare const CourseMemberCandidatesResponseSchema: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        fullName: z.ZodString;
        email: z.ZodEmail;
        role: z.ZodEnum<{
            professor: "professor";
            student: "student";
            admin: "admin";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const CourseSummaryCountsSchema: z.ZodObject<{
    instructorCount: z.ZodNumber;
    studentCount: z.ZodNumber;
    documentCount: z.ZodNumber;
}, z.core.$strip>;
export declare const CourseListItemSchema: z.ZodObject<{
    id: z.ZodUUID;
    code: z.ZodString;
    title: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    semester: z.ZodCoercedNumber<unknown>;
    ectsCredits: z.ZodCoercedNumber<unknown>;
    isActive: z.ZodBoolean;
    counts: z.ZodObject<{
        instructorCount: z.ZodNumber;
        studentCount: z.ZodNumber;
        documentCount: z.ZodNumber;
    }, z.core.$strip>;
    primaryInstructor: z.ZodNullable<z.ZodObject<{
        id: z.ZodUUID;
        fullName: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const CourseListResponseSchema: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        code: z.ZodString;
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        semester: z.ZodCoercedNumber<unknown>;
        ectsCredits: z.ZodCoercedNumber<unknown>;
        isActive: z.ZodBoolean;
        counts: z.ZodObject<{
            instructorCount: z.ZodNumber;
            studentCount: z.ZodNumber;
            documentCount: z.ZodNumber;
        }, z.core.$strip>;
        primaryInstructor: z.ZodNullable<z.ZodObject<{
            id: z.ZodUUID;
            fullName: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    meta: z.ZodObject<{
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
        totalItems: z.ZodNumber;
        totalPages: z.ZodNumber;
    }, z.core.$strip>;
    summary: z.ZodObject<{
        totalCourses: z.ZodNumber;
        activeCourses: z.ZodNumber;
        unassignedCourses: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const CourseInstructorSchema: z.ZodObject<{
    id: z.ZodUUID;
    userId: z.ZodUUID;
    fullName: z.ZodString;
    email: z.ZodEmail;
    role: z.ZodEnum<{
        owner: "owner";
        assistant: "assistant";
    }>;
    assignedAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const AssignCourseInstructorRequestSchema: z.ZodObject<{
    instructorId: z.ZodUUID;
    role: z.ZodDefault<z.ZodEnum<{
        owner: "owner";
        assistant: "assistant";
    }>>;
}, z.core.$strip>;
export declare const CourseInstructorsResponseSchema: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        userId: z.ZodUUID;
        fullName: z.ZodString;
        email: z.ZodEmail;
        role: z.ZodEnum<{
            owner: "owner";
            assistant: "assistant";
        }>;
        assignedAt: z.ZodISODateTime;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const CourseEnrollmentSchema: z.ZodObject<{
    id: z.ZodUUID;
    studentId: z.ZodUUID;
    fullName: z.ZodString;
    email: z.ZodEmail;
    status: z.ZodEnum<{
        active: "active";
        inactive: "inactive";
        completed: "completed";
    }>;
    enrolledAt: z.ZodISODateTime;
    updatedAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const EnrollStudentRequestSchema: z.ZodObject<{
    studentId: z.ZodUUID;
    status: z.ZodDefault<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
        completed: "completed";
    }>>;
}, z.core.$strip>;
export declare const UpdateEnrollmentStatusRequestSchema: z.ZodObject<{
    status: z.ZodEnum<{
        active: "active";
        inactive: "inactive";
        completed: "completed";
    }>;
}, z.core.$strip>;
export declare const CourseEnrollmentsResponseSchema: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        studentId: z.ZodUUID;
        fullName: z.ZodString;
        email: z.ZodEmail;
        status: z.ZodEnum<{
            active: "active";
            inactive: "inactive";
            completed: "completed";
        }>;
        enrolledAt: z.ZodISODateTime;
        updatedAt: z.ZodISODateTime;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const CourseDocumentMetadataSchema: z.ZodObject<{
    id: z.ZodUUID;
    title: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
        active: "active";
        replaced: "replaced";
        deleted: "deleted";
    }>;
    visibility: z.ZodEnum<{
        visible_to_students: "visible_to_students";
        hidden_from_students: "hidden_from_students";
    }>;
    originalFilename: z.ZodNullable<z.ZodString>;
    mimeType: z.ZodNullable<z.ZodString>;
    fileSizeBytes: z.ZodNullable<z.ZodNumber>;
    pageCount: z.ZodNullable<z.ZodNumber>;
    createdAt: z.ZodISODateTime;
    updatedAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const CreateCourseDocumentRequestSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    visibility: z.ZodDefault<z.ZodEnum<{
        visible_to_students: "visible_to_students";
        hidden_from_students: "hidden_from_students";
    }>>;
}, z.core.$strip>;
export declare const MAX_COURSE_DOCUMENT_UPLOAD_BYTES: number;
export declare const UpdateCourseDocumentMetadataRequestSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        replaced: "replaced";
        deleted: "deleted";
    }>>;
    visibility: z.ZodOptional<z.ZodEnum<{
        visible_to_students: "visible_to_students";
        hidden_from_students: "hidden_from_students";
    }>>;
}, z.core.$strip>;
export declare const CourseDocumentsResponseSchema: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            active: "active";
            replaced: "replaced";
            deleted: "deleted";
        }>;
        visibility: z.ZodEnum<{
            visible_to_students: "visible_to_students";
            hidden_from_students: "hidden_from_students";
        }>;
        originalFilename: z.ZodNullable<z.ZodString>;
        mimeType: z.ZodNullable<z.ZodString>;
        fileSizeBytes: z.ZodNullable<z.ZodNumber>;
        pageCount: z.ZodNullable<z.ZodNumber>;
        createdAt: z.ZodISODateTime;
        updatedAt: z.ZodISODateTime;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const CourseDocumentResponseSchema: z.ZodObject<{
    data: z.ZodObject<{
        id: z.ZodUUID;
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            active: "active";
            replaced: "replaced";
            deleted: "deleted";
        }>;
        visibility: z.ZodEnum<{
            visible_to_students: "visible_to_students";
            hidden_from_students: "hidden_from_students";
        }>;
        originalFilename: z.ZodNullable<z.ZodString>;
        mimeType: z.ZodNullable<z.ZodString>;
        fileSizeBytes: z.ZodNullable<z.ZodNumber>;
        pageCount: z.ZodNullable<z.ZodNumber>;
        createdAt: z.ZodISODateTime;
        updatedAt: z.ZodISODateTime;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const CourseDocumentAnnotationBodySchema: z.ZodOptional<z.ZodNullable<z.ZodString>>;
export declare const CourseDocumentAnnotationSelectedTextSchema: z.ZodOptional<z.ZodNullable<z.ZodString>>;
export declare const CourseDocumentAnnotationTargetSchema: z.ZodObject<{
    id: z.ZodUUID;
    pageNumber: z.ZodNumber;
    selectedText: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const CourseDocumentAnnotationAuthorSchema: z.ZodObject<{
    id: z.ZodUUID;
    fullName: z.ZodString;
    role: z.ZodEnum<{
        professor: "professor";
        student: "student";
        admin: "admin";
    }>;
}, z.core.$strip>;
export declare const CourseDocumentAnnotationSchema: z.ZodObject<{
    id: z.ZodUUID;
    courseId: z.ZodUUID;
    documentId: z.ZodUUID;
    target: z.ZodObject<{
        id: z.ZodUUID;
        pageNumber: z.ZodNumber;
        selectedText: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
    author: z.ZodObject<{
        id: z.ZodUUID;
        fullName: z.ZodString;
        role: z.ZodEnum<{
            professor: "professor";
            student: "student";
            admin: "admin";
        }>;
    }, z.core.$strip>;
    type: z.ZodEnum<{
        highlight: "highlight";
        note: "note";
        question: "question";
        important: "important";
        confusing: "confusing";
    }>;
    visibility: z.ZodEnum<{
        private: "private";
        public: "public";
        instructor_only: "instructor_only";
    }>;
    body: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodISODateTime;
    updatedAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const CreateCourseDocumentAnnotationRequestSchema: z.ZodObject<{
    pageNumber: z.ZodCoercedNumber<unknown>;
    type: z.ZodEnum<{
        highlight: "highlight";
        note: "note";
        question: "question";
        important: "important";
        confusing: "confusing";
    }>;
    visibility: z.ZodEnum<{
        private: "private";
        public: "public";
        instructor_only: "instructor_only";
    }>;
    body: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    selectedText: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const UpdateCourseDocumentAnnotationRequestSchema: z.ZodObject<{
    type: z.ZodOptional<z.ZodEnum<{
        highlight: "highlight";
        note: "note";
        question: "question";
        important: "important";
        confusing: "confusing";
    }>>;
    visibility: z.ZodOptional<z.ZodEnum<{
        private: "private";
        public: "public";
        instructor_only: "instructor_only";
    }>>;
    body: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const CourseDocumentAnnotationsResponseSchema: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        courseId: z.ZodUUID;
        documentId: z.ZodUUID;
        target: z.ZodObject<{
            id: z.ZodUUID;
            pageNumber: z.ZodNumber;
            selectedText: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
        author: z.ZodObject<{
            id: z.ZodUUID;
            fullName: z.ZodString;
            role: z.ZodEnum<{
                professor: "professor";
                student: "student";
                admin: "admin";
            }>;
        }, z.core.$strip>;
        type: z.ZodEnum<{
            highlight: "highlight";
            note: "note";
            question: "question";
            important: "important";
            confusing: "confusing";
        }>;
        visibility: z.ZodEnum<{
            private: "private";
            public: "public";
            instructor_only: "instructor_only";
        }>;
        body: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodISODateTime;
        updatedAt: z.ZodISODateTime;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const CourseDocumentAnnotationResponseSchema: z.ZodObject<{
    data: z.ZodObject<{
        id: z.ZodUUID;
        courseId: z.ZodUUID;
        documentId: z.ZodUUID;
        target: z.ZodObject<{
            id: z.ZodUUID;
            pageNumber: z.ZodNumber;
            selectedText: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
        author: z.ZodObject<{
            id: z.ZodUUID;
            fullName: z.ZodString;
            role: z.ZodEnum<{
                professor: "professor";
                student: "student";
                admin: "admin";
            }>;
        }, z.core.$strip>;
        type: z.ZodEnum<{
            highlight: "highlight";
            note: "note";
            question: "question";
            important: "important";
            confusing: "confusing";
        }>;
        visibility: z.ZodEnum<{
            private: "private";
            public: "public";
            instructor_only: "instructor_only";
        }>;
        body: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodISODateTime;
        updatedAt: z.ZodISODateTime;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const CourseDetailSchema: z.ZodObject<{
    id: z.ZodUUID;
    code: z.ZodString;
    title: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    semester: z.ZodCoercedNumber<unknown>;
    ectsCredits: z.ZodCoercedNumber<unknown>;
    isActive: z.ZodBoolean;
    counts: z.ZodObject<{
        instructorCount: z.ZodNumber;
        studentCount: z.ZodNumber;
        documentCount: z.ZodNumber;
    }, z.core.$strip>;
    primaryInstructor: z.ZodNullable<z.ZodObject<{
        id: z.ZodUUID;
        fullName: z.ZodString;
    }, z.core.$strip>>;
    createdAt: z.ZodISODateTime;
    updatedAt: z.ZodISODateTime;
    instructors: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        userId: z.ZodUUID;
        fullName: z.ZodString;
        email: z.ZodEmail;
        role: z.ZodEnum<{
            owner: "owner";
            assistant: "assistant";
        }>;
        assignedAt: z.ZodISODateTime;
    }, z.core.$strip>>;
    enrollments: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        studentId: z.ZodUUID;
        fullName: z.ZodString;
        email: z.ZodEmail;
        status: z.ZodEnum<{
            active: "active";
            inactive: "inactive";
            completed: "completed";
        }>;
        enrolledAt: z.ZodISODateTime;
        updatedAt: z.ZodISODateTime;
    }, z.core.$strip>>;
    documents: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            active: "active";
            replaced: "replaced";
            deleted: "deleted";
        }>;
        visibility: z.ZodEnum<{
            visible_to_students: "visible_to_students";
            hidden_from_students: "hidden_from_students";
        }>;
        originalFilename: z.ZodNullable<z.ZodString>;
        mimeType: z.ZodNullable<z.ZodString>;
        fileSizeBytes: z.ZodNullable<z.ZodNumber>;
        pageCount: z.ZodNullable<z.ZodNumber>;
        createdAt: z.ZodISODateTime;
        updatedAt: z.ZodISODateTime;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const CourseDetailResponseSchema: z.ZodObject<{
    data: z.ZodObject<{
        id: z.ZodUUID;
        code: z.ZodString;
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        semester: z.ZodCoercedNumber<unknown>;
        ectsCredits: z.ZodCoercedNumber<unknown>;
        isActive: z.ZodBoolean;
        counts: z.ZodObject<{
            instructorCount: z.ZodNumber;
            studentCount: z.ZodNumber;
            documentCount: z.ZodNumber;
        }, z.core.$strip>;
        primaryInstructor: z.ZodNullable<z.ZodObject<{
            id: z.ZodUUID;
            fullName: z.ZodString;
        }, z.core.$strip>>;
        createdAt: z.ZodISODateTime;
        updatedAt: z.ZodISODateTime;
        instructors: z.ZodArray<z.ZodObject<{
            id: z.ZodUUID;
            userId: z.ZodUUID;
            fullName: z.ZodString;
            email: z.ZodEmail;
            role: z.ZodEnum<{
                owner: "owner";
                assistant: "assistant";
            }>;
            assignedAt: z.ZodISODateTime;
        }, z.core.$strip>>;
        enrollments: z.ZodArray<z.ZodObject<{
            id: z.ZodUUID;
            studentId: z.ZodUUID;
            fullName: z.ZodString;
            email: z.ZodEmail;
            status: z.ZodEnum<{
                active: "active";
                inactive: "inactive";
                completed: "completed";
            }>;
            enrolledAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
        }, z.core.$strip>>;
        documents: z.ZodArray<z.ZodObject<{
            id: z.ZodUUID;
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            status: z.ZodEnum<{
                active: "active";
                replaced: "replaced";
                deleted: "deleted";
            }>;
            visibility: z.ZodEnum<{
                visible_to_students: "visible_to_students";
                hidden_from_students: "hidden_from_students";
            }>;
            originalFilename: z.ZodNullable<z.ZodString>;
            mimeType: z.ZodNullable<z.ZodString>;
            fileSizeBytes: z.ZodNullable<z.ZodNumber>;
            pageCount: z.ZodNullable<z.ZodNumber>;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const CourseMutationResponseSchema: z.ZodObject<{
    data: z.ZodObject<{
        id: z.ZodUUID;
        code: z.ZodString;
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        semester: z.ZodCoercedNumber<unknown>;
        ectsCredits: z.ZodCoercedNumber<unknown>;
        isActive: z.ZodBoolean;
        counts: z.ZodObject<{
            instructorCount: z.ZodNumber;
            studentCount: z.ZodNumber;
            documentCount: z.ZodNumber;
        }, z.core.$strip>;
        primaryInstructor: z.ZodNullable<z.ZodObject<{
            id: z.ZodUUID;
            fullName: z.ZodString;
        }, z.core.$strip>>;
        createdAt: z.ZodISODateTime;
        updatedAt: z.ZodISODateTime;
        instructors: z.ZodArray<z.ZodObject<{
            id: z.ZodUUID;
            userId: z.ZodUUID;
            fullName: z.ZodString;
            email: z.ZodEmail;
            role: z.ZodEnum<{
                owner: "owner";
                assistant: "assistant";
            }>;
            assignedAt: z.ZodISODateTime;
        }, z.core.$strip>>;
        enrollments: z.ZodArray<z.ZodObject<{
            id: z.ZodUUID;
            studentId: z.ZodUUID;
            fullName: z.ZodString;
            email: z.ZodEmail;
            status: z.ZodEnum<{
                active: "active";
                inactive: "inactive";
                completed: "completed";
            }>;
            enrolledAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
        }, z.core.$strip>>;
        documents: z.ZodArray<z.ZodObject<{
            id: z.ZodUUID;
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            status: z.ZodEnum<{
                active: "active";
                replaced: "replaced";
                deleted: "deleted";
            }>;
            visibility: z.ZodEnum<{
                visible_to_students: "visible_to_students";
                hidden_from_students: "hidden_from_students";
            }>;
            originalFilename: z.ZodNullable<z.ZodString>;
            mimeType: z.ZodNullable<z.ZodString>;
            fileSizeBytes: z.ZodNullable<z.ZodNumber>;
            pageCount: z.ZodNullable<z.ZodNumber>;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ProfessorCourseListItemSchema: z.ZodObject<{
    id: z.ZodUUID;
    code: z.ZodString;
    title: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    semester: z.ZodCoercedNumber<unknown>;
    ectsCredits: z.ZodCoercedNumber<unknown>;
    isActive: z.ZodBoolean;
    instructorRole: z.ZodEnum<{
        owner: "owner";
        assistant: "assistant";
    }>;
    counts: z.ZodObject<{
        documentCount: z.ZodNumber;
        visibleDocumentCount: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ProfessorCourseListResponseSchema: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        code: z.ZodString;
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        semester: z.ZodCoercedNumber<unknown>;
        ectsCredits: z.ZodCoercedNumber<unknown>;
        isActive: z.ZodBoolean;
        instructorRole: z.ZodEnum<{
            owner: "owner";
            assistant: "assistant";
        }>;
        counts: z.ZodObject<{
            documentCount: z.ZodNumber;
            visibleDocumentCount: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>>;
    summary: z.ZodObject<{
        assignedCourseCount: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ProfessorCourseDetailSchema: z.ZodObject<{
    id: z.ZodUUID;
    code: z.ZodString;
    title: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    semester: z.ZodCoercedNumber<unknown>;
    ectsCredits: z.ZodCoercedNumber<unknown>;
    isActive: z.ZodBoolean;
    instructorRole: z.ZodEnum<{
        owner: "owner";
        assistant: "assistant";
    }>;
    counts: z.ZodObject<{
        documentCount: z.ZodNumber;
        visibleDocumentCount: z.ZodNumber;
    }, z.core.$strip>;
    studentCount: z.ZodNumber;
    instructors: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        userId: z.ZodUUID;
        fullName: z.ZodString;
        email: z.ZodEmail;
        role: z.ZodEnum<{
            owner: "owner";
            assistant: "assistant";
        }>;
        assignedAt: z.ZodISODateTime;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ProfessorCourseDetailResponseSchema: z.ZodObject<{
    data: z.ZodObject<{
        id: z.ZodUUID;
        code: z.ZodString;
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        semester: z.ZodCoercedNumber<unknown>;
        ectsCredits: z.ZodCoercedNumber<unknown>;
        isActive: z.ZodBoolean;
        instructorRole: z.ZodEnum<{
            owner: "owner";
            assistant: "assistant";
        }>;
        counts: z.ZodObject<{
            documentCount: z.ZodNumber;
            visibleDocumentCount: z.ZodNumber;
        }, z.core.$strip>;
        studentCount: z.ZodNumber;
        instructors: z.ZodArray<z.ZodObject<{
            id: z.ZodUUID;
            userId: z.ZodUUID;
            fullName: z.ZodString;
            email: z.ZodEmail;
            role: z.ZodEnum<{
                owner: "owner";
                assistant: "assistant";
            }>;
            assignedAt: z.ZodISODateTime;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const StudentCourseListItemSchema: z.ZodObject<{
    id: z.ZodUUID;
    code: z.ZodString;
    title: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    semester: z.ZodCoercedNumber<unknown>;
    ectsCredits: z.ZodCoercedNumber<unknown>;
    isActive: z.ZodBoolean;
    counts: z.ZodObject<{
        documentCount: z.ZodNumber;
    }, z.core.$strip>;
    primaryInstructor: z.ZodNullable<z.ZodObject<{
        fullName: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const StudentCourseListResponseSchema: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        code: z.ZodString;
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        semester: z.ZodCoercedNumber<unknown>;
        ectsCredits: z.ZodCoercedNumber<unknown>;
        isActive: z.ZodBoolean;
        counts: z.ZodObject<{
            documentCount: z.ZodNumber;
        }, z.core.$strip>;
        primaryInstructor: z.ZodNullable<z.ZodObject<{
            fullName: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    summary: z.ZodObject<{
        enrolledCourseCount: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const StudentCourseDetailSchema: z.ZodObject<{
    id: z.ZodUUID;
    code: z.ZodString;
    title: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    semester: z.ZodCoercedNumber<unknown>;
    ectsCredits: z.ZodCoercedNumber<unknown>;
    isActive: z.ZodBoolean;
    counts: z.ZodObject<{
        documentCount: z.ZodNumber;
    }, z.core.$strip>;
    primaryInstructor: z.ZodNullable<z.ZodObject<{
        fullName: z.ZodString;
    }, z.core.$strip>>;
    instructors: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        userId: z.ZodUUID;
        fullName: z.ZodString;
        email: z.ZodEmail;
        role: z.ZodEnum<{
            owner: "owner";
            assistant: "assistant";
        }>;
        assignedAt: z.ZodISODateTime;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const StudentCourseDetailResponseSchema: z.ZodObject<{
    data: z.ZodObject<{
        id: z.ZodUUID;
        code: z.ZodString;
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        semester: z.ZodCoercedNumber<unknown>;
        ectsCredits: z.ZodCoercedNumber<unknown>;
        isActive: z.ZodBoolean;
        counts: z.ZodObject<{
            documentCount: z.ZodNumber;
        }, z.core.$strip>;
        primaryInstructor: z.ZodNullable<z.ZodObject<{
            fullName: z.ZodString;
        }, z.core.$strip>>;
        instructors: z.ZodArray<z.ZodObject<{
            id: z.ZodUUID;
            userId: z.ZodUUID;
            fullName: z.ZodString;
            email: z.ZodEmail;
            role: z.ZodEnum<{
                owner: "owner";
                assistant: "assistant";
            }>;
            assignedAt: z.ZodISODateTime;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type CourseIdParams = z.infer<typeof CourseIdParamsSchema>;
export type CourseMemberIdParams = z.infer<typeof CourseMemberIdParamsSchema>;
export type CourseDocumentIdParams = z.infer<typeof CourseDocumentIdParamsSchema>;
export type CourseDocumentAnnotationIdParams = z.infer<typeof CourseDocumentAnnotationIdParamsSchema>;
export type CourseStatusFilter = z.infer<typeof CourseStatusFilterSchema>;
export type CourseCreateRequest = z.infer<typeof CourseCreateRequestSchema>;
export type CourseUpdateRequest = z.infer<typeof CourseUpdateRequestSchema>;
export type CourseListQuery = z.infer<typeof CourseListQuerySchema>;
export type CourseMemberCandidateRole = z.infer<typeof CourseMemberCandidateRoleSchema>;
export type CourseMemberCandidatesQuery = z.infer<typeof CourseMemberCandidatesQuerySchema>;
export type CourseMemberCandidate = z.infer<typeof CourseMemberCandidateSchema>;
export type CourseMemberCandidatesResponse = z.infer<typeof CourseMemberCandidatesResponseSchema>;
export type CourseSummaryCounts = z.infer<typeof CourseSummaryCountsSchema>;
export type CourseListItem = z.infer<typeof CourseListItemSchema>;
export type CourseListResponse = z.infer<typeof CourseListResponseSchema>;
export type CourseInstructor = z.infer<typeof CourseInstructorSchema>;
export type AssignCourseInstructorRequest = z.infer<typeof AssignCourseInstructorRequestSchema>;
export type CourseInstructorsResponse = z.infer<typeof CourseInstructorsResponseSchema>;
export type CourseEnrollment = z.infer<typeof CourseEnrollmentSchema>;
export type EnrollStudentRequest = z.infer<typeof EnrollStudentRequestSchema>;
export type UpdateEnrollmentStatusRequest = z.infer<typeof UpdateEnrollmentStatusRequestSchema>;
export type CourseEnrollmentsResponse = z.infer<typeof CourseEnrollmentsResponseSchema>;
export type CourseDocumentMetadata = z.infer<typeof CourseDocumentMetadataSchema>;
export type CreateCourseDocumentRequest = z.infer<typeof CreateCourseDocumentRequestSchema>;
export type UpdateCourseDocumentMetadataRequest = z.infer<typeof UpdateCourseDocumentMetadataRequestSchema>;
export type CourseDocumentsResponse = z.infer<typeof CourseDocumentsResponseSchema>;
export type CourseDocumentResponse = z.infer<typeof CourseDocumentResponseSchema>;
export type CourseDocumentAnnotation = z.infer<typeof CourseDocumentAnnotationSchema>;
export type CreateCourseDocumentAnnotationRequest = z.infer<typeof CreateCourseDocumentAnnotationRequestSchema>;
export type UpdateCourseDocumentAnnotationRequest = z.infer<typeof UpdateCourseDocumentAnnotationRequestSchema>;
export type CourseDocumentAnnotationsResponse = z.infer<typeof CourseDocumentAnnotationsResponseSchema>;
export type CourseDocumentAnnotationResponse = z.infer<typeof CourseDocumentAnnotationResponseSchema>;
export type CourseDetail = z.infer<typeof CourseDetailSchema>;
export type CourseDetailResponse = z.infer<typeof CourseDetailResponseSchema>;
export type CourseMutationResponse = z.infer<typeof CourseMutationResponseSchema>;
export type ProfessorCourseListItem = z.infer<typeof ProfessorCourseListItemSchema>;
export type ProfessorCourseListResponse = z.infer<typeof ProfessorCourseListResponseSchema>;
export type ProfessorCourseDetail = z.infer<typeof ProfessorCourseDetailSchema>;
export type ProfessorCourseDetailResponse = z.infer<typeof ProfessorCourseDetailResponseSchema>;
export type StudentCourseListItem = z.infer<typeof StudentCourseListItemSchema>;
export type StudentCourseListResponse = z.infer<typeof StudentCourseListResponseSchema>;
export type StudentCourseDetail = z.infer<typeof StudentCourseDetailSchema>;
export type StudentCourseDetailResponse = z.infer<typeof StudentCourseDetailResponseSchema>;
//# sourceMappingURL=course-management.d.ts.map