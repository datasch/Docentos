import type { TTSGuide } from '../types';

export function filterTTSGuides(guides: TTSGuide[], query: string, moduleId: string, lessonTitles: Record<string, string>): TTSGuide[] {
  const term = query.trim().toLocaleLowerCase();
  return guides.filter((guide) => {
    if (moduleId !== 'ALL' && guide.moduleId !== moduleId) return false;
    if (!term) return true;
    return [guide.title, guide.scriptText, guide.mentorName, guide.voiceId, lessonTitles[guide.videoId || ''] || '']
      .some((value) => value.toLocaleLowerCase().includes(term));
  });
}
