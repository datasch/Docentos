import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  LockKeyhole,
  Sparkles,
  Send,
  Loader2,
  Clock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import type { Course, User } from '../types';
import { CourseShareButton } from './CourseShareButton';
import { api } from '../lib/api';

export function CourseOverview({
  course,
  ready,
  user,
  onBack,
  onRegister,
  onLogin,
  onPurchase,
  onContinue,
}: {
  course?: Course;
  ready: boolean;
  user: User | null;
  onBack: () => void;
  onRegister: () => void;
  onLogin: () => void;
  onPurchase: () => void;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  const isMentee = user?.role === 'MENTEE';
  const allowed = ready && course?.hasAccess === true;

  const [effectiveMentor, setEffectiveMentor] = useState<{
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null>(
    course?.assignedMentor || (course?.mentors && course.mentors.length > 0 ? course.mentors[0] : null) || null,
  );
  const [hasPendingRequest, setHasPendingRequest] = useState<boolean>(Boolean(course?.hasPendingRequest));
  const [isRequestingAccess, setIsRequestingAccess] = useState<boolean>(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    if (!course) return;
    const previous = document.title;
    document.title = `${course.title} | DocentOS`;
    return () => {
      document.title = previous;
    };
  }, [course?.title]);

  useEffect(() => {
    if (!course?.id || !isMentee || allowed) return;
    const directMentor = course.assignedMentor || (course.mentors && course.mentors.length > 0 ? course.mentors[0] : null);
    if (directMentor) setEffectiveMentor(directMentor);

    api
      .getMyMentor(course.id)
      .then((res) => {
        if (res?.mentor) setEffectiveMentor(res.mentor);
        if (typeof res?.hasPendingRequest === 'boolean') setHasPendingRequest(res.hasPendingRequest);
      })
      .catch(() => {});
  }, [course?.id, course?.assignedMentor, course?.mentors, isMentee, allowed]);

  const handleRequestAccess = async () => {
    if (!course?.id || isRequestingAccess) return;
    setIsRequestingAccess(true);
    try {
      await api.requestCourseAccess(course.id);
      setHasPendingRequest(true);
    } catch (err: any) {
      alert(err?.message || 'No se pudo enviar la solicitud de acceso.');
    } finally {
      setIsRequestingAccess(false);
    }
  };

  const handleCopyEmail = () => {
    if (!effectiveMentor?.email) return;
    navigator.clipboard.writeText(effectiveMentor.email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  if (!course || !course.published) {
    return (
      <section className="mx-auto max-w-xl px-6 py-24 text-center text-ink">
        <h1 className="text-2xl font-semibold">{ready ? 'Este curso no está disponible' : 'Cargando curso…'}</h1>
        <button type="button" onClick={onBack} className="mt-6 btn-brand-primary px-5 py-3 cursor-pointer">
          Explorar catálogo
        </button>
      </section>
    );
  }

  const price = new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: course.currency || 'USD',
  }).format(course.price);

  return (
    <section className="academy-course-overview mx-auto max-w-6xl px-6 py-8 sm:py-14 text-ink">
      <button
        type="button"
        onClick={onBack}
        className="mb-8 inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('overview.backToCatalog', 'Volver al catálogo')}
      </button>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12">
        {/* Portada del Curso */}
        <div className="academy-course-cover overflow-hidden rounded-3xl border border-line bg-card">
          {course.coverImage ? (
            <img src={course.coverImage} alt={course.title} className="aspect-video w-full object-cover" />
          ) : (
            <div className="aspect-video grid place-items-center">
              <BookOpen className="h-12 w-12 text-brand-cyan" />
            </div>
          )}
        </div>

        {/* Información y Acciones del Curso */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-brand-cyan">{course.category || t('overview.professionalTraining', 'Formación profesional')}</p>
            {isMentee && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 text-[11px] font-bold text-brand-violet-light uppercase tracking-wider">
                <Sparkles className="h-3 w-3 text-brand-violet-light" /> {t('overview.menteeBadge', 'Mentee')}
              </span>
            )}
          </div>

          <h1 className="mt-3 break-words font-constellation-display text-3xl sm:text-4xl leading-tight">
            {course.title}
          </h1>

          <p className="mt-5 whitespace-pre-line text-sm sm:text-base leading-relaxed text-ink-soft">
            {course.description}
          </p>

          {/* Precio para no-mentees sin acceso o badge de mentoría */}
          {!allowed && (
            isMentee ? (
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 border border-purple-500/30 px-3 py-1 text-xs font-semibold text-brand-violet-light">
                  <Sparkles className="h-3.5 w-3.5 text-brand-violet-light" />
                  {t('overview.menteeNotice', 'Acceso gestionado por Mentoría • Sin cobros de matrícula')}
                </span>
              </div>
            ) : (
              <p className="mt-7 text-3xl font-semibold">
                {price}
                <span className="ml-2 text-sm font-normal text-ink-muted">{course.currency || 'USD'}</span>
              </p>
            )
          )}

          {/* Flujo de Acceso: Alumnos con acceso vs Mentee sin acceso vs Visitante */}
          {allowed ? (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!ready}
                onClick={onContinue}
                className="btn-brand-primary flex items-center gap-2 px-5 py-3 text-sm cursor-pointer disabled:opacity-50"
              >
                {!ready ? t('overview.verifyingAccess', 'Verificando acceso…') : t('overview.continueLearning', 'Continuar aprendiendo')}
                <ArrowRight className="h-4 w-4" />
              </button>
              <CourseShareButton course={course} />
            </div>
          ) : isMentee ? (
            <div className="mt-6 rounded-2xl border border-purple-500/30 bg-purple-950/15 p-5 shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-3.5">
                {effectiveMentor?.avatarUrl ? (
                  <img
                    src={effectiveMentor.avatarUrl}
                    alt={effectiveMentor.name}
                    className="h-12 w-12 rounded-full border border-purple-500/40 object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-500/20 font-bold text-brand-violet-light border border-purple-500/30">
                    {effectiveMentor?.name ? effectiveMentor.name.charAt(0).toUpperCase() : 'M'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-violet-light">
                    {effectiveMentor ? 'Mentor Asignado' : 'Coordinación Académica'}
                  </span>
                  <h3 className="truncate text-base font-bold text-ink">{effectiveMentor?.name || 'Mentor DocentOS'}</h3>
                  <p className="truncate text-xs text-ink-muted font-mono">{effectiveMentor?.email || 'contacto@academia.com'}</p>
                </div>
              </div>

              {hasPendingRequest ? (
                <div className="mt-4 flex flex-col gap-2.5 pt-3 border-t border-purple-500/20">
                  <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 p-3 text-xs text-warning-light">
                    <Clock className="h-4 w-4 shrink-0 text-amber-400 mt-0.5 animate-pulse" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">Solicitud enviada a tu mentor • En espera de aprobación</p>
                      <p className="text-[11px] font-normal text-amber-200/80 mt-0.5">
                        Tu mentor tiene la notificación en su panel para autorizar tu acceso en 1 clic.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-ink-muted">
                    <button
                      type="button"
                      onClick={onContinue}
                      className="inline-flex items-center gap-1.5 text-brand-violet-light hover:text-white transition-colors cursor-pointer text-xs font-semibold"
                    >
                      <span>Ver temario en el visor</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    {effectiveMentor?.email && (
                      <div className="flex items-center gap-2">
                        <a
                          href={`mailto:${effectiveMentor.email}?subject=${encodeURIComponent(`Seguimiento: Solicitud de acceso al curso ${course.title}`)}&body=${encodeURIComponent(`Hola ${effectiveMentor.name},\n\nSoy ${user?.name || ''} (${user?.email || ''}). Te envié una solicitud en DocentOS para acceder al curso "${course.title}".\n\n¡Quedo atento!`)}`}
                          className="text-brand-cyan hover:underline transition-colors flex items-center gap-1"
                        >
                          <Mail className="h-3 w-3" />
                          <span>Enviar recordatorio por correo</span>
                        </a>
                        <button
                          type="button"
                          onClick={handleCopyEmail}
                          className="hover:text-ink transition-colors flex items-center gap-1 font-mono text-[11px] cursor-pointer"
                        >
                          {copiedEmail ? <span className="text-emerald-400 font-bold">¡Copiado!</span> : <span>Copiar correo</span>}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-3 pt-3 border-t border-purple-500/20">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleRequestAccess}
                      disabled={isRequestingAccess}
                      className="btn-brand-primary flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {isRequestingAccess ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Enviando solicitud...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          <span>Solicitar acceso a mi mentor</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={onContinue}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-line-subtle bg-surface px-4 py-3 text-xs font-semibold text-ink hover:bg-canvas transition-colors cursor-pointer"
                    >
                      <span>Explorar temario</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <CourseShareButton course={course} />
                  </div>
                  <p className="text-[11px] text-ink-muted">
                    Envía una solicitud interna en 1 clic para que tu mentor autorice este curso en tu plan.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!ready}
                onClick={user ? onPurchase : onRegister}
                className="btn-brand-primary flex items-center gap-2 px-5 py-3 text-sm cursor-pointer disabled:opacity-50"
              >
                {!ready ? t('overview.verifyingAccess', 'Verificando acceso…') : user ? t('overview.buyCourse', 'Ver opciones de acceso') : t('overview.createAccount', 'Crear cuenta para continuar')}
                <ArrowRight className="h-4 w-4" />
              </button>
              <CourseShareButton course={course} />
            </div>
          )}

          {!user && (
            <p className="mt-4 text-sm text-ink-muted">
              {t('overview.alreadyHaveAccount', '¿Ya tienes cuenta?')}{' '}
              <button
                type="button"
                onClick={onLogin}
                className="text-brand-cyan underline underline-offset-4 cursor-pointer"
              >
                {t('overview.loginAction', 'Inicia sesión')}
              </button>
            </p>
          )}

          {!allowed && (
            isMentee ? (
              <p className="mt-5 flex items-start gap-2 text-xs text-ink-muted">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-violet-light" />
                Como Mentee, tu acceso a este curso no requiere compra. Tu mentor asignado habilitará tu acceso en un solo clic desde su panel.
              </p>
            ) : (
              <p className="mt-5 flex items-start gap-2 text-xs text-ink-muted">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                El acceso a las clases requiere una compra o autorización de la academia.
              </p>
            )
          )}
        </div>
      </div>
    </section>
  );
}
