/**
 * Asigna los recursos ya existentes a su lección (`scripts/assign-resources-to-lessons.ts`).
 *
 * Hasta ahora los recursos colgaban del curso o del módulo. Este script busca,
 * dentro de cada módulo, la lección que lleva el mismo nombre base que el
 * recurso (`03 Clase.mp4` ↔ `03 Clase.pdf`, o `03 Clase.en_US.srt`) y la enlaza.
 * Los que no tienen pareja se listan al final para asignarlos a mano desde
 * Administración → Recursos.
 *
 * Uso:
 *   npx tsx scripts/assign-resources-to-lessons.ts           # simulación: solo informa
 *   npx tsx scripts/assign-resources-to-lessons.ts --apply   # guarda las asignaciones
 */

import { prisma } from '../server/prisma.js';
import { baseKey, subtitleBaseKeys } from '../server/courseImportPlan.js';

async function main() {
  const apply = process.argv.slice(2).includes('--apply');

  const resources = await prisma.courseResource.findMany({
    where: { videoId: null, moduleId: { not: null } },
    select: { id: true, title: true, moduleId: true, course: { select: { title: true } } },
    orderBy: [{ courseId: 'asc' }, { order: 'asc' }],
  });

  const moduleIds = [...new Set(resources.map((resource) => resource.moduleId as string))];
  const lessons = await prisma.videoDriveLink.findMany({
    where: { moduleId: { in: moduleIds } },
    select: { id: true, title: true, moduleId: true },
  });
  const lessonsByModule = new Map<string, Array<{ id: string; keys: Set<string> }>>();
  for (const lesson of lessons) {
    const list = lessonsByModule.get(lesson.moduleId) ?? [];
    list.push({ id: lesson.id, keys: new Set([baseKey(lesson.title), baseKey(`${lesson.title}.mp4`)]) });
    lessonsByModule.set(lesson.moduleId, list);
  }

  const assigned: Array<{ id: string; videoId: string }> = [];
  const unmatched: Array<{ course: string; title: string }> = [];
  for (const resource of resources) {
    const candidates = new Set([...subtitleBaseKeys(resource.title), baseKey(resource.title)]);
    const matches = (lessonsByModule.get(resource.moduleId as string) ?? []).filter((lesson) =>
      [...candidates].some((key) => lesson.keys.has(key)),
    );
    // Solo si hay una única lección candidata: ante la duda no se adivina.
    if (matches.length === 1) assigned.push({ id: resource.id, videoId: matches[0].id });
    else unmatched.push({ course: resource.course.title, title: resource.title });
  }

  console.log(`${resources.length} recursos de módulo sin lección: ${assigned.length} con pareja, ${unmatched.length} sin ella.`);
  if (apply) {
    for (const item of assigned) {
      await prisma.courseResource.update({ where: { id: item.id }, data: { videoId: item.videoId } });
    }
    console.log(`Asignados ${assigned.length} recursos.`);
  } else {
    console.log('Simulación: no se guardó nada. Añade --apply para aplicar.');
  }
  if (unmatched.length > 0) {
    console.log('\nSin pareja (asignar a mano):');
    for (const item of unmatched) console.log(`  - [${item.course}] ${item.title}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
