import type { Course, Module, VideoDriveLink } from '../types';
import { getCanonicalCategory } from './courseCategories';

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function searchCourseCatalog(courses: Course[], query: string, category: string) {
  const q = normalize(query);
  const selectedCategory = normalize(category);
  const lessons: { course: Course; module: Module; video: VideoDriveLink }[] = [];
  const matches = courses.filter(course => {
    const canonical = normalize(getCanonicalCategory(course.category) || course.category || 'General');
    if (category !== 'todos' && canonical !== selectedCategory && normalize(course.category || '') !== selectedCategory) return false;
    let lessonMatches = false;
    if (q.length >= 2) {
      for (const module of course.modules || []) {
        for (const video of module.videos || []) {
          if (normalize(`${video.title} ${video.description || ''}`).includes(q)) {
            lessons.push({ course, module, video });
            lessonMatches = true;
          }
        }
      }
    }
    return !q || normalize(`${course.title} ${course.description || ''} ${course.category || ''}`).includes(q) || lessonMatches;
  });
  return { courses: matches, lessons };
}
