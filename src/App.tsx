/**
 * DocentOS - Aplicación Principal con Interfaz Constellation
 * Plataforma Web de Educación y Mentoría de Alto Nivel
 */

import React, { useState, useEffect } from 'react';
import { ConstellationAppShell } from './experiences/constellation/ConstellationAppShell';
import { PaywallModal } from './components/PaywallModal';
import { AuthModal } from './components/AuthModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { SetupWizard } from './components/SetupWizard';
import { AIAssistantTour } from './components/AIAssistantTour';
import { CertificateVerifyModal } from './components/CertificateVerifyModal';
import { ContractSignatureModal } from './components/ContractSignatureModal';
import { ListeningBoxModal } from './components/ListeningBoxModal';
import { api } from './lib/api';
import { User, Course } from './types';
import { RefreshCw } from 'lucide-react';
import { initSavedTheme } from './lib/themeApplicator';
import { applySeasonalTheme } from './lib/seasonalTheme';

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

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [course, setCourse] = useState<Course | null>(null);
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
      console.warn('No se pudo verificar el estado del setup:', e);
    }
    return false;
  };

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const setupNeeded = await checkSetupStatus();
      if (setupNeeded) {
        setShowSetupWizard(true);
        if (!silent) setLoading(false);
        return;
      }

      let authUser: User | null = null;
      try {
        const authRes = await api.getCurrentUser();
        authUser = authRes.user ?? null;
        setCurrentUser(authUser);
      } catch (authErr) {
        console.warn("No hay sesión activa:", authErr);
        setCurrentUser(null);
      }

      try {
        let lastStudiedId: string | null = null;
        if (authUser) {
          try {
            const prog = await api.getProgress();
            lastStudiedId = prog.lastCourseId ?? null;
          } catch {}
        }

        const coursesRes = await api.getCourses();
        if (coursesRes.courses && coursesRes.courses.length > 0) {
          setCourses(coursesRes.courses);

          const preferredId = lastStudiedId || readLastCourseId();
          const preferred = preferredId
            ? coursesRes.courses.find((c) => c.id === preferredId)
            : null;
          setCourse(preferred ?? coursesRes.courses[0]);
        } else {
          setCourses([]);
          setCourse(null);
        }
      } catch (courseErr) {
        console.error("Error al cargar cursos:", courseErr);
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
      <SetupWizard
        onSetupComplete={() => {
          setShowSetupWizard(false);
          setIsSetupRequired(false);
          loadData();
        }}
      />
    );
  }

  if (loading) {
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

      {/* Modal Cambio de Contraseña */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        onChanged={(message) => {
          setShowChangePasswordModal(false);
          setCurrentUser(null);
          setCourse(null);
          setAuthMode('login');
          setAuthNotice(message);
          navigateTo('landing');
          setShowAuthModal(true);
        }}
      />

      {/* Modal Paywall Overlay */}
      {showPaywallModal && currentUser && course && (
        <div className="fixed inset-0 z-50 bg-[#07070b]/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
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

      {/* Tour Asistente */}
      {showTour && currentUser && activeTab !== 'landing' && (
        <AIAssistantTour
          onHighlightTab={(tab) => navigateTo(tab)}
          onClose={() => setShowTour(false)}
        />
      )}

      {/* Modal Verificación Pública de Certificados */}
      <CertificateVerifyModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        initialCode={verifyCode}
      />

      {/* Buzón de Escucha Modal */}
      {currentUser && (
        <ListeningBoxModal
          isOpen={showListening}
          onClose={() => setShowListening(false)}
          courses={courses}
          onUnreadChange={setUnreadListening}
        />
      )}

      {/* Modal Obligatorio Firma de Contrato */}
      {pendingContract && currentUser && (
        <ContractSignatureModal
          contractData={pendingContract}
          onSuccess={() => {
            setPendingContract(null);
            loadData();
          }}
        />
      )}

    </div>
  );
}
