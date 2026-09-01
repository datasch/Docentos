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
import { SetupWizard } from './components/SetupWizard';
import { AIAssistantTour } from './components/AIAssistantTour';
import { api } from './lib/api';
import { User, Course, UserRole } from './types';
import { siteConfig } from './config/theme';
import { DOCENTOS_VERSION } from './version';
import { RefreshCw, Crown, Shield, Sparkles, CheckCircle2, ExternalLink } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allDemoUsers, setAllDemoUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [course, setCourse] = useState<Course | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSetupRequired, setIsSetupRequired] = useState<boolean>(false);
  const [showSetupWizard, setShowSetupWizard] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'landing' | 'courses' | 'mentor' | 'admin' | 'plugins' | 'drive' | 'vip'>('landing');
  const [showPaywallModal, setShowPaywallModal] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showTour, setShowTour] = useState<boolean>(false);

  const checkSetupStatus = async () => {
    try {
      const res = await fetch('/api/setup/status');
      if (res.ok) {
        const data = await res.json();
        if (data.isSetupRequired) {
          setIsSetupRequired(true);
        }
      }
    } catch (e) {
      console.log('Setup check note:', e);
    }
  };

  const loadData = async () => {
    try {
      await checkSetupStatus();

      const userRes = await api.getCurrentUser();
      setCurrentUser(userRes.user);
      setAllDemoUsers(userRes.allDemoUsers);

      const courseRes = await api.getCourses();
      if (courseRes.courses && courseRes.courses.length > 0) {
        setCourses(courseRes.courses);
        setCourse(courseRes.courses[0]);
        setHasAccess(courseRes.hasAccess);
      }

      // Check if onboarding assistant tour should trigger
      const isTourDone = localStorage.getItem('giantucchi_tour_completed');
      if (!isTourDone) {
        setShowTour(true);
      }
    } catch (error) {
      console.error('Error al cargar datos iniciales de Academia Giantucchi:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSetupComplete = async (adminUser: User, updatedAppName?: string) => {
    if (updatedAppName) {
      siteConfig.appName = updatedAppName;
    }
    setIsSetupRequired(false);
    setShowSetupWizard(false);
    setCurrentUser(adminUser);
    await loadData();
  };

  if (isSetupRequired || showSetupWizard) {
    return <SetupWizard onSetupComplete={handleSetupComplete} />;
  }

  const handleRoleSwitch = async (role: UserRole, userId?: string) => {
    setLoading(true);
    try {
      const res = await api.switchRole(role, userId);
      if (res.user) {
        setCurrentUser(res.user);
      }
      await loadData();
    } catch (error) {
      console.error('Error al cambiar de rol:', error);
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    setShowPaywallModal(false);
    await loadData();
  };

  const handleVipActivated = async () => {
    setShowPaywallModal(false);
    setActiveTab('courses');
    await loadData();
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.error('Logout error:', e);
    }
    const userRes = await api.getCurrentUser();
    setCurrentUser(userRes.user);
    setActiveTab('landing');
  };

  const isAuthenticated = Boolean(
    currentUser &&
    currentUser.role !== 'PUBLIC_USER' &&
    currentUser.role !== 'EXTERNAL' &&
    activeTab !== 'landing'
  );

  if (loading || !currentUser || !course) {
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
          currentUser={currentUser}
          allDemoUsers={allDemoUsers}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onRoleSwitch={handleRoleSwitch}
          hasAccess={hasAccess}
          onRestartTour={() => setShowTour(true)}
          onLogout={handleLogout}
        />
      )}

      {/* Main Content Area based on Active Tab */}
      <main className="flex-1 animate-fade-in">
        
        {activeTab === 'landing' && (
          <LandingPage
            courses={courses}
            currentUser={currentUser}
            onOpenAuth={(mode) => {
              setAuthMode(mode);
              setShowAuthModal(true);
            }}
            onExploreCourse={(selectedCourse) => {
              setCourse(selectedCourse);
              setActiveTab('courses');
            }}
          />
        )}

        {activeTab === 'courses' && (
          <div>
            {!hasAccess && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-gradient text-white flex items-center justify-center shrink-0 shadow-md">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Muro de Pago Activo (Usuario Externo)</h4>
                      <p className="text-xs text-slate-400">
                        Paga el curso o activa tu Pase VIP para desbloquear las clases y mentorías.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowPaywallModal(true)}
                    className="btn-brand-primary px-4 py-2 text-xs font-extrabold shrink-0"
                  >
                    Activar Pase VIP / Comprar Acceso
                  </button>
                </div>
              </div>
            )}

            <CourseViewer
              course={course}
              currentUser={currentUser}
              hasAccess={hasAccess}
              onOpenPaywall={() => setShowPaywallModal(true)}
            />
          </div>
        )}

        {activeTab === 'mentor' && (
          <MentorDashboard
            currentUser={currentUser}
            courses={courses}
            onRefreshCourses={loadData}
          />
        )}

        {activeTab === 'admin' && (
          <AdminDashboard
            course={course}
            onRefreshData={loadData}
          />
        )}

        {activeTab === 'plugins' && (
          <div className="max-w-7xl mx-auto p-4 sm:p-8">
            <PluginManagerView />
          </div>
        )}

        {activeTab === 'drive' && (
          <DriveExplorerModal
            userRole={currentUser.role}
            modules={course.modules}
            onVideoLinked={loadData}
          />
        )}

        {activeTab === 'vip' && (
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
          onClose={() => setShowAuthModal(false)}
          onSuccess={(user, redirectPath) => {
            setCurrentUser(user);
            loadData();
            if (redirectPath === '/mentor/dashboard') {
              setActiveTab('mentor');
            } else if (redirectPath === '/admin/plugins') {
              setActiveTab('plugins');
            } else {
              setActiveTab('courses');
            }
          }}
        />

        {/* Modal overlay if triggered from CourseViewer */}
        {showPaywallModal && (
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
                price={course.price}
                onPaymentSuccess={handlePaymentSuccess}
                onVipActivated={handleVipActivated}
              />
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-[#0a0a0f] border-t border-[#2d2d44] py-6 px-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row items-center gap-2 font-bold text-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-lg bg-brand-gradient text-white font-black text-[10px] flex items-center justify-center shadow-sm">
                {siteConfig.logoInitial}
              </div>
              <span className="text-white uppercase">{siteConfig.appName}</span>
              <span className="text-slate-500 font-normal">© {new Date().getFullYear()}</span>
            </div>
            <span className="text-[11px] text-slate-500 font-normal hidden md:inline">
              • {siteConfig.authorCredit}
            </span>
          </div>

          {/* White-Label Credit */}
          <div className="flex items-center gap-2">
            <a
              href={siteConfig.poweredByLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1a1a2e] border border-[#2d2d44] hover:border-[#06b6d4] text-slate-300 hover:text-white transition-all text-[11px] font-medium group shadow-sm"
            >
              <span>{siteConfig.poweredByText}</span>
              <ExternalLink className="w-3 h-3 text-[#06b6d4] group-hover:scale-110 transition-transform" />
            </a>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-[#06b6d4]">
            <CheckCircle2 className="w-3.5 h-3.5" /> DocentOS v{DOCENTOS_VERSION} · Alpha
          </div>
        </div>
      </footer>

      {/* Onboarding Assistant Ian Tour */}
      {showTour && (
        <AIAssistantTour
          onHighlightTab={(tab) => setActiveTab(tab)}
          onClose={() => setShowTour(false)}
        />
      )}

    </div>
  );
}
