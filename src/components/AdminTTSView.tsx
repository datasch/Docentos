import { AdminSelect } from './AdminSelect';
import { useToastMessage } from '../lib/useToastMessage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, ChevronDown, LayoutGrid, List, Loader2, Plus, Sparkles, Trash2, Volume2, Wand2, X } from 'lucide-react';
import type { Module, TTSGuide } from '../types';
import { SUPPORTED_TTS_VOICES, ttsService } from '../lib/ttsService';
import { filterTTSGuides } from '../lib/adminTTSFilter';
import { PageLoader } from './loading/PageLoader';
import { ActiveFilters, AdminSearchField, FilterMenu, Pager, useListView } from './AdminListKit';
import { useTranslation, Trans } from 'react-i18next'

interface Props {
  courseId: string;
  courseTitle: string;
  modules: Module[];
  guides: TTSGuide[];
  loading: boolean;
  sheetOpen: boolean;
  showCreateButton: boolean;
  onOpenSheet: () => void;
  onCloseSheet: () => void;
  title: string;
  onTitle: (value: string) => void;
  script: string;
  onScript: (value: string) => void;
  voice: string;
  onVoice: (value: string) => void;
  speed: number;
  onSpeed: (value: number) => void;
  videoId: string;
  onVideoId: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onGenerate: () => void;
  onPreview: () => void;
  generating: boolean;
  previewing: boolean;
  success: string;
  error: string;
  onDelete: (id: string) => Promise<void>;
}

export function AdminTTSView(props: Props) {
  const { t } = useTranslation()
  useToastMessage(props.success, 'success');
  useToastMessage(props.sheetOpen ? '' : props.error, 'error');
  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<TTSGuide | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lessonOpen, setLessonOpen] = useState(false);
  const { isMobile, view, change } = useListView('admin-tts-view');
  const sheetRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setQuery('');
    setModuleFilter('ALL');
    setPage(1);
    setDeleteTarget(null);
    setLessonOpen(false);
  }, [props.courseId]);

  useEffect(() => {
    const dialog = sheetRef.current;
    if (!dialog) return;
    if (props.sheetOpen && !dialog.open) dialog.showModal();
    if (!props.sheetOpen && dialog.open) dialog.close();
  }, [props.sheetOpen]);
  useEffect(() => {
    const dialog = confirmRef.current;
    if (!dialog) return;
    if (deleteTarget && !dialog.open) dialog.showModal();
    if (!deleteTarget && dialog.open) dialog.close();
  }, [deleteTarget]);

  const lessons = useMemo(() => props.modules.flatMap((module) => module.videos.map((video) => ({
    id: video.id, moduleId: module.id, label: `${module.title} → ${video.title}`, title: video.title, module: module.title,
  }))), [props.modules]);
  const selectedLesson = props.modules.flatMap((module) => module.videos.map((video) => ({ id: video.id, title: video.title, module: module.title }))).find((lesson) => lesson.id === props.videoId);
  const lessonById = Object.fromEntries(lessons.map((lesson) => [lesson.id, lesson]));
  const lessonTitles = Object.fromEntries(lessons.map((lesson) => [lesson.id, lesson.label]));
  const filtered = filterTTSGuides(props.guides, query, moduleFilter, lessonTitles);
  const pageSize = view === 'list' ? 10 : 9;
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const moduleOptions = props.modules.map((module) => ({ value: module.id, label: module.title, count: props.guides.filter((guide) => guide.moduleId === module.id).length }));

  const deleteGuide = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    await props.onDelete(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <section data-mentor-ui="modern" className="admin-courses-root admin-tts" aria-label={t('audioTts', 'Audio TTS')}>
      <div className="admin-tts__intro">
        <div><h3>{t('guiasDeAudio', 'Guías de audio')}</h3><p>{t('introduccionesHabladasParaLasLeccionesDe', 'Introducciones habladas para las lecciones de «{{courseTitle}}».', { courseTitle: props.courseTitle })}</p></div>
        {props.showCreateButton ? <button type="button" className="mentor-course-control admin-tts__create" onClick={props.onOpenSheet} disabled={lessons.length === 0}><Plus aria-hidden="true" />{t('nuevaGuia', 'Nueva guía')}</button> : <span>{props.guides.length} {t('guias', { defaultValue_one: 'guía', defaultValue_other: 'guías', count: props.guides.length })}</span>}
      </div>
      <div className="mentor-course-toolbar admin-tts__toolbar">
        <AdminSearchField value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder={t('buscarGuiaOLeccion', 'Buscar guía o lección')} label={t('buscarGuiaDeAudio', 'Buscar guía de audio')} />
        <FilterMenu groups={[{ value: moduleFilter, onChange: (value) => { setModuleFilter(value); setPage(1); }, options: moduleOptions }]} />
        {!isMobile && <div className="mentor-publication-filters admin-view-toggle" role="group" aria-label={t('vistaDeGuias', 'Vista de guías')}>
          <button type="button" aria-pressed={view === 'list'} onClick={() => { change('list'); setPage(1); }}><List aria-hidden="true" />{t('lista', 'Lista')}</button>
          <button type="button" aria-pressed={view === 'cards'} onClick={() => { change('cards'); setPage(1); }}><LayoutGrid aria-hidden="true" />{t('tarjetas', 'Tarjetas')}</button>
        </div>}
      </div>
      <ActiveFilters noun="guías" shown={filtered.length} total={props.guides.length} onClear={() => { setQuery(''); setModuleFilter('ALL'); setPage(1); }} chips={[
        ...(moduleFilter !== 'ALL' ? [{ key: 'module', text: props.modules.find((module) => module.id === moduleFilter)?.title || 'Módulo', onRemove: () => { setModuleFilter('ALL'); setPage(1); } }] : []),
        ...(query.trim() ? [{ key: 'query', text: `«${query.trim()}»`, onRemove: () => { setQuery(''); setPage(1); } }] : []),
      ]} />
      {lessons.length === 0 && <p className="admin-resources__notice admin-resources__notice--error" role="status"><AlertTriangle aria-hidden="true" />{t('esteCursoAunNoTieneLeccionesCreaUnaEnEl', 'Este curso aún no tiene lecciones. Crea una en el temario para añadir audio.')}</p>}
      {props.loading ? <PageLoader label={t('cargandoGuias', 'Cargando guías…')} /> : visible.length === 0 ? (
        <div className="admin-tts__empty"><Volume2 aria-hidden="true" /><p>{t('ningunaGuiaCoincideConLaBusqueda', { defaultValue_zero: 'Todavía no hay guías de audio para este curso.', defaultValue_other: 'Ninguna guía coincide con la búsqueda.', count: props.guides.length })}</p></div>
      ) : <ul className="admin-tts__list" data-view={view}>
        {visible.map((guide) => {
          const voice = SUPPORTED_TTS_VOICES.find((option) => option.id === guide.voiceId);
          return <li className="admin-tts__item" key={guide.id}>
            <div className="admin-tts__content">
              <div className="admin-tts__item-main admin-tts__item-main--tagged"><span className="admin-tts__glyph" aria-hidden="true"><Volume2 /></span><h4>{guide.title}</h4><span className="admin-tts__kind" aria-label={t('xpRewardPuntosDeExperienciaDeRecompensa', '{{xpReward}} puntos de experiencia de recompensa', { xpReward: guide.xpReward })}>{t('xpRewardExp', '+{{xpReward}} EXP', { xpReward: guide.xpReward })}</span><div className="admin-tts__where"><p>{lessonById[guide.videoId || '']?.title || t('leccionNoDisponible', 'Lección no disponible')}</p><small>{lessonById[guide.videoId || '']?.module}</small></div></div>
              <div className="admin-tts__script"><p>{guide.scriptText}</p></div>
              <div className="admin-tts__meta"><div className="admin-tts__meta-text"><span>{guide.mentorName}</span><span>{voice ? `${voice.flag} ${voice.name}` : guide.voiceId}</span><span>x{guide.voiceSpeed}</span></div></div>
            </div>
            <div className="admin-tts__actions"><button type="button" className="mentor-course-control" onClick={() => ttsService.speak({ text: guide.scriptText, voiceId: guide.voiceId, speed: guide.voiceSpeed })}><Volume2 aria-hidden="true" />{t('escuchar', 'Escuchar')}</button><button type="button" className="mentor-course-control" data-danger="true" onClick={() => setDeleteTarget(guide)} aria-haspopup="dialog" aria-label={t('eliminarTitle', 'Eliminar {{title}}', { title: guide.title })}><Trash2 aria-hidden="true" />{t('eliminar', 'Eliminar')}</button></div>
          </li>;
        })}
      </ul>}
      <Pager total={filtered.length} size={pageSize} page={safePage} onPage={setPage} noun="guías" />

      <dialog ref={sheetRef} className="mentee-sheet admin-tts__sheet" aria-labelledby="admin-tts-sheet-title" onClose={props.onCloseSheet} onClick={(event) => { if (event.target === sheetRef.current) props.onCloseSheet(); }}>
        <div className="mentee-sheet__body admin-person-sheet">
          <header className="mentee-sheet__head"><span className="mentee-sheet__icon" aria-hidden="true"><Volume2 /></span><div className="mentor-mentee-id"><strong id="admin-tts-sheet-title">{t('nuevaGuiaDeAudio', 'Nueva guía de audio')}</strong><span>{props.courseTitle}</span></div><button type="button" className="mentee-sheet__close" onClick={props.onCloseSheet} aria-label={t('cerrar', 'Cerrar')}><X aria-hidden="true" /></button></header>
          <form id="admin-tts-form" className="admin-person-sheet__scroll admin-tts__form" onSubmit={props.onSubmit}>
            <div className="meeting-field"><label htmlFor="admin-tts-title">{t('titulo', 'Título')}</label><input id="admin-tts-title" value={props.title} onChange={(event) => props.onTitle(event.target.value)} placeholder={t('ejBienvenidaAlModulo', 'Ej. Bienvenida al módulo')} required /></div>
            <div className="meeting-field"><span id="admin-tts-lesson-label" className="admin-tts__label">{t('leccionDeDestino', 'Lección de destino')}</span>
              <button type="button" className="admin-tts__lesson-trigger" aria-expanded={lessonOpen} aria-labelledby="admin-tts-lesson-label" onClick={() => setLessonOpen((open) => !open)} disabled={lessons.length === 0}>
                <span>{selectedLesson ? <><small>{selectedLesson.module}</small>{selectedLesson.title}</> : t('seleccionaUnaLeccion', 'Selecciona una lección')}</span><ChevronDown aria-hidden="true" />
              </button>
              {lessonOpen && <div className="admin-tts__lesson-list" role="group" aria-labelledby="admin-tts-lesson-label">{props.modules.filter((module) => module.videos.length > 0).map((module) => <div key={module.id}><strong>{module.title}</strong>{module.videos.map((video) => <button key={video.id} type="button" aria-pressed={video.id === props.videoId} onClick={() => { props.onVideoId(video.id); setLessonOpen(false); }}><span>{video.title}</span>{video.id === props.videoId && <Check aria-hidden="true" />}</button>)}</div>)}</div>}
            </div>
            <div className="meeting-field"><label htmlFor="admin-tts-voice">{t('voz', 'Voz')}</label><div className="admin-tts__voice-row"><AdminSelect inline id="admin-tts-voice" value={props.voice} onChange={props.onVoice} options={SUPPORTED_TTS_VOICES.map((voice) => ({ value: voice.id, label: `${voice.flag} ${voice.name}` }))} /><button type="button" className="mentor-course-control" onClick={() => ttsService.testVoice(props.voice, props.speed)}><Volume2 aria-hidden="true" />{t('probar', 'Probar')}</button></div></div>
            <div className="meeting-field"><label htmlFor="admin-tts-speed">{t('velocidadDeLecturaXSpeed', 'Velocidad de lectura: x{{speed}}', { speed: props.speed })}</label><input id="admin-tts-speed" type="range" min="0.8" max="1.4" step="0.1" value={props.speed} onChange={(event) => props.onSpeed(Number(event.target.value))} /></div>
            <fieldset className="admin-tts__voice-bank"><legend>{t('bancoDePruebaRapidaDeVocesPorIdioma', 'Banco de prueba rápida de voces por idioma')}</legend><div className="admin-tts__voice-options">{SUPPORTED_TTS_VOICES.map((voice) => <button key={voice.id} type="button" aria-pressed={props.voice === voice.id} onClick={() => { props.onVoice(voice.id); ttsService.testVoice(voice.id, props.speed); }}><span>{voice.flag} {voice.name}</span><Volume2 aria-hidden="true" /></button>)}</div></fieldset>
            <div className="meeting-field"><div className="admin-tts__script-head"><label htmlFor="admin-tts-script">{t('guion', 'Guion')}</label><button type="button" className="mentor-course-control" onClick={props.onGenerate} disabled={props.generating || !props.videoId}>{props.generating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Wand2 aria-hidden="true" />}{props.generating ? t('generando', 'Generando…') : t('generarConIa', 'Generar con IA')}</button></div><textarea id="admin-tts-script" rows={6} value={props.script} onChange={(event) => props.onScript(event.target.value)} placeholder={t('textoQueEscucharaElAlumnoAntesDeLa', 'Texto que escuchará el alumno antes de la lección')} required /></div>
            <button type="button" className="mentor-course-control admin-tts__preview" onClick={props.onPreview} disabled={!props.script.trim()}><Volume2 aria-hidden="true" />{props.previewing ? t('reproduciendo', 'Reproduciendo…') : t('escucharVistaPrevia', 'Escuchar vista previa')}</button>
            {props.error && <p className="admin-resource-sheet__error" role="alert">{props.error}</p>}
            {lessons.length === 0 && <p className="admin-resource-sheet__hint">{t('creaUnaLeccionEnElTemarioAntesDeAnadir', 'Crea una lección en el temario antes de añadir audio.')}</p>}
          </form>
          <footer className="mentee-sheet__foot mentee-sheet__foot--actions"><button type="submit" form="admin-tts-form" className="mentor-course-control mentor-course-import" disabled={lessons.length === 0 || props.generating}><Sparkles aria-hidden="true" />{t('guardarGuia', 'Guardar guía')}</button></footer>
        </div>
      </dialog>

      <dialog ref={confirmRef} className="mentor-confirm" aria-labelledby="admin-tts-delete-title" onCancel={(event) => { event.preventDefault(); if (!deleting) setDeleteTarget(null); }} onClick={(event) => { if (event.target === confirmRef.current && !deleting) setDeleteTarget(null); }}>
        {deleteTarget && <div className="mentor-confirm__body"><h3 id="admin-tts-delete-title">{t('eliminarGuiaDeAudio', 'Eliminar guía de audio')}</h3><p>{t('seEliminara', 'Se eliminará')} <strong>{deleteTarget.title}</strong> <Trans i18nKey="deEstaLeccionEstaAccionEsPermanente">de esta lección. Esta acción es <strong className="mentor-confirm__permanent">permanente</strong>.</Trans></p><div className="mentor-confirm__actions"><button type="button" className="mentor-course-control" onClick={() => setDeleteTarget(null)} disabled={deleting}>{t('cancelar', 'Cancelar')}</button><button type="button" className="mentor-course-control" data-danger="true" onClick={deleteGuide} disabled={deleting}>{deleting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}{t('eliminarGuia', 'Eliminar guía')}</button></div></div>}
      </dialog>
    </section>
  );
}
