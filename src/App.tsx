/**
 * DocentOS - Aplicación Principal con Interfaz Constellation
 * Plataforma Web de Educación y Mentoría de Alto Nivel
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ConstellationAppShell } from './experiences/constellation/ConstellationAppShell';
import { api } from './lib/api';
import { User, Course } from './types';
import { RefreshCw } from 'lucide-react';
import { initSavedTheme } from './lib/themeApplicator';
import { applySeasonalTheme } from './lib/seasonalTheme';
import { pluginManager } from './plugins/PluginManager';
import { setCustomBrandName, setCustomCampusName, setCustomLogoUrl } from './lib/logoConfig';

const PaywallModal = lazy(() => import('./components/PaywallModal').then((m) => ({ default: m.PaywallModal })));
const AuthModal = lazy(() => import('./components/AuthModal').then((m) => ({ default: m.AuthModal })));
const ChangePasswordModal = lazy(() => import('./components/ChangePasswordModal').then((m) => ({ default: m.ChangePasswordModal })));
const SetupWizard = lazy(() => import('./components/SetupWizard').then((m) => ({ default: m.SetupWizard })));
const AIAssistantTour = lazy(() => import('./components/AIAssistantTour').then((m) => ({ default: m.AIAssistantTour })));
const CertificateVerifyModal = lazy(() => import('./components/CertificateVerifyModal').then((m) => ({ default: m.CertificateVerifyModal })));
const ContractSignatureModal = lazy(() => import('./components/ContractSignatureModal').then((m) => ({ default: m.ContractSignatureModal })));
const ListeningBoxModal = lazy(() => import('./components/ListeningBoxModal').then((m) => ({ default: m.ListeningBoxModal })));

// Inicializar tema y festividad inmediatamente para evitar parpadeos
initSavedTheme();
applySeasonalTheme();

type ActiveTab = 'landing' | 'courses' | 'mentor' | 'admin' | 'plugins' | 'vip';

const TAB_PATHS: Record<ActiveTab, string> = {
  landing: '/',
  courses: '/courses',
  mentor: '/mentor/dashboard',
  admin: '/admin',
  plugins: '/admin/plugins',
  vip: '/vip',
};

function tabFromPath(pathname: string): ActiveTab {
  if (pathname.startsWith('/admin/plugins')) return 'plugins';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/mentor')) return 'mentor';
  if (pathname.startsWith('/courses')) return 'courses';
  if (pathname.startsWith('/vip')) return 'vip';
  return 'landing';
}

const LAST_COURSE_KEY = 'docentos_last_course_id';

function readLastCourseId(): string | null {
  try {
    return localStorage.getItem(LAST_COURSE_KEY);
  } catch {
    return null;
  }
}

const CACHED_COURSES_KEY = 'docentos_cached_courses_v1';
const CACHED_USER_KEY = 'docentos_cached_user_v1';

function readCachedUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && parsed.id ? (parsed as User) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null) {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CACHED_USER_KEY);
    }
  } catch {}
}

function readCachedCourses(): Course[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CACHED_COURSES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCachedCourses(courses: Course[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHED_COURSES_KEY, JSON.stringify(courses));
  } catch {}
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => readCachedUser());
  const [courses, setCourses] = useState<Course[]>(() => readCachedCourses());
  const [course, setCourse] = useState<Course | null>(() => {
    const cached = readCachedCourses();
    const lastId = readLastCourseId();
    if (cached.length > 0) {
      return (lastId ? cached.find((c) => c.id === lastId) : null) || cached[0] || null;
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(() => readCachedCourses().length === 0);
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
  const [pendingContract, setPendingContract] = useState<any | null>(null);
  const [showListening, setShowListening] = useState<boolean>(false);
  const [unreadListening, setUnreadListening] = useState<number>(0);

  const navigateTo = (tab: ActiveTab, options?: { replace?: boolean }) => {
    const path = TAB_PATHS[tab] || '/';
    if (window.location.pathname !== path) {
      if (options?.replace) window.history.replaceState({}, '', path);
      else window.history.pushState({}, '', path);
    }
    setActiveTabState(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      console.warn('No se pudo verificar el estado del setup:', e);
    }
    return false;
  };

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const [setupResult, authResult, coursesResult] = await Promise.allSettled([
        checkSetupStatus(),
        api.getCurrentUser(),
        api.getCourses(),
      ]);

      const setupNeeded = setupResult.status === 'fulfilled' && Boolean(setupResult.value);
      if (setupNeeded) {
        setShowSetupWizard(true);
        if (!silent) setLoading(false);
        return;
      }

      let authUser: User | null = null;
      if (authResult.status === 'fulfilled' && authResult.value?.authenticated) {
        authUser = authResult.value?.user ?? null;
        setCurrentUser(authUser);
        writeCachedUser(authUser);
        if (authUser) {
          try {
            const [pendingRes, pluginsRes] = await Promise.allSettled([
              api.contracts.getPending(),
              api.getPlugins(),
            ]);
            if (pendingRes.status === 'fulfilled' && pendingRes.value.requiresSignature && pendingRes.value.contract) {
              setPendingContract(pendingRes.value.contract);
            }
            if (pluginsRes.status === 'fulfilled' && pluginsRes.value?.plugins) {
              pluginManager.setPlugins(pluginsRes.value.plugins);
            }
          } catch {
            // Silencioso
          }
        }
      } else {
        setCurrentUser(null);
        writeCachedUser(null);
        setPendingContract(null);
        try {
          const brandRes = await api.getPublicBrand();
          if (brandRes?.brandName) {
            setCustomBrandName(brandRes.brandName);
          }
          if (brandRes?.campusName) {
            setCustomCampusName(brandRes.campusName);
          }
          if (brandRes?.logoUrl !== undefined) {
            setCustomLogoUrl(brandRes.logoUrl);
          }
        } catch {
          // Silencioso
        }
      }

      if (coursesResult.status === 'fulfilled') {
        const coursesRes = coursesResult.value;
        if (coursesRes.courses && coursesRes.courses.length > 0) {
          setCourses(coursesRes.courses);
          writeCachedCourses(coursesRes.courses);

          let lastStudiedId: string | null = readLastCourseId();
          if (authUser) {
            try {
              const prog = await api.getProgress();
              if (prog.lastCourseId) lastStudiedId = prog.lastCourseId;
            } catch {}
          }

          const preferred = lastStudiedId
            ? coursesRes.courses.find((c) => c.id === lastStudiedId)
            : null;
          setCourse(preferred ?? coursesRes.courses[0]);
        } else {
          setCourses([]);
          setCourse(null);
        }
      }
    } catch (err) {
      console.error("Error al inicializar datos:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handlePopState = () => setActiveTabState(tabFromPath(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error('Error en logout:', err);
    } finally {
      writeCachedUser(null);
      setCurrentUser(null);
      setCourse(null);
      navigateTo('landing');
      loadData();
    }
  };

  const selectCourse = (c: Course) => {
    setCourse(c);
    try {
      localStorage.setItem(LAST_COURSE_KEY, c.id);
    } catch {}
  };

  const handlePaymentSuccess = () => {
    setShowPaywallModal(false);
    loadData();
  };

  const handleVipActivated = () => {
    setShowPaywallModal(false);
    loadData();
  };

  const handleOpenListening = () => {
    if (!currentUser) {
      setAuthMode('login');
      setAuthNotice('Inicia sesión para dejarnos tu aporte o sugerencia en el buzón.');
      setShowAuthModal(true);
      return;
    }
    setShowListening(true);
  };

  const hasAccess = Boolean(
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'MENTOR' ||
    currentUser?.role === 'VIP'
  );

  if (showSetupWizard) {
    return (
      <Suspense fallback={null}>
        <SetupWizard
          onSetupComplete={() => {
            setShowSetupWizard(false);
            setIsSetupRequired(false);
            loadData();
          }}
        />
      </Suspense>
    );
  }

  // Solo bloquear con spinner si se accede directamente a una ruta privada (admin/mentor) mientras se valida la sesión
  if (loading && (activeTab === 'admin' || activeTab === 'plugins' || activeTab === 'mentor')) {
    return (
      <div className="min-h-screen bg-[#07070b] text-white flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#0f0f17] border border-white/10 text-[#06b6d4] flex items-center justify-center animate-pulse">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-sm font-semibold text-slate-400">Iniciando DocentOS Constellation...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#07070b] text-slate-900 dark:text-white flex flex-col selection:bg-[#06b6d4] selection:text-[#050505] font-sans">
      
      {/* Experiencia Principal Oficial: DocentOS Constellation */}
      <ConstellationAppShell
        currentUser={currentUser}
        courses={courses}
        activeCourse={course}
        activeTab={activeTab === 'landing' ? 'explore' : activeTab}
        hasAccess={hasAccess}
        onNavigate={(tab) => navigateTo(tab)}
        onSelectCourse={(selected) => {
          selectCourse(selected);
          window.scrollTo({ top: 0 });
        }}
        onOpenAuth={() => {
          setAuthMode('login');
          setAuthNotice(null);
          setShowAuthModal(true);
        }}
        onLogout={handleLogout}
        onOpenPaywall={() => setShowPaywallModal(true)}
        onRefreshData={() => loadData(true)}
        onPaymentSuccess={handlePaymentSuccess}
        onVipActivated={handleVipActivated}
        onRestartTour={() => setShowTour(true)}
        onOpenVerifyModal={() => {
          setVerifyCode('');
          setShowVerifyModal(true);
        }}
        onOpenListening={handleOpenListening}
        onChangePassword={() => setShowChangePasswordModal(true)}
        unreadListening={unreadListening}
      />

      {/* Modales diferidos (Lazy Loaded) para no penalizar la carga inicial */}
      <Suspense fallback={null}>
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            initialMode={authMode}
            initialMessage={authNotice}
            onClose={() => setShowAuthModal(false)}
            onSuccess={(user, redirectPath) => {
              setCurrentUser(user);
              writeCachedUser(user);
              setAuthNotice(null);
              loadData();
              navigateTo(tabFromPath(redirectPath));
              if (!localStorage.getItem('giantucchi_tour_completed')) {
                setShowTour(true);
              }
            }}
          />
        )}

        {showChangePasswordModal && (
          <ChangePasswordModal
            isOpen={showChangePasswordModal}
            onClose={() => setShowChangePasswordModal(false)}
            onChanged={(message) => {
              setShowChangePasswordModal(false);
              writeCachedUser(null);
              setCurrentUser(null);
              setCourse(null);
              setAuthMode('login');
              setAuthNotice(message);
              navigateTo('landing');
              setShowAuthModal(true);
            }}
          />
        )}

        {showPaywallModal && currentUser && course && (
          <div
            className="fixed inset-0 z-50 bg-[#07070b]/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in overscroll-contain"
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="relative max-w-4xl w-full">
              <button
                onClick={() => setShowPaywallModal(false)}
                className="absolute top-4 right-4 z-20 text-slate-400 hover:text-white bg-[#141420] border border-white/10 p-2 rounded-xl transition-all"
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

        {showTour && currentUser && activeTab !== 'landing' && (
          <AIAssistantTour
            onHighlightTab={(tab) => navigateTo(tab)}
            onClose={() => setShowTour(false)}
          />
        )}

        {showVerifyModal && (
          <CertificateVerifyModal
            isOpen={showVerifyModal}
            onClose={() => setShowVerifyModal(false)}
            initialCode={verifyCode}
          />
        )}

        {currentUser && showListening && (
          <ListeningBoxModal
            isOpen={showListening}
            onClose={() => setShowListening(false)}
            courses={courses}
            onUnreadChange={setUnreadListening}
          />
        )}

        {pendingContract && currentUser && (
          <ContractSignatureModal
            contractData={pendingContract}
            onSuccess={() => {
              setPendingContract(null);
              loadData();
            }}
          />
        )}
      </Suspense>

    </div>
  );
}
