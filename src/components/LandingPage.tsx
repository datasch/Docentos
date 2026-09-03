/**
 * Landing Page Institucional Pública
 * DocentOS - The AI-Native, Open-Source Learning Engine
 *
 * Página de inicio pública para visitantes.
 * Carga dinámicamente la configuración desde `GET /api/public/landing-config` con fallback automático.
 * Diseño ultra alto nivel en tema oscuro minimalista (#000000, #0a0a0f, #262626, acentos neón).
 */

import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Sparkles,
  BookOpen,
  Award,
  Video,
  Users,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Globe,
  PlayCircle,
  MessageSquare,
  Bot,
  Zap,
  Layers,
  ChevronRight,
  Star,
  Megaphone,
  Github,
  Linkedin,
  Twitter,
  ExternalLink,
  Brain,
  Sliders,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Course, LandingConfig } from '../types';
import { api } from '../lib/api';
import { DOCENTOS_VERSION } from '../version';
import { PublicNavbar } from './PublicNavbar';
import { Footer } from './Footer';

interface LandingPageProps {
  courses: Course[];
  onOpenAuth: (mode: 'login' | 'register') => void;
  onExploreCourse: (course: Course) => void;
  /** Sesion activa: la portada la refleja en vez de ofrecer iniciar sesion. */
  currentUser?: { name: string; role: string } | null;
  onGoToApp?: () => void;
  onLogout?: () => void;
}

const DEFAULT_LANDING_CONFIG: LandingConfig = {
  heroTitle: 'El Motor de Aprendizaje Abierto con IA Nativa & Mentoría',
  heroSubtitle:
    'DocentOS es la alternativa moderna, liviana y modular de código abierto frente a plataformas LMS tradicionales monolíticas como Moodle u Odoo LMS. Clases indexadas desde Google Drive, guías gamificadas con voz de IA, resolución de dudas con mentores y arquitectura extensible de plugins.',
  heroMediaUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop',
  heroCtaText: 'Explorar Catálogo de Cursos',
  heroCtaLink: '#cursos',
  heroSecondaryCtaText: 'Solicitar Admisión VIP',
  heroSecondaryCtaLink: '#planes',
  featuredCourseIds: ['course-giantucchi-mastery'],
  bannerEnabled: true,
  bannerText: '🚀 Motor de IA optimizado, gestión de guías vocales e integración nativa con Google Drive.',
  bannerLinkText: 'Ver Novedades',
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
const SECTION_ALIASES: Record<string, string> = {
  '#courses': '#cursos',
  '/courses': '#cursos',
  '#catalogo': '#cursos',
  '#catalog': '#cursos',
  '#vip': '#planes',
  '/vip': '#planes',
  '#planes': '#planes',
  '#pricing': '#planes',
  '#beneficios': '#beneficios',
  '#testimonios': '#testimonios',
};

export function resolveLandingCta(link: string | undefined, fallback: string): string {
  const value = String(link ?? '').trim();
  if (!value) return fallback;
  if (/^https?:\/\//i.test(value)) return value;
  const alias = SECTION_ALIASES[value.toLowerCase()];
  if (alias) return alias;
  if (value.startsWith('#')) return value;
  return fallback;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  courses,
  onOpenAuth,
  onExploreCourse,
  currentUser,
  onGoToApp,
  onLogout,
}) => {
  const { t, i18n } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [landingConfig, setLandingConfig] = useState<LandingConfig>(DEFAULT_LANDING_CONFIG);

  useEffect(() => {
    loadLandingConfig();
  }, []);

  const loadLandingConfig = async () => {
    try {
      const res = await api.getLandingConfig();
      if (res && res.config) {
        setLandingConfig({
          ...DEFAULT_LANDING_CONFIG,
          ...res.config,
          benefits: res.config.benefits && res.config.benefits.length > 0 ? res.config.benefits : DEFAULT_LANDING_CONFIG.benefits,
          testimonials: res.config.testimonials && res.config.testimonials.length > 0 ? res.config.testimonials : DEFAULT_LANDING_CONFIG.testimonials,
        });
      }
    } catch (err) {
      console.warn('Usando configuración por defecto para Landing Page:', err);
    }
  };

  const categories = ['ALL', 'Mentoría Elite', 'Inteligencia Artificial', 'Desarrollo Web'];

  // Filter courses by category and featured list
  const featuredSet = new Set(landingConfig.featuredCourseIds || []);
  const displayCourses = courses.filter((c) => {
    if (selectedCategory !== 'ALL' && c.category !== selectedCategory) return false;
    if (featuredSet.size > 0 && selectedCategory === 'ALL') {
      return featuredSet.has(c.id) || courses.length <= 3;
    }
    return true;
  });

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

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://docentos.org';
  const pageTitle = `${landingConfig.heroTitle} | DocentOS Open Source LMS`;
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
    <div className="min-h-screen bg-[#000000] text-slate-100 font-sans selection:bg-[#06b6d4] selection:text-black">
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
      
      {/* 0. Promo Announcement Banner */}
      {landingConfig.bannerEnabled && (
        <div className="bg-gradient-to-r from-[#06b6d4] via-[#a855f7] to-[#06b6d4] text-black py-2 px-4 text-center text-xs font-bold flex items-center justify-center gap-2 shadow-md">
          <Megaphone className="w-4 h-4 text-black animate-pulse" />
          <span>{landingConfig.bannerText}</span>
          {landingConfig.bannerLinkText && (
            <a
              href={landingConfig.bannerLinkUrl || '#'}
              className="underline font-black hover:text-white transition-colors ml-1"
            >
              {landingConfig.bannerLinkText} →
            </a>
          )}
        </div>
      )}

      {/* 1. Thin Public Header */}
      <PublicNavbar
        onOpenAuth={onOpenAuth}
        currentUser={currentUser}
        onGoToApp={onGoToApp}
        onLogout={onLogout}
      />

      {/* 2. Dynamic Hero Section */}
      <section className="relative pt-16 pb-20 px-4 sm:px-8 max-w-7xl mx-auto overflow-hidden">
        {/* Background Glowing Orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#06b6d4]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-80 h-80 bg-[#a855f7]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#141420] border border-[#262626] text-[#06b6d4] text-xs font-bold shadow-xl">
            <Sparkles className="w-4 h-4 text-[#06b6d4]" />
            <span>DocentOS v{DOCENTOS_VERSION} • Open Source LMS</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            {landingConfig.heroTitle}
          </h1>

          <p className="text-sm sm:text-base text-slate-400 font-normal leading-relaxed">
            {landingConfig.heroSubtitle}
          </p>

          {/* CTA Group */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <a
              href={resolveLandingCta(landingConfig.heroCtaLink, '#cursos')}
              className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-[#06b6d4] to-[#a855f7] hover:opacity-90 text-black font-extrabold rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 text-xs"
            >
              <BookOpen className="w-4 h-4" />
              <span>{landingConfig.heroCtaText || 'Explorar Catálogo'}</span>
            </a>

            <a
              href={resolveLandingCta(landingConfig.heroSecondaryCtaLink, '#planes')}
              className="w-full sm:w-auto px-7 py-3.5 bg-[#141420] hover:bg-[#1a1a2e] border border-[#262626] hover:border-[#06b6d4] text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-xs"
            >
              <Users className="w-4 h-4 text-[#06b6d4]" />
              <span>{landingConfig.heroSecondaryCtaText || 'Solicitar Admisión VIP'}</span>
            </a>
          </div>

          {/* Hero Media Preview Card */}
          {landingConfig.heroMediaUrl && (
            <div className="pt-8 max-w-4xl mx-auto">
              <div className="rounded-2xl overflow-hidden border border-[#262626] shadow-2xl bg-[#0a0a0f] aspect-video relative group">
                <img
                  src={landingConfig.heroMediaUrl}
                  alt="DocentOS Platform Preview"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#000000] via-transparent to-transparent opacity-80" />
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-white">
                  <span className="font-extrabold bg-black/80 px-3 py-1 rounded-lg border border-[#262626]">
                    DocentOS AI Studio & Mentor Engine
                  </span>
                  <span className="text-[10px] text-[#06b6d4] font-mono font-bold bg-black/80 px-3 py-1 rounded-lg border border-[#262626]">
                    v{DOCENTOS_VERSION}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. Featured Course Catalog Section */}
      <section id="cursos" className="py-20 px-4 sm:px-8 max-w-7xl mx-auto border-t border-[#262626]">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-[10px] font-bold text-[#06b6d4] uppercase tracking-widest block mb-1">
            Programas Académicos Destacados
          </span>
          <h2 className="text-3xl font-extrabold text-white">Catálogo de Cursos & Mentorías</h2>
          <p className="text-xs text-slate-400 mt-2">
            Explora la estructura modular, clases en video y metodologías personalizadas de la plataforma.
          </p>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedCategory === cat
                    ? 'bg-[#06b6d4] text-black shadow-md'
                    : 'bg-[#141420] text-slate-400 hover:text-white border border-[#262626]'
                }`}
              >
                {cat === 'ALL' ? 'Todos los Programas' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayCourses.map((course) => {
            const moduleCount = course.modules?.length || 0;
            const videoCount = course.modules?.reduce((acc, m) => acc + (m.videos?.length || 0), 0) || 0;

            return (
              <div
                key={course.id}
                className="bg-[#0a0a0f] border border-[#262626] rounded-2xl overflow-hidden hover:border-[#06b6d4] transition-all group flex flex-col justify-between"
              >
                <div>
                  {/* Cover Image & Category Badge */}
                  <div className="relative h-48 overflow-hidden bg-[#141420]">
                    <img
                      src={course.coverImage || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800'}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent" />
                    
                    <span className="absolute top-3 left-3 bg-[#0a0a0f]/90 border border-[#262626] text-[#06b6d4] text-[10px] font-extrabold px-2.5 py-1 rounded-lg backdrop-blur-md">
                      {course.category}
                    </span>

                    <span className="absolute top-3 right-3 bg-gradient-to-r from-[#06b6d4] to-[#a855f7] text-black text-xs font-black px-2.5 py-1 rounded-lg shadow-md">
                      ${course.price} USD
                    </span>
                  </div>

                  {/* Course Details */}
                  <div className="p-5 space-y-3">
                    <h3 className="font-extrabold text-base text-white group-hover:text-[#06b6d4] transition-colors line-clamp-2">
                      {course.title}
                    </h3>

                    <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                      {course.description}
                    </p>

                    {/* Modules & Videos Summary */}
                    <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400 pt-2 border-t border-[#262626]">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-[#06b6d4]" /> {moduleCount} Módulos
                      </span>
                      <span className="flex items-center gap-1">
                        <PlayCircle className="w-3.5 h-3.5 text-[#a855f7]" /> {videoCount} Lecciones
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-5 pt-0">
                  <button
                    onClick={() => onExploreCourse(course)}
                    className="w-full py-2.5 bg-[#141420] hover:bg-gradient-to-r hover:from-[#06b6d4] hover:to-[#a855f7] hover:text-black border border-[#262626] text-white text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <span>Ver Programa Completo</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Benefits & Methodology Section */}
      <section id="beneficios" className="py-20 px-4 sm:px-8 max-w-7xl mx-auto border-t border-[#262626] bg-[#0a0a0f]">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[10px] font-bold text-[#06b6d4] uppercase tracking-widest block mb-1">
            Innovación Educativa
          </span>
          <h2 className="text-3xl font-extrabold text-white">Pilares de Metodología & Tecnología</h2>
          <p className="text-xs text-slate-400 mt-2">
            Garantizamos la máxima retención y aplicación de conocimientos a través de herramientas de vanguardia.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {landingConfig.benefits.map((b, idx) => {
            const IconComp = getIconComponent(b.icon);
            return (
              <div key={b.id || idx} className="bg-[#000000] border border-[#262626] p-6 rounded-2xl relative hover:border-[#06b6d4]/50 transition-all">
                <span className="text-3xl font-black text-slate-800 font-mono absolute top-4 right-4">
                  0{idx + 1}
                </span>
                <div className="w-10 h-10 rounded-xl bg-[#141420] border border-[#262626] flex items-center justify-center text-[#06b6d4] mb-4">
                  <IconComp className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-sm text-white mb-2">{b.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{b.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Testimonials Section */}
      <section id="testimonios" className="py-20 px-4 sm:px-8 max-w-7xl mx-auto border-t border-[#262626]">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[10px] font-bold text-[#a855f7] uppercase tracking-widest block mb-1">
            Comunidad & Testimonios
          </span>
          <h2 className="text-3xl font-extrabold text-white">Lo que opinan nuestros Mentees</h2>
          <p className="text-xs text-slate-400 mt-2">
            Experiencias reales de profesionales transformando su carrera con DocentOS.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {landingConfig.testimonials.map((t) => (
            <div key={t.id} className="bg-[#0a0a0f] border border-[#262626] p-6 rounded-2xl space-y-4 hover:border-[#a855f7]/50 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={t.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    alt={t.name}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-[#262626]"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-white">{t.name}</h4>
                    <span className="text-[10px] text-[#06b6d4] font-semibold">{t.role}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[#eab308]">
                  {[...Array(t.rating || 5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-[#eab308]" />
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed italic">
                "{t.comment}"
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Pricing & Admission Tiers */}
      <section id="planes" className="py-20 px-4 sm:px-8 max-w-7xl mx-auto border-t border-[#262626]">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[10px] font-bold text-[#06b6d4] uppercase tracking-widest block mb-1">
            Planes de Acceso
          </span>
          <h2 className="text-3xl font-extrabold text-white">Membresías & Tiers de Admisión</h2>
          <p className="text-xs text-slate-400 mt-2">
            Elige el formato de acceso que mejor se adapte a tus metas profesionales.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Tier 1: Public User */}
          <div className="bg-[#0a0a0f] border border-[#262626] rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Público General
              </div>
              <div className="text-3xl font-black text-white mb-4">
                $149 <span className="text-xs font-normal text-slate-500">/ curso</span>
              </div>
              <p className="text-xs text-slate-400 mb-6">
                Para estudiantes individuales que desean adquirir programas específicos.
              </p>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#06b6d4]" /> Acceso al curso seleccionado
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#06b6d4]" /> Reproductor Google Drive
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#06b6d4]" /> Comentarios de clase
                </li>
              </ul>
            </div>
            <button
              onClick={() => onOpenAuth('register')}
              className="w-full mt-8 py-3 bg-[#141420] hover:bg-[#1f1f33] border border-[#262626] text-white font-bold rounded-xl text-xs transition-all"
            >
              Registrarse como Público
            </button>
          </div>

          {/* Tier 2: Mentee VIP (Featured) */}
          <div className="bg-gradient-to-b from-[#141420] to-[#0a0a0f] border-2 border-[#06b6d4] rounded-2xl p-6 relative flex flex-col justify-between shadow-2xl shadow-[#06b6d4]/10">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#06b6d4] to-[#a855f7] text-black text-[10px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider">
              Recomendado
            </span>
            <div>
              <div className="text-xs font-extrabold text-[#06b6d4] uppercase tracking-wider mb-2 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Mentee VIP
              </div>
              <div className="text-3xl font-black text-white mb-4">
                Pase Total <span className="text-xs font-normal text-emerald-400 font-bold">Bypass Activo</span>
              </div>
              <p className="text-xs text-slate-300 mb-6">
                Acceso ilimitado e inmediato a todos los cursos y mentorías del catálogo.
              </p>
              <ul className="space-y-3 text-xs text-slate-200">
                <li className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-[#06b6d4]" /> Todos los programas sin Muro de Pago
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#06b6d4]" /> Tutoría prioritaria con Mentores
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#06b6d4]" /> Guías de Voz IA de Mentor
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#06b6d4]" /> Certificados Oficiales PDF
                </li>
              </ul>
            </div>
            <button
              onClick={() => onOpenAuth('register')}
              className="w-full mt-8 py-3 bg-gradient-to-r from-[#06b6d4] to-[#a855f7] hover:opacity-90 text-black font-extrabold rounded-xl text-xs shadow-lg transition-all"
            >
              Obtener Pase VIP
            </button>
          </div>

          {/* Tier 3: Mentor Tutor */}
          <div className="bg-[#0a0a0f] border border-[#262626] rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-[#a855f7] uppercase tracking-wider mb-2">
                Membresía Mentor
              </div>
              <div className="text-3xl font-black text-white mb-4">
                Docente <span className="text-xs font-normal text-slate-500">/ Institucional</span>
              </div>
              <p className="text-xs text-slate-400 mb-6">
                Para instructores y mentores que desean publicar programas y gestionar mentees.
              </p>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#a855f7]" /> Panel del Mentor (`MentorDashboard`)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#a855f7]" /> Creación y edición de Cursos
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#a855f7]" /> Seguimiento de Mentees asignados
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#a855f7]" /> Centro de Consultas Q&A
                </li>
              </ul>
            </div>
            <button
              onClick={() => onOpenAuth('register')}
              className="w-full mt-8 py-3 bg-[#141420] hover:bg-[#1f1f33] border border-[#262626] text-white font-bold rounded-xl text-xs transition-all"
            >
              Postular como Mentor
            </button>
          </div>
        </div>
      </section>

      {/* 7. Public Footer */}
      <Footer githubUrl={landingConfig.githubUrl} />

    </div>
  );
};
