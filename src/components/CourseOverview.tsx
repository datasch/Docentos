import React, { useEffect } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, LockKeyhole } from 'lucide-react';
import type { Course, User } from '../types';
import { CourseShareButton } from './CourseShareButton';

export function CourseOverview({ course, ready, user, onBack, onRegister, onLogin, onPurchase, onContinue }: {
  course?: Course; ready: boolean; user: User | null; onBack: () => void;
  onRegister: () => void; onLogin: () => void; onPurchase: () => void; onContinue: () => void;
}) {
  useEffect(() => {
    if (!course) return;
    const previous = document.title;
    document.title = `${course.title} | DocentOS`;
    return () => { document.title = previous; };
  }, [course?.title]);
  if (!course || !course.published) return <section className="mx-auto max-w-xl px-6 py-24 text-center text-ink"><h1 className="text-2xl font-semibold">{ready ? 'Este curso no está disponible' : 'Cargando curso…'}</h1><button type="button" onClick={onBack} className="mt-6 btn-brand-primary px-5 py-3 cursor-pointer">Explorar catálogo</button></section>;
  const allowed = ready && course.hasAccess === true;
  const price = new Intl.NumberFormat('es-PE', { style: 'currency', currency: course.currency || 'USD' }).format(course.price);
  return <section className="mx-auto max-w-6xl px-6 py-8 sm:py-14 text-ink">
    <button type="button" onClick={onBack} className="mb-8 inline-flex items-center gap-2 text-sm text-ink-soft cursor-pointer"><ArrowLeft className="h-4 w-4" />Volver al catálogo</button>
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12">
      <div className="overflow-hidden rounded-3xl border border-line bg-card">{course.coverImage ? <img src={course.coverImage} alt={course.title} className="aspect-video w-full object-cover" /> : <div className="aspect-video grid place-items-center"><BookOpen className="h-12 w-12 text-brand-cyan" /></div>}</div>
      <div><p className="text-sm font-medium text-brand-cyan">{course.category || 'Formación profesional'}</p><h1 className="mt-3 break-words font-constellation-display text-3xl sm:text-4xl leading-tight">{course.title}</h1><p className="mt-5 whitespace-pre-line text-sm sm:text-base leading-relaxed text-ink-soft">{course.description}</p>
        {!allowed && <p className="mt-7 text-3xl font-semibold">{price}<span className="ml-2 text-sm font-normal text-ink-muted">{course.currency || 'USD'}</span></p>}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" disabled={!ready} onClick={allowed ? onContinue : user ? onPurchase : onRegister} className="btn-brand-primary flex items-center gap-2 px-5 py-3 text-sm cursor-pointer disabled:opacity-50">{!ready ? 'Verificando acceso…' : allowed ? 'Continuar aprendiendo' : user ? 'Ver opciones de acceso' : 'Crear cuenta para continuar'}<ArrowRight className="h-4 w-4" /></button>
          <CourseShareButton course={course} />
        </div>
        {!user && <p className="mt-4 text-sm text-ink-muted">¿Ya tienes cuenta? <button type="button" onClick={onLogin} className="text-brand-cyan underline underline-offset-4 cursor-pointer">Inicia sesión</button></p>}
        {!allowed && <p className="mt-5 flex items-start gap-2 text-xs text-ink-muted"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />El acceso a las clases requiere una compra o autorización de la academia.</p>}
      </div>
    </div>
  </section>;
}
