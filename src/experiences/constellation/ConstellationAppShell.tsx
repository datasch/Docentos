import type { CourseCardPatch } from '../../lib/courseCardUpdate';
import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Course } from '../../types';
import '../../styles/academy.css';
import '../../styles/academy-layout.css';
import { api } from '../../lib/api';
import { getLocalizedCourse, getLocalizedCourses } from '../../lib/courseLocalization';
import { ConstellationNavbar, ConstellationTab } from './ConstellationNavbar';
import { NotificationBell } from '../../components/notifications/NotificationBell';
import { NotificationToasts } from '../../components/notifications/NotificationToasts';
import {
  ADMIN_LISTENING_EVENT,
  ADMIN_TAB_STORAGE_KEY,
  LESSON_FOCUS_EVENT,
  LESSON_FOCUS_STORAGE_KEY,
  LESSON_PANEL_STORAGE_KEY,
  LISTENING_FOCUS_STORAGE_KEY,
  MENTOR_QNA_EVENT,
  MENTOR_TAB_STORAGE_KEY,
  useNotifications,
  type LessonFocus,
} from '../../lib/useNotifications';
import type { AppNotification } from '../../lib/api';
import { ConstellationHero } from './ConstellationHero';
import { ConstellationCourseCatalog } from './ConstellationCourseCatalog';
import { ConstellationPillars } from './ConstellationPillars';
import { ConstellationTestimonials } from './ConstellationTestimonials';
import { ConstellationFooter } from './ConstellationFooter';
import { Shield, Users } from 'lucide-react';

import { getSeasonalTheme, SeasonalTheme } from '../../lib/seasonalTheme';
import { SeasonalGlobalOverlay } from '../../components/SeasonalGlobalOverlay';
import { RouteSkeleton } from '../../components/loading/RouteSkeleton';

const loadCourseOverview = () => import('../../components/CourseOverview');
const loadConstellationCanvas = () => import('./ConstellationCanvas');
const loadMyLearningBundle = () =>
  Promise.all([import('../../styles/my-learning.css'), import('./ConstellationMyLearning')]);
const loadCourseViewer = () => import('./ConstellationCourseViewer');
const loadAdminBundle = () =>
  Promise.all([import('../../styles/staffStyles'), import('../../components/AdminDashboard')]);
const loadMentorBundle = () =>
  Promise.all([import('../../styles/staffStyles'), import('../../components/MentorDashboard')]);
const loadPaywallModal = () => import('../../components/PaywallModal');

function preloadTabChunk(tab: ConstellationTab) {
  if (tab === 'learning') void loadMyLearningBundle();
  else if (tab === 'mentor') void loadMentorBundle();
  else if (tab === 'admin') void loadAdminBundle();
  else if (tab === 'viewer') void loadCourseViewer();
}

const CourseOverview = lazy(() =>
  loadCourseOverview().then((m) => ({ default: m.CourseOverview }))
);
const ConstellationCanvas = lazy(() =>
  loadConstellationCanvas().then((module) => ({ default: module.ConstellationCanvas }))
);
const ConstellationMyLearning = lazy(() =>
  loadMyLearningBundle().then(([, module]) => ({ default: module.ConstellationMyLearning }))
);
const ConstellationCourseViewer = lazy(() =>
  loadCourseViewer().then((m) => ({ default: m.ConstellationCourseViewer }))
);
const AdminDashboard = lazy(() =>
  loadAdminBundle().then(([, m]) => ({ default: m.AdminDashboard }))
);
const MentorDashboard = lazy(() =>
  loadMentorBundle().then(([, m]) => ({ default: m.MentorDashboard }))
);
const PaywallModal = lazy(() =>
  loadPaywallModal().then((m) => ({ default: m.PaywallModal }))
);

interface ConstellationAppShellProps {
  currentUser: User | null;
  courses: Course[];
  activeCourse: Course | null;
  activeTab: string;
  hasAccess: boolean;
  sharedCourseId?: string | null;
  courseAccessReady?: boolean;
  onOpenCourseOverview: (course: Course) => void;
  onContinueCourse: (course: Course) => void;
  onRegister: () => void;
  onNavigate: (tab: any) => void;
  onSelectCourse: (course: Course) => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenPaywall: () => void;
  onRefreshData: () => void;
  onCourseUpdated?: (courseId: string, patch: CourseCardPatch) => void;
  onPaymentSuccess?: () => void;
  onVipActivated?: () => void;
  onRestartTour?: () => void;
  onOpenVerifyModal?: (code?: string) => void;
  onOpenListening?: () => void;
  onChangePassword?: () => void;
  unreadListening?: number;
  listeningDocked?: boolean;
}

export const ConstellationAppShell: React.FC<ConstellationAppShellProps> = ({
  currentUser,
  courses,
  activeCourse,
  activeTab,
  hasAccess,
  sharedCourseId = null,
  courseAccessReady = false,
  onOpenCourseOverview,
  onContinueCourse,
  onRegister,
  onNavigate,
  onSelectCourse,
  onOpenAuth,
  onLogout,
  onOpenPaywall,
  onRefreshData,
  onCourseUpdated,
  onPaymentSuccess,
  onVipActivated,
  onRestartTour,
  onOpenVerifyModal,
  onOpenListening,
  onChangePassword,
  unreadListening = 0,
  listeningDocked = false,
}) => {
  const { t, i18n } = useTranslation();
  const resolveTab = (tab: string): ConstellationTab => {
    if (tab === 'admin' || tab === 'plugins') return 'admin';
    if (tab === 'mentor') return 'mentor';
    if (tab === 'courses' || tab === 'vip') return 'courses';
    if (tab === 'search') return 'courses';
    if (tab === 'learning') return 'learning';
    if (tab === 'viewer') return 'viewer';
    return 'explore';
  };

  const notificationsState = useNotifications(currentUser?.id);

  // Abrir un aviso: el mentor va a su bandeja de consultas y el alumno al curso.
  const handleOpenNotification = (notification: AppNotification) => {
    if (!notification.readAt) void notificationsState.markRead([notification.id]);
    if (notification.type === 'listening.message') {
      const listeningEntryId = notification.data?.listeningEntryId || null;
      try {
        sessionStorage.setItem(ADMIN_TAB_STORAGE_KEY, 'listening');
        if (listeningEntryId) sessionStorage.setItem(LISTENING_FOCUS_STORAGE_KEY, listeningEntryId);
        else sessionStorage.removeItem(LISTENING_FOCUS_STORAGE_KEY);
      } catch {
        // Sin almacenamiento la pestaña se cambia por el evento.
      }
      setConstellationTab('admin');
      onNavigate('admin');
      window.dispatchEvent(new CustomEvent(ADMIN_LISTENING_EVENT, { detail: { listeningEntryId } }));
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      return;
    }
    if (notification.type === 'qna.question') {
      try {
        sessionStorage.setItem(MENTOR_TAB_STORAGE_KEY, 'qna');
      } catch {
        // Sin almacenamiento la pestaña se cambia por el evento.
      }
      setConstellationTab('mentor');
      onNavigate('mentor');
      window.dispatchEvent(new CustomEvent(MENTOR_QNA_EVENT));
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      return;
    }
    // Respuesta a una consulta: se abre el curso donde se hizo la pregunta (no
    // el último que estaba abierto) y, dentro, esa lección con la pestaña de
    // Mentoría para ver la respuesta.
    const courseId = notification.data.courseId;
    if (!courseId) return;
    const focus: LessonFocus = { courseId, videoId: notification.data.videoId || null };
    try {
      sessionStorage.setItem(LESSON_FOCUS_STORAGE_KEY, JSON.stringify(focus));
      sessionStorage.setItem(LESSON_PANEL_STORAGE_KEY, 'mentorship');
    } catch {
      // Sin almacenamiento se abre el curso igualmente.
    }
    // Si ese curso ya está abierto, la Ruta Cósmica abre la lección al recibirlo.
    window.dispatchEvent(new CustomEvent<LessonFocus>(LESSON_FOCUS_EVENT, { detail: focus }));
    const target = localizedCourses.find((c) => c.id === courseId) || courses.find((c) => c.id === courseId);
    if (target) handleContinueCourse(target);
  };

  const [showDesktopBrand, setShowDesktopBrand] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)');
    const update = () => setShowDesktopBrand(desktop.matches);
    update();
    desktop.addEventListener('change', update);
    return () => desktop.removeEventListener('change', update);
  }, []);

  const [selectedCourseForViewer, setSelectedCourseForViewer] = useState<Course | null>(activeCourse || null);
  const courseCacheRef = useRef<Map<string, Course>>(new Map());
  const [constellationTab, setConstellationTab] = useState<ConstellationTab>(() => resolveTab(activeTab));
  const [visitedTabs, setVisitedTabs] = useState<Record<'explore' | 'courses' | 'learning' | 'mentor' | 'admin', boolean>>(() => {
    const initial = resolveTab(activeTab);
    return {
      explore: initial === 'explore',
      courses: initial === 'courses',
      learning: initial === 'learning',
      mentor: initial === 'mentor',
      admin: initial === 'admin',
    };
  });
  const [seasonalTheme, setSeasonalThemeState] = useState<SeasonalTheme>(getSeasonalTheme());

  useEffect(() => {
    setConstellationTab(resolveTab(activeTab));
  }, [activeTab]);

  useEffect(() => {
    if (
      constellationTab === 'explore' ||
      constellationTab === 'courses' ||
      constellationTab === 'learning' ||
      constellationTab === 'mentor' ||
      constellationTab === 'admin'
    ) {
      setVisitedTabs((prev) => (prev[constellationTab] ? prev : { ...prev, [constellationTab]: true }));
    }
  }, [constellationTab]);

  useEffect(() => {
    if (!currentUser) return;
    const warm = () => {
      preloadTabChunk('learning');
      if (currentUser.role === 'ADMIN' || currentUser.role === 'MENTOR') preloadTabChunk('mentor');
      if (currentUser.role === 'ADMIN') preloadTabChunk('admin');
    };
    const timer = window.setTimeout(warm, 1200);
    return () => window.clearTimeout(timer);
  }, [currentUser]);

  useEffect(() => {
    const handleSeasonalChange = (e: any) => {
      if (e.detail?.theme) setSeasonalThemeState(e.detail.theme);
      else setSeasonalThemeState(getSeasonalTheme());
    };
    window.addEventListener('docentos-seasonal-change', handleSeasonalChange);
    return () => window.removeEventListener('docentos-seasonal-change', handleSeasonalChange);
  }, []);

  const handlePrefetchCourse = (courseId: string) => {
    if (courseCacheRef.current.has(courseId)) return;
    api.getCourse(courseId)
      .then((res) => {
        if (res?.course && res.course.modules && res.course.modules.length > 0) {
          courseCacheRef.current.set(courseId, res.course);
        }
      })
      .catch(() => {});
  };

  const handleSelectCourse = (selected: Course) => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    if ((sharedCourseId || selected.hasAccess !== true) && currentUser?.role !== 'MENTEE') {
      onOpenCourseOverview(selected);
      return;
    }
    const cached = courseCacheRef.current.get(selected.id);
    const resolved = (cached && cached.modules && cached.modules.length > 0) ? cached : selected;
    setSelectedCourseForViewer(resolved);
    onSelectCourse(resolved);
    setConstellationTab('viewer');
  };

  const handleContinueCourse = (selected: Course) => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    const cached = courseCacheRef.current.get(selected.id);
    const resolved = (cached && cached.modules && cached.modules.length > 0) ? cached : selected;
    setSelectedCourseForViewer(resolved);
    onContinueCourse(resolved);
    setConstellationTab('viewer');
  };

  const localizedCourses = useMemo(
    () => getLocalizedCourses(courses, t),
    [courses, t, i18n.language]
  );
  const localizedActiveCourse = useMemo(
    () => (activeCourse ? getLocalizedCourse(activeCourse, t) : null),
    [activeCourse, t, i18n.language]
  );
  const rawCurrentCourse = selectedCourseForViewer || localizedActiveCourse || localizedCourses[0] || null;
  const currentCourse = useMemo(
    () => (rawCurrentCourse ? getLocalizedCourse(rawCurrentCourse, t) : null),
    [rawCurrentCourse, t, i18n.language]
  );
  // Never authorize playback from a prefetched course or a previous account.
  const [viewerError, setViewerError] = useState(false);
  const [verifiedCourse, setVerifiedCourse] = useState<{
    course: Course;
    user: User | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setVerifiedCourse(null);
    setViewerError(false);
    courseCacheRef.current.clear();
    if (constellationTab === 'viewer' && currentCourse) {
      api.getCourse(currentCourse.id).then(({ course }) => {
        if (!cancelled) setVerifiedCourse({ course, user: currentUser });
      }).catch(() => {
        if (!cancelled) { setVerifiedCourse(null); setViewerError(true); }
      });
    }
    return () => { cancelled = true; };
  }, [currentCourse?.id, currentUser, constellationTab]);

  const rawViewerCourse = constellationTab === 'viewer' &&
    verifiedCourse?.course.id === currentCourse?.id && verifiedCourse?.user === currentUser
    ? verifiedCourse.course : null;
  const viewerCourse = useMemo(
    () => (rawViewerCourse ? getLocalizedCourse(rawViewerCourse, t) : null),
    [rawViewerCourse, t, i18n.language]
  );


  return (
    <div className="academy-experience min-h-screen bg-canvas dark:bg-[#07070b] text-ink dark:text-white flex flex-col font-sans selection:bg-[var(--color-brand-cyan)] selection:text-[var(--color-on-brand)] relative overflow-x-clip w-full max-w-full">
      

      {/* Ambientación Festiva Global de DocentOS (Halloween & Navidad) */}
      <SeasonalGlobalOverlay />
      
      {/* Barra Superior */}
      <ConstellationNavbar
        currentUser={currentUser}
        courses={localizedCourses}
        activeCourse={currentCourse}
        activeTab={constellationTab}
        hasAccess={hasAccess}
        onPreloadTab={preloadTabChunk}
        onSelectTab={(tab) => {
          if (tab === constellationTab && !sharedCourseId) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          setConstellationTab(tab);
          if (tab === 'explore') onNavigate('landing');
          else if (tab === 'courses') onNavigate('courses');
          else if (tab === 'learning') onNavigate('learning');
          else if (tab === 'mentor') onNavigate('mentor');
          else if (tab === 'admin') onNavigate('admin');
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
        }}
        onOpenAuth={onOpenAuth}
        onLogout={onLogout}
        onRestartTour={onRestartTour}
        onOpenVerifyModal={onOpenVerifyModal}
        onOpenListening={onOpenListening}
        onChangePassword={onChangePassword}
        unreadListening={unreadListening}
        notificationBell={
          <NotificationBell
            notifications={notificationsState.notifications}
            unreadCount={notificationsState.unreadCount}
            onOpenNotification={handleOpenNotification}
            onMarkAllRead={() => void notificationsState.markRead()}
          />
        }
      />

      <NotificationToasts
        toasts={notificationsState.toasts}
        onOpen={handleOpenNotification}
        onDismiss={notificationsState.dismissToast}
      />

      {/* Lienzo 3D de Constelación Neural: visible en inicio, catálogo y mi aprendizaje */}
      {showDesktopBrand && (constellationTab === 'explore' || constellationTab === 'courses' || constellationTab === 'learning') && !sharedCourseId && (
        <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
          <Suspense fallback={null}>
            <ConstellationCanvas fullScreen />
          </Suspense>
        </div>
      )}

      {/* Contenido Dinámico con Transiciones Fluidas sin saltos de layout */}
      <main className="flex-1 w-full relative z-10">
        <Suspense
          fallback={
            <RouteSkeleton
              variant={constellationTab === 'learning' ? 'learning' : 'staff'}
              label={t('cargando', 'Cargando…')}
            />
          }
        >
          {sharedCourseId ? (
            <CourseOverview
              course={localizedCourses.find(c => c.id === sharedCourseId && c.published)}
              ready={courseAccessReady}
              user={currentUser}
              onBack={() => onNavigate('courses')}
              onRegister={onRegister}
              onLogin={onOpenAuth}
              onPurchase={() => {
                const selected = localizedCourses.find(c => c.id === sharedCourseId && c.published);
                if (selected) { onSelectCourse(selected); onOpenPaywall(); }
              }}
              onContinue={() => {
                const selected = localizedCourses.find(c => c.id === sharedCourseId && c.published);
                if (selected) { setSelectedCourseForViewer(selected); onContinueCourse(selected); }
              }}
            />
          ) : <>
            {/* 1. Vista Explorar: Hero con Constelación 3D + Búsqueda Neural + Muestra de Catálogo */}
            {(visitedTabs.explore || constellationTab === 'explore') && (
              <div
                key="view-explore"
                className="w-full portal-tab-pane"
                hidden={constellationTab !== 'explore'}
                aria-hidden={constellationTab !== 'explore'}
              >
                <ConstellationHero
                  currentUser={currentUser}
                  showInlineBrand={false}
                  onExploreCourses={() => {
                    setConstellationTab('courses');
                    onNavigate('courses');
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
                  }}
                  onOpenSearch={() => {
                    setConstellationTab('courses');
                    onNavigate('courses');
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
                  }}
                  totalCoursesCount={localizedCourses.length}
                />

                <ConstellationCourseCatalog
                  featuredOnly
                  onBrowseCatalog={() => {
                    setConstellationTab('courses');
                    onNavigate('courses');
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
                  }}
                  courses={localizedCourses}
                  onSelectCourse={handleSelectCourse}
                  onPrefetchCourse={handlePrefetchCourse}
                />
                <ConstellationPillars />
                <ConstellationTestimonials
                  currentUser={currentUser}
                  onOpenAuth={onOpenAuth}
                />
              </div>
            )}

            {(visitedTabs.learning || constellationTab === 'learning') && (
              <div
                key="view-learning"
                className="w-full portal-tab-pane"
                hidden={constellationTab !== 'learning'}
                aria-hidden={constellationTab !== 'learning'}
              >
                <ConstellationMyLearning
                  user={currentUser}
                  courses={localizedCourses}
                  accessReady={courseAccessReady}
                  isActive={constellationTab === 'learning'}
                  onContinue={handleContinueCourse}
                  onBrowse={() => { setConstellationTab('courses'); onNavigate('courses'); }}
                  onLogin={onOpenAuth}
                  onVerifyCertificate={onOpenVerifyModal}
                />
              </div>
            )}

            {/* 3. Vista Catálogo Completo */}
            {(visitedTabs.courses || constellationTab === 'courses') && (
              <div
                key="view-courses"
                className="w-full portal-tab-pane"
                hidden={constellationTab !== 'courses'}
                aria-hidden={constellationTab !== 'courses'}
              >
                <ConstellationCourseCatalog
                  courses={localizedCourses}
                  onSelectCourse={handleSelectCourse}
                  onPrefetchCourse={handlePrefetchCourse}
                />
              </div>
            )}

            {/* 4. Vista Reproductor Inmersivo */}
            {constellationTab === 'viewer' && !viewerCourse && (
              <p role="status" className="p-8 text-center">{viewerError ? t('appShell.verifyAccessFailed', 'No se pudo verificar el acceso. Vuelve a abrir el curso para reintentar.') : t('appShell.verifyingCourseAccess', 'Verificando acceso al curso…')}</p>
            )}
            {constellationTab === 'viewer' && currentCourse && viewerCourse && (
              <div key={`view-viewer-${currentCourse.id}`} className="w-full animate-backdrop-fade">
                <ConstellationCourseViewer
                  key={`${viewerCourse.id}-${currentUser?.id || 'guest'}`}
                  course={viewerCourse}
                  currentUser={currentUser}
                  hasAccess={viewerCourse?.hasAccess === true}
                  onOpenPaywall={currentUser?.role === 'MENTEE' ? () => {} : onOpenPaywall}
                  onGoHome={() => {
                    setConstellationTab('learning');
                    onNavigate('learning');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onSelectCourse={handleSelectCourse}
                  courses={localizedCourses}
                />
              </div>
            )}

            {/* Fallback si no hay cursos para el reproductor */}
            {constellationTab === 'viewer' && !currentCourse && (
              <div key="view-viewer-empty" className="max-w-xl mx-auto py-24 px-6 text-center animate-backdrop-fade">
                <h2 className="font-constellation-display text-2xl text-slate-900 dark:text-white mb-2">
                  {t('appShell.noCourseSelected', 'No hay un curso seleccionado')}
                </h2>
                <p className="font-constellation-body text-slate-600 dark:text-white/50 text-sm mb-6">
                  {t('appShell.selectCourseDesc', 'Selecciona un curso desde el catálogo para iniciar la reproducción inmersiva.')}
                </p>
                <button
                  onClick={() => {
                    setConstellationTab('courses');
                    onNavigate('courses');
                  }}
                  className="btn-constellation-pill text-xs"
                >
                  {t('appShell.exploreCatalog', 'Explorar Catálogo')}
                </button>
              </div>
            )}

            {/* 5. Vista Mentoría */}
            {(visitedTabs.mentor || constellationTab === 'mentor') && (
              <div
                key="view-mentor"
                className="w-full portal-tab-pane"
                hidden={constellationTab !== 'mentor'}
                aria-hidden={constellationTab !== 'mentor'}
              >
                {currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'MENTOR') ? (
                  <div className="w-full max-w-[1600px] mx-auto overflow-x-hidden">
                    <MentorDashboard
                      currentUser={currentUser}
                      courses={localizedCourses}
                      onRefreshCourses={onRefreshData}
                      onCourseUpdated={onCourseUpdated}
                    />
                  </div>
                ) : (
                  <div className="max-w-md mx-auto py-24 px-6 text-center animate-backdrop-fade">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-brand-cyan/10 border border-brand-cyan/30 flex items-center justify-center text-brand-cyan">
                      <Users className="w-7 h-7" />
                    </div>
                    <h2 className="font-constellation-display text-2xl text-slate-900 dark:text-white mb-2">
                      {t('appShell.mentorshipZone', 'Zona de Mentoría')}
                    </h2>
                    <p className="font-constellation-body text-slate-600 dark:text-white/60 text-sm mb-6">
                      {t('appShell.mentorshipDesc', 'Inicia sesión con credenciales autorizadas de Mentor o Administrador para gestionar el aula y tus alumnos.')}
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={onOpenAuth}
                        className="cursor-pointer px-6 py-2.5 rounded-full bg-[#8052ff] hover:bg-[#7042f0] text-white font-constellation-label text-xs font-semibold transition-[color,background-color,border-color,opacity,box-shadow]"
                      >
                        {t('appShell.login', 'Iniciar Sesión')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConstellationTab('explore');
                          onNavigate('landing');
                        }}
                        className="cursor-pointer px-5 py-2.5 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white font-constellation-label text-xs font-semibold tracking-wider transition-colors"
                      >
                        {t('appShell.backToHome', 'Volver al Inicio')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 6. Vista Administración */}
            {(visitedTabs.admin || constellationTab === 'admin') && (
              <div
                key="view-admin"
                className="w-full portal-tab-pane"
                hidden={constellationTab !== 'admin'}
                aria-hidden={constellationTab !== 'admin'}
              >
                {currentUser?.role === 'ADMIN' ? (
                  <div className="w-full max-w-[1600px] mx-auto overflow-x-clip">
                    <AdminDashboard
                      currentUser={currentUser}
                      course={currentCourse}
                      onRefreshData={onRefreshData}
                    />
                  </div>
                ) : (
                  <div className="max-w-md mx-auto py-24 px-6 text-center animate-fade-in">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-warning-light">
                      <Shield className="w-7 h-7" />
                    </div>
                    <h2 className="font-constellation-display text-2xl text-slate-900 dark:text-white mb-2">
                      {t('appShell.adminZone', 'Panel de Administración')}
                    </h2>
                    <p className="font-constellation-body text-slate-600 dark:text-white/60 text-sm mb-6">
                      {t('appShell.adminDesc', 'Debes iniciar sesión con una cuenta de Administrador de DocentOS para acceder al panel de control.')}
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={onOpenAuth}
                        className="cursor-pointer px-6 py-2.5 rounded-full bg-[#8052ff] hover:bg-[#7042f0] text-white font-constellation-label text-xs font-semibold transition-[color,background-color,border-color,opacity,box-shadow]"
                      >
                        {t('appShell.login', 'Iniciar Sesión')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConstellationTab('explore');
                          onNavigate('landing');
                        }}
                        className="cursor-pointer px-5 py-2.5 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white font-constellation-label text-xs font-semibold tracking-wider transition-colors"
                      >
                        {t('appShell.backToHome', 'Volver al Inicio')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pestaña VIP Paywall si activo */}
            {activeTab === 'vip' && currentUser && currentUser.role !== 'MENTEE' && currentCourse && (
              <div key="view-vip" className="max-w-4xl mx-auto px-4 py-8 animate-backdrop-fade">
                <PaywallModal
                  userRole={currentUser.role}
                  courseTitle={currentCourse.title}
                  price={currentCourse.price}
                  onPaymentSuccess={onPaymentSuccess || (() => {})}
                  onVipActivated={onVipActivated || (() => {})}
                />
              </div>
            )}
          </>}
        </Suspense>
      </main>

      {/* Footer Oficial de DocentOS Principal adaptado a la estética Constellation */}
      <ConstellationFooter
        onOpenListening={onOpenListening}
        unreadListening={unreadListening}
        listeningDocked={listeningDocked}
      />

    </div>
  );
};
