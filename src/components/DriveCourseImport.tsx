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

import { useToastMessage } from '../lib/useToastMessage';
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
import { AdminSelect } from './AdminSelect';
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
  <div className="admin-import__tree">
    {modules.map((moduleEntry) => {
      const isOpen = expanded.has(moduleEntry.key);
      const lessonsIn = moduleEntry.lessons.filter((lesson) => lesson.include).length;
      const resourcesIn = moduleEntry.resources.filter((resource) => resource.include).length;

      return (
        <div key={moduleEntry.key} className="admin-import__module" data-off={!moduleEntry.include || undefined}>
          <div className="admin-import__module-head">
            <input
              type="checkbox"
              checked={moduleEntry.include}
              onChange={() => onPatchModule(moduleEntry.key, { include: !moduleEntry.include })}
              aria-label={t('incluirElModuloTitle', 'Incluir el módulo {{title}}', { title: moduleEntry.title })}
            />
            <button
              type="button"
              className="admin-import__toggle"
              onClick={() => onToggleExpanded(moduleEntry.key)}
              aria-expanded={isOpen}
              aria-label={isOpen ? 'Contraer módulo' : 'Desplegar módulo'}
            >
              {isOpen ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
            </button>
            <input
              type="text"
              className="admin-import__title"
              value={moduleEntry.title}
              onChange={(event) => onPatchModule(moduleEntry.key, { title: event.target.value })}
              aria-label={moduleEntry.title}
            />
            <span className="admin-import__count">
              {t('driveLessonsCount', { count: lessonsIn, defaultValue_one: '{{count}} lección', defaultValue_other: '{{count}} lecciones' })} · {t('driveResourcesCount', { count: resourcesIn, defaultValue_one: '{{count}} recurso', defaultValue_other: '{{count}} recursos' })}
            </span>
          </div>

          {isOpen && (
            <div className="admin-import__rows">
              {moduleEntry.lessons.map((lesson) => {
                const Icon = KIND_ICON[lesson.contentKind] ?? Video;
                return (
                  <div key={lesson.key} className="admin-import__row" data-off={!lesson.include || undefined}>
                    <input
                      type="checkbox"
                      checked={lesson.include}
                      onChange={() => onToggleLesson(moduleEntry.key, lesson.key)}
                      aria-label={t('incluirLaLeccionTitle', 'Incluir la lección {{title}}', { title: lesson.title })}
                    />
                    <Icon aria-hidden="true" />
                    <input
                      type="text"
                      className="admin-import__title"
                      value={lesson.title}
                      onChange={(event) => onRenameLesson(moduleEntry.key, lesson.key, event.target.value)}
                      title={lesson.originalName}
                      aria-label={lesson.title}
                    />
                    <span className="admin-import__count">
                      {lesson.duration}
                      {lesson.durationEstimated ? '~' : ''}
                    </span>
                  </div>
                );
              })}

              {moduleEntry.resources.length > 0 && (
                <div className="admin-import__resources">
                  <p>{t('recursosDelModulo', 'Recursos del módulo')}</p>
                  {moduleEntry.resources.map((resource) => {
                    const Icon = KIND_ICON[resource.contentKind] ?? FileText;
                    const size = formatSize(resource.sizeBytes);
                    return (
                      <div key={resource.key} className="admin-import__row" data-off={!resource.include || undefined}>
                        <input
                          type="checkbox"
                          checked={resource.include}
                          onChange={() => onToggleResource(moduleEntry.key, resource.key)}
                          aria-label={t('incluirElRecursoTitle', 'Incluir el recurso {{title}}', { title: resource.title })}
                        />
                        <Icon aria-hidden="true" />
                        <span className="admin-import__name" title={resource.originalName}>{resource.title}</span>
                        <span className="admin-import__count">
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
  useToastMessage(error, 'error');
  useToastMessage(notice, 'success');
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

  return (
    <section className="admin-import" aria-label={t('importarDesdeGoogleDrive', 'Importar desde Google Drive')}>
      <header className="admin-import__head">
        <span className="admin-import__glyph" aria-hidden="true"><HardDrive /></span>
        <div>
          <h3>{t('importarDesdeGoogleDrive', 'Importar desde Google Drive')}</h3>
          <p>{t('pegaElEnlaceDeLaCarpetaDelCursoSeLeenSus', 'Pega el enlace de la carpeta del curso: se leen sus subcarpetas como módulos, los vídeos como lecciones y los ZIP, PDF o subtítulos como recursos del módulo. Nada se guarda hasta que lo confirmes.')}</p>
        </div>
      </header>

      <form onSubmit={handleAnalyze} className="admin-import__url">
        <input
          type="text"
          className="admin-import__input"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://drive.google.com/drive/folders/1AbC..."
          aria-label={t('importarDesdeGoogleDrive', 'Importar desde Google Drive')}
        />
        <button type="submit" className="mentor-course-control admin-primary-action" disabled={analyzing || !url.trim()}>
          {analyzing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
          {analyzing ? t('leyendoCarpeta', 'Leyendo carpeta…') : t('analizar', 'Analizar')}
        </button>
      </form>


      {plan && totals && (
        <div className="admin-import__plan">
          <p className="admin-import__summary" role="status">
            <span>{t('driveModulesCount', { count: totals.modules, defaultValue_one: '{{count}} módulo', defaultValue_other: '{{count}} módulos' })}</span>
            <span>{t('driveLessonsCount', { count: totals.lessons, defaultValue_one: '{{count}} lección', defaultValue_other: '{{count}} lecciones' })}</span>
            <span>{t('driveResourcesCount', { count: totals.resources, defaultValue_one: '{{count}} recurso', defaultValue_other: '{{count}} recursos' })}</span>
            <span>{t('minutesMin', '~{{minutes}} min', { minutes: totals.minutes })}</span>
            <span>{t('filesFoundArchivosLeidos', '{{filesFound}} archivos leídos', { filesFound: plan.stats.filesFound })}</span>
            {plan.strategy === 'public' && (
              <span title={t('sinGoogleDriveApiKeyDriveNoPublicaLa', 'Sin GOOGLE_DRIVE_API_KEY, Drive no publica la duración real y se estima por el tamaño del archivo.')}>
                {t('duracionesEstimadas', 'duraciones estimadas')}
              </span>
            )}
          </p>

          {plan.incomplete && (
            <p className="admin-import__alert" role="alert">
              <AlertTriangle aria-hidden="true" />
              <span>
                <Trans i18nKey="laCarpetaEsMasGrandeQueLosTopesDeLectura">La carpeta es más grande que los topes de lectura, así que esto es solo una parte.
                Importa por subcarpetas o sube los límites de <code>DRIVE_IMPORT_*</code>.</Trans>
              </span>
            </p>
          )}

          {existingCourse && !duplicate && (
            <p className="admin-import__alert" role="alert">
              <AlertTriangle aria-hidden="true" />
              <span>{t('estaCarpetaYaSeImportoComoTitleSiSigues', 'Esta carpeta ya se importó como «{{title}}». Si sigues, se te preguntará si añadir solo lo que falte.', { title: existingCourse.title })}</span>
            </p>
          )}

          <div className="admin-import__fields">
            <div className="meeting-field">
              <label htmlFor="drive-import-title">{t('tituloDelCurso', 'Título del Curso')}</label>
              <input id="drive-import-title" type="text" className="admin-import__input" value={plan.title} onChange={(event) => updatePlan((draft) => ({ ...draft, title: event.target.value }))} />
            </div>
            <div className="meeting-field">
              <label htmlFor="drive-import-category">{t('categoriaEtiqueta', 'Categoría')}</label>
              <input id="drive-import-category" type="text" className="admin-import__input" value={plan.category} onChange={(event) => updatePlan((draft) => ({ ...draft, category: event.target.value }))} />
            </div>
            <div className="meeting-field admin-import__wide">
              <label htmlFor="drive-import-description">{t('descripcion', 'Descripción')}</label>
              <textarea id="drive-import-description" rows={2} className="admin-import__input" value={plan.description} onChange={(event) => updatePlan((draft) => ({ ...draft, description: event.target.value }))} />
            </div>
            <div className="meeting-field">
              <label htmlFor="drive-import-price">{t('precio', 'Precio')}</label>
              <input id="drive-import-price" type="number" min={0} step="0.01" className="admin-import__input" value={price} onChange={(event) => setPrice(Number(event.target.value))} />
            </div>
            <div className="meeting-field">
              <label htmlFor="drive-import-currency">{t('moneda', 'Moneda')}</label>
              <AdminSelect id="drive-import-currency" value={currency} onChange={setCurrency} options={['USD', 'EUR', 'MXN', 'COP', 'ARS', 'PEN'].map((code) => ({ value: code, label: code }))} />
            </div>
            <div className="meeting-field admin-import__wide">
              <label htmlFor="drive-import-cover">{t('imagenDePortadaUrl', 'Imagen de Portada (URL)')}</label>
              <input id="drive-import-cover" type="url" className="admin-import__input" value={coverImage} onChange={(event) => setCoverImage(event.target.value)} placeholder={t('opcionalSeUsaUnaPorDefecto', 'Opcional; se usa una por defecto')} />
            </div>
          </div>

          <PlanTree
            modules={plan.modules}
            expanded={expanded}
            onToggleExpanded={toggleExpanded}
            onPatchModule={patchModule}
            onToggleLesson={toggleLesson}
            onRenameLesson={renameLesson}
            onToggleResource={toggleResource}
          />

          {duplicate && (
            <div className="admin-import__alert admin-import__alert--ask" role="alertdialog" aria-label={duplicate.title}>
              <p>
                <AlertTriangle aria-hidden="true" />
                <span>{t('estaCarpetaYaSeImportoComoTitleQue', 'Esta carpeta ya se importó como «{{title}}». ¿Qué prefieres?', { title: duplicate.title })}</span>
              </p>
              <div className="admin-import__ask">
                <button type="button" className="mentor-course-control admin-primary-action" onClick={() => handleApply('append')} disabled={applying}>
                  {t('anadirSoloLoQueFalte', 'Añadir solo lo que falte')}
                </button>
                <button type="button" className="mentor-course-control" onClick={() => handleApply('create')} disabled={applying}>
                  {t('crearUnCursoAparte', 'Crear un curso aparte')}
                </button>
                <button type="button" className="mentor-course-control" onClick={() => setDuplicate(null)}>
                  {t('cancelar', 'Cancelar')}
                </button>
              </div>
            </div>
          )}

          <div className="admin-import__actions">
            <div className="admin-import__actions-left">
              <label className="admin-import__check">
                <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
                {t('publicarInmediatamente', 'Publicar inmediatamente')}
              </label>
              <button type="button" className="mentor-course-control" onClick={resetAll}>
                <X aria-hidden="true" /> {t('descartar', 'Descartar')}
              </button>
            </div>

            <div className="admin-import__actions-right">
              <button
                type="button"
                className="mentor-course-control"
                onClick={handleOrganize}
                disabled={organizing || applying || !aiAvailable}
                title={
                  aiAvailable
                    ? t('renombraYReordenaConAiProviderSiSu', 'Renombra y reordena con {{aiProvider}}. Si su propuesta pierde alguna lección, se descarta entera.', { aiProvider })
                    : t('configuraOpenaiApiKeyODeepseekApiKeyPara', 'Configura OPENAI_API_KEY o DEEPSEEK_API_KEY para habilitarlo. La importación funciona igual sin IA.')
                }
              >
                {organizing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
                {organizing ? t('organizando', 'Organizando…') : t('mejorarConIa', 'Mejorar con IA')}
              </button>

              <button
                type="button"
                className="mentor-course-control admin-primary-action"
                onClick={() => handleApply()}
                disabled={applying || organizing || totals.lessons + totals.resources === 0}
              >
                {applying ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
                {t('crearCurso', 'Crear curso')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
