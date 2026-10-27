import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { User, Course } from '../../types';
import { api } from '../../lib/api';
import { ConstellationNavbar, ConstellationTab } from './ConstellationNavbar';
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
  import('./ConstellationCanvas').then((m) => ({ default: m.ConstellationCanvas }))
);
const ConstellationNeuralSearch = lazy(() =>
  import('./ConstellationNeuralSearch').then((m) => ({ default: m.ConstellationNeuralSearch }))
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
  onNavigate: (tab: any) => void;
  onSelectCourse: (course: Course) => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenPaywall: () => void;
  onRefreshData: () => void;
  onPaymentSuccess?: () => void;
  onVipActivated?: () => void;
  onRestartTour?: () => void;
  onOpenVerifyModal?: () => void;
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
  const resolveTab = (tab: string): ConstellationTab => {
    if (tab === 'admin' || tab === 'plugins') return 'admin';
    if (tab === 'mentor') return 'mentor';
    if (tab === 'courses' || tab === 'vip') return 'courses';
    if (tab === 'search') return 'search';
    if (tab === 'viewer') return 'viewer';
    return 'explore';
  };

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
    const cached = courseCacheRef.current.get(selected.id);
    const resolved = (cached && cached.modules && cached.modules.length > 0) ? cached : selected;
    setSelectedCourseForViewer(resolved);
    onSelectCourse(resolved);
    setConstellationTab('viewer');
  };

  const currentCourse = selectedCourseForViewer || activeCourse || courses[0] || null;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#07070b] text-slate-900 dark:text-white flex flex-col font-sans selection:bg-[#06b6d4] selection:text-[#050505] relative overflow-x-hidden w-full max-w-full">
      
      {/* Ambientación Festiva Global de DocentOS (Halloween & Navidad) */}
      <SeasonalGlobalOverlay />
      
      {/* Barra Superior */}
      <ConstellationNavbar
        currentUser={currentUser}
        courses={courses}
        activeCourse={selectedCourseForViewer}
        activeTab={constellationTab}
        hasAccess={hasAccess}
        onSelectTab={(tab) => {
          if (tab === constellationTab) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          setConstellationTab(tab);
          if (tab === 'explore') onNavigate('landing');
          else if (tab === 'courses') onNavigate('courses');
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
      />

      {/* Resplandor ambiental atmosférico en móvil (puro CSS, 0 JS / 0 GPU) */}
      <div
        aria-hidden="true"
        className="md:hidden fixed top-20 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full blur-[100px] opacity-15 dark:opacity-25 pointer-events-none -z-10 bg-gradient-to-tr from-[#06b6d4] via-[#a855f7] to-[#eab308]"
      />

      {/* Lienzo 3D de Constelación Neural: solo en pantallas medianas y escritorio (>= md) */}
      <div
        className={`hidden md:block fixed inset-0 pointer-events-none z-0 transition-opacity duration-300 ${
          constellationTab === 'explore' ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          visibility: constellationTab === 'explore' ? 'visible' : 'hidden',
        }}
        aria-hidden={constellationTab !== 'explore'}
      >
        <Suspense fallback={null}>
          <ConstellationCanvas
            fullScreen
            paused={constellationTab !== 'explore'}
          />
        </Suspense>
      </div>

      {/* Contenido Dinámico con Transiciones Fluidas sin saltos de layout */}
      <main className="flex-1 w-full relative z-10">
        <Suspense fallback={null}>
          <AnimatePresence mode="wait">
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
                  onExploreCourses={() => {
                    setConstellationTab('courses');
                    onNavigate('courses');
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
                  }}
                  onOpenSearch={() => {
                    setConstellationTab('search');
                    onNavigate('search');
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
                  }}
                  totalCoursesCount={courses.length}
                />

                <ConstellationCourseCatalog
                  courses={courses}
                  onSelectCourse={handleSelectCourse}
                  onPrefetchCourse={handlePrefetchCourse}
                />
                <ConstellationPillars />
                <ConstellationTestimonials />
              </motion.div>
            )}

            {/* 2. Vista Búsqueda Sináptica Inmersiva */}
            {constellationTab === 'search' && (
              <motion.div
                key="view-search"
                variants={pageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full"
              >
                <ConstellationNeuralSearch
                  courses={courses}
                  onSelectCourse={handleSelectCourse}
                  onOpenLesson={(selected) => handleSelectCourse(selected)}
                />
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
                  courses={courses}
                  onSelectCourse={handleSelectCourse}
                  onPrefetchCourse={handlePrefetchCourse}
                />
                <ConstellationPillars />
                <ConstellationTestimonials />
              </motion.div>
            )}

            {/* 4. Vista Reproductor Inmersivo */}
            {constellationTab === 'viewer' && currentCourse && (
              <motion.div
                key={`view-viewer-${currentCourse.id}`}
                variants={pageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full"
              >
                <ConstellationCourseViewer
                  course={currentCourse}
                  currentUser={currentUser}
                  hasAccess={hasAccess}
                  onOpenPaywall={onOpenPaywall}
                  onGoHome={() => {
                    setConstellationTab('courses');
                    onNavigate('courses');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onSelectCourse={handleSelectCourse}
                  courses={courses}
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
                  No hay un curso seleccionado
                </h2>
                <p className="font-constellation-body text-white/50 text-sm mb-6">
                  Selecciona un curso desde el catálogo para iniciar la reproducción inmersiva.
                </p>
                <button
                  onClick={() => {
                    setConstellationTab('courses');
                    onNavigate('courses');
                  }}
                  className="btn-constellation-pill text-xs"
                >
                  Explorar Catálogo
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
                      courses={courses}
                      onRefreshCourses={onRefreshData}
                    />
                  </div>
                ) : (
                  <div className="max-w-md mx-auto py-24 px-6 text-center animate-fade-in">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Users className="w-7 h-7" />
                    </div>
                    <h2 className="font-constellation-display text-2xl text-slate-900 dark:text-white mb-2">
                      Zona de Mentoría
                    </h2>
                    <p className="font-constellation-body text-slate-600 dark:text-white/60 text-sm mb-6">
                      Inicia sesión con credenciales autorizadas de Mentor o Administrador para gestionar el aula y tus alumnos.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={onOpenAuth}
                        className="cursor-pointer px-6 py-2.5 rounded-full bg-[#8052ff] hover:bg-[#7042f0] text-white font-constellation-label text-xs font-semibold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(128,82,255,0.35)]"
                      >
                        Iniciar Sesión
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConstellationTab('explore');
                          onNavigate('landing');
                        }}
                        className="cursor-pointer px-5 py-2.5 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white font-constellation-label text-xs font-semibold tracking-wider transition-all"
                      >
                        Volver al Inicio
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
                      Panel de Administración
                    </h2>
                    <p className="font-constellation-body text-slate-600 dark:text-white/60 text-sm mb-6">
                      Debes iniciar sesión con una cuenta de Administrador de DocentOS para acceder al panel de control.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={onOpenAuth}
                        className="cursor-pointer px-6 py-2.5 rounded-full bg-[#8052ff] hover:bg-[#7042f0] text-white font-constellation-label text-xs font-semibold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(128,82,255,0.35)]"
                      >
                        Iniciar Sesión
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConstellationTab('explore');
                          onNavigate('landing');
                        }}
                        className="cursor-pointer px-5 py-2.5 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white font-constellation-label text-xs font-semibold tracking-wider transition-all"
                      >
                        Volver al Inicio
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Pestaña VIP Paywall si activo */}
            {activeTab === 'vip' && currentUser && currentCourse && (
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
          </AnimatePresence>
        </Suspense>
      </main>

      {/* Footer Oficial de DocentOS Principal adaptado a la estética Constellation */}
      <ConstellationFooter
        onGoToCourses={() => {
          setConstellationTab('courses');
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
        }}
        onGoToSearch={() => {
          setConstellationTab('search');
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
        }}
      />

    </div>
  );
};
