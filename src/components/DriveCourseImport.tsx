/**
 * Importar un curso desde una carpeta de Google Drive.
 *
 * El flujo es deliberadamente de dos pasos: **analizar** lee la carpeta y
 * propone un plan; **crear** lo escribe. Entre medias el administrador revisa
 * el árbol, desmarca lo que sobra, corrige títulos y, si quiere, deja que la IA
 * los pula. Importar de una sola pasada sobre una carpeta ajena produce cursos
 * basura difíciles de deshacer.
 *
 * Nada de lo que se ve aquí se guarda hasta pulsar "Crear curso", y el servidor
 * revalida el plan entero antes de tocar la base de datos.
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  Music,
  Plus,
  Search,
  Sparkles,
  Subtitles,
  Video,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import type { ImportContentKind, ImportPlan, PlannedModule } from '../types';
import { useTranslation, Trans } from 'react-i18next'
import i18next from 'i18next'

interface DriveCourseImportProps {
  /** Se llama tras crear el curso, para que el catálogo se refresque. */
  onImported: () => void;
}

const KIND_ICON: Record<ImportContentKind, React.ElementType> = {
  video: Video,
  audio: Music,
  pdf: FileText,
  doc: FileText,
  slides: FileText,
  sheet: FileText,
  image: ImageIcon,
  note: FileText,
  web: FileText,
  subtitle: Subtitles,
  archive: Archive,
  other: FileText,
};

const KIND_LABEL: Record<ImportContentKind, string> = {
  video: 'Vídeo',
  audio: 'Audio',
  pdf: 'PDF',
  doc: 'Documento',
  slides: 'Presentación',
  sheet: 'Hoja de cálculo',
  image: 'Imagen',
  note: 'Texto',
  web: 'Página web',
  subtitle: 'Subtítulos',
  archive: 'Comprimido',
  other: 'Recurso',
};

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return i18next.t('valGb', '{{val}} GB', { val: (mb / 1024).toFixed(1) });
  if (mb >= 1) return i18next.t('mbMb', '{{mb}} MB', { mb: mb.toFixed(1) });
  return i18next.t('valKb', '{{val}} KB', { val: Math.max(1, Math.round(bytes / 1024)) });
}

/** Lo que quedaría seleccionado ahora mismo; refleja `planTotals` del servidor. */
export function selectedTotals(plan: ImportPlan) {
  let modules = 0;
  let lessons = 0;
  let resources = 0;
  let seconds = 0;

  for (const moduleEntry of plan.modules) {
    if (!moduleEntry.include) continue;
    const includedLessons = moduleEntry.lessons.filter((lesson) => lesson.include);
    const includedResources = moduleEntry.resources.filter((resource) => resource.include);
    if (includedLessons.length === 0 && includedResources.length === 0) continue;
    modules++;
    lessons += includedLessons.length;
    resources += includedResources.length;
    for (const lesson of includedLessons) seconds += lesson.durationSeconds;
  }

  return { modules, lessons, resources, minutes: Math.round(seconds / 60) };
}

export interface PlanTreeProps {
  modules: PlannedModule[];
  /** Claves de los módulos desplegados. */
  expanded: Set<string>;
  onToggleExpanded?: (moduleKey: string) => void;
  onPatchModule?: (moduleKey: string, patch: Partial<PlannedModule>) => void;
  onToggleLesson?: (moduleKey: string, lessonKey: string) => void;
  onRenameLesson?: (moduleKey: string, lessonKey: string, title: string) => void;
  onToggleResource?: (moduleKey: string, resourceKey: string) => void;
}

const noop = () => {};

/**
 * El plan tal y como se revisa: módulos plegables con sus lecciones y sus
 * recursos, todo con casilla y título editable. Es puramente presentacional
 * —no sabe de red— para poder dibujarse y comprobarse sin servidor.
 */
export const PlanTree: React.FC<PlanTreeProps> = ({
  modules,
  expanded,
  onToggleExpanded = noop,
  onPatchModule = noop,
  onToggleLesson = noop,
  onRenameLesson = noop,
  onToggleResource = noop,
}) => {
  const { t } = useTranslation()
  return (
  <div className="border border-[#2d2d44] rounded-xl divide-y divide-[#2d2d44] max-h-[26rem] overflow-y-auto">
    {modules.map((moduleEntry) => {
      const isOpen = expanded.has(moduleEntry.key);
      const lessonsIn = moduleEntry.lessons.filter((lesson) => lesson.include).length;
      const resourcesIn = moduleEntry.resources.filter((resource) => resource.include).length;

      return (
        <div key={moduleEntry.key} className={moduleEntry.include ? '' : 'opacity-50'}>
          <div className="flex items-center gap-2 px-3 py-2 bg-[#0f0f18]">
            <input
              type="checkbox"
              checked={moduleEntry.include}
              onChange={() => onPatchModule(moduleEntry.key, { include: !moduleEntry.include })}
              className="accent-[#06b6d4] w-4 h-4 shrink-0"
              aria-label={t('incluirElModuloTitle', 'Incluir el módulo {{title}}', { title: moduleEntry.title })}
            />
            <button
              type="button"
              onClick={() => onToggleExpanded(moduleEntry.key)}
              className="text-slate-400 hover:text-white shrink-0"
              aria-label={isOpen ? 'Contraer módulo' : 'Desplegar módulo'}
            >
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <input
              type="text"
              value={moduleEntry.title}
              onChange={(event) => onPatchModule(moduleEntry.key, { title: event.target.value })}
              className="flex-1 bg-transparent text-xs font-bold text-white focus:outline-none focus:bg-[#0a0a0f] rounded px-1 py-0.5"
            />
            <span className="text-[11px] text-slate-500 whitespace-nowrap">
              {t('driveLessonsCount', { count: lessonsIn, defaultValue_one: '{{count}} lección', defaultValue_other: '{{count}} lecciones' })} · {t('driveResourcesCount', { count: resourcesIn, defaultValue_one: '{{count}} recurso', defaultValue_other: '{{count}} recursos' })}
            </span>
          </div>

          {isOpen && (
            <div className="px-3 py-2 space-y-1">
              {moduleEntry.lessons.map((lesson) => {
                const Icon = KIND_ICON[lesson.contentKind] ?? Video;
                return (
                  <div key={lesson.key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={lesson.include}
                      onChange={() => onToggleLesson(moduleEntry.key, lesson.key)}
                      className="accent-[#06b6d4] w-3.5 h-3.5 shrink-0"
                      aria-label={t('incluirLaLeccionTitle', 'Incluir la lección {{title}}', { title: lesson.title })}
                    />
                    <Icon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <input
                      type="text"
                      value={lesson.title}
                      onChange={(event) => onRenameLesson(moduleEntry.key, lesson.key, event.target.value)}
                      title={lesson.originalName}
                      className={`flex-1 bg-transparent text-xs rounded px-1 py-0.5 focus:outline-none focus:bg-[#0a0a0f] ${
                        lesson.include ? 'text-slate-200' : 'text-slate-600 line-through'
                      }`}
                    />
                    <span className="text-[11px] text-slate-500 whitespace-nowrap">
                      {lesson.duration}
                      {lesson.durationEstimated ? '~' : ''}
                    </span>
                  </div>
                );
              })}

              {moduleEntry.resources.length > 0 && (
                <div className="pt-2 mt-1 border-t border-[#2d2d44]/60">
                  <p className="text-[11px] font-bold text-slate-500 mb-1">{t('recursosDelModulo', 'Recursos del módulo')}</p>
                  {moduleEntry.resources.map((resource) => {
                    const Icon = KIND_ICON[resource.contentKind] ?? FileText;
                    const size = formatSize(resource.sizeBytes);
                    return (
                      <div key={resource.key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={resource.include}
                          onChange={() => onToggleResource(moduleEntry.key, resource.key)}
                          className="accent-[#06b6d4] w-3.5 h-3.5 shrink-0"
                          aria-label={t('incluirElRecursoTitle', 'Incluir el recurso {{title}}', { title: resource.title })}
                        />
                        <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span
                          className={`flex-1 text-xs truncate px-1 ${
                            resource.include ? 'text-slate-300' : 'text-slate-600 line-through'
                          }`}
                          title={resource.originalName}
                        >
                          {resource.title}
                        </span>
                        <span className="text-[11px] text-slate-500 whitespace-nowrap">
                          {KIND_LABEL[resource.contentKind]}
                          {size ? ` · ${size}` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      );
    })}
  </div>
)
};

export const DriveCourseImport: React.FC<DriveCourseImportProps> = ({ onImported }) => {
  const { t } = useTranslation()
  const [url, setUrl] = useState('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [analyzing, setAnalyzing] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [applying, setApplying] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiProvider, setAiProvider] = useState('none');
  const [existingCourse, setExistingCourse] = useState<{ id: string; title: string } | null>(null);
  /** Se rellena cuando el servidor responde 409: hay que preguntar antes de duplicar. */
  const [duplicate, setDuplicate] = useState<{ id: string; title: string } | null>(null);

  const [price, setPrice] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const [coverImage, setCoverImage] = useState('');
  const [published, setPublished] = useState(false);

  const totals = plan ? selectedTotals(plan) : null;

  const resetAll = () => {
    setPlan(null);
    setExpanded(new Set());
    setError('');
    setExistingCourse(null);
    setDuplicate(null);
  };

  const handleAnalyze = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return;
    setAnalyzing(true);
    setError('');
    setNotice('');
    setDuplicate(null);
    try {
      const res = await api.previewDriveImport(url.trim());
      setPlan(res.plan);
      setAiAvailable(res.aiAvailable);
      setAiProvider(res.aiProvider);
      setExistingCourse(res.existingCourse);
      // El primer módulo abierto basta para ver que la lectura fue bien; abrir
      // ocho carpetas de golpe convierte la revisión en scroll infinito.
      setExpanded(new Set(res.plan.modules.slice(0, 1).map((moduleEntry) => moduleEntry.key)));
    } catch (err: any) {
      resetAll();
      setError(err.message || t('noSePudoLeerLaCarpeta', 'No se pudo leer la carpeta.'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleOrganize = async () => {
    if (!plan) return;
    setOrganizing(true);
    setError('');
    setNotice('');
    try {
      const res = await api.organizeDriveImport(plan);
      setPlan(res.plan);
      setNotice(
        res.organized
          ? t('titulosYEstructuraPulidosConProviderVal', 'Títulos y estructura pulidos con {{provider}}{{val}}.', { provider: res.provider ?? 'IA', val: res.model ? ` (${res.model})` : '' })
          : t('laPropuestaDeLaIaSeDescartoYElPlanSigue', 'La propuesta de la IA se descartó y el plan sigue intacto. Motivo: {{reason}}', { reason: res.reason ?? 'desconocido' }),
      );
    } catch (err: any) {
      setError(err.message || t('noSePudoOrganizarElCursoConIa', 'No se pudo organizar el curso con IA.'));
    } finally {
      setOrganizing(false);
    }
  };

  const handleApply = async (onDuplicate?: 'append' | 'create') => {
    if (!plan) return;
    setApplying(true);
    setError('');
    setNotice('');
    try {
      const res = await api.applyDriveImport({
        plan,
        price,
        currency,
        published,
        coverImage: coverImage.trim() || undefined,
        onDuplicate,
      });
      const partes = [
        t('driveModulesCount', { count: res.created.modules, defaultValue_one: '{{count}} módulo', defaultValue_other: '{{count}} módulos' }),
        t('driveLessonsCount', { count: res.created.lessons, defaultValue_one: '{{count}} lección', defaultValue_other: '{{count}} lecciones' }),
        t('driveResourcesCount', { count: res.created.resources, defaultValue_one: '{{count}} recurso', defaultValue_other: '{{count}} recursos' }),
      ].join(' · ');
      const omitido =
        res.skipped.lessons + res.skipped.resources > 0
          ? t('seOmitieronLessonsLeccionesYResources', 'Se omitieron {{lessons}} lecciones y {{resources}} recursos que ya estaban.', { lessons: res.skipped.lessons, resources: res.skipped.resources })
          : '';
      setNotice(
        `${res.mode === 'append' ? 'Contenido añadido' : 'Curso creado'}: ${partes}.${omitido}`,
      );
      resetAll();
      setUrl('');
      onImported();
    } catch (err: any) {
      if (err.code === 'duplicate' && err.course) {
        setDuplicate(err.course);
      } else {
        setError(err.message || t('noSePudoCrearElCurso', 'No se pudo crear el curso.'));
      }
    } finally {
      setApplying(false);
    }
  };

  const updatePlan = (updater: (draft: ImportPlan) => ImportPlan) => {
    setPlan((current) => (current ? updater(current) : current));
  };

  const patchModule = (moduleKey: string, patch: Partial<PlannedModule>) =>
    updatePlan((draft) => ({
      ...draft,
      modules: draft.modules.map((moduleEntry) =>
        moduleEntry.key === moduleKey ? { ...moduleEntry, ...patch } : moduleEntry,
      ),
    }));

  const toggleLesson = (moduleKey: string, lessonKey: string) =>
    updatePlan((draft) => ({
      ...draft,
      modules: draft.modules.map((moduleEntry) =>
        moduleEntry.key !== moduleKey
          ? moduleEntry
          : {
              ...moduleEntry,
              lessons: moduleEntry.lessons.map((lesson) =>
                lesson.key === lessonKey ? { ...lesson, include: !lesson.include } : lesson,
              ),
            },
      ),
    }));

  const renameLesson = (moduleKey: string, lessonKey: string, title: string) =>
    updatePlan((draft) => ({
      ...draft,
      modules: draft.modules.map((moduleEntry) =>
        moduleEntry.key !== moduleKey
          ? moduleEntry
          : {
              ...moduleEntry,
              lessons: moduleEntry.lessons.map((lesson) =>
                lesson.key === lessonKey ? { ...lesson, title } : lesson,
              ),
            },
      ),
    }));

  const toggleResource = (moduleKey: string, resourceKey: string) =>
    updatePlan((draft) => ({
      ...draft,
      modules: draft.modules.map((moduleEntry) =>
        moduleEntry.key !== moduleKey
          ? moduleEntry
          : {
              ...moduleEntry,
              resources: moduleEntry.resources.map((resource) =>
                resource.key === resourceKey ? { ...resource, include: !resource.include } : resource,
              ),
            },
      ),
    }));

  const toggleExpanded = (moduleKey: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(moduleKey)) next.delete(moduleKey);
      else next.add(moduleKey);
      return next;
    });

  const inputClass =
    'w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]';

  return (
    <div className="bg-[#141420] border border-[#2d2d44] rounded-2xl p-6 shadow-xl space-y-4">
      <div className="border-b border-[#2d2d44] pb-3">
        <h3 className="font-extrabold text-base text-white flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-cyan-400" />
          {t('importarDesdeGoogleDrive', 'Importar desde Google Drive')}
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          {t('pegaElEnlaceDeLaCarpetaDelCursoSeLeenSus', 'Pega el enlace de la carpeta del curso: se leen sus subcarpetas como módulos, los vídeos como lecciones y los ZIP, PDF o subtítulos como recursos del módulo. Nada se guarda hasta que lo confirmes.')}
        </p>
      </div>

      <form onSubmit={handleAnalyze} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://drive.google.com/drive/folders/1AbC..."
          className={inputClass}
        />
        <button
          type="submit"
          disabled={analyzing || !url.trim()}
          className="btn-brand-primary py-2 px-4 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {analyzing ? t('leyendoCarpeta', 'Leyendo carpeta…') : t('analizar', 'Analizar')}
        </button>
      </form>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs font-bold flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {notice && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {notice}
        </div>
      )}

      {plan && totals && (
        <div className="space-y-4">
          {/* Resumen de la lectura */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
            <span className="px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              {t('driveModulesCount', { count: totals.modules, defaultValue_one: '{{count}} módulo', defaultValue_other: '{{count}} módulos' })}
            </span>
            <span className="px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              {t('driveLessonsCount', { count: totals.lessons, defaultValue_one: '{{count}} lección', defaultValue_other: '{{count}} lecciones' })}
            </span>
            <span className="px-2 py-1 rounded-lg bg-slate-500/10 text-slate-300 border border-slate-500/30">
              {t('driveResourcesCount', { count: totals.resources, defaultValue_one: '{{count}} recurso', defaultValue_other: '{{count}} recursos' })}
            </span>
            <span className="px-2 py-1 rounded-lg bg-slate-500/10 text-slate-300 border border-slate-500/30">
              {t('minutesMin', '~{{minutes}} min', { minutes: totals.minutes })}
            </span>
            <span className="px-2 py-1 rounded-lg bg-slate-500/10 text-slate-400 border border-slate-500/30">
              {t('filesFoundArchivosLeidos', '{{filesFound}} archivos leídos', { filesFound: plan.stats.filesFound })}
            </span>
            {plan.strategy === 'public' && (
              <span
                className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30"
                title={t('sinGoogleDriveApiKeyDriveNoPublicaLa', 'Sin GOOGLE_DRIVE_API_KEY, Drive no publica la duración real y se estima por el tamaño del archivo.')}
              >
                {t('duracionesEstimadas', 'duraciones estimadas')}
              </span>
            )}
          </div>

          {plan.incomplete && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-bold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <Trans i18nKey="laCarpetaEsMasGrandeQueLosTopesDeLectura">La carpeta es más grande que los topes de lectura, así que esto es solo una parte.
              Importa por subcarpetas o sube los límites de <code>DRIVE_IMPORT_*</code>.</Trans>
            </div>
          )}

          {existingCourse && !duplicate && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-bold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {t('estaCarpetaYaSeImportoComoTitleSiSigues', 'Esta carpeta ya se importó como «{{title}}». Si sigues, se te preguntará si añadir solo lo que falte.', { title: existingCourse.title })}
            </div>
          )}

          {/* Datos del curso */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">{t('tituloDelCurso', 'Título del Curso')}</label>
              <input
                type="text"
                value={plan.title}
                onChange={(event) => updatePlan((draft) => ({ ...draft, title: event.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">{t('categoriaEtiqueta', 'Categoría')}</label>
              <input
                type="text"
                value={plan.category}
                onChange={(event) => updatePlan((draft) => ({ ...draft, category: event.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1">{t('descripcion', 'Descripción')}</label>
            <textarea
              rows={2}
              value={plan.description}
              onChange={(event) => updatePlan((draft) => ({ ...draft, description: event.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">{t('precio', 'Precio')}</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(event) => setPrice(Number(event.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">{t('moneda', 'Moneda')}</label>
              <select value={currency} onChange={(event) => setCurrency(event.target.value)} className={inputClass}>
                <option value="USD">{t('usd', 'USD')}</option>
                <option value="EUR">{t('eur', 'EUR')}</option>
                <option value="MXN">{t('mxn', 'MXN')}</option>
                <option value="COP">{t('cop', 'COP')}</option>
                <option value="ARS">{t('ars', 'ARS')}</option>
                <option value="PEN">{t('pen', 'PEN')}</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] font-bold text-slate-400 block mb-1">{t('imagenDePortadaUrl', 'Imagen de Portada (URL)')}</label>
              <input
                type="url"
                value={coverImage}
                onChange={(event) => setCoverImage(event.target.value)}
                placeholder={t('opcionalSeUsaUnaPorDefecto', 'Opcional; se usa una por defecto')}
                className={inputClass}
              />
            </div>
          </div>

          {/* Árbol revisable */}
          <PlanTree
            modules={plan.modules}
            expanded={expanded}
            onToggleExpanded={toggleExpanded}
            onPatchModule={patchModule}
            onToggleLesson={toggleLesson}
            onRenameLesson={renameLesson}
            onToggleResource={toggleResource}
          />

          {/* Confirmación de reimportación */}
          {duplicate && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
              <p className="text-xs font-bold text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {t('estaCarpetaYaSeImportoComoTitleQue', 'Esta carpeta ya se importó como «{{title}}». ¿Qué prefieres?', { title: duplicate.title })}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleApply('append')}
                  disabled={applying}
                  className="btn-brand-primary py-1.5 px-3 text-xs font-bold disabled:opacity-50"
                >
                  {t('anadirSoloLoQueFalte', 'Añadir solo lo que falte')}
                </button>
                <button
                  type="button"
                  onClick={() => handleApply('create')}
                  disabled={applying}
                  className="py-1.5 px-3 text-xs font-bold text-slate-300 border border-[#2d2d44] rounded-xl hover:text-white disabled:opacity-50"
                >
                  {t('crearUnCursoAparte', 'Crear un curso aparte')}
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicate(null)}
                  className="py-1.5 px-3 text-xs font-bold text-slate-400 hover:text-white"
                >
                  {t('cancelar', 'Cancelar')}
                </button>
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(event) => setPublished(event.target.checked)}
                  className="accent-[#06b6d4] w-4 h-4"
                />
                {t('publicarInmediatamente', 'Publicar inmediatamente')}
              </label>
              <button
                type="button"
                onClick={resetAll}
                className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5"
              >
                <X className="w-4 h-4" /> {t('descartar', 'Descartar')}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOrganize}
                disabled={organizing || applying || !aiAvailable}
                title={
                  aiAvailable
                    ? t('renombraYReordenaConAiProviderSiSu', 'Renombra y reordena con {{aiProvider}}. Si su propuesta pierde alguna lección, se descarta entera.', { aiProvider })
                    : t('configuraOpenaiApiKeyODeepseekApiKeyPara', 'Configura OPENAI_API_KEY o DEEPSEEK_API_KEY para habilitarlo. La importación funciona igual sin IA.')
                }
                className="py-2 px-4 text-xs font-bold text-cyan-300 border border-cyan-500/40 rounded-xl hover:bg-cyan-500/10 flex items-center gap-1.5 disabled:opacity-40"
              >
                {organizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {organizing ? t('organizando', 'Organizando…') : t('mejorarConIa', 'Mejorar con IA')}
              </button>

              <button
                type="button"
                onClick={() => handleApply()}
                disabled={applying || organizing || totals.lessons + totals.resources === 0}
                className="btn-brand-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {t('crearCurso', 'Crear curso')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
