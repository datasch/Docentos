/**
 * Academia Giantucchi - Aplicación Principal
 * Plataforma Web de Educación y Mentoría de Alto Nivel
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CourseViewer } from './components/CourseViewer';
import { DriveExplorerModal } from './components/DriveExplorerModal';
import { PaywallModal } from './components/PaywallModal';
import { AdminDashboard } from './components/AdminDashboard';
import { MentorDashboard } from './components/MentorDashboard';
import { PluginManagerView } from './components/PluginManagerView';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { SetupWizard } from './components/SetupWizard';
import { AIAssistantTour } from './components/AIAssistantTour';
import { CertificateVerifyModal } from './components/CertificateVerifyModal';
import { api } from './lib/api';
import { User, Course } from './types';
import { siteConfig } from './config/theme';
import { DOCENTOS_VERSION, DOCENTOS_RELEASE_CHANNEL } from './version';
import { RefreshCw, Crown, Shield, Sparkles, CheckCircle2, ExternalLink } from 'lucide-react';

type ActiveTab = 'landing' | 'courses' | 'mentor' | 'admin' | 'plugins' | 'drive' | 'vip';

const TAB_PATHS: Record<ActiveTab, string> = {
  landing: '/',
  courses: '/courses',
  mentor: '/mentor/dashboard',
  admin: '/admin',
  plugins: '/admin/plugins',
  drive: '/drive',
  vip: '/vip',
};

function tabFromPath(pathname: string): ActiveTab {
  if (pathname.startsWith('/admin/plugins')) return 'plugins';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/mentor')) return 'mentor';
  if (pathname.startsWith('/courses')) return 'courses';
  if (pathname.startsWith('/drive')) return 'drive';
  if (pathname.startsWith('/vip')) return 'vip';
  return 'landing';
}

/** Dónde estaba estudiando el alumno en este navegador. */
const LAST_COURSE_KEY = 'docentos_last_course_id';

function readLastCourseId(): string | null {
  try {
    return localStorage.getItem(LAST_COURSE_KEY);
  } catch {
    // Navegación privada o almacenamiento bloqueado: se recurre al progreso.
    return null;
  }
}

const releaseChannelLabel =
  DOCENTOS_RELEASE_CHANNEL.charAt(0).toUpperCase() + DOCENTOS_RELEASE_CHANNEL.slice(1);

function canOpenTab(user: User | null, tab: ActiveTab) {
  if (tab === 'landing') return true;
  if (!user) return false;
  if (tab === 'admin') return user.role === 'ADMIN';
  if (['mentor', 'plugins', 'drive'].includes(tab)) {
    return user.role === 'ADMIN' || user.role === 'MENTOR';
  }
  return true;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [course, setCourse] = useState<Course | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSetupRequired, setIsSetupRequired] = useState<boolean>(false);
  const [showSetupWizard, setShowSetupWizard] = useState<boolean>(false);

  const [activeTab, setActiveTabState] = useState<ActiveTab>(() => tabFromPath(window.location.pathname));
  const [showPaywallModal, setShowPaywallModal] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [showTour, setShowTour] = useState<boolean>(false);
  const [showVerifyModal, setShowVerifyModal] = useState<boolean>(false);
  const [verifyCode, setVerifyCode] = useState<string>('');

  const navigateTo = (tab: ActiveTab, options?: { replace?: boolean }) => {
    const path = TAB_PATHS[tab];
    if (window.location.pathname !== path) {
      if (options?.replace) window.history.replaceState({}, '', path);
      else window.history.pushState({}, '', path);
    }
    setActiveTabState(tab);
    window.scrollTo({ top: 0 });
  };

  const checkSetupStatus = async () => {
    try {
      const res = await fetch('/api/setup/status');
      if (res.ok) {
        const data = await res.json();
        const setupRequired = Boolean(data.isSetupRequired);
        setIsSetupRequired(setupRequired);
        return setupRequired;
      }
    } catch (e) {
      console.log('Setup check note:', e);
    }
    return false;
  };

  /**
   * Abrir un curso lo deja apuntado como el último en el que se estudió, para
   * volver a él en la siguiente visita en vez de al primero del catálogo.
   */
  const selectCourse = (selected: Course) => {
    setCourse(selected);
    try {
      localStorage.setItem(LAST_COURSE_KEY, selected.id);
    } catch {
      /* sin almacenamiento el curso sigue abierto, solo no se recuerda */
    }
  };

  const loadData = async () => {
    try {
      const setupRequired = await checkSetupStatus();
      if (setupRequired) return;

      const userRes = await api.getCurrentUser();
      setCurrentUser(userRes.user);

      // El curso de la última lección marcada. Sirve cuando el navegador no
      // recuerda nada (otro equipo, datos borrados): es la huella de estudio
      // que sí viaja con la cuenta.
      let lastStudiedId: string | null = null;
      if (userRes.user) {
        try {
          lastStudiedId = (await api.getProgress()).lastCourseId ?? null;
        } catch {
          /* sin progreso todavía; se abrirá el primero del catálogo */
        }
      }

      const courseRes = await api.getCourses();
      if (courseRes.courses && courseRes.courses.length > 0) {
        const list = courseRes.courses;
        setCourses(list);
        setHasAccess(courseRes.hasAccess);

        setCourse((current) => {
          // Al recargar datos se conserva el curso abierto —antes se volvía
          // siempre al primero, perdiendo el que el alumno estaba viendo—,
          // pero apuntando a la instancia recién traída del servidor.
          const stillOpen = current && list.find((item) => item.id === current.id);
          if (stillOpen) return stillOpen;

          const remembered = list.find((item) => item.id === readLastCourseId());
          const lastStudied = list.find((item) => item.id === lastStudiedId);
          return remembered || lastStudied || list[0];
        });
      }

      // El tour NO se lanza al restaurar la sesion: navega entre pestañas y
      // expulsaria al usuario de la ruta que acaba de recargar. Solo arranca
      // tras un inicio de sesion explicito (ver AuthModal onSuccess).
    } catch (error) {
      console.error('Error al cargar datos iniciales de Academia Giantucchi:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (new URLSearchParams(window.location.search).has('resetToken')) {
      setAuthMode('login');
      setShowAuthModal(true);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => setActiveTabState(tabFromPath(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (loading || canOpenTab(currentUser, activeTab)) return;
    navigateTo(currentUser ? 'courses' : 'landing', { replace: true });
  }, [activeTab, currentUser, loading]);

  const handleSetupComplete = async (adminUser: User, updatedAppName?: string) => {
    if (updatedAppName) {
      siteConfig.appName = updatedAppName;
    }
    setIsSetupRequired(false);
    setShowSetupWizard(false);
    setCurrentUser(adminUser);
    navigateTo('admin', { replace: true });
    await loadData();
  };

  if (isSetupRequired || showSetupWizard) {
    return <SetupWizard onSetupComplete={handleSetupComplete} />;
  }

  const handlePaymentSuccess = async () => {
    setShowPaywallModal(false);
    await loadData();
  };

  const handleVipActivated = async () => {
    setShowPaywallModal(false);
    navigateTo('courses');
    await loadData();
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.error('Logout error:', e);
    }
    setCurrentUser(null);
    setHasAccess(false);
    setShowTour(false);
    navigateTo('landing');
  };

  const isAuthenticated = Boolean(currentUser && activeTab !== 'landing');

  if (loading || !course) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#141420] border border-[#2d2d44] text-[#06b6d4] flex items-center justify-center animate-pulse">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-sm font-semibold text-slate-400">Iniciando Academia Giantucchi...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col selection:bg-[#a855f7] selection:text-white font-sans">
      
      {/* App Private Navbar (ONLY rendered when user is authenticated and inside app views) */}
      {isAuthenticated && (
        <Navbar
          currentUser={currentUser!}
          activeTab={activeTab}
          setActiveTab={navigateTo}
          hasAccess={hasAccess}
          onRestartTour={() => setShowTour(true)}
          onChangePassword={() => setShowChangePasswordModal(true)}
          onLogout={handleLogout}
          onOpenVerifyModal={() => {
            setVerifyCode('');
            setShowVerifyModal(true);
          }}
          courses={courses}
          onSelectCourse={(selected) => {
            selectCourse(selected);
            navigateTo('courses');
          }}
        />
      )}

      {/* Main Content Area based on Active Tab */}
      <main className="flex-1 animate-fade-in">
        
        {activeTab === 'landing' && (
          <LandingPage
            courses={courses}
            currentUser={currentUser}
            onGoToApp={() => navigateTo(currentUser?.role === 'ADMIN' ? 'admin' : 'courses')}
            onLogout={handleLogout}
            onOpenAuth={(mode) => {
              setAuthMode(mode);
              setAuthNotice(null);
              setShowAuthModal(true);
            }}
            onExploreCourse={(selectedCourse) => {
              selectCourse(selectedCourse);
              if (currentUser) navigateTo('courses');
              else {
                setAuthMode('login');
                setAuthNotice(null);
                setShowAuthModal(true);
              }
            }}
          />
        )}

        {activeTab === 'courses' && currentUser && (
          <div>
            {!hasAccess && (
              <div className="mx-auto w-full max-w-[1800px] px-4 pt-6 lg:px-6">
                <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <Sparkles aria-hidden className="h-5 w-5 shrink-0 text-brand-cyan" />
                    <div>
                      <h2 className="text-section font-semibold text-ink">Estás viendo una vista previa</h2>
                      <p className="mt-0.5 text-meta text-ink-muted">
                        Las clases y la mentoría se abren al activar tu acceso.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowPaywallModal(true)}
                    className="btn-brand-primary shrink-0 px-4 py-2.5 text-meta"
                  >
                    Activar acceso
                  </button>
                </div>
              </div>
            )}

            <CourseViewer
              course={course}
              currentUser={currentUser}
              hasAccess={hasAccess}
              onOpenPaywall={() => setShowPaywallModal(true)}
              courses={courses}
              onSelectCourse={(selected) => {
                selectCourse(selected);
                window.scrollTo({ top: 0 });
              }}
              onGoHome={() => navigateTo('landing')}
            />
          </div>
        )}

        {activeTab === 'mentor' && currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'MENTOR') && (
          <MentorDashboard
            currentUser={currentUser}
            courses={courses}
            onRefreshCourses={loadData}
          />
        )}

        {activeTab === 'admin' && currentUser?.role === 'ADMIN' && (
          <AdminDashboard
            course={course}
            onRefreshData={loadData}
          />
        )}

        {activeTab === 'plugins' && currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'MENTOR') && (
          <div className="max-w-7xl mx-auto p-4 sm:p-8">
            <PluginManagerView />
          </div>
        )}

        {activeTab === 'drive' && currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'MENTOR') && (
          <DriveExplorerModal
            userRole={currentUser.role}
            modules={course.modules}
            onVideoLinked={loadData}
          />
        )}

        {activeTab === 'vip' && currentUser && (
          <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
            <PaywallModal
              userRole={currentUser.role}
              courseTitle={course.title}
              price={course.price}
              onPaymentSuccess={handlePaymentSuccess}
              onVipActivated={handleVipActivated}
            />
          </div>
        )}

        {/* Modal Auth Overlay */}
        <AuthModal
          isOpen={showAuthModal}
          initialMode={authMode}
          initialMessage={authNotice}
          onClose={() => setShowAuthModal(false)}
          onSuccess={(user, redirectPath) => {
            setCurrentUser(user);
            setAuthNotice(null);
            loadData();
            navigateTo(tabFromPath(redirectPath));
            if (!localStorage.getItem('giantucchi_tour_completed')) {
              setShowTour(true);
            }
          }}
        />

        <ChangePasswordModal
          isOpen={showChangePasswordModal}
          onClose={() => setShowChangePasswordModal(false)}
          onChanged={(message) => {
            setShowChangePasswordModal(false);
            setCurrentUser(null);
            setHasAccess(false);
            setAuthMode('login');
            setAuthNotice(message);
            navigateTo('landing');
            setShowAuthModal(true);
          }}
        />

        {/* Modal overlay if triggered from CourseViewer */}
        {showPaywallModal && currentUser && (
          <div className="fixed inset-0 z-50 bg-[#0a0a0f]/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
            <div className="relative max-w-4xl w-full">
              <button
                onClick={() => setShowPaywallModal(false)}
                className="absolute top-4 right-4 z-20 text-slate-400 hover:text-white bg-[#1a1a2e] border border-[#2d2d44] p-2 rounded-xl transition-all"
              >
                ✕
              </button>
              <PaywallModal
                userRole={currentUser.role}
                courseTitle={course.title}
                courseId={course.id}
                price={course.price}
                onPaymentSuccess={handlePaymentSuccess}
                onVipActivated={handleVipActivated}
              />
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      {/* El pie cierra la pagina, asi que comparte su fondo. Pintarlo de
          #0a0a0f lo dejaba mas claro que el suelo #050505 y se leia como una
          banda encendida al final en vez de como un remate.
          La portada trae el suyo propio, en su propio sistema visual: sin este
          filtro salian dos pies seguidos al final de `/`. */}
      {activeTab !== 'landing' && (
      <footer className="border-t border-line px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col items-center gap-3 text-meta text-ink-muted md:flex-row md:justify-between">
          <div className="flex flex-col items-center gap-2 md:flex-row">
            <span className="flex items-center gap-2">
              <span className="bg-brand-gradient flex h-5 w-5 shrink-0 items-center justify-center rounded-md p-px">
                <span className="flex h-full w-full items-center justify-center rounded-[5px] bg-canvas">
                  <span className="bg-gradient-to-r from-brand-cyan to-brand-purple bg-clip-text text-micro font-black text-transparent">
                    {siteConfig.logoInitial}
                  </span>
                </span>
              </span>
              <span className="text-ink">{siteConfig.appName}</span>
              <span>© {new Date().getFullYear()}</span>
            </span>
            <span className="hidden md:inline">· {siteConfig.authorCredit}</span>
          </div>

          {/* White-Label Credit */}
          <a
            href={siteConfig.poweredByLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-surface hover:text-ink"
          >
            {siteConfig.poweredByText}
            <ExternalLink aria-hidden className="h-3 w-3" />
          </a>

          <span className="flex items-center gap-1.5 tabular-nums">
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5 text-brand-violet" />
            v{DOCENTOS_VERSION} · {releaseChannelLabel}
          </span>
        </div>
      </footer>
      )}

      {/* Onboarding Assistant Ian Tour */}
      {showTour && currentUser && activeTab !== 'landing' && (
        <AIAssistantTour
          onHighlightTab={(tab) => navigateTo(tab)}
          onClose={() => setShowTour(false)}
        />
      )}

      {/* Certificate Public Verification Modal */}
      <CertificateVerifyModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        initialCode={verifyCode}
      />

    </div>
  );
}
