import type { Course } from '../types';

export type CourseCardPatch = Partial<Pick<Course, 'published' | 'openToAllRegistered'>>;

export function patchCourseCard(courses: Course[], courseId: string, patch: CourseCardPatch): Course[] {
  return courses.map(course => course.id === courseId ? { ...course, ...patch } : course);
}
