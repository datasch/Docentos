import type { Course } from '../types';

export type CoursePublicationFilter = 'all' | 'published' | 'draft';

export function filterCoursesByPublication(courses: Course[], filter: CoursePublicationFilter): Course[] {
  if (filter === 'all') return courses;
  return courses.filter(course => filter === 'published' ? course.published : !course.published);
}
