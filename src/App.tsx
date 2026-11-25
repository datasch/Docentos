/**
 * DocentOS - Aplicación Principal con Interfaz Constellation
 * Plataforma Web de Educación y Mentoría de Alto Nivel
 */

import { LandingConfigProvider } from './lib/landingConfig';
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { PageLoader } from './components/loading/PageLoader';
import { ConstellationAppShell } from './experiences/constellation/ConstellationAppShell';
import { api } from './lib/api';
import {
  isPrivatePath,
  privateRouteRoleAllowed,
  privateRouteView,
  TAB_PATHS,
  tabFromPath,
  viewerPath,
  viewerCourseIdFromPath,
  type ActiveTab,
} from './lib/appRoutes';
import { courseIdFromPath, coursePath } from './lib/courseSharing';
import { User, Course } from './types';
import { patchCourseCard } from './lib/courseCardUpdate';
import { initSavedTheme } from './lib/themeApplicator';
import { applySeasonalTheme, syncSeasonalPluginState } from './lib/seasonalTheme';
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
import { ListeningFloatingButton } from './components/ListeningFloatingButton';
import { useTranslation } from 'react-i18next'

// Inicializar tema y festividad inmediatamente para evitar parpadeos
initSavedTheme();
applySeasonalTheme();

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
type PrivateRouteStatus = 'idle' | 'pending' | 'authorized' | 'unauthorized' | 'unavailable';

const LOAD_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms = LOAD_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Tiempo de espera agotado')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

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
  const { t } = useTranslation()
  const [currentUser, setCurrentUser] = useState<User | null>(() => (
    isPrivatePath(window.location.pathname) ? null : readCachedUser()
  ));
  const [courses, setCourses] = useState<Course[]>(() => readCachedCourses());
  const [course, setCourse] = useState<Course | null>(() => {
    const cached = readCachedCourses();
    const lastId = readLastCourseId();
    if (cached.length > 0) {
      return (lastId ? cached.find((c) => c.id === lastId) : null) || cached[0] || null;
    }
    return null;
  });
  const [accessVerified, setAccessVerified] = useState(false);
  const [privateRouteStatus, setPrivateRouteStatus] = useState<PrivateRouteStatus>(() => (
    isPrivatePath(window.location.pathname) ? 'pending' : 'idle'
  ));
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(() => (
    readCachedCourses().length === 0 || isPrivatePath(window.location.pathname)
  ));
  const [isSetupRequired, setIsSetupRequired] = useState<boolean>(false);
  const [showSetupWizard, setShowSetupWizard] = useState<boolean>(false);

  const [activeTab, setActiveTabState] = useState<ActiveTab>(() => tabFromPath(window.location.pathname));
  const [sharedCourseId, setSharedCourseId] = useState(() => courseIdFromPath(window.location.pathname));
  const [showPaywallModal, setShowPaywallModal] = useState<boolean>(false);
  // Quien llega desde el enlace del correo de recuperación ve directamente el
  // formulario de nueva contraseña (AuthModal lee el token de la URL).
  const [showAuthModal, setShowAuthModal] = useState<boolean>(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('resetToken'),
  );
  const [showChangePasswordModal, setShowChangePasswordModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [showTour, setShowTour] = useState<boolean>(false);
  const [showVerifyModal, setShowVerifyModal] = useState<boolean>(false);
  const [verifyCode, setVerifyCode] = useState<string>('');
  const [pendingContract, setPendingContract] = useState<any | null>(null);
  const [showListening, setShowListening] = useState<boolean>(false);
  const [unreadListening, setUnreadListening] = useState<number>(0);
  // El buzón flotante se puede cerrar: queda acoplado en el footer, junto a GitHub,
  // hasta recargar la página. No se recuerda: al volver, aparece flotando otra vez.
  const [listeningDocked, setListeningDocked] = useState<boolean>(false);
  const dockListening = () => setListeningDocked(true);

  const navigateTo = (tab: ActiveTab, options?: {
    replace?: boolean;
    privateAccess?: Extract<PrivateRouteStatus, 'authorized' | 'unauthorized' | 'pending'>;
  }) => {
    const path = TAB_PATHS[tab] || '/';
    if (window.location.pathname !== path) {
      if (options?.replace) window.history.replaceState({}, '', path);
      else window.history.pushState({}, '', path);
    }
    setSharedCourseId(null);
    setActiveTabState(tab);
    if (isPrivatePath(path)) {
      setPrivateRouteStatus(options?.privateAccess || (accessVerified
        ? privateRouteRoleAllowed(path, currentUser?.role) ? 'authorized' : 'unauthorized'
        : 'pending'));
    } else {
      setPrivateRouteStatus('idle');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const checkSetupStatus = async () => {
    try {
      const res = await withTimeout(fetch('/api/setup/status'));
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
      // Una recarga silenciosa no debe desmontar la vista privada (perdería la pestaña activa).
      const currentPath = window.location.pathname;
      const privatePath = isPrivatePath(currentPath);
      if (!silent) {
        setAccessVerified(false);
        if (privatePath && privateRouteStatus !== 'authorized') {
          setPrivateRouteStatus('pending');
        }
      }

      const setupPromise = checkSetupStatus();
      const authPromise = withTimeout(api.getCurrentUser());
      const coursesPromise = withTimeout(api.getCourses());

      const [setupResult, authResult] = await Promise.allSettled([setupPromise, authPromise]);

      const setupNeeded = setupResult.status === 'fulfilled' && Boolean(setupResult.value);
      if (setupNeeded) {
        setShowSetupWizard(true);
        if (!silent) setLoading(false);
        return;
      }

      let authUser: User | null = null;
      const activePath = window.location.pathname;
      const activePrivatePath = isPrivatePath(activePath);
      const secondaryPromises: Promise<unknown>[] = [];
      if (authResult.status === 'fulfilled' && authResult.value?.authenticated) {
        authUser = authResult.value?.user ?? null;
        setCurrentUser(authUser);
        writeCachedUser(authUser);
        if (activePrivatePath) {
          setPrivateRouteStatus(privateRouteRoleAllowed(activePath, authUser?.role) ? 'authorized' : 'unauthorized');
        }
        if (authUser) {
          secondaryPromises.push(
            Promise.allSettled([api.contracts.getPending(), api.getPlugins()])
              .then(([pendingRes, pluginsRes]) => {
                if (pendingRes.status === 'fulfilled' && pendingRes.value.requiresSignature && pendingRes.value.contract) {
                  setPendingContract(pendingRes.value.contract);
                }
                if (pluginsRes.status === 'fulfilled' && pluginsRes.value?.plugins) {
                  pluginManager.setPlugins(pluginsRes.value.plugins);
                }
              })
              .catch(() => {}),
          );
        }
      } else if (authResult.status === 'fulfilled') {
        setCurrentUser(null);
        writeCachedUser(null);
        setPendingContract(null);
        if (activePrivatePath) setPrivateRouteStatus('unauthorized');
        secondaryPromises.push(
          api
            .getPublicBrand()
            .then((brandRes) => {
              if (brandRes?.brandName) setCustomBrandName(brandRes.brandName);
              if (brandRes?.campusName) setCustomCampusName(brandRes.campusName);
              if (brandRes?.logoUrl !== undefined) setCustomLogoUrl(brandRes.logoUrl);
              if (brandRes?.festivities) syncSeasonalPluginState(brandRes.festivities);
            })
            .catch(() => {}),
        );
      } else if (activePrivatePath && (!silent || privateRouteStatus !== 'authorized')) {
        setCurrentUser(null);
        writeCachedUser(null);
        setPrivateRouteStatus('unavailable');
      }

      const [coursesResult] = await Promise.allSettled([coursesPromise, ...secondaryPromises]);

      setConnectionNotice(
        authResult.status === 'rejected' || coursesResult.status === 'rejected'
          ? t('noPudimosActualizarTusDatosIntentaloDe', 'No pudimos actualizar tus datos. Inténtalo de nuevo en unos momentos.')
          : null,
      );

      if (coursesResult.status === 'fulfilled') {
        const coursesRes = coursesResult.value;
        setAccessVerified(authResult.status === 'fulfilled');
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

          const preferredId = courseIdFromPath(window.location.pathname) || viewerCourseIdFromPath(window.location.pathname) || lastStudiedId;
          const preferred = preferredId
            ? coursesRes.courses.find((c) => c.id === preferredId)
            : null;
          setCourse(preferred ?? coursesRes.courses[0]);
        } else {
          setCourses([]);
          setCourse(null);
        }
      }
    } catch (err) {
      console.error("Error al inicializar datos:", err);
      if (isPrivatePath(window.location.pathname) && (!silent || privateRouteStatus !== 'authorized')) {
        setCurrentUser(null);
        writeCachedUser(null);
        setPrivateRouteStatus('unavailable');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // En el visor, la dirección lleva el curso abierto: al recargar se vuelve a él.
  useEffect(() => {
    if (activeTab !== 'viewer' || !course) return;
    const path = viewerPath(course.id);
    if (window.location.pathname !== path) window.history.replaceState(window.history.state, '', path + window.location.search);
  }, [activeTab, course?.id]);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setSharedCourseId(courseIdFromPath(path));
      setActiveTabState(tabFromPath(path));
      if (isPrivatePath(path)) {
        setPrivateRouteStatus(accessVerified
          ? privateRouteRoleAllowed(path, currentUser?.role) ? 'authorized' : 'unauthorized'
          : 'pending');
      } else {
        setPrivateRouteStatus('idle');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [accessVerified, currentUser]);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error('Error en logout:', err);
    } finally {
      writeCachedUser(null);
      setAccessVerified(false);
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
      setAuthNotice(t('iniciaSesionParaDejarnosTuAporteO', 'Inicia sesión para dejarnos tu aporte o sugerencia en el buzón.'));
      setShowAuthModal(true);
      return;
    }
    setShowListening(true);
  };

  const hasAccess = accessVerified && courses.some((c) => c.hasAccess === true);

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

  const privatePath = isPrivatePath(window.location.pathname);

  if (privatePath && privateRouteStatus === 'pending') {
    return (
      <PageLoader className="page-loader--screen" label={t('iniciandoDocentosConstellation', 'Iniciando DocentOS Constellation...')} />
    );
  }

  if (privatePath && privateRouteStatus !== 'authorized') {
    const privateView = privateRouteView(
      privateRouteStatus === 'unavailable' ? 'unavailable' : 'unauthorized',
    );
    return (
      <div className="min-h-screen bg-canvas text-ink flex items-center justify-center px-5">
        <main className="w-full max-w-2xl rounded-[20px] border border-line bg-surface px-8 py-12 text-center shadow-[0_16px_48px_rgba(22,40,58,0.14)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.24)] sm:px-16 sm:py-16">
          <p className="text-sm font-medium text-ink-muted">{t('docentos', 'DocentOS')}</p>
          <div
            aria-hidden="true"
            className="mx-auto my-7 h-8 w-32 -rotate-[8deg] rounded-[50%] border border-brand-cyan/55"
          />
          <p className="-mt-[4.5rem] text-[clamp(5.5rem,18vw,9rem)] font-medium leading-[0.9] tracking-[-0.03em] text-ink">
            404
          </p>
          <h1 className="mt-6 text-[clamp(1.5rem,4vw,2rem)] font-medium">{privateView.title}</h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-ink-muted">{privateView.description}</p>
          <button
            type="button"
            onClick={() => {
              if (privateRouteStatus === 'unavailable') {
                loadData();
              } else {
                navigateTo('landing');
              }
            }}
            className="mt-7 rounded-[10px] border border-line bg-ink px-[18px] py-3 text-sm font-medium text-canvas transition-colors hover:border-brand-cyan hover:bg-surface hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-cyan"
          >
            {privateRouteStatus === 'unavailable' ? t('reintentar', 'Reintentar') : t('volverAlInicio', 'Volver al inicio')}
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas dark:bg-[#07070b] text-ink dark:text-white flex flex-col selection:bg-[var(--color-brand-cyan)] selection:text-[var(--color-on-brand)] font-sans">
      {connectionNotice && (
        <div role="status" className="flex flex-wrap items-center justify-center gap-3 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          <p>{connectionNotice}</p>
          <button type="button" disabled={loading} onClick={() => loadData()} className="font-semibold underline underline-offset-4 disabled:opacity-50">{t('reintentar', 'Reintentar')}</button>
        </div>
      )}
      
      {/* Experiencia Principal Oficial: DocentOS Constellation */}
      <LandingConfigProvider>
      <ConstellationAppShell
        currentUser={currentUser}
        courses={courses}
        activeCourse={course}
        activeTab={activeTab === 'landing' ? 'explore' : activeTab}
        hasAccess={hasAccess}
        sharedCourseId={sharedCourseId}
        courseAccessReady={accessVerified}
        onOpenCourseOverview={(selected) => {
          selectCourse(selected);
          window.history.pushState({}, '', coursePath(selected.id));
          setSharedCourseId(selected.id);
          setActiveTabState('courses');
          window.scrollTo({ top: 0 });
        }}
        onContinueCourse={(selected) => { selectCourse(selected); navigateTo('viewer'); }}
        onRegister={() => { setAuthMode('register'); setAuthNotice(null); setShowAuthModal(true); }}
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
        onOpenPaywall={() => {
          if (currentUser?.role !== 'MENTEE') {
            setShowPaywallModal(true);
          }
        }}
        onRefreshData={() => loadData(true)}
        onCourseUpdated={(courseId, patch) => {
          setCourses(previous => {
            const updated = patchCourseCard(previous, courseId, patch);
            writeCachedCourses(updated);
            return updated;
          });
          setCourse(previous => previous?.id === courseId ? { ...previous, ...patch } : previous);
        }}
        onPaymentSuccess={handlePaymentSuccess}
        onVipActivated={handleVipActivated}
        onRestartTour={() => setShowTour(true)}
        onOpenVerifyModal={(code) => {
          setVerifyCode(code || '');
          setShowVerifyModal(true);
        }}
        onOpenListening={handleOpenListening}
        onChangePassword={() => setShowChangePasswordModal(true)}
        unreadListening={unreadListening}
        listeningDocked={listeningDocked}
      />
      </LandingConfigProvider>

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
              setAccessVerified(true);
              setAuthNotice(null);
              loadData();
              if (!sharedCourseId) {
                const nextTab = tabFromPath(redirectPath);
                navigateTo(nextTab, {
                  privateAccess: isPrivatePath(redirectPath)
                    ? privateRouteRoleAllowed(redirectPath, user.role) ? 'authorized' : 'unauthorized'
                    : undefined,
                });
              }
              if (!sharedCourseId && !localStorage.getItem('giantucchi_tour_completed')) {
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

        {showPaywallModal && currentUser && course && currentUser.role !== 'MENTEE' && (
          <div
            className="fixed inset-0 z-50 bg-ink/60 dark:bg-[#07070b]/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in overscroll-contain"
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

      {/* Botón flotante accesible de Buzón de Escucha en la esquina inferior izquierda */}
      {!showListening && !listeningDocked && (
        <ListeningFloatingButton
          unreadCount={unreadListening}
          onClick={handleOpenListening}
          onDismiss={dockListening}
        />
      )}

    </div>
  );
}
