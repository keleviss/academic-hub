import { describe, expect, it } from 'vitest';

import {
  AnnotationVisibilitySchema,
  AnalyticsEventTypeSchema,
  SelfCheckTypeSchema,
  UserRoleSchema,
} from './enums.js';

describe('shared enum schemas', () => {
  it('accepts MVP enum values from the ER model', () => {
    expect(UserRoleSchema.parse('student')).toBe('student');
    expect(AnnotationVisibilitySchema.parse('instructor_only')).toBe(
      'instructor_only',
    );
    expect(SelfCheckTypeSchema.parse('completion_ack')).toBe('completion_ack');
    expect(AnalyticsEventTypeSchema.parse('annotation.created')).toBe(
      'annotation.created',
    );
  });

  it('rejects display-only or unknown values', () => {
    expect(() => AnnotationVisibilitySchema.parse('instructor-only')).toThrow();
    expect(() => UserRoleSchema.parse('guest')).toThrow();
  });
});
