/**
 * Portada publica de DocentOS.
 *
 * La misma pagina sirve dos estados: al visitante le presenta la plataforma y
 * le ofrece entrar o registrarse; al alumno con sesion abierta le da la
 * bienvenida por su nombre y le devuelve a su catalogo. Todo el contenido sale
 * de `GET /api/public/landing-config` con respaldo local, y la piel visual vive
 * en `src/styles/landing.css` bajo el prefijo `lp-`.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Sparkles,
  BookOpen,
  Award,
  Video,
  Users,
  ShieldCheck,
  CheckCircle2,
  Github,
  Linkedin,
  Twitter,
  Layers,
  ChevronRight,
  Star,
  Play,
  PlayCircle,
  MessageCircle,
  Brain,
  Zap,
  Rocket,
  GraduationCap,
  Crown,
  Clock,
} from 'lucide-react';
import { avatarSrc } from '../lib/avatar.js';
import { useTranslation } from 'react-i18next';
import { Course, LandingConfig, LandingTestimonial, ModeratedTestimonial } from '../types';
import { api } from '../lib/api';
import { DOCENTOS_VERSION } from '../version';
import { PublicNavbar, PublicNavLink } from './PublicNavbar';
import { siteConfig } from '../config/theme';

interface LandingPageProps {
  courses: Course[];
  onOpenAuth: (mode: 'login' | 'register') => void;
  onExploreCourse: (course: Course) => void;
  /** Sesion activa: la portada la refleja en vez de ofrecer iniciar sesion. */
  currentUser?: { name: string; role: string; avatarUrl?: string } | null;
  onGoToApp?: () => void;
  onLogout?: () => void;
}

/** Caras de la barra de prueba social. Ilustrativas, como el resto del demo. */
const TRUST_FACES = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
];

const DEFAULT_LANDING_CONFIG: LandingConfig = {
  heroTitle: 'Una nueva forma de aprender | con inteligencia artificial.',
  heroSubtitle:
    'Supera los límites de la educación tradicional. DocentOS combina rutas de aprendizaje adaptativas, mentoría sintética 24/7 y evaluación cognitiva en tiempo real para acelerar tu dominio profesional.',
  heroMediaUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop',
  heroCtaText: 'Explorar Catálogo de Cursos',
  heroCtaLink: '#cursos',
  heroSecondaryCtaText: 'Solicitar Admisión VIP',
  heroSecondaryCtaLink: '#planes',
  featuredCourseIds: ['course-giantucchi-mastery'],
  bannerEnabled: true,
  bannerText: '🚀 Motor de IA optimizado, gestión de guías vocales e integración nativa con Google Drive.',
  bannerLinkText: 'Ver Novedades',
  trustRating: '4.9/5',
  trustAudience: '+12,500',
  bannerLinkUrl: '#metodologia',
  benefits: [
    {
      id: 'b1',
      icon: 'Brain',
      title: 'Motor AI-Native Integrado',
      description: 'Generación dinámica de contenidos, guías vocales de mentoría en tiempo real y asistente de estudio sintético.',
    },
    {
      id: 'b2',
      icon: 'Video',
      title: 'Streaming Nativo con Google Drive',
      description: 'Indexación automática de lecciones e integración directa de videos almacenados en carpetas de Google Drive.',
    },
    {
      id: 'b3',
      icon: 'ShieldCheck',
      title: 'Control de Roles RBAC & Single-Admin',
      description: 'Permisos jerárquicos estrictos con garantía de Administrador Único y Pases VIP de acceso ilimitado.',
    },
    {
      id: 'b4',
      icon: 'Layers',
      title: 'Arquitectura Modular de Plugins',
      description: 'Amplía la funcionalidad del LMS con módulos de Certificados PDF, Exámenes interconectados y Webhooks.',
    },
  ],
  testimonials: [
    {
      id: 't1',
      name: 'Carlos Mendoza',
      role: 'Estudiante VIP & Software Engineer',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      comment: 'DocentOS me permitió completar la mentoría técnica con guías explicativas por audio e interactuar directamente con los mentores.',
      rating: 5,
    },
    {
      id: 't2',
      name: 'Ing. Sofia Ruiz',
      role: 'Mentor Director en DocentOS',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      comment: 'Gestión directa de estudiantes, revisión centralizada de preguntas y vinculación automática de videos en minutos.',
      rating: 5,
    },
  ],
  footerText: 'DocentOS Community Edition',
  githubUrl: 'https://github.com/giantucchi/docentos',
  discordUrl: '',
  twitterUrl: '',
  linkedinUrl: '',
};

/**
 * Convierte el destino guardado en el editor de portada en uno que exista.
 *
 * La configuración puede traer rutas de la aplicación (`#courses`, `/vip`) que
 * no son secciones de esta página: pulsarlas no hacía absolutamente nada. Aquí
 * se traducen a la sección equivalente y, ante un destino desconocido, se cae
 * al catálogo en lugar de dejar el botón muerto.
 */
/**
 * La tabla de membresias sigue en el archivo pero no se pinta, a peticion del
 * cliente. Para recuperarla basta con poner el flag en `true`.
 *
 * Los testimonios ya no llevan flag: la seccion se pinta sola cuando hay algo
 * real que enseñar (ver `testimonials`), porque ahora los escriben las personas
 * que usan la plataforma y no el editor de portada.
 */
const MOSTRAR_PLANES = false;

/** Mismo limite que valida el servidor en `POST /api/testimonials`. */
const TESTIMONIAL_MAX_CHARS = 400;

const SECTION_ALIASES: Record<string, string> = {
  '#courses': '#cursos',
  '/courses': '#cursos',
  '#catalogo': '#cursos',
  '#catalog': '#cursos',
  '#vip': '#cursos',
  '/vip': '#cursos',
  '#planes': '#cursos',
  '#pricing': '#cursos',
  '#beneficios': '#beneficios',
  '#testimonios': '#testimonios',
};

/**
 * El catalogo que se ensena en la portada.
 *
 * Sin sesion, todo el escaparate: es lo que invita a registrarse. Con sesion,
 * solo los cursos a los que esa persona tiene acceso; entrar y seguir viendo
 * un muro de cursos ajenos con candado convierte la portada en un anuncio en
 * lugar de en el sitio al que se vuelve a estudiar.
 *
 * `hasAccess` lo resuelve el servidor en `GET /api/courses` (pago, matricula o
 * asignacion de mentoria): aqui no se decide nada sobre permisos, solo se
 * filtra lo que ya viene marcado.
 */
export function visibleCourses<T extends { hasAccess?: boolean }>(
  courses: T[],
  hasSession: boolean,
): T[] {
  if (!hasSession) return courses;
  return courses.filter((course) => course.hasAccess === true);
}

/**
 * Cuando merece la pena pintar la seccion de testimonios.
 *
 * Con opiniones publicadas siempre; sin ellas, solo a quien tiene sesion, que
 * es quien puede escribir la primera. A un visitante de una instalacion recien
 * montada se le ahorra un titular con el hueco vacio debajo.
 */
export function shouldShowTestimonials(approvedCount: number, hasSession: boolean): boolean {
  return approvedCount > 0 || hasSession;
}

export function resolveLandingCta(link: string | undefined, fallback: string): string {
  const value = String(link ?? '').trim();
  if (!value) return fallback;
  if (/^https?:\/\//i.test(value)) return value;
  const alias = SECTION_ALIASES[value.toLowerCase()];
  if (alias) return alias;
  if (value.startsWith('#')) return value;
  return fallback;
}

/** Lecciones publicadas de un curso, que es la medida de "cuánto hay dentro". */
function lessonCount(course: Course): number {
  return course.modules?.reduce((total, module) => total + (module.videos?.length || 0), 0) || 0;
}

/**
 * Emoji por categoria.
 *
 * Se mapea en vez de escribirse en la pildora porque las categorias las crea el
 * admin al publicar cada curso: una lista fija se quedaria coja en cuanto
 * apareciera una nueva. Las claves van sin tildes y en minusculas, asi que
 * "Diseño UI/UX" y "diseno ui/ux" caen en la misma entrada, y lo que no este
 * en el mapa recibe el emoji neutro.
 */
const CATEGORY_EMOJI: Record<string, string> = {
  'desarrollo web': '🚀',
  'inteligencia artificial': '🧠',
  'ia': '🧠',
  'devops & cloud': '☁️',
  'devops y cloud': '☁️',
  'cloud & devops': '☁️',
  'cloud': '☁️',
  'diseno ui/ux': '🎨',
  'diseno': '🎨',
  'ui/ux': '🎨',
  'mobile con flutter': '📱',
  'mobile': '📱',
  'desarrollo movil': '📱',
  'ciberseguridad': '🛡️',
  'seguridad': '🛡️',
  'bases de datos': '🗄️',
  'base de datos': '🗄️',
  'mentoria elite': '👑',
  'habilidades blandas': '🤝',
  'data science': '📊',
  'marketing digital': '📈',
  'negocios': '💼',
  'idiomas': '🗣️',
};

const DEFAULT_CATEGORY_EMOJI = '📚';

/**
 * Color de la insignia. Sale del nombre de la categoria y no de la posicion en
 * la rejilla: la misma tarjeta aparece en dos secciones, y con el indice el
 * mismo curso cambiaba de color al bajar por la pagina.
 */
function categoryTone(category: string): number {
  let hash = 0;
  for (let i = 0; i < category.length; i += 1) {
    hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  }
  return hash % 6;
}

/** Normaliza para buscar en el mapa: sin tildes, sin espacios de sobra, en minusculas. */
function categoryEmoji(category: string): string {
  const key = (category || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  return CATEGORY_EMOJI[key] || DEFAULT_CATEGORY_EMOJI;
}

const FALLBACK_COVER = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80';

/** Cuantos cursos ensena el catalogo cuando nadie ha marcado destacados. */
const CATALOG_FALLBACK_SIZE = 3;

/** Tarjeta de curso. La comparten el catalogo y la seccion de estrenos. */
const CourseCard: React.FC<{ course: Course; onExplore: (course: Course) => void }> = ({
  course,
  onExplore,
}) => {
  const modules = course.modules?.length || 0;
  const lessons = lessonCount(course);

  return (
    <article className="lp-course-card">
      <div className="lp-card-cover">
        <img className="lp-card-cover-bg" src={course.coverImage || FALLBACK_COVER} alt="" loading="lazy" />
        <div className="lp-card-cover-glow" />
        <div className="lp-card-badges">
          <span className={`lp-cat-badge tone-${categoryTone(course.category)}`}>
            <span aria-hidden>{categoryEmoji(course.category)}</span>
            {course.category}
          </span>
          <span className={`lp-price-badge${course.price > 0 ? '' : ' is-free'}`}>
            {course.price > 0 ? `$${course.price} ${course.currency || 'USD'}` : 'Gratis'}
          </span>
        </div>
        <span className="lp-play-btn">
          <Play aria-hidden className="h-5 w-5" fill="currentColor" />
        </span>
      </div>

      <div className="lp-card-body">
        <h3 className="lp-course-title">
          <button type="button" className="lp-card-link" onClick={() => onExplore(course)}>
            {course.title}
          </button>
        </h3>
        <p className="lp-course-desc">{course.description}</p>

        <div className="lp-card-meta">
          <span className="lp-meta-item">
            <Layers aria-hidden />
            {modules} {modules === 1 ? 'módulo' : 'módulos'}
          </span>
          <span className="lp-meta-item is-violet">
            <PlayCircle aria-hidden />
            {lessons} {lessons === 1 ? 'lección' : 'lecciones'}
          </span>
        </div>
      </div>
    </article>
  );
};

export const LandingPage: React.FC<LandingPageProps> = ({
  courses,
  onOpenAuth,
  onExploreCourse,
  currentUser,
  onGoToApp,
  onLogout,
}) => {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [landingConfig, setLandingConfig] = useState<LandingConfig>(DEFAULT_LANDING_CONFIG);
  const [activeSection, setActiveSection] = useState<string>('');
  /** Estudio ya hecho por quien tiene la sesión abierta; null mientras no se sepa. */
  const [studyStats, setStudyStats] = useState<{ lessons: number; certificates: number } | null>(null);

  /** Testimonios aprobados. Vacío mientras se cargan o si aún no hay ninguno. */
  const [testimonials, setTestimonials] = useState<LandingTestimonial[]>([]);
  /** El de quien tiene sesión, en cualquier estado: pendiente, publicado o rechazado. */
  const [myTestimonial, setMyTestimonial] = useState<ModeratedTestimonial | null>(null);
  const [showTestimonialForm, setShowTestimonialForm] = useState(false);
  const [draftRating, setDraftRating] = useState(5);
  const [draftComment, setDraftComment] = useState('');
  const [savingTestimonial, setSavingTestimonial] = useState(false);
  const [testimonialError, setTestimonialError] = useState<string | null>(null);

  useEffect(() => {
    loadLandingConfig();
    loadTestimonials();
  }, []);

  // Solo quien tiene sesión puede haber dejado una opinión.
  useEffect(() => {
    if (!currentUser) {
      setMyTestimonial(null);
      setShowTestimonialForm(false);
      return;
    }
    let cancelled = false;
    api
      .getMyTestimonial()
      .then((res) => {
        if (cancelled) return;
        setMyTestimonial(res.testimonial);
        if (res.testimonial) {
          setDraftRating(res.testimonial.rating);
          setDraftComment(res.testimonial.comment);
        }
      })
      .catch(() => {
        /* sin opinión previa la portada funciona igual */
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  // El saludo cuenta lecciones reales: sin sesión no hay nada que contar.
  useEffect(() => {
    if (!currentUser) {
      setStudyStats(null);
      return;
    }
    let cancelled = false;
    api
      .getProgress()
      .then((res) => {
        if (cancelled) return;
        setStudyStats({
          lessons: Object.values(res.completedVideos || {}).filter(Boolean).length,
          certificates: (res.certificates || []).filter((cert) => !cert.revokedAt).length,
        });
      })
      .catch(() => {
        /* el saludo se muestra igual, solo que sin la tarjeta de progreso */
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const loadTestimonials = async () => {
    try {
      const res = await api.getTestimonials();
      setTestimonials(res.testimonials || []);
    } catch (err) {
      // La portada entera no puede caerse porque falle esta sección.
      console.warn('No se pudieron cargar los testimonios:', err);
    }
  };

  /**
   * Guarda la opinión y vuelve a pedir la lista publicada.
   *
   * Lo enviado no aparece al momento: nace pendiente de revisión, y eso es lo
   * que dice el aviso. Prometer una publicación inmediata sería mentir.
   */
  const handleSubmitTestimonial = async (event: React.FormEvent) => {
    event.preventDefault();
    const comment = draftComment.trim();
    if (!comment) {
      setTestimonialError('Escribe tu opinión antes de enviarla');
      return;
    }
    setSavingTestimonial(true);
    setTestimonialError(null);
    try {
      const res = await api.submitTestimonial({ rating: draftRating, comment });
      setMyTestimonial(res.testimonial);
      setShowTestimonialForm(false);
      await loadTestimonials();
    } catch (err: any) {
      setTestimonialError(err?.message || 'No se pudo enviar tu opinión');
    } finally {
      setSavingTestimonial(false);
    }
  };

  const loadLandingConfig = async () => {
    try {
      const res = await api.getLandingConfig();
      if (res && res.config) {
        setLandingConfig({
          ...DEFAULT_LANDING_CONFIG,
          ...res.config,
          benefits: res.config.benefits && res.config.benefits.length > 0 ? res.config.benefits : DEFAULT_LANDING_CONFIG.benefits,
        });
      }
    } catch (err) {
      console.warn('Usando configuración por defecto para Landing Page:', err);
    }
  };

  /**
   * El catálogo del que se alimenta toda la portada. Con sesión abierta son los
   * cursos propios; sin ella, el escaparate completo.
   */
  const catalog = useMemo(
    () => visibleCourses(courses, Boolean(currentUser)),
    [courses, currentUser],
  );

  /** Las píldoras salen del catálogo real, no de una lista escrita a mano. */
  const categories = useMemo(() => {
    const found = Array.from(new Set(catalog.map((c) => c.category).filter(Boolean)));
    return ['ALL', ...found];
  }, [catalog]);

  const query = searchQuery.trim().toLowerCase();
  /** Hay filtro puesto: la seccion deja de ser un escaparate y pasa a ser una busqueda. */
  const isBrowsing = Boolean(query) || selectedCategory !== 'ALL';

  /**
   * Que ensena el catalogo.
   *
   * En reposo, solo los cursos marcados como destacados en el editor de
   * portada: la portada es un escaparate, no el catalogo entero. En cuanto se
   * escribe en el buscador o se pulsa una categoria, se recorre todo el
   * catalogo, que es lo unico que hace util a esos dos controles.
   *
   * Si la lista de destacados esta vacia o quedo apuntando a cursos borrados,
   * se ensenan los tres primeros en vez de dejar la seccion en blanco.
   */
  const displayCourses = useMemo(() => {
    const featuredSet = new Set(landingConfig.featuredCourseIds || []);

    const matching = catalog.filter((course) => {
      if (selectedCategory !== 'ALL' && course.category !== selectedCategory) return false;
      if (!query) return true;
      return `${course.title} ${course.description} ${course.category}`.toLowerCase().includes(query);
    });

    if (isBrowsing) return matching;
    // Con sesión no se recorta a los destacados: los cursos propios se enseñan
    // todos, que para eso son suyos.
    if (currentUser) return matching;
    const featured = matching.filter((course) => featuredSet.has(course.id));
    return featured.length > 0 ? featured : matching.slice(0, CATALOG_FALLBACK_SIZE);
  }, [catalog, currentUser, landingConfig.featuredCourseIds, selectedCategory, query, isBrowsing]);

  /**
   * Estrenos: los cuatro publicados mas recientemente. La API entrega el
   * catalogo de mas antiguo a mas nuevo, asi que se invierte antes de ordenar
   * y el desempate de un curso sin fecha cae del lado del recien creado.
   */
  const newestCourses = useMemo(() => {
    const publishedTime = (course: Course) =>
      course.publishedAt ? Date.parse(course.publishedAt) || 0 : 0;
    return [...catalog].reverse().sort((a, b) => publishedTime(b) - publishedTime(a)).slice(0, 4);
  }, [catalog]);

  const catalogTotals = useMemo(
    () =>
      catalog.reduce(
        (acc, course) => ({
          modules: acc.modules + (course.modules?.length || 0),
          lessons: acc.lessons + lessonCount(course),
        }),
        { modules: 0, lessons: 0 },
      ),
    [catalog],
  );

  /**
   * «Nuevos cursos» es escaparate: enseña lo último publicado para que quien no
   * tiene cuenta vea que la plataforma se mueve. Con sesión sobra —repetiría
   * las mismas tarjetas de «Tus cursos» bajo un titular que ya no es cierto—.
   */
  const showNewest = catalog.length > 0 && !currentUser;

  /**
   * La sección de testimonios se pinta sola cuando tiene sentido: si hay
   * opiniones publicadas, o si quien mira tiene sesión y por tanto puede dejar
   * la suya. A un visitante de una instalación recién montada no se le enseña
   * un titular con el hueco vacío debajo.
   */
  const mostrarTestimonios = shouldShowTestimonials(testimonials.length, Boolean(currentUser));

  /**
   * Cuatro enlaces y no cinco: con el logo, el buscador y los dos botones de
   * sesion, un quinto no cabia en los 1380px del contenedor y la barra se
   * montaba sobre si misma. "Tendencias" se cae porque es la seccion que queda
   * de paso al bajar desde el catalogo.
   */
  const navLinks: PublicNavLink[] = useMemo(
    () => [
      { id: 'cursos', label: 'Catálogo', href: '#cursos' },
      { id: 'beneficios', label: 'Metodología', href: '#beneficios' },
      ...(mostrarTestimonios
        ? [{ id: 'testimonios', label: 'Testimonios', href: '#testimonios' }]
        : []),
      ...(MOSTRAR_PLANES ? [{ id: 'planes', label: 'Planes', href: '#planes' }] : []),
    ],
    [mostrarTestimonios],
  );

  // Subraya en la barra la sección que se está mirando.
  useEffect(() => {
    const sections = navLinks
      .map((link) => document.getElementById(link.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: '-80px 0px -55% 0px', threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [navLinks]);

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Brain':
        return Brain;
      case 'Video':
        return Video;
      case 'ShieldCheck':
        return ShieldCheck;
      case 'Layers':
        return Layers;
      case 'Award':
        return Award;
      case 'Sparkles':
        return Sparkles;
      case 'Zap':
        return Zap;
      case 'Users':
        return Users;
      default:
        return Brain;
    }
  };

  const appName = siteConfig.appName || 'DocentOS';
  const firstName = (currentUser?.name || '').trim().split(/\s+/)[0] || '';
  const communityUrl = landingConfig.discordUrl || landingConfig.githubUrl || 'https://github.com/giantucchi/docentos';

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://docentos.org';
  // El titular se guarda en una sola cadena editable; la barra marca dónde
  // empieza el tramo que va en gradiente. Sin barra, el titular va entero en
  // blanco y no se pierde nada.
  const [titleLead, titleAccent] = (() => {
    const raw = landingConfig.heroTitle || '';
    const cut = raw.indexOf('|');
    if (cut === -1) return [raw.trim(), ''];
    return [raw.slice(0, cut).trim(), raw.slice(cut + 1).trim()];
  })();
  const plainHeroTitle = [titleLead, titleAccent].filter(Boolean).join(' ');

  const showsTrustBar = Boolean(landingConfig.trustRating && landingConfig.trustAudience);

  const pageTitle = `${plainHeroTitle} | DocentOS Open Source LMS`;
  const pageDescription = landingConfig.heroSubtitle;

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    'name': 'DocentOS',
    'operatingSystem': 'Web, Linux, Docker',
    'applicationCategory': 'EducationalApplication',
    'offers': {
      '@type': 'Offer',
      'price': '0',
      'priceCurrency': 'USD',
    },
    'description': pageDescription,
  };

  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    'name': 'Giantucchi Inc. EIRL',
    'alternateName': 'DocentOS Open Source LMS',
    'url': currentOrigin,
    'logo': landingConfig.heroMediaUrl,
    'description': 'Institución líder en programas e-Learning de alto rendimiento, IA Nativa y Mentoría de Software.',
    'sameAs': [
      landingConfig.githubUrl || 'https://github.com/giantucchi/docentos',
      'https://linkedin.com/company/giantucchi',
    ],
  };

  // Marcado para buscadores: aqui va el catalogo completo, no el filtrado.
  // Quien lo lee nunca tiene sesion y describe la oferta, no lo que ve un alumno.
  const coursesSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'itemListElement': courses.map((c, idx) => ({
      '@type': 'ListItem',
      'position': idx + 1,
      'item': {
        '@type': 'Course',
        'name': c.title,
        'description': c.description,
        'provider': {
          '@type': 'EducationalOrganization',
          'name': 'Giantucchi Inc. EIRL',
        },
        'educationalLevel': 'Intermediate / Advanced',
      },
    })),
  };

  return (
    <div className="lp-root">
      <Helmet>
        {/* Basic Metadata */}
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="keywords" content="LMS, Open Source, e-Learning, DocentOS, Giantucchi, Cursos, Mentoría, IA, React, Node.js" />
        <link rel="canonical" href={currentOrigin} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={currentOrigin} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={landingConfig.heroMediaUrl} />
        <meta property="og:site_name" content="DocentOS LMS" />

        {/* Twitter Cards */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@giantucchi" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={landingConfig.heroMediaUrl} />

        {/* JSON-LD Structured Data for AEO / SEO */}
        <script type="application/ld+json">{JSON.stringify(softwareSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(orgSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(coursesSchema)}</script>
      </Helmet>

      {/* 1. Barra de navegación */}
      <PublicNavbar
        onOpenAuth={onOpenAuth}
        currentUser={currentUser}
        onGoToApp={onGoToApp}
        onLogout={onLogout}
        links={navLinks}
        activeSection={activeSection}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="lp-container" id="inicio">
        {currentUser ? (
          /* 2a. Sesión abierta: saludo por nombre y vuelta al estudio. */
          <section className="lp-welcome">
            <div className="lp-welcome-text">
              <h1>
                Bienvenido de vuelta, <span>{firstName || currentUser.name}</span> 👋
              </h1>
              <p>Continúa aprendiendo hoy para alcanzar tus objetivos profesionales.</p>
            </div>

            {studyStats && (
              <div className="lp-streak-card">
                <div className="lp-streak-flame" aria-hidden>
                  🔥
                </div>
                <div className="lp-streak-info">
                  <span className="lp-streak-title">Tu progreso</span>
                  <span className="lp-streak-val">
                    {studyStats.lessons} {studyStats.lessons === 1 ? 'lección completada' : 'lecciones completadas'}
                  </span>
                </div>
              </div>
            )}
          </section>
        ) : (
          /* 2b. Visitante: presentación de la plataforma. */
          <section className="lp-hero">
            <div className="lp-hero-content">
              <a href="#cursos" className="lp-hero-badge">
                <span className="lp-hero-badge-icon" aria-hidden>
                  <Sparkles className="h-3 w-3" />
                </span>
                <span>
                  {appName} v{DOCENTOS_VERSION} ·{' '}
                  <span className="lp-hero-badge-accent">LMS abierto con IA nativa</span>
                </span>
                <ChevronRight aria-hidden className="lp-hero-badge-arrow h-3.5 w-3.5" />
              </a>

              {/* El titular es fijo y no sale de `landingConfig`: es la promesa
                  de la marca, no un campo que se edite por instalación. */}
              <h1 className="lp-hero-title">
                {titleLead}
                {titleAccent && (
                  <>
                    {' '}
                    <span className="lp-hero-title-accent">{titleAccent}</span>
                  </>
                )}
              </h1>

              <p className="lp-hero-sub">{landingConfig.heroSubtitle}</p>

              <div className="lp-hero-actions">
                <a href={resolveLandingCta(landingConfig.heroCtaLink, '#cursos')} className="lp-btn-primary">
                  <BookOpen aria-hidden className="h-4 w-4" />
                  {landingConfig.heroCtaText || 'Explorar Catálogo'}
                </a>
                <a
                  href={resolveLandingCta(landingConfig.heroSecondaryCtaLink, '#cursos')}
                  className="lp-btn-secondary"
                >
                  <Users aria-hidden className="h-4 w-4" />
                  {landingConfig.heroSecondaryCtaText || 'Solicitar Admisión VIP'}
                </a>
              </div>

              {showsTrustBar && (
                <div className="lp-hero-trust">
                  <span className="lp-trust-avatars" aria-hidden>
                    {TRUST_FACES.map((face) => (
                      <span
                        key={face}
                        className="lp-trust-avatar"
                        style={{ backgroundImage: `url('${face}')` }}
                      />
                    ))}
                  </span>

                  <span className="lp-trust-rating">
                    <span className="lp-trust-stars" aria-hidden>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <Star key={i} className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
                      ))}
                    </span>
                    <span>
                      <strong>{landingConfig.trustRating}</strong> de satisfacción
                    </span>
                    <span className="lp-trust-dot" aria-hidden />
                    <span>
                      <strong className="lp-trust-highlight">{landingConfig.trustAudience}</strong>{' '}
                      estudiantes activos
                    </span>
                  </span>
                </div>
              )}

              {/* Las cifras salen del catálogo real, no de una constante. */}
              {catalog.length > 0 && (
                <div className="lp-hero-stats">
                  <article className="lp-stat-card">
                    <span className="lp-stat-icon" aria-hidden>
                      <Layers className="h-5 w-5" />
                    </span>
                    <strong className="lp-stat-number">{catalog.length}</strong>
                    <span className="lp-stat-label">
                      {catalog.length === 1 ? 'Programa' : 'Programas'}
                    </span>
                    <p className="lp-stat-note">Rutas completas con temario, video y mentoría.</p>
                  </article>

                  <article className="lp-stat-card">
                    <span className="lp-stat-icon" aria-hidden>
                      <Brain className="h-5 w-5" />
                    </span>
                    <strong className="lp-stat-number">{catalogTotals.modules}</strong>
                    <span className="lp-stat-label">Módulos</span>
                    <p className="lp-stat-note">Bloques que se abren conforme terminas el anterior.</p>
                  </article>

                  <article className="lp-stat-card">
                    <span className="lp-stat-icon" aria-hidden>
                      <Video className="h-5 w-5" />
                    </span>
                    <strong className="lp-stat-number">{catalogTotals.lessons}</strong>
                    <span className="lp-stat-label">Lecciones</span>
                    <p className="lp-stat-note">Clases en video con notas y progreso guardado.</p>
                  </article>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 3. Píldoras de categoría */}
        {categories.length > 1 && (
          <div className="lp-pills">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`lp-pill${selectedCategory === cat ? ' is-active' : ''}`}
              >
                <span className="lp-pill-emoji" aria-hidden>
                  {cat === 'ALL' ? '✨' : categoryEmoji(cat)}
                </span>
                {cat === 'ALL' ? 'Destacados' : cat}
              </button>
            ))}
          </div>
        )}

        {/* 4. Catálogo */}
        <section className="lp-section" id="cursos">
          <div className="lp-section-header">
            <div className="lp-section-title-wrap">
              <div className="lp-section-indicator" />
              <div>
                {/* Con sesión la sección deja de ser escaparate: son sus cursos. */}
                <h2 className="lp-section-title">
                  {currentUser
                    ? 'Tus cursos'
                    : isBrowsing
                      ? 'Catálogo de cursos y mentorías'
                      : 'Programas destacados'}
                </h2>
                <p className="lp-section-sub">
                  {currentUser
                    ? 'Los programas a los que tienes acceso. Entra y sigue por donde lo dejaste.'
                    : isBrowsing
                      ? 'Estructura modular, clases en video y acompañamiento de mentores en cada programa.'
                      : 'Una selección de la casa. Filtra por categoría o busca arriba para recorrer todo el catálogo.'}
                </p>
              </div>
            </div>

            {!currentUser && (
              <a href="#cursos" className="lp-see-all">
                Ver todo el catálogo
                <ChevronRight aria-hidden className="h-4 w-4" />
              </a>
            )}
          </div>

          {displayCourses.length === 0 ? (
            <p className="lp-empty">
              {query
                ? `No encontramos cursos que coincidan con “${searchQuery.trim()}”.`
                : currentUser
                  ? 'Todavía no tienes ningún curso asignado. En cuanto te matriculen aparecerá aquí.'
                  : 'Todavía no hay cursos publicados en esta categoría.'}
            </p>
          ) : (
            <div className="lp-courses-grid">
              {displayCourses.map((course) => (
                <CourseCard key={course.id} course={course} onExplore={onExploreCourse} />
              ))}
            </div>
          )}
        </section>

        {/* 5. Estrenos del catálogo */}
        {showNewest && (
          <section className="lp-section" id="estrenos">
            <div className="lp-section-header">
              <div className="lp-section-title-wrap">
                <div className="lp-section-indicator is-gold" />
                <div>
                  <h2 className="lp-section-title">Nuevos cursos</h2>
                  <p className="lp-section-sub">Lo último que se ha publicado en la plataforma.</p>
                </div>
              </div>

              <a href="#cursos" className="lp-see-all">
                Ver todos los estrenos
                <ChevronRight aria-hidden className="h-4 w-4" />
              </a>
            </div>

            <div className="lp-courses-grid">
              {newestCourses.map((course) => (
                <CourseCard key={course.id} course={course} onExplore={onExploreCourse} />
              ))}
            </div>
          </section>
        )}

        {/* 6. Pilares de metodología */}
        <section className="lp-section" id="beneficios">
          <div className="lp-section-header">
            <div className="lp-section-title-wrap">
              <div className="lp-section-indicator" />
              <div>
                <h2 className="lp-section-title">Pilares de metodología y tecnología</h2>
                <p className="lp-section-sub">
                  Las piezas del motor que sostienen la retención y la aplicación de lo aprendido.
                </p>
              </div>
            </div>
          </div>

          <div className="lp-benefits-grid">
            {landingConfig.benefits.map((benefit, idx) => {
              const IconComp = getIconComponent(benefit.icon);
              return (
                <article key={benefit.id || idx} className="lp-benefit-card">
                  <span className="lp-benefit-num" aria-hidden>
                    0{idx + 1}
                  </span>
                  <span className="lp-benefit-icon">
                    <IconComp aria-hidden className="h-5 w-5" />
                  </span>
                  <h3 className="lp-benefit-title">{benefit.title}</h3>
                  <p className="lp-benefit-desc">{benefit.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* 7. Testimonios */}
        {mostrarTestimonios && (
          <section className="lp-section" id="testimonios">
            <div className="lp-section-header">
              <div className="lp-section-title-wrap">
                <div className="lp-section-indicator is-violet" />
                <div>
                  <h2 className="lp-section-title">Lo que opinan nuestros mentees</h2>
                  <p className="lp-section-sub">
                    Opiniones escritas por quienes estudian aquí. Se publican tras revisarlas.
                  </p>
                </div>
              </div>

              {/* Dejar la propia opinión. Sin sesión, primero hay que entrar. */}
              {currentUser ? (
                !showTestimonialForm && (
                  <button
                    type="button"
                    className="lp-see-all"
                    onClick={() => {
                      setTestimonialError(null);
                      setShowTestimonialForm(true);
                    }}
                  >
                    {myTestimonial ? 'Editar mi opinión' : 'Dejar mi opinión'}
                    <ChevronRight aria-hidden />
                  </button>
                )
              ) : (
                <button type="button" className="lp-see-all" onClick={() => onOpenAuth('login')}>
                  Entra para dejar la tuya
                  <ChevronRight aria-hidden />
                </button>
              )}
            </div>

            {/* Estado de la opinión propia: qué pasó con lo que ya envió. */}
            {currentUser && myTestimonial && !showTestimonialForm && (
              <p className="lp-testimonial-status">
                {myTestimonial.status === 'PENDING' && (
                  <>
                    <Clock aria-hidden className="h-3.5 w-3.5" />
                    Tu opinión está pendiente de revisión.
                  </>
                )}
                {myTestimonial.status === 'APPROVED' && (
                  <>
                    <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
                    Tu opinión ya está publicada. ¡Gracias!
                  </>
                )}
                {myTestimonial.status === 'REJECTED' && (
                  <>
                    <MessageCircle aria-hidden className="h-3.5 w-3.5" />
                    Tu opinión no se publicó. Puedes editarla y volver a enviarla.
                  </>
                )}
              </p>
            )}

            {currentUser && showTestimonialForm && (
              <form className="lp-testimonial-form" onSubmit={handleSubmitTestimonial}>
                <div className="lp-testimonial-form-row">
                  <span className="lp-testimonial-form-label">Tu valoración</span>
                  <div className="lp-star-picker" role="radiogroup" aria-label="Valoración de 1 a 5">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={draftRating === value}
                        aria-label={`${value} de 5`}
                        className={`lp-star-pick${value <= draftRating ? ' is-on' : ''}`}
                        onClick={() => setDraftRating(value)}
                      >
                        <Star aria-hidden className="h-5 w-5" fill="currentColor" />
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  className="lp-testimonial-textarea"
                  rows={4}
                  maxLength={TESTIMONIAL_MAX_CHARS}
                  placeholder="Cuenta tu experiencia con la plataforma…"
                  value={draftComment}
                  onChange={(event) => setDraftComment(event.target.value)}
                  aria-label="Tu opinión"
                />

                <div className="lp-testimonial-form-foot">
                  <span className="lp-testimonial-count">
                    {draftComment.length}/{TESTIMONIAL_MAX_CHARS}
                  </span>
                  <div className="lp-testimonial-actions">
                    <button
                      type="button"
                      className="lp-btn-ghost"
                      onClick={() => {
                        setShowTestimonialForm(false);
                        setTestimonialError(null);
                        setDraftRating(myTestimonial?.rating ?? 5);
                        setDraftComment(myTestimonial?.comment ?? '');
                      }}
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="lp-btn-primary" disabled={savingTestimonial}>
                      {savingTestimonial ? 'Enviando…' : 'Enviar opinión'}
                    </button>
                  </div>
                </div>

                {testimonialError && <p className="lp-testimonial-error">{testimonialError}</p>}
                <p className="lp-testimonial-note">
                  Se publicará con tu nombre y tu foto de perfil, una vez revisada.
                </p>
              </form>
            )}

            {testimonials.length > 0 ? (
              <div className="lp-testimonials-grid">
                {testimonials.map((testimonial) => (
                  <article key={testimonial.id} className="lp-testimonial">
                    <div className="lp-testimonial-head">
                      <div className="lp-testimonial-person">
                        <img
                          className="lp-testimonial-avatar"
                          src={avatarSrc(testimonial.avatarUrl)}
                          alt=""
                          loading="lazy"
                        />
                        <div>
                          <h4 className="lp-testimonial-name">{testimonial.name}</h4>
                          <span className="lp-testimonial-role">{testimonial.role}</span>
                        </div>
                      </div>

                      <div className="lp-stars" aria-label={`${testimonial.rating || 5} de 5`}>
                        {Array.from({ length: testimonial.rating || 5 }).map((_, i) => (
                          <Star key={i} aria-hidden className="h-3.5 w-3.5" fill="currentColor" />
                        ))}
                      </div>
                    </div>

                    <p className="lp-testimonial-text">“{testimonial.comment}”</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="lp-testimonial-empty">
                Todavía no hay opiniones publicadas. Si ya estudias aquí, la primera puede ser la tuya.
              </p>
            )}
          </section>
        )}

        {/* 8. Planes de acceso */}
        {MOSTRAR_PLANES && (
          <section className="lp-section" id="planes">
            <div className="lp-section-header">
              <div className="lp-section-title-wrap">
                <div className="lp-section-indicator" />
                <div>
                  <h2 className="lp-section-title">Membresías y tiers de admisión</h2>
                  <p className="lp-section-sub">Elige el formato de acceso que mejor se adapte a tus metas.</p>
                </div>
              </div>
            </div>

            <div className="lp-plans-grid">
              <article className="lp-plan">
                <span className="lp-plan-kicker">
                  <GraduationCap aria-hidden className="h-3.5 w-3.5" />
                  Público general
                </span>
                <div className="lp-plan-price">
                  $149 <small>/ curso</small>
                </div>
                <p className="lp-plan-desc">
                  Para estudiantes individuales que desean adquirir programas específicos.
                </p>
                <ul className="lp-plan-list">
                  <li>
                    <CheckCircle2 aria-hidden /> Acceso al curso seleccionado
                  </li>
                  <li>
                    <CheckCircle2 aria-hidden /> Reproductor con Google Drive
                  </li>
                  <li>
                    <CheckCircle2 aria-hidden /> Comentarios de clase
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => (currentUser ? onGoToApp?.() : onOpenAuth('register'))}
                  className="lp-btn-secondary lp-btn-block lp-plan-cta"
                >
                  {currentUser ? 'Ir a mi panel' : 'Registrarme como público'}
                </button>
              </article>

              <article className="lp-plan is-featured">
                <span className="lp-plan-flag">Recomendado</span>
                <span className="lp-plan-kicker is-cyan">
                  <Crown aria-hidden className="h-3.5 w-3.5" />
                  Mentee VIP
                </span>
                <div className="lp-plan-price">
                  Pase total <small className="is-accent">Bypass activo</small>
                </div>
                <p className="lp-plan-desc">
                  Acceso ilimitado e inmediato a todos los cursos y mentorías del catálogo.
                </p>
                <ul className="lp-plan-list">
                  <li>
                    <CheckCircle2 aria-hidden /> Todos los programas sin muro de pago
                  </li>
                  <li>
                    <CheckCircle2 aria-hidden /> Tutoría prioritaria con mentores
                  </li>
                  <li>
                    <CheckCircle2 aria-hidden /> Guías de voz con IA
                  </li>
                  <li>
                    <CheckCircle2 aria-hidden /> Certificados oficiales en PDF
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => (currentUser ? onGoToApp?.() : onOpenAuth('register'))}
                  className="lp-btn-primary lp-btn-block lp-plan-cta"
                >
                  {currentUser ? 'Gestionar mi acceso' : 'Obtener pase VIP'}
                </button>
              </article>

              <article className="lp-plan is-mentor">
                <span className="lp-plan-kicker is-violet">
                  <Users aria-hidden className="h-3.5 w-3.5" />
                  Membresía mentor
                </span>
                <div className="lp-plan-price">
                  Docente <small>/ institucional</small>
                </div>
                <p className="lp-plan-desc">
                  Para instructores que desean publicar programas y acompañar a sus mentees.
                </p>
                <ul className="lp-plan-list">
                  <li>
                    <CheckCircle2 aria-hidden /> Panel del mentor
                  </li>
                  <li>
                    <CheckCircle2 aria-hidden /> Creación y edición de cursos
                  </li>
                  <li>
                    <CheckCircle2 aria-hidden /> Seguimiento de mentees asignados
                  </li>
                  <li>
                    <CheckCircle2 aria-hidden /> Centro de consultas Q&amp;A
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => (currentUser ? onGoToApp?.() : onOpenAuth('register'))}
                  className="lp-btn-secondary lp-btn-block lp-plan-cta"
                >
                  {currentUser ? 'Ir a mi panel' : 'Postular como mentor'}
                </button>
              </article>
            </div>
          </section>
        )}

        {/* 9. Cierre */}
        <section className="lp-promo-section">
          <div className="lp-promo-banner">
            <div className="lp-promo-content">
              <span className="lp-promo-badge">
                <Rocket aria-hidden className="h-3.5 w-3.5" />
                Código abierto
              </span>

              <h2 className="lp-promo-title">{appName}</h2>

              <div className="lp-promo-meta">
                <span>
                  <Sparkles aria-hidden className="h-4 w-4" />v{DOCENTOS_VERSION}
                </span>
                <span>•</span>
                <span>{landingConfig.footerText || siteConfig.authorCredit}</span>
              </div>

              <p className="lp-promo-desc">
                {currentUser
                  ? 'Tu sesión ya está abierta: vuelve a tus clases, retoma la lección donde la dejaste y sigue avanzando con tus mentores.'
                  : 'Un motor de aprendizaje autoalojable, modular y con IA nativa. Crea tu cuenta y empieza hoy con las clases, las guías de voz y la mentoría de la plataforma.'}
              </p>

              <div className="lp-promo-actions">
                {currentUser ? (
                  <>
                    <button type="button" onClick={onGoToApp} className="lp-btn-primary">
                      <Zap aria-hidden className="h-4 w-4" />
                      Ir a mi panel
                    </button>
                    <a href="#cursos" className="lp-btn-secondary">
                      Explorar el catálogo
                    </a>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => onOpenAuth('register')} className="lp-btn-primary">
                      <Zap aria-hidden className="h-4 w-4" />
                      {t('nav.register') || 'Crear mi cuenta'}
                    </button>
                    <button type="button" onClick={() => onOpenAuth('login')} className="lp-btn-secondary">
                      {t('nav.login') || 'Iniciar sesión'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 10. Pie */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-grid">
            <div className="lp-footer-left">
              <span className="lp-logo" style={{ fontSize: '1.1rem' }}>
                <span className="lp-logo-badge" style={{ width: 30, height: 30 }}>
                  <span className="lp-logo-badge-inner" style={{ fontSize: '0.85rem' }}>
                    <span>{siteConfig.logoInitial || appName.charAt(0)}</span>
                  </span>
                </span>
                <span className="lp-logo-text">
                  {appName}
                  <span>.</span>
                </span>
              </span>
              <p className="lp-footer-motto">{siteConfig.appTagline}</p>
            </div>

            <ul className="lp-footer-links">
              <li>
                <a href="#cursos">Catálogo</a>
              </li>
              {MOSTRAR_PLANES && (
                <li>
                  <a href="#planes">Planes</a>
                </li>
              )}
              {landingConfig.githubUrl && (
                <li>
                  <a href={landingConfig.githubUrl} target="_blank" rel="noopener noreferrer">
                    <Github aria-hidden className="h-4 w-4" />
                    GitHub
                  </a>
                </li>
              )}
              {landingConfig.discordUrl && (
                <li>
                  <a href={landingConfig.discordUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle aria-hidden className="h-4 w-4" />
                    Comunidad
                  </a>
                </li>
              )}
              {landingConfig.twitterUrl && (
                <li>
                  <a href={landingConfig.twitterUrl} target="_blank" rel="noopener noreferrer">
                    <Twitter aria-hidden className="h-4 w-4" />
                    Twitter
                  </a>
                </li>
              )}
              {landingConfig.linkedinUrl && (
                <li>
                  <a href={landingConfig.linkedinUrl} target="_blank" rel="noopener noreferrer">
                    <Linkedin aria-hidden className="h-4 w-4" />
                    LinkedIn
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div className="lp-footer-bottom">
            <span>
              © {new Date().getFullYear()} {appName}. Todos los derechos reservados.
            </span>
            <span>·</span>
            <span className="lp-footer-version">
              <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />v{DOCENTOS_VERSION}
            </span>
          </div>
        </div>
      </footer>

      {/* 11. Acceso rápido a la comunidad */}
      <a
        href={communityUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="lp-support"
        aria-label="Abrir la comunidad de soporte"
      >
        <span className="lp-support-tooltip">💬 ¿Tienes dudas? Escríbenos</span>
        <MessageCircle aria-hidden />
      </a>
    </div>
  );
};
