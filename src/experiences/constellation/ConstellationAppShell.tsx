import React, { useState, useEffect, useRef } from 'react';
import { User, Course } from '../../types';
import { api } from '../../lib/api';
import { ConstellationNavbar, ConstellationTab } from './ConstellationNavbar';
import { ConstellationHero } from './ConstellationHero';
import { ConstellationNeuralSearch } from './ConstellationNeuralSearch';
import { ConstellationCourseCatalog } from './ConstellationCourseCatalog';
import { ConstellationCourseViewer } from './ConstellationCourseViewer';
import { ConstellationPillars } from './ConstellationPillars';
import { ConstellationTestimonials } from './ConstellationTestimonials';
import { ConstellationFooter } from './ConstellationFooter';
import { ConstellationCanvas } from './ConstellationCanvas';
import { Shield, Users } from 'lucide-react';
import { AdminDashboard } from '../../components/AdminDashboard';
import { MentorDashboard } from '../../components/MentorDashboard';
import { PaywallModal } from '../../components/PaywallModal';

import { getSeasonalTheme, SeasonalTheme } from '../../lib/seasonalTheme';
import { SeasonalGlobalOverlay } from '../../components/SeasonalGlobalOverlay';

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

  // Auto-prefetch proactivo en segundo plano de cursos con retraso y límite para no saturar móviles
  useEffect(() => {
    if (!courses || courses.length === 0) return;
    // En móviles posponer y limitar el prefetch para no competir con el renderizado inicial
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const timer = setTimeout(() => {
      const sliceCount = isMobile ? 2 : 4;
      courses.slice(0, sliceCount).forEach((c) => {
        handlePrefetchCourse(c.id);
      });
    }, isMobile ? 2500 : 800);
    return () => clearTimeout(timer);
  }, [courses]);

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
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#07070b] text-slate-900 dark:text-white flex flex-col font-sans selection:bg-[#06b6d4] selection:text-[#050505] relative">
      
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
          setConstellationTab(tab);
          if (tab === 'explore') onNavigate('landing');
          else if (tab === 'courses') onNavigate('courses');
          else if (tab === 'mentor') onNavigate('mentor');
          else if (tab === 'admin') onNavigate('admin');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenAuth={onOpenAuth}
        onLogout={onLogout}
        onRestartTour={onRestartTour}
        onOpenVerifyModal={onOpenVerifyModal}
        onOpenListening={onOpenListening}
        onChangePassword={onChangePassword}
        unreadListening={unreadListening}
      />

      {/* Lienzo 3D de Constelación Neural: solo activo en la vista Explorar para máximo rendimiento */}
      {constellationTab === 'explore' && (
        <ConstellationCanvas fullScreen />
      )}

      {/* Contenido Dinámico */}
      <main className="flex-1 w-full relative z-10">
        
        {/* 1. Vista Explorar: Hero con Constelación 3D + Búsqueda Neural + Muestra de Catálogo */}
        {constellationTab === 'explore' && (
          <div className="w-full">
            <ConstellationHero
              currentUser={currentUser}
              onExploreCourses={() => {
                setConstellationTab('courses');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenSearch={() => {
                setConstellationTab('search');
                window.scrollTo({ top: 0, behavior: 'smooth' });
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
          </div>
        )}

        {/* 2. Vista Búsqueda Sináptica Inmersiva */}
        {constellationTab === 'search' && (
          <ConstellationNeuralSearch
            courses={courses}
            onSelectCourse={handleSelectCourse}
            onOpenLesson={(selected) => handleSelectCourse(selected)}
          />
        )}

        {/* 3. Vista Catálogo Completo */}
        {constellationTab === 'courses' && (
          <div className="w-full">
            <ConstellationCourseCatalog
              courses={courses}
              onSelectCourse={handleSelectCourse}
              onPrefetchCourse={handlePrefetchCourse}
            />
            <ConstellationPillars />
            <ConstellationTestimonials />
          </div>
        )}

        {/* 4. Vista Reproductor Inmersivo */}
        {constellationTab === 'viewer' && currentCourse && (
          <ConstellationCourseViewer
            course={currentCourse}
            currentUser={currentUser}
            hasAccess={hasAccess}
            onOpenPaywall={onOpenPaywall}
            onGoHome={() => {
              setConstellationTab('courses');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSelectCourse={handleSelectCourse}
            courses={courses}
          />
        )}

        {/* Fallback si no hay cursos para el reproductor */}
        {constellationTab === 'viewer' && !currentCourse && (
          <div className="max-w-xl mx-auto py-24 px-6 text-center">
            <h2 className="font-constellation-display text-2xl text-white mb-2">
              No hay un curso seleccionado
            </h2>
            <p className="font-constellation-body text-white/50 text-sm mb-6">
              Selecciona un curso desde el catálogo para iniciar la reproducción inmersiva.
            </p>
            <button
              onClick={() => setConstellationTab('courses')}
              className="btn-constellation-pill text-xs"
            >
              Explorar Catálogo
            </button>
          </div>
        )}

        {/* 5. Vista Mentoría */}
        {constellationTab === 'mentor' && (
          currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'MENTOR') ? (
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
          )
        )}

        {/* 6. Vista Administración */}
        {constellationTab === 'admin' && (
          currentUser?.role === 'ADMIN' ? (
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
          )
        )}

        {/* Pestaña VIP Paywall si activo */}
        {activeTab === 'vip' && currentUser && currentCourse && (
          <div className="max-w-4xl mx-auto px-4 py-8">
            <PaywallModal
              userRole={currentUser.role}
              courseTitle={currentCourse.title}
              price={currentCourse.price}
              onPaymentSuccess={onPaymentSuccess || (() => {})}
              onVipActivated={onVipActivated || (() => {})}
            />
          </div>
        )}

      </main>

      {/* Footer Oficial de DocentOS Principal adaptado a la estética Constellation */}
      <ConstellationFooter
        onGoToCourses={() => {
          setConstellationTab('courses');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onGoToSearch={() => {
          setConstellationTab('search');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

    </div>
  );
};
