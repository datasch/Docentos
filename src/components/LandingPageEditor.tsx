/**
 * LandingPageEditor.tsx - Editor CMS de Portada de DocentOS
 * Permite al Administrador personalizar completamente la Landing Page pública:
 * - Hero, Cursos Destacados, Beneficios, Banner de Anuncios y Footer.
 *
 * Los testimonios son la excepcion: ya no se escriben aqui. Los redactan las
 * personas que usan la plataforma desde la propia portada y esta pestaña es su
 * cola de moderacion; lo unico que se decide es si se publican o no.
 */

import { useToastMessage } from '../lib/useToastMessage';
import { PageLoader } from './loading/PageLoader';
import React, { useState, useEffect, useRef, useDeferredValue } from 'react';
import { createPortal } from 'react-dom';
import {
  Layout,
  Sparkles,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  Eye,
  Star,
  StarHalf,
  Globe,
  Layers,
  Brain,
  Video,
  ShieldCheck,
  Award,
  Link2,
  Sliders,
  HelpCircle,
  RefreshCw,
  Image as ImageIcon,
  ArrowRight,
  Clock,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { avatarSrc } from '../lib/avatar.js';
import { api } from '../lib/api';
import { LandingConfig, LandingBenefit, ModeratedTestimonial, TestimonialStatus, Course } from '../types';
import { AdminSearchField } from './AdminListKit';
import { AdminSelect } from './AdminSelect';
import { safeLandingLink } from '../lib/safeUrl';
import { ConstellationHero } from '../experiences/constellation/ConstellationHero';
import { ConstellationCourseCatalog } from '../experiences/constellation/ConstellationCourseCatalog';
import { ConstellationPillars } from '../experiences/constellation/ConstellationPillars';
import { ConstellationTestimonials } from '../experiences/constellation/ConstellationTestimonials';
import { ConstellationFooter } from '../experiences/constellation/ConstellationFooter';
import { LandingConfigProvider, customLanding } from '../lib/landingConfig';
import { siteConfig } from '../config/theme';
import { useTranslation, Trans } from 'react-i18next'

interface LandingPageEditorProps {
  onSaved?: () => void;
  disableAnimation?: boolean;
  /** Dónde pintar Vista previa y Guardar: la fila del selector Portada | Escucha. Sin hueco, van arriba del editor. */
  actionsSlot?: HTMLElement | null;
}

/** Secciones reales de la portada pública: un enlace interno solo puede apuntar a una de ellas. */
const LANDING_SECTIONS = [
  { value: '#inicio', key: 'landingSectionTop', label: 'Inicio de la portada' },
  { value: '#cursos', key: 'landingSectionCourses', label: 'Catálogo de cursos' },
  { value: '#beneficios', key: 'landingSectionBenefits', label: 'Beneficios' },
  { value: '#testimonios', key: 'landingSectionTestimonials', label: 'Testimonios' },
];
/** Nombres antiguos que la portada ya sabe traducir a una sección. */
const LEGACY_LINKS: Record<string, string> = {
  '#courses': '#cursos', '/courses': '#cursos', '#catalogo': '#cursos', '#catalog': '#cursos',
  '#vip': '#cursos', '/vip': '#cursos', '#planes': '#cursos', '#pricing': '#cursos',
};
const sectionOf = (link: string) => {
  const value = link.trim().toLowerCase();
  const canonical = LEGACY_LINKS[value] ?? value;
  return LANDING_SECTIONS.find((section) => section.value === canonical)?.value ?? '';
};
const isLinkValid = (link: string) => link.trim() === '' || !!sectionOf(link) || !!safeLandingLink(link.trim());

/** Largos recomendados: pasarse no bloquea, pero la portada se ve peor. */
const TITLE_MAX = 70;
const SUBTITLE_MAX = 180;
const HERO_DEFAULTS = {
  heroTitle: 'Una nueva forma de aprender | con inteligencia artificial.',
  heroSubtitle: 'Supera los límites de la educación tradicional. DocentOS combina rutas de aprendizaje adaptativas, mentoría sintética 24/7 y evaluación cognitiva en tiempo real para acelerar tu dominio profesional.',
  heroCtaText: 'Explorar Catálogo de Cursos',
  heroCtaLink: '#cursos',
  heroSecondaryCtaText: 'Solicitar Admisión VIP',
  heroSecondaryCtaLink: '#cursos',
};

/** Valoración: solo números de 0 a 5 con un decimal. Se guarda como "4.9/5", que es lo que pinta la portada. */
const ratingNumber = (value: string) => value.replace('/5', '').trim();
const parseRating = (value: string) => { const n = parseFloat(ratingNumber(value)); return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : 0; };
const sanitizeRating = (raw: string) => {
  const [whole, ...rest] = raw.replace(',', '.').replace(/[^0-9.]/g, '').split('.');
  let out = whole.slice(0, 1);
  if (rest.length) out += '.' + rest.join('').slice(0, 1);
  return parseFloat(out) > 5 ? '5' : out;
};
const starState = (rating: number, index: number) => (rating >= index + 0.75 ? 'full' : rating >= index + 0.25 ? 'half' : 'empty');
/** Estudiantes activos: solo dígitos, con separador de miles. */
const audienceDigits = (value: string) => value.replace(/\D/g, '');
const formatAudience = (digits: string) => (digits ? Number(digits).toLocaleString('en-US') : '');

const StarsRow: React.FC<{ rating: number }> = ({ rating }) => (
  <>
    {[0, 1, 2, 3, 4].map((i) => {
      const state = starState(rating, i);
      return state === 'half' ? <StarHalf key={i} data-state="half" aria-hidden="true" /> : <Star key={i} data-state={state} aria-hidden="true" />;
    })}
  </>
);

const BENEFIT_ICONS: Array<{ value: string; Icon: React.ElementType; key: string; label: string }> = [
  { value: 'Brain', Icon: Brain, key: 'brainIa', label: 'IA' },
  { value: 'Video', Icon: Video, key: 'videoDrive', label: 'Video' },
  { value: 'ShieldCheck', Icon: ShieldCheck, key: 'shieldcheckRoles', label: 'Seguridad' },
  { value: 'Layers', Icon: Layers, key: 'layersPlugins', label: 'Plugins' },
  { value: 'Award', Icon: Award, key: 'awardCertificados', label: 'Certificados' },
  { value: 'Sparkles', Icon: Sparkles, key: 'sparklesGamificacion', label: 'Gamificación' },
];
const BENEFIT_TITLE_MAX = 60;
const BENEFIT_TEXT_MAX = 160;
const move = <T,>(items: T[], index: number, direction: -1 | 1): T[] => {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

/** Ancho de escritorio con el que se pinta la portada dentro de la vista previa; se reduce para que quepa. */
const PREVIEW_WIDTH = 1280;
const noop = () => {};

interface LandingLivePreviewProps { config: LandingConfig; courses: Course[]; activeTab: string; onPick: (section: string) => void }

/** La portada pública completa, con el borrador actual. Un clic en una sección lleva a su pestaña. */
const LandingLivePreview: React.FC<LandingLivePreviewProps> = ({ config, courses, activeTab, onPick }) => {
  const { t } = useTranslation();
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.35);
  const draft = useDeferredValue(config);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setScale(Math.max(0.2, box.clientWidth / PREVIEW_WIDTH));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // Marca la sección que se está editando.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    box.querySelectorAll('[data-editing]').forEach((node) => node.removeAttribute('data-editing'));
    box.querySelectorAll(`[data-landing-section="${activeTab}"]`).forEach((node) => node.setAttribute('data-editing', ''));
  });

  // Al cambiar de pestaña, la vista previa se desplaza a esa sección.
  useEffect(() => {
    const box = boxRef.current;
    const target = box?.querySelector<HTMLElement>(`[data-landing-section="${activeTab}"]`);
    if (!box || !target) return;
    const top = target.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 12;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    box.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
  }, [activeTab]);

  const handleClick = (event: React.MouseEvent) => {
    // Es una vista previa: ningún enlace ni botón de la portada hace nada.
    event.preventDefault();
    event.stopPropagation();
    const section = (event.target as HTMLElement).closest('[data-landing-section]')?.getAttribute('data-landing-section');
    if (section) onPick(section);
  };

  return (
    <aside className="landing-live" aria-label={t('landingLiveTitle', 'Vista previa de la portada')}>
      <div className="landing-live__head">
        <p>{t('landingLiveTitle', 'Vista previa de la portada')}</p>
        <span>{t('landingLiveHint', 'Haz clic en una sección para editarla')}</span>
      </div>
      <div className="landing-live__box" ref={boxRef} onClickCapture={handleClick}>
        <div className="landing-live__page" style={{ width: PREVIEW_WIDTH, zoom: scale }}>
          <LandingConfigProvider value={draft}>
            <div className="academy-experience landing-live__home">
              <div data-landing-section="hero"><ConstellationHero currentUser={null} showInlineBrand={false} onExploreCourses={noop} onOpenSearch={noop} totalCoursesCount={courses.length} /></div>
              <div data-landing-section="courses"><ConstellationCourseCatalog featuredOnly onBrowseCatalog={noop} courses={courses} onSelectCourse={noop} onPrefetchCourse={noop} /></div>
              <div data-landing-section="benefits"><ConstellationPillars /></div>
              <div data-landing-section="testimonials"><ConstellationTestimonials currentUser={null} onOpenAuth={noop} /></div>
              <div data-landing-section="footer"><ConstellationFooter /></div>
            </div>
          </LandingConfigProvider>
        </div>
      </div>
    </aside>
  );
};

interface LandingLinkFieldProps { id: string; label: string; value: string; onChange: (value: string) => void }

/** Destino de un botón: una sección de la portada o una dirección externa, nunca texto suelto. */
const LandingLinkField: React.FC<LandingLinkFieldProps> = ({ id, label, value, onChange }) => {
  const { t } = useTranslation();
  const [forceExternal, setForceExternal] = useState(false);
  const section = sectionOf(value);
  const external = forceExternal || (value.trim() !== '' && !section);
  const valid = isLinkValid(value);
  return (
    <div className="meeting-field">
      <label htmlFor={id}>{label}</label>
      <AdminSelect
        id={id}
        value={external ? '__external' : section || '#cursos'}
        onChange={(next) => {
          if (next === '__external') { setForceExternal(true); if (section || !value.trim()) onChange('https://'); }
          else { setForceExternal(false); onChange(next); }
        }}
        options={[
          ...LANDING_SECTIONS.map((item) => ({ value: item.value, label: t(item.key, item.label) })),
          { value: '__external', label: t('landingLinkExternal', 'Enlace a otro sitio') },
        ]}
      />
      {external && (
        <>
          <input type="text" inputMode="url" aria-label={label} aria-invalid={!valid} placeholder="https://" value={value} onChange={(e) => onChange(e.target.value)} />
          {!valid && <p className="landing-hint" data-error role="alert">{t('landingLinkInvalid', 'Escribe una dirección que empiece por https://')}</p>}
        </>
      )}
    </div>
  );
};

export const LandingPageEditor: React.FC<LandingPageEditorProps> = ({ onSaved, disableAnimation = false, actionsSlot = null }) => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'hero' | 'courses' | 'benefits' | 'testimonials' | 'footer'>('hero');

  // Cola de moderacion de testimonios. Vive fuera de `config` a proposito: no
  // se guarda con el boton de la portada, cada decision se aplica al momento.
  const [testimonials, setTestimonials] = useState<ModeratedTestimonial[]>([]);
  const [testimonialFilter, setTestimonialFilter] = useState<TestimonialStatus | 'ALL'>('PENDING');
  const [loadingTestimonials, setLoadingTestimonials] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  useToastMessage(successMsg, 'success');
  useToastMessage(errorMsg, 'error');

  // Course selector state
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);


  const [courseSearch, setCourseSearch] = useState('');

  // Form State
  const [config, setConfig] = useState<LandingConfig>({
    heroTitle: t('unaNuevaFormaDeAprenderConInteligencia', 'Una nueva forma de aprender | con inteligencia artificial.'),
    heroSubtitle: t('superaLosLimitesDeLaEducacionTradicional', 'Supera los límites de la educación tradicional. DocentOS combina rutas de aprendizaje adaptativas, mentoría sintética 24/7 y evaluación cognitiva en tiempo real para acelerar tu dominio profesional.'),
    heroMediaUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop',
    heroCtaText: 'Explorar Cursos',
    heroCtaLink: '#courses',
    heroSecondaryCtaText: 'Pase Mentee',
    heroSecondaryCtaLink: '#vip',
    featuredCourseIds: ['course-giantucchi-mastery'],
    bannerEnabled: true,
    bannerText: t('motorDeIaOptimizadoGestionDeGuiasVocales', '🚀 Motor de IA optimizado, gestión de guías vocales e integración nativa con Google Drive.'),
    bannerLinkText: 'Ver Novedades',
    trustRating: '4.9/5',
    trustAudience: '+12,500',
    bannerLinkUrl: '#',
    benefits: [],
    testimonials: [],
    footerText: t('createdAndMaintainedByGiantucchiJoseLuis', 'Created and maintained by Giantucchi (Jose Luis Hernandez Hernandez)'),
    githubUrl: 'https://github.com/giantucchi/docentos',
    discordUrl: '',
    twitterUrl: '',
    linkedinUrl: '',
  });


  useEffect(() => {
    loadData();
  }, []);

  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const discardDialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = discardDialogRef.current;
    if (!dialog) return;
    if (confirmDiscard && !dialog.open) dialog.showModal();
    if (!confirmDiscard && dialog.open) dialog.close();
  }, [confirmDiscard]);
  const discardChanges = () => {
    try { setConfig(JSON.parse(savedSnapshot)); } catch { /* sin copia guardada: no hay nada que restaurar */ }
    setErrorMsg('');
    setConfirmDiscard(false);
  };

  // Lo último que está guardado en el servidor: sirve para saber si hay cambios sin guardar.
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const titleLength = config.heroTitle.replace('|', '').length;
  const dirty = savedSnapshot !== '' && JSON.stringify(config) !== savedSnapshot;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /** Lo que el inicio muestra hoy: los valores de fábrica se sustituyen por esos textos para editar sobre lo real. */
  const currentHomeCopy = () => ({
    heroTitle: t('hero.title', 'Dale dirección a tu aprendizaje.'),
    heroSubtitle: t('hero.subtitle', 'Elige una especialización, estudia por módulos y encuentra los recursos que necesitas para seguir avanzando.'),
    heroCtaText: t('hero.exploreCourses', 'Explorar cursos'),
    heroCtaLink: '#cursos',
    footerText: siteConfig.authorCredit || t('docentosCommunityEdition', 'DocentOS Community Edition'),
    githubUrl: siteConfig.poweredByLink || 'https://github.com/datasch/Docentos',
    benefits: [
      { id: 'b1', icon: 'Video', title: t('pillars.item1Title', 'Estudia por módulos'), description: t('pillars.item1Desc', 'Videos y recursos organizados para que encuentres cada parte de tu curso.') },
      { id: 'b2', icon: 'Brain', title: t('pillars.item2Title', 'Apoyo durante el estudio'), description: t('pillars.item2Desc', 'Consulta el asistente y las guías de voz disponibles en la plataforma.') },
      { id: 'b3', icon: 'ShieldCheck', title: t('pillars.item3Title', 'Tu acceso, en un solo lugar'), description: t('pillars.item3Desc', 'Encuentra los cursos que tienes asignados y accede a su contenido desde tu cuenta.') },
      { id: 'b4', icon: 'Layers', title: t('pillars.item4Title', 'Recursos para avanzar'), description: t('pillars.item4Desc', 'Consulta los materiales y las evaluaciones que incorpora cada curso.') },
    ],
  });
  const withCurrentCopy = (saved: LandingConfig): LandingConfig => {
    const mine = customLanding(saved);
    const home = currentHomeCopy();
    return {
      ...saved,
      heroTitle: mine.heroTitle ?? home.heroTitle,
      heroSubtitle: mine.heroSubtitle ?? home.heroSubtitle,
      heroCtaText: mine.heroCtaText ?? home.heroCtaText,
      heroCtaLink: mine.heroCtaLink ?? home.heroCtaLink,
      benefits: mine.benefits ?? home.benefits,
      footerText: mine.footerText ?? home.footerText,
      githubUrl: mine.githubUrl ?? home.githubUrl,
    };
  };
  const restoreHeroDefaults = () => setConfig((current) => { const home = currentHomeCopy(); return { ...current, heroTitle: home.heroTitle, heroSubtitle: home.heroSubtitle, heroCtaText: home.heroCtaText, heroCtaLink: home.heroCtaLink }; });

  const loadData = async () => {
    setLoading(true);
    try {
      const [configRes, coursesRes] = await Promise.all([
        api.getLandingConfig(),
        api.getCourses(),
      ]);

      if (configRes.config) {
        const shown = withCurrentCopy(configRes.config);
        setConfig(shown);
        setSavedSnapshot(JSON.stringify(shown));
      } else {
        setSavedSnapshot((current) => current || '__none__');
      }
      if (coursesRes.courses) {
        setAvailableCourses(coursesRes.courses);
      }
    } catch (err: any) {
      console.error('Error loading landing config or courses:', err);
      setErrorMsg(t('noSePudoCargarLaConfiguracionDeLaPortada', 'No se pudo cargar la configuración de la portada.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isLinkValid(config.heroCtaLink) || !isLinkValid(config.heroSecondaryCtaLink)) {
      setActiveTab('hero');
      setErrorMsg(t('landingLinksToFix', 'Revisa los enlaces de los botones: hay una dirección que no es válida.'));
      return;
    }
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await api.updateLandingConfig(config);
      if (res.success) {
        setSavedSnapshot(JSON.stringify(config));
        setSuccessMsg(t('configuracionDeLaPortadaGuardadaConExito', '¡Configuración de la portada guardada con éxito!'));
        if (onSaved) onSaved();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      console.error('Error saving landing config:', err);
      setErrorMsg(err.message || t('errorAlGuardarLaConfiguracion', 'Error al guardar la configuración.'));
    } finally {
      setSaving(false);
    }
  };

  // Featured Courses Helpers
  const toggleFeaturedCourse = (courseId: string) => {
    const current = [...config.featuredCourseIds];
    const index = current.indexOf(courseId);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(courseId);
    }
    setConfig({ ...config, featuredCourseIds: current });
  };

  // Benefits Handlers
  const addBenefit = () => {
    const newB: LandingBenefit = {
      id: `b-${Date.now()}`,
      icon: 'Brain',
      title: t('nuevoBeneficio', 'Nuevo Beneficio'),
      description: t('escribeAquiLaDescripcionDetalladaDel', 'Escribe aquí la descripción detallada del beneficio.'),
    };
    setConfig({ ...config, benefits: [...config.benefits, newB] });
  };

  const updateBenefit = (id: string, field: keyof LandingBenefit, val: string) => {
    const updated = config.benefits.map((b) => (b.id === id ? { ...b, [field]: val } : b));
    setConfig({ ...config, benefits: updated });
  };

  const deleteBenefit = (id: string) => {
    setConfig({ ...config, benefits: config.benefits.filter((b) => b.id !== id) });
  };

  // Moderacion de testimonios
  const loadTestimonials = async (filter: TestimonialStatus | 'ALL') => {
    setLoadingTestimonials(true);
    try {
      const res = await api.getTestimonialsForModeration(filter === 'ALL' ? undefined : filter);
      setTestimonials(res.testimonials || []);
    } catch (err: any) {
      setErrorMsg(err?.message || t('noSePudieronCargarLosTestimonios', 'No se pudieron cargar los testimonios'));
    } finally {
      setLoadingTestimonials(false);
    }
  };

  // Solo se pide la lista al abrir la pestaña: el resto del editor no la usa.
  useEffect(() => {
    if (activeTab === 'testimonials') {
      loadTestimonials(testimonialFilter);
    }
  }, [activeTab, testimonialFilter]);

  /** Aprobar o rechazar. Se recarga para que la ficha salga del filtro actual. */
  const moderateTestimonial = async (id: string, status: TestimonialStatus) => {
    try {
      await api.moderateTestimonial(id, status);
      setSuccessMsg(status === 'APPROVED' ? t('testimonioPublicado', 'Testimonio publicado') : t('testimonioRetiradoDeLaPortada', 'Testimonio retirado de la portada'));
      setTimeout(() => setSuccessMsg(''), 2500);
      await loadTestimonials(testimonialFilter);
      onSaved?.();
    } catch (err: any) {
      setErrorMsg(err?.message || t('noSePudoModerarElTestimonio', 'No se pudo moderar el testimonio'));
    }
  };

  /** Borrar de verdad. Rechazar basta para que no se vea; borrar es permanente y pide confirmación. */
  const [testimonialToDelete, setTestimonialToDelete] = useState<ModeratedTestimonial | null>(null);
  const [deletingTestimonial, setDeletingTestimonial] = useState(false);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (testimonialToDelete && !dialog.open) dialog.showModal();
    if (!testimonialToDelete && dialog.open) dialog.close();
  }, [testimonialToDelete]);
  const removeTestimonial = async () => {
    if (!testimonialToDelete || deletingTestimonial) return;
    setDeletingTestimonial(true);
    try {
      await api.deleteTestimonial(testimonialToDelete.id);
      setTestimonialToDelete(null);
      await loadTestimonials(testimonialFilter);
      onSaved?.();
    } catch (err: any) {
      setTestimonialToDelete(null);
      setErrorMsg(err?.message || t('noSePudoEliminarElTestimonio', 'No se pudo eliminar el testimonio'));
    } finally {
      setDeletingTestimonial(false);
    }
  };

  if (loading) {
    return (
      <div data-mentor-ui="modern" className="admin-courses-root">
        <PageLoader label={t('cargandoCmsGestorDePortada', 'Cargando la portada…')} />
      </div>
    );
  }

  const filteredCourses = availableCourses.filter(
    (c) =>
      c.title.toLowerCase().includes(courseSearch.toLowerCase()) ||
      c.category.toLowerCase().includes(courseSearch.toLowerCase())
  );

  const actions = (
    <>
      <span className="landing-status" data-dirty={dirty || undefined} role="status">
        {dirty ? t('landingUnsaved', 'Cambios sin guardar') : t('landingSaved', 'Todo guardado')}
      </span>
      {dirty && (
        <button type="button" className="mentor-course-control" onClick={() => setConfirmDiscard(true)} disabled={saving}>
          {t('landingDiscard', 'Descartar cambios')}
        </button>
      )}
      <button type="button" className="mentor-course-control admin-primary-action" onClick={() => handleSave()} disabled={saving || !dirty}>
        {saving ? <RefreshCw className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
        <span>{t('guardarCambiosCapital', 'Guardar Cambios')}</span>
      </button>
    </>
  );

  return (
    <div data-mentor-ui="modern" className={`admin-courses-root landing-editor ${disableAnimation ? '' : 'animate-fade-in'}`}>
      {actionsSlot ? createPortal(actions, actionsSlot) : <div className="landing-editor__actions">{actions}</div>}


      <div className="landing-workspace">
      <div className="landing-main">
      {/* Secciones de la portada */}
      <div className="landing-tabs" role="tablist" aria-label={t('seccionesDeLaPortada', 'Secciones de la portada')}>
        {([
          { key: 'hero', label: t('landingTabMain', 'Principal') },
          { key: 'courses', label: t('landingTabCourses', 'Cursos'), count: config.featuredCourseIds.length },
          { key: 'benefits', label: t('beneficios', 'Beneficios'), count: config.benefits.length },
          { key: 'testimonials', label: t('testimonios', 'Testimonios') },
          { key: 'footer', label: t('landingTabFooter', 'Pie de página') },
        ] as const).map((tab) => (
          <button key={tab.key} type="button" role="tab" aria-selected={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
            {'count' in tab && <span>({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* TAB 1: PRINCIPAL. Solo lo que el inicio muestra de verdad. */}
      {activeTab === 'hero' && (
        <div className="landing-hero">
          <form onSubmit={handleSave} className="landing-form">
            <fieldset className="landing-group">
              <legend>{t('landingGroupHeadline', 'Titular')}</legend>
              <div className="meeting-field">
                <label htmlFor="landing-hero-title">{t('tituloPrincipalDePortada', 'Título Principal de Portada')}</label>
                <input id="landing-hero-title" type="text" required maxLength={140} value={config.heroTitle} onChange={(e) => setConfig({ ...config, heroTitle: e.target.value })} />
                <p className="landing-count" data-over={titleLength > TITLE_MAX || undefined} aria-live="polite">{titleLength} / {TITLE_MAX}{titleLength > TITLE_MAX ? ` · ${t('landingTooLong', 'Más largo de lo recomendado')}` : ''}</p>
              </div>
              <div className="meeting-field">
                <label htmlFor="landing-hero-subtitle">{t('subtituloDescripcion', 'Subtítulo / Descripción')}</label>
                <textarea id="landing-hero-subtitle" rows={3} required maxLength={320} value={config.heroSubtitle} onChange={(e) => setConfig({ ...config, heroSubtitle: e.target.value })} />
                <p className="landing-count" data-over={config.heroSubtitle.length > SUBTITLE_MAX || undefined} aria-live="polite">{config.heroSubtitle.length} / {SUBTITLE_MAX}{config.heroSubtitle.length > SUBTITLE_MAX ? ` · ${t('landingTooLong', 'Más largo de lo recomendado')}` : ''}</p>
              </div>
            </fieldset>

            <fieldset className="landing-group">
              <legend>{t('landingGroupButton', 'Botón principal')}</legend>
              <div className="landing-grid">
                <div className="meeting-field">
                  <label htmlFor="landing-cta-text">{t('textoBotonCtaPrincipal', 'Texto Botón CTA Principal')}</label>
                  <input id="landing-cta-text" type="text" maxLength={40} value={config.heroCtaText} onChange={(e) => setConfig({ ...config, heroCtaText: e.target.value })} />
                </div>
                <LandingLinkField id="landing-cta-link" label={t('enlaceBotonCtaPrincipal', 'Enlace Botón CTA Principal')} value={config.heroCtaLink} onChange={(value) => setConfig({ ...config, heroCtaLink: value })} />
              </div>
              <p className="landing-hint">{t('landingButtonHint', 'El botón «Buscar una lección» y el número de cursos del catálogo no se editan: se calculan solos.')}</p>
            </fieldset>
            <button type="button" className="landing-restore" onClick={restoreHeroDefaults}>{t('landingRestore', 'Restaurar los textos originales')}</button>
          </form>
        </div>
      )}

      {/* TAB 2: PROGRAMA DESTACADO. El inicio muestra uno solo. */}
      {activeTab === 'courses' && (() => {
        const featuredId = config.featuredCourseIds[0];
        const featured = availableCourses.find((item) => item.id === featuredId);
        const candidates = filteredCourses.filter((item) => item.id !== featuredId);
        return (
          <div className="landing-courses">
            <section className="landing-group" aria-labelledby="landing-featured-title">
              <h3 id="landing-featured-title">{t('landingFeaturedProgram', 'Programa destacado')}</h3>
              <p className="landing-hint">{t('landingFeaturedHint', 'El inicio destaca un solo programa, justo debajo del titular. Elige cuál.')}</p>
              {featured ? (
                <div className="landing-course">
                  <img src={featured.coverImage} alt="" />
                  <div className="landing-course__text"><strong>{featured.title}</strong><span>{featured.category}</span></div>
                  <div className="landing-course__actions">
                    <button type="button" className="mentor-course-control" onClick={() => setConfig({ ...config, featuredCourseIds: [] })}>{t('landingUnfeature', 'Quitar')}</button>
                  </div>
                </div>
              ) : (
                <p className="landing-empty">{t('landingFeaturedEmpty', 'No elegiste ninguno: el inicio destaca el primer curso del catálogo.')}</p>
              )}
            </section>

            <section className="landing-group" aria-labelledby="landing-available-title">
              <div className="landing-group__head">
                <h3 id="landing-available-title">{t('landingAvailable', 'Cursos disponibles')}</h3>
                <AdminSearchField className="landing-featured-search" value={courseSearch} onChange={setCourseSearch} placeholder={t('buscarCursos', 'Buscar cursos...')} label={t('buscarCursos', 'Buscar cursos...')} />
              </div>
              {candidates.length === 0 ? (
                <p className="landing-empty">{t('landingNoResults', 'Ningún curso coincide con la búsqueda.')}</p>
              ) : (
                <ul className="landing-courselist">
                  {candidates.map((course) => (
                    <li key={course.id} className="landing-course">
                      <img src={course.coverImage} alt="" />
                      <div className="landing-course__text"><strong>{course.title}</strong><span>{course.category}</span></div>
                      <div className="landing-course__actions">
                        <button type="button" className="mentor-course-control" onClick={() => setConfig({ ...config, featuredCourseIds: [course.id] })}>{t('landingFeature', 'Elegir')}</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        );
      })()}

      {/* TAB 3: BENEFICIOS, con vista previa viva */}
      {activeTab === 'benefits' && (
        <div className="landing-hero">
          <div className="landing-form">
            <p className="landing-hint">{t('landingBenefitsHint', 'Entre 3 y 6 beneficios se leen mejor. Cada uno lleva un icono, un título corto y una frase.')}</p>
            {config.benefits.length === 0 && <p className="landing-empty">{t('landingBenefitsEmpty', 'Todavía no hay beneficios. Añade el primero.')}</p>}
            {config.benefits.map((b, index) => (
              <fieldset key={b.id} className="landing-group landing-benefit">
                <legend>{t('landingBenefitN', 'Beneficio {{n}}', { n: index + 1 })}</legend>
                <div className="landing-benefit__bar">
                  <div className="landing-icons" role="group" aria-label={t('icono', 'Icono:')}>
                    {BENEFIT_ICONS.map(({ value, Icon, key, label }) => (
                      <button key={value} type="button" aria-pressed={b.icon === value} title={t(key, label)} aria-label={t(key, label)} onClick={() => updateBenefit(b.id, 'icon', value)}>
                        <Icon aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                  <div className="landing-course__actions">
                    <button type="button" className="landing-iconbtn" onClick={() => setConfig({ ...config, benefits: move(config.benefits, index, -1) })} disabled={index === 0} aria-label={`${t('landingMoveUp', 'Subir')}: ${b.title}`}><ChevronUp aria-hidden="true" /></button>
                    <button type="button" className="landing-iconbtn" onClick={() => setConfig({ ...config, benefits: move(config.benefits, index, 1) })} disabled={index === config.benefits.length - 1} aria-label={`${t('landingMoveDown', 'Bajar')}: ${b.title}`}><ChevronDown aria-hidden="true" /></button>
                    <button type="button" className="landing-iconbtn" data-danger="true" onClick={() => deleteBenefit(b.id)} aria-label={`${t('eliminarBeneficio', 'Eliminar beneficio')}: ${b.title}`}><Trash2 aria-hidden="true" /></button>
                  </div>
                </div>
                <div className="meeting-field">
                  <label htmlFor={`benefit-title-${b.id}`}>{t('tituloDelBeneficio', 'Título del Beneficio')}</label>
                  <input id={`benefit-title-${b.id}`} type="text" maxLength={90} value={b.title} onChange={(e) => updateBenefit(b.id, 'title', e.target.value)} />
                  <p className="landing-count" data-over={b.title.length > BENEFIT_TITLE_MAX || undefined} aria-live="polite">{b.title.length} / {BENEFIT_TITLE_MAX}</p>
                </div>
                <div className="meeting-field">
                  <label htmlFor={`benefit-text-${b.id}`}>{t('descripcion', 'Descripción')}</label>
                  <textarea id={`benefit-text-${b.id}`} rows={2} maxLength={240} value={b.description} onChange={(e) => updateBenefit(b.id, 'description', e.target.value)} />
                  <p className="landing-count" data-over={b.description.length > BENEFIT_TEXT_MAX || undefined} aria-live="polite">{b.description.length} / {BENEFIT_TEXT_MAX}</p>
                </div>
              </fieldset>
            ))}
            <button type="button" className="mentor-course-control landing-add" onClick={addBenefit}><Plus aria-hidden="true" />{t('agregarBeneficio', 'Agregar Beneficio')}</button>
          </div>

        </div>
      )}

      {/* TAB 4: MODERACION DE TESTIMONIOS */}
      {activeTab === 'testimonials' && (
        <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-6 shadow-xl space-y-6">
          <p className="landing-hint" role="note">{t('landingTestimonialsLive', 'Aquí las decisiones se aplican al momento: no necesitas pulsar «Guardar Cambios».')}</p>
          <div className="border-b border-[#2d2d44] pb-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-[var(--color-brand-cyan)]" />
              {t('testimoniosDeLaPortada', 'Testimonios de la portada')}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {t('losEscribenLasPersonasUsuariasDesdeLa', 'Los escriben las personas usuarias desde la portada. Aquí solo decides cuáles se publican: el texto es suyo y no se edita.')}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {([
              { key: 'PENDING', label: t('pendientes', 'Pendientes') },
              { key: 'APPROVED', label: t('publicados', 'Publicados') },
              { key: 'REJECTED', label: t('rechazados', 'Rechazados') },
              { key: 'ALL', label: t('todos', 'Todos') },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTestimonialFilter(tab.key)}
                className="landing-filter" aria-pressed={testimonialFilter === tab.key}
              >
                {tab.label}
              </button>
            ))}

            <button
              onClick={() => loadTestimonials(testimonialFilter)}
              className="ml-auto p-2 text-slate-400 hover:text-white rounded-lg hover:bg-[#1a1a2e]"
              title={t('actualizarLista', 'Actualizar lista')}
            >
              <RefreshCw className={`w-4 h-4 ${loadingTestimonials ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {testimonials.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-10">
              {loadingTestimonials
                ? t('cargandoPuntos', 'Cargando…')
                : testimonialFilter === 'PENDING'
                  ? t('noHayOpinionesEsperandoRevision', 'No hay opiniones esperando revisión.')
                  : t('noHayTestimoniosEnEsteEstado', 'No hay testimonios en este estado.')}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {testimonials.map((testimonial) => (
                <div key={testimonial.id} className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={avatarSrc(testimonial.avatarUrl)}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover ring-1 ring-[#2d2d44] flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{testimonial.name}</p>
                        <p className="text-[10px] font-semibold text-[var(--color-brand-cyan)]">{testimonial.role}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[var(--color-brand-cyan)] flex-shrink-0">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5" fill="currentColor" />
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed italic">“{testimonial.comment}”</p>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#2d2d44]">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${testimonial.status === 'APPROVED'
                          ? 'text-success-light'
                          : testimonial.status === 'REJECTED'
                            ? 'text-danger-light'
                            : 'text-warning-light'
                        }`}
                    >
                      {testimonial.status === 'APPROVED' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : testimonial.status === 'REJECTED' ? (
                        <X className="w-3.5 h-3.5" />
                      ) : (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                      {testimonial.status === 'APPROVED' ? t('publicado', 'Publicado') : testimonial.status === 'REJECTED' ? t('rechazado', 'Rechazado') : t('pendienteCapital', 'Pendiente')}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {testimonial.status !== 'APPROVED' && (
                        <button
                          onClick={() => moderateTestimonial(testimonial.id, 'APPROVED')}
                          className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-success-light font-bold rounded-lg text-[11px]"
                        >
                          {t('publicar', 'Publicar')}
                        </button>
                      )}
                      {testimonial.status !== 'REJECTED' && (
                        <button
                          onClick={() => moderateTestimonial(testimonial.id, 'REJECTED')}
                          className="px-3 py-1.5 bg-[#141420] hover:bg-[#0a0a0f] text-slate-300 font-bold rounded-lg text-[11px]"
                        >
                          {testimonial.status === 'APPROVED' ? t('retirar', 'Retirar') : t('rechazar', 'Rechazar')}
                        </button>
                      )}
                      <button
                        onClick={() => setTestimonialToDelete(testimonial)}
                        className="p-1.5 text-slate-500 hover:text-danger-light rounded-lg hover:bg-[#141420]"
                        title={t('eliminarDefinitivamente', 'Eliminar definitivamente')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: BANNER PROMO & FOOTER */}
      {activeTab === 'footer' && (
        <form onSubmit={handleSave} className="bg-[#141420] border border-[#2d2d44] rounded-xl p-6 shadow-xl space-y-6">
          <div className="border-b border-[#2d2d44] pb-3">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-[var(--color-brand-cyan)]" />
              {t('enlacesDelPieDePagina', 'Pie de página y redes')}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {t('configuraElTextoYLosEnlacesDelPie', 'Texto del pie de página y enlaces a redes sociales.')}
            </p>
          </div>

          {/* Footer Texts & Links */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                {t('textoPrincipalDelFooter', 'Texto Principal del Footer')}
              </label>
              <input
                type="text"
                value={config.footerText}
                onChange={(e) => setConfig({ ...config, footerText: e.target.value })}
                className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-3 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  {t('githubRepositoryUrl', 'GitHub Repository URL')}
                </label>
                <input
                  type="url"
                  value={config.githubUrl}
                  onChange={(e) => setConfig({ ...config, githubUrl: e.target.value })}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-2.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  {t('linkedinUrl', 'LinkedIn URL')}
                </label>
                <input
                  type="url"
                  value={config.linkedinUrl}
                  onChange={(e) => setConfig({ ...config, linkedinUrl: e.target.value })}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-2.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  {t('discordCommunityUrl', 'Discord Community URL')}
                </label>
                <input
                  type="url"
                  value={config.discordUrl}
                  onChange={(e) => setConfig({ ...config, discordUrl: e.target.value })}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-2.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  {t('twitterXUrl', 'Twitter / X URL')}
                </label>
                <input
                  type="url"
                  value={config.twitterUrl}
                  onChange={(e) => setConfig({ ...config, twitterUrl: e.target.value })}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-2.5 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>

        </form>
      )}

      </div>
      <LandingLivePreview config={config} courses={availableCourses} activeTab={activeTab} onPick={(section) => setActiveTab(section as typeof activeTab)} />
      </div>

      <dialog
        ref={discardDialogRef}
        className="mentor-confirm"
        aria-labelledby="landing-discard-title"
        onCancel={(event) => { event.preventDefault(); setConfirmDiscard(false); }}
        onClick={(event) => { if (event.target === event.currentTarget) setConfirmDiscard(false); }}
      >
        {confirmDiscard && (
          <div className="mentor-confirm__body">
            <h3 id="landing-discard-title">{t('landingDiscard', 'Descartar cambios')}</h3>
            <p>{t('landingDiscardBody', 'Se perderán los cambios que no has guardado. Esta acción es')} <strong className="mentor-confirm__permanent">{t('landingPermanent', 'permanente')}</strong>.</p>
            <div className="mentor-confirm__actions">
              <button type="button" className="mentor-course-control" onClick={() => setConfirmDiscard(false)}>{t('landingKeepEditing', 'Seguir editando')}</button>
              <button type="button" className="mentor-course-control" data-danger="true" onClick={discardChanges}>{t('landingDiscard', 'Descartar cambios')}</button>
            </div>
          </div>
        )}
      </dialog>

      <dialog
        ref={deleteDialogRef}
        className="mentor-confirm"
        aria-labelledby="landing-testimonial-delete-title"
        onCancel={(event) => { event.preventDefault(); if (!deletingTestimonial) setTestimonialToDelete(null); }}
        onClick={(event) => { if (event.target === event.currentTarget && !deletingTestimonial) setTestimonialToDelete(null); }}
      >
        {testimonialToDelete && (
          <div className="mentor-confirm__body">
            <h3 id="landing-testimonial-delete-title">{t('eliminarOpinion', 'Eliminar opinión')}</h3>
            <p>
              {t('seBorraraLaOpinionDe', 'Se borrará la opinión de')} <strong>{testimonialToDelete.name || t('estaPersona', 'esta persona')}</strong><Trans i18nKey="estaAccionEsPermanente">. Esta acción es <strong className="mentor-confirm__permanent">permanente</strong>.</Trans>
            </p>
            <div className="mentor-confirm__actions">
              <button type="button" className="mentor-course-control" onClick={() => setTestimonialToDelete(null)} disabled={deletingTestimonial}>{t('cancelar', 'Cancelar')}</button>
              <button type="button" className="mentor-course-control" data-danger="true" onClick={removeTestimonial} disabled={deletingTestimonial} aria-busy={deletingTestimonial}>
                {deletingTestimonial ? <RefreshCw className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
                {t('eliminarOpinion', 'Eliminar opinión')}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
};