import { Course, Module, VideoDriveLink } from '../types';

export function getLocalizedCourse(
  course: Course,
  t: (key: string, defaultValue?: any) => string
): Course {
  if (!course) return course;

  // 1. Course Title
  let title = course.title;
  const titleKey = `courses.${course.id}.title`;
  const translatedTitle = t(titleKey);
  if (translatedTitle && translatedTitle !== titleKey) {
    title = translatedTitle;
  } else if (
    course.id === 'course-giantucchi-mastery' ||
    (course.title && course.title.includes('Programa de Mentoría Elite Giantucchi'))
  ) {
    title = t(
      'courses.course-giantucchi-mastery.title',
      'Programa de Mentoría Elite Giantucchi: Full-Stack & Cloud Architecture'
    );
  } else if (course.title && course.title.includes('Curso de Grafana')) {
    title = t('courses.grafana.title', 'Curso de Grafana');
  } else if (course.title && course.title.includes('Curso de React Actualizado por el Mentor')) {
    title = t('courses.reactUpdated.title', 'Curso de React Actualizado por el Mentor');
  } else if (course.title && course.title.includes('Quiero crear un curso práctico')) {
    title = t('courses.practicalPrompt.title', 'Curso Práctico & Estructurado: Proyectos Aplicados');
  }

  // 2. Course Description
  let description = course.description;
  const descKey = `courses.${course.id}.description`;
  const translatedDesc = t(descKey);
  if (translatedDesc && translatedDesc !== descKey) {
    description = translatedDesc;
  } else if (
    course.id === 'course-giantucchi-mastery' ||
    (course.title && course.title.includes('Programa de Mentoría Elite Giantucchi'))
  ) {
    description = t(
      'courses.course-giantucchi-mastery.description',
      'Aprende a construir aplicaciones web completas a nivel empresarial con React, Node.js, Prisma, Google Drive API y patrones de arquitectura resiliente con acceso directo a mentorías.'
    );
  } else if (course.description && course.description.includes('Programa de formación estructurado a partir de')) {
    const match = course.description.match(/a partir de (\d+) clases seleccionadas de YouTube/);
    const count = match ? match[1] : '';
    description = t('courses.youtubeDescriptionTemplate', {
      count,
      defaultValue: course.description,
    });
  }

  // 3. Category
  let category = course.category;
  if (category) {
    const catKey = `categories.${category}`;
    const translatedCat = t(catKey);
    if (translatedCat && translatedCat !== catKey) {
      category = translatedCat;
    }
  }

  // 4. Modules
  const modules = (course.modules || []).map((m: Module) => {
    let mTitle = m.title;
    const modTitleKey = `courses.${course.id}.modules.${m.id}.title`;
    const transModTitle = t(modTitleKey);
    if (transModTitle && transModTitle !== modTitleKey) {
      mTitle = transModTitle;
    } else if (m.id === 'module-1') {
      mTitle = t('courses.course-giantucchi-mastery.modules.module-1.title', m.title);
    } else if (m.id === 'module-2') {
      mTitle = t('courses.course-giantucchi-mastery.modules.module-2.title', m.title);
    } else if (m.id === 'module-3') {
      mTitle = t('courses.course-giantucchi-mastery.modules.module-3.title', m.title);
    } else if (m.id === 'module-4') {
      mTitle = t('courses.course-giantucchi-mastery.modules.module-4.title', m.title);
    }

    let mDesc = m.description;
    const modDescKey = `courses.${course.id}.modules.${m.id}.description`;
    const transModDesc = t(modDescKey);
    if (transModDesc && transModDesc !== modDescKey) {
      mDesc = transModDesc;
    } else if (m.id === 'module-1') {
      mDesc = t('courses.course-giantucchi-mastery.modules.module-1.description', m.description || '');
    } else if (m.id === 'module-2') {
      mDesc = t('courses.course-giantucchi-mastery.modules.module-2.description', m.description || '');
    } else if (m.id === 'module-3') {
      mDesc = t('courses.course-giantucchi-mastery.modules.module-3.description', m.description || '');
    } else if (m.id === 'module-4') {
      mDesc = t('courses.course-giantucchi-mastery.modules.module-4.description', m.description || '');
    }

    const videos = (m.videos || []).map((v: VideoDriveLink) => {
      let vTitle = v.title;
      const vTitleKey = `courses.${course.id}.videos.${v.id}.title`;
      const transVTitle = t(vTitleKey);
      if (transVTitle && transVTitle !== vTitleKey) {
        vTitle = transVTitle;
      }
      let vDesc = v.description;
      const vDescKey = `courses.${course.id}.videos.${v.id}.description`;
      const transVDesc = t(vDescKey);
      if (transVDesc && transVDesc !== vDescKey) {
        vDesc = transVDesc;
      }
      return {
        ...v,
        title: vTitle,
        description: vDesc,
      };
    });

    return {
      ...m,
      title: mTitle,
      description: mDesc,
      videos,
    };
  });

  return {
    ...course,
    title,
    description,
    category,
    modules,
  };
}

export function getLocalizedCourses(
  courses: Course[],
  t: (key: string, defaultValue?: any) => string
): Course[] {
  if (!courses || !Array.isArray(courses)) return [];
  return courses.map((course) => getLocalizedCourse(course, t));
}
