import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Course } from '../../types';
import '../../styles/academy.css';
import '../../styles/academy-layout.css';
import { api } from '../../lib/api';
import { getLocalizedCourse, getLocalizedCourses } from '../../lib/courseLocalization';
import { CourseOverview } from '../../components/CourseOverview';
import { ConstellationNavbar, ConstellationTab } from './ConstellationNavbar';
import { NotificationBell } from '../../components/notifications/NotificationBell';
import { NotificationToasts } from '../../components/notifications/NotificationToasts';
import { MENTOR_QNA_EVENT, MENTOR_TAB_STORAGE_KEY, useNotifications } from '../../lib/useNotifications';
import type { AppNotification } from '../../lib/api';
import { ConstellationHero } from './ConstellationHero';
import { ConstellationCourseCatalog } from './ConstellationCourseCatalog';
import { ConstellationPillars } from './ConstellationPillars';
import { ConstellationTestimonials } from './ConstellationTestimonials';
import { ConstellationFooter } from './ConstellationFooter';
import { Shield, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { getSeasonalTheme, SeasonalTheme } from '../../lib/seasonalTheme';
import { SeasonalGlobalOverlay } from '../../components/SeasonalGlobalOverlay';

const ConstellationCanvas = lazy(() =>
  import('./ConstellationCanvas').then(module => ({ default: module.ConstellationCanvas }))
);
const ConstellationMyLearning = lazy(() =>
  import('./ConstellationMyLearning').then(module => ({ default: module.ConstellationMyLearning }))
);
const ConstellationCourseViewer = lazy(() =>
  import('./ConstellationCourseViewer').then((m) => ({ default: m.ConstellationCourseViewer }))
);
const AdminDashboard = lazy(() =>
  import('../../components/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const MentorDashboard = lazy(() =>
  import('../../components/MentorDashboard').then((m) => ({ default: m.MentorDashboard }))
);
const PaywallModal = lazy(() =>
  import('../../components/PaywallModal').then((m) => ({ default: m.PaywallModal }))
);

import type { Variants } from 'motion/react';

const pageTransitionVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.16, ease: 'easeIn' },
  },
};

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
  onPaymentSuccess?: () => void;
  onVipActivated?: () => void;
  onRestartTour?: () => void;
  onOpenVerifyModal?: (code?: string) => void;
  onOpenListening?: () => void;
  onChangePassword?: () => void;
  unreadListening?: number;
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
  onPaymentSuccess,
  onVipActivated,
  onRestartTour,
  onOpenVerifyModal,
  onOpenListening,
  onChangePassword,
  unreadListening = 0,
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
    const target = courses.find((c) => c.id === notification.data.courseId);
    if (target) onContinueCourse(target);
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
  const [seasonalTheme, setSeasonalThemeState] = useState<SeasonalTheme>(getSeasonalTheme());

  useEffect(() => {
    setConstellationTab(resolveTab(activeTab));
  }, [activeTab]);

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
    <div className="academy-experience min-h-screen bg-[#f8fafc] dark:bg-[#07070b] text-slate-900 dark:text-white flex flex-col font-sans selection:bg-[#06b6d4] selection:text-[#050505] relative overflow-x-clip w-full max-w-full">
      

      {/* Ambientación Festiva Global de DocentOS (Halloween & Navidad) */}
      <SeasonalGlobalOverlay />
      
      {/* Barra Superior */}
      <ConstellationNavbar
        currentUser={currentUser}
        courses={localizedCourses}
        activeCourse={currentCourse}
        activeTab={constellationTab}
        hasAccess={hasAccess}
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

      {/* Resplandor ambiental atmosférico cósmico de fondo */}
      <div
        aria-hidden="true"
        className="fixed top-20 left-1/2 -translate-x-1/2 w-[340px] sm:w-[600px] h-[340px] sm:h-[600px] rounded-full blur-[120px] opacity-15 dark:opacity-25 pointer-events-none -z-10 bg-gradient-to-tr from-[#06b6d4] via-[#a855f7] to-[#eab308]"
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
        <Suspense fallback={null}>
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
          ) : <AnimatePresence mode="wait">
            {/* 1. Vista Explorar: Hero con Constelación 3D + Búsqueda Neural + Muestra de Catálogo */}
            {constellationTab === 'explore' && (
              <motion.div
                key="view-explore"
                variants={pageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full"
              >
                <ConstellationHero
                  currentUser={currentUser}
                  showInlineBrand={!showDesktopBrand}
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
              </motion.div>
            )}

            {constellationTab === 'learning' && (
              <motion.div key="view-learning" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit" className="w-full">
                <ConstellationMyLearning user={currentUser} courses={localizedCourses} accessReady={courseAccessReady}
                  onContinue={handleContinueCourse}
                  onBrowse={() => { setConstellationTab('courses'); onNavigate('courses'); }}
                  onLogin={onOpenAuth} onVerifyCertificate={onOpenVerifyModal} />
              </motion.div>
            )}

            {/* 3. Vista Catálogo Completo */}
            {constellationTab === 'courses' && (
              <motion.div
                key="view-courses"
                variants={pageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full"
              >
                <ConstellationCourseCatalog
                  courses={localizedCourses}
                  onSelectCourse={handleSelectCourse}
                  onPrefetchCourse={handlePrefetchCourse}
                />
              </motion.div>
            )}

            {/* 4. Vista Reproductor Inmersivo */}
            {constellationTab === 'viewer' && !viewerCourse && (
              <p role="status" className="p-8 text-center">{viewerError ? t('appShell.verifyAccessFailed', 'No se pudo verificar el acceso. Vuelve a abrir el curso para reintentar.') : t('appShell.verifyingCourseAccess', 'Verificando acceso al curso…')}</p>
            )}
            {constellationTab === 'viewer' && currentCourse && viewerCourse && (
              <motion.div
                key={`view-viewer-${currentCourse.id}`}
                variants={pageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full"
              >
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
              </motion.div>
            )}

            {/* Fallback si no hay cursos para el reproductor */}
            {constellationTab === 'viewer' && !currentCourse && (
              <motion.div
                key="view-viewer-empty"
                variants={pageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="max-w-xl mx-auto py-24 px-6 text-center"
              >
                <h2 className="font-constellation-display text-2xl text-white mb-2">
                  {t('appShell.noCourseSelected', 'No hay un curso seleccionado')}
                </h2>
                <p className="font-constellation-body text-white/50 text-sm mb-6">
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
              </motion.div>
            )}

            {/* 5. Vista Mentoría */}
            {constellationTab === 'mentor' && (
              <motion.div
                key="view-mentor"
                variants={pageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full"
              >
                {currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'MENTOR') ? (
                  <div className="w-full max-w-[1600px] mx-auto overflow-x-hidden">
                    <MentorDashboard
                      currentUser={currentUser}
                      courses={localizedCourses}
                      onRefreshCourses={onRefreshData}
                    />
                  </div>
                ) : (
                  <div className="max-w-md mx-auto py-24 px-6 text-center animate-fade-in">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
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
                        className="cursor-pointer px-6 py-2.5 rounded-full bg-[#8052ff] hover:bg-[#7042f0] text-white font-constellation-label text-xs font-semibold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(128,82,255,0.35)]"
                      >
                        {t('appShell.login', 'Iniciar Sesión')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConstellationTab('explore');
                          onNavigate('landing');
                        }}
                        className="cursor-pointer px-5 py-2.5 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white font-constellation-label text-xs font-semibold tracking-wider transition-all"
                      >
                        {t('appShell.backToHome', 'Volver al Inicio')}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* 6. Vista Administración */}
            {constellationTab === 'admin' && (
              <motion.div
                key="view-admin"
                variants={pageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full"
              >
                {currentUser?.role === 'ADMIN' ? (
                  <div className="w-full max-w-[1600px] mx-auto overflow-x-hidden">
                    <AdminDashboard
                      currentUser={currentUser}
                      course={currentCourse}
                      onRefreshData={onRefreshData}
                    />
                  </div>
                ) : (
                  <div className="max-w-md mx-auto py-24 px-6 text-center animate-fade-in">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
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
                        className="cursor-pointer px-6 py-2.5 rounded-full bg-[#8052ff] hover:bg-[#7042f0] text-white font-constellation-label text-xs font-semibold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(128,82,255,0.35)]"
                      >
                        {t('appShell.login', 'Iniciar Sesión')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConstellationTab('explore');
                          onNavigate('landing');
                        }}
                        className="cursor-pointer px-5 py-2.5 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white font-constellation-label text-xs font-semibold tracking-wider transition-all"
                      >
                        {t('appShell.backToHome', 'Volver al Inicio')}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Pestaña VIP Paywall si activo */}
            {activeTab === 'vip' && currentUser && currentUser.role !== 'MENTEE' && currentCourse && (
              <motion.div
                key="view-vip"
                variants={pageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="max-w-4xl mx-auto px-4 py-8"
              >
                <PaywallModal
                  userRole={currentUser.role}
                  courseTitle={currentCourse.title}
                  price={currentCourse.price}
                  onPaymentSuccess={onPaymentSuccess || (() => {})}
                  onVipActivated={onVipActivated || (() => {})}
                />
              </motion.div>
            )}
          </AnimatePresence>}
        </Suspense>
      </main>

      {/* Footer Oficial de DocentOS Principal adaptado a la estética Constellation */}
      <ConstellationFooter
        onOpenListening={onOpenListening}
        unreadListening={unreadListening}

      />

    </div>
  );
};
