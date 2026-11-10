import type { CertificateRecord, Course } from '../types';

export function learningCourses(courses: Course[], accessReady: boolean, signedIn: boolean): Course[] {
  return accessReady && signedIn ? courses.filter(course => course.published && course.hasAccess === true) : [];
}

export function courseLearningProgress(course: Course, completed: Record<string, boolean>, certificates: CertificateRecord[]) {
  const videoIds = new Set((course.modules || []).flatMap(module => (module.videos || []).map(video => video.id)));
  const done = [...videoIds].filter(id => completed[id] === true).length;
  const total = videoIds.size;
  const certificate = certificates.find(item => item.courseId === course.id && !item.revokedAt);
  return { done, total, percent: total ? Math.round(done / total * 100) : null, certificate };
}

export function nextLearningCourse(courses: Course[], completed: Record<string, boolean>, certificates: CertificateRecord[], lastCourseId?: string | null) {
  const pending = courses.filter(course => {
    const progress = courseLearningProgress(course, completed, certificates);
    return course.published && course.hasAccess === true && !progress.certificate;
  });
  return pending.find(course => course.id === lastCourseId)
    || pending.find(course => courseLearningProgress(course, completed, certificates).done > 0)
    || pending[0];
}
