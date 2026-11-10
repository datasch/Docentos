import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, MessageSquare, Plus, Edit3, Clock, CheckCircle2, AlertCircle, X, Sparkles, Loader2 } from 'lucide-react';
import { User, LandingTestimonial, ModeratedTestimonial } from '../../types';
import { api } from '../../lib/api';
import { avatarSrc } from '../../lib/avatar';
import { useBodyScrollLock } from '../../lib/useBodyScrollLock';

const TESTIMONIAL_MAX_CHARS = 400;

/**
 * Datos mock de prueba EXCLUSIVAMENTE para entorno de desarrollo local (import.meta.env.DEV).
 * En la compilación de producción (npm run build), Vite reemplaza import.meta.env.DEV por false
 * y Rollup elimina este bloque por completo mediante tree-shaking, garantizando que nunca se
 * envíen a producción ni al branch main.
 */
const DEV_MOCK_TESTIMONIALS: LandingTestimonial[] = import.meta.env.DEV
  ? [
      {
        id: 'dev-mock-1',
        name: 'Carlos Mendoza (Demo Local)',
        role: 'Estudiante VIP & Software Engineer',
        avatarUrl: '',
        comment: 'DocentOS me permitió completar la mentoría técnica con guías explicativas por audio e interactuar directamente con los mentores.',
        rating: 5,
      },
      {
        id: 'dev-mock-2',
        name: 'Ing. Sofia Ruiz (Demo Local)',
        role: 'Mentor Senior en DocentOS',
        avatarUrl: '',
        comment: 'Gestión directa de estudiantes, revisión centralizada de preguntas y vinculación automática de videos en minutos.',
        rating: 5,
      },
      {
        id: 'dev-mock-3',
        name: 'Alejandro Valdés (Demo Local)',
        role: 'Fullstack Engineer & Alumno',
        avatarUrl: '',
        comment: 'La fluidez de la plataforma y el enfoque directo a código sin rodeos marca la diferencia frente a cualquier otro LMS tradicional.',
        rating: 5,
      },
    ]
  : [];

interface ConstellationTestimonialsProps {
  currentUser?: User | null;
  onOpenAuth?: () => void;
}

export const ConstellationTestimonials: React.FC<ConstellationTestimonialsProps> = ({
  currentUser,
  onOpenAuth,
}) => {
  const { t } = useTranslation();
  const [testimonials, setTestimonials] = useState<LandingTestimonial[]>([]);
  const [myTestimonial, setMyTestimonial] = useState<ModeratedTestimonial | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Formulario / Modal para Mentees y Estudiantes
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [draftRating, setDraftRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [draftComment, setDraftComment] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Toggle exclusivo de desarrollo para ver mocks si la base local está vacía
  const [showDevMocks, setShowDevMocks] = useState<boolean>(false);

  useBodyScrollLock(isModalOpen);

  // Carga testimonios reales aprobados desde la base de datos
  const loadTestimonials = useCallback(async () => {
    try {
      const res = await api.getTestimonials();
      setTestimonials(res.testimonials || []);
    } catch (err) {
      console.warn('No se pudieron cargar los testimonios en Constellation:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga la opinión propia del estudiante logueado (si existe)
  const loadMyTestimonial = useCallback(async () => {
    if (!currentUser) {
      setMyTestimonial(null);
      return;
    }
    try {
      const res = await api.getMyTestimonial();
      if (res.testimonial) {
        setMyTestimonial(res.testimonial);
        setDraftRating(res.testimonial.rating || 5);
        setDraftComment(res.testimonial.comment || '');
      } else {
        setMyTestimonial(null);
        setDraftRating(5);
        setDraftComment('');
      }
    } catch {
      // Si no ha dejado testimonio o el endpoint devuelve 404/vacío, no rompemos la UI
      setMyTestimonial(null);
    }
  }, [currentUser]);

  useEffect(() => {
    loadTestimonials();
  }, [loadTestimonials]);

  useEffect(() => {
    loadMyTestimonial();
  }, [loadMyTestimonial]);

  // Manejo de tecla Escape para cerrar el modal
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
        setError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const handleOpenModal = () => {
    if (!currentUser) {
      onOpenAuth?.();
      return;
    }
    if (myTestimonial) {
      setDraftRating(myTestimonial.rating || 5);
      setDraftComment(myTestimonial.comment || '');
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmitTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    const comment = draftComment.trim();
    if (!comment) {
      setError('Por favor escribe tu testimonio u opinión.');
      return;
    }
    if (comment.length > TESTIMONIAL_MAX_CHARS) {
      setError(`El testimonio no puede superar los ${TESTIMONIAL_MAX_CHARS} caracteres.`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await api.submitTestimonial({ rating: draftRating, comment });
      setMyTestimonial(res.testimonial);
      setIsModalOpen(false);
      setStatusNotice('¡Tu testimonio fue enviado! Se publicará en cuanto sea revisado.');
      setTimeout(() => setStatusNotice(null), 6000);
      await loadTestimonials();
    } catch (err: any) {
      setError(err?.message || 'Error al enviar tu testimonio. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  // En producción, NUNCA se usan datos mock. En desarrollo local, se pueden habilitar si no hay reales.
  const isDevMode = import.meta.env.DEV;
  const activeTestimonials: LandingTestimonial[] =
    testimonials.length > 0
      ? testimonials
      : isDevMode && showDevMocks
      ? DEV_MOCK_TESTIMONIALS
      : [];

  // Regla de renderizado idéntica a shouldShowTestimonials:
  // Si no hay testimonios y el usuario no está logueado en producción, la sección se oculta
  // para evitar dejar un titular con un hueco vacío.
  const hasContentToShow = activeTestimonials.length > 0 || Boolean(currentUser) || (isDevMode && showDevMocks);

  if (!loading && !hasContentToShow) {
    return null;
  }

  return (
    <section id="testimonios" className="relative w-full bg-transparent py-20 select-none border-t border-slate-200 dark:border-white/[0.04]">
      <div className="max-w-[1280px] mx-auto px-6">

        {/* Notificación de envío exitoso */}
        {statusNotice && (
          <div className="mb-8 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-3 text-sm animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
              <span>{statusNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusNotice(null)}
              className="text-emerald-700 dark:text-emerald-300 hover:opacity-75 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Cabecera de la Sección Testimonios */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="flex flex-col items-start gap-1">
            <h2 className="font-constellation-display text-[32px] sm:text-[44px] md:text-[52px] leading-tight text-slate-900 dark:text-white tracking-[-0.035em]">
              {t('testimonials.title', 'Lo que opinan nuestros mentees')}
            </h2>
            <p className="font-constellation-body text-sm sm:text-base text-slate-600 dark:text-white/60 mt-1 max-w-2xl leading-relaxed font-extralight">
              {t('testimonials.subtitle', 'Experiencias compartidas por quienes estudian en DocentOS.')}
            </p>
          </div>

          {/* Acciones para el estudiante / mentee */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {currentUser && myTestimonial && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono border backdrop-blur-md bg-white/70 dark:bg-white/[0.04]">
                {myTestimonial.status === 'PENDING' && (
                  <>
                    <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                    <span className="text-amber-600 dark:text-amber-400">{t('testimonials.statusPending', 'En revisión')}</span>
                  </>
                )}
                {myTestimonial.status === 'APPROVED' && (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">{t('testimonials.statusApproved', 'Publicado')}</span>
                  </>
                )}
                {myTestimonial.status === 'REJECTED' && (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                    <span className="text-rose-600 dark:text-rose-400">{t('testimonials.statusRejected', 'Requiere cambios')}</span>
                  </>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleOpenModal}
              className="academy-text-button border border-line"
            >
              {currentUser ? (
                myTestimonial ? (
                  <>
                    <Edit3 className="w-4 h-4" />
                    <span>{t('testimonials.editReview', 'Editar mi opinión')}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>{t('testimonials.leaveReview', 'Compartir mi experiencia')}</span>
                  </>
                )
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{t('testimonials.leaveReview', 'Dejar mi testimonio')}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Banner informativo de modo local solo en DEV si no hay datos en la BD */}
        {isDevMode && testimonials.length === 0 && (
          <div className="mb-6 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex flex-wrap items-center justify-between gap-2 text-xs text-purple-700 dark:text-purple-300">
            <span>
              <strong>[Modo Dev]</strong> La base de datos local aún no tiene testimonios aprobados.
            </span>
            <button
              type="button"
              onClick={() => setShowDevMocks((prev) => !prev)}
              className="px-2.5 py-1 rounded-lg bg-purple-600 text-white hover:bg-purple-500 font-mono text-[11px]"
            >
              {showDevMocks ? 'Ocultar mocks locales' : 'Ver mocks locales de prueba'}
            </button>
          </div>
        )}

        {/* Grilla de Testimonios Reales */}
        {activeTestimonials.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {activeTestimonials.map((t) => (
              <article
                key={t.id}
                className="academy-testimonial-card flex flex-col justify-between p-6 rounded-[24px] bg-white/80 dark:bg-[#0c0a1a]/80 hover:bg-slate-50 dark:hover:bg-[#141026] hover:-translate-y-1 border border-slate-200 dark:border-white/[0.08] hover:border-[#a855f7]/40 transition-all duration-200 group shadow-md dark:shadow-lg [content-visibility:auto]"
              >
                <div>
                  {/* Cabecera con Persona y Estrellas */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        src={avatarSrc(t.avatarUrl)}
                        alt={t.name}
                        width={40}
                        height={40}
                        decoding="async"
                        className="w-10 h-10 shrink-0 rounded-full object-cover border border-slate-200 dark:border-white/10"
                        loading="lazy"
                      />
                      <div>
                        <h3 className="font-constellation-display text-base text-slate-900 dark:text-white font-medium">
                          {t.name}
                        </h3>
                        <span className="font-constellation-label text-[11px] text-[#06b6d4] tracking-wider uppercase block">
                          {t.role || 'Estudiante'}
                        </span>
                      </div>
                    </div>

                    {/* Estrellas */}
                    <div className="flex items-center gap-0.5 text-[#eab308]" aria-label={`${t.rating} de 5 estrellas`}>
                      {Array.from({ length: t.rating || 5 }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-[#eab308]" />
                      ))}
                    </div>
                  </div>

                  {/* Comentario */}
                  <p className="font-constellation-body text-xs sm:text-sm text-slate-600 dark:text-slate-200 leading-relaxed font-extralight italic">
                    “{t.comment}”
                  </p>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-100 dark:border-white/[0.04] text-[10px] font-mono text-slate-600 dark:text-slate-300 flex items-center justify-between">
                  <span>ESTUDIANTE VERIFICADO</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">100% Auténtico</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          /* Estado vacío si no hay testimonios aprobados aún */
          <div className="flex flex-col items-center justify-center p-10 text-center rounded-[24px] bg-white/40 dark:bg-[#0c0a1a]/40 border border-dashed border-slate-300 dark:border-white/10 max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="font-constellation-display text-lg text-slate-900 dark:text-white font-medium mb-1">
              Sé el primero en compartir tu experiencia
            </h3>
            <p className="font-constellation-body text-xs sm:text-sm text-slate-600 dark:text-white/60 mb-5 max-w-sm">
              Todavía no hay opiniones públicas publicadas. Tu testimonio ayudará a futuros mentees a conocer los proyectos y mentorías.
            </p>
            <button
              type="button"
              onClick={handleOpenModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Escribir mi opinión</span>
            </button>
          </div>
        )}

      </div>

      {/* Modal para que el Mentee / Estudiante redacte o edite su testimonio */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="testimonial-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) {
              setIsModalOpen(false);
              setError(null);
            }
          }}
        >
          <div className="relative max-h-[calc(100dvh-2rem)] overflow-y-auto w-full max-w-lg rounded-2xl bg-surface border border-line p-5 sm:p-7 shadow-2xl">
            {/* Botón cerrar */}
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setIsModalOpen(false);
                setError(null);
              }}
              className="absolute top-2 right-2 flex h-11 w-11 items-center justify-center text-ink-soft hover:text-ink rounded-lg transition-colors"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Cabecera del modal */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 id="testimonial-modal-title" className="font-constellation-display text-lg font-bold text-slate-900 dark:text-white">
                  {myTestimonial ? 'Editar mi testimonio' : 'Compartir mi experiencia'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/60">
                  Cuéntanos qué tal ha sido tu experiencia aprendiendo en DocentOS.
                </p>
              </div>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmitTestimonial} className="space-y-4">
              {/* Selector de calificación (Estrellas) */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-white/70 mb-2">
                  Tu Calificación
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="flex items-center"
                    role="radiogroup"
                    aria-label="Calificación de 1 a 5 estrellas"
                  >
                    {[1, 2, 3, 4, 5].map((val) => {
                      const isActive = (hoverRating ?? draftRating) >= val;
                      return (
                        <button
                          key={val}
                          type="button"
                          role="radio"
                          aria-checked={draftRating === val}
                          aria-label={`${val} de 5 estrellas`}
                          disabled={saving}
                          onMouseEnter={() => setHoverRating(val)}
                          onMouseLeave={() => setHoverRating(null)}
                          onClick={() => setDraftRating(val)}
                          className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-raised focus-visible:outline-2 focus-visible:outline-brand-cyan"
                        >
                          <Star
                            className={`w-6 h-6 transition-colors ${
                              isActive
                                ? 'text-[#eab308] fill-[#eab308]'
                                : 'text-slate-300 dark:text-white/20'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-xs font-mono font-medium text-[#eab308] ml-2">
                    {hoverRating ?? draftRating} de 5 estrellas
                  </span>
                </div>
              </div>

              {/* Textarea del comentario */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="testimonial-comment" className="text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-white/70">
                    Tu Opinión
                  </label>
                  <span className={`text-[11px] font-mono ${
                    draftComment.length > TESTIMONIAL_MAX_CHARS ? 'text-rose-500' : 'text-slate-400 dark:text-white/40'
                  }`}>
                    {draftComment.length} / {TESTIMONIAL_MAX_CHARS}
                  </span>
                </div>
                <textarea
                  id="testimonial-comment"
                  rows={4}
                  value={draftComment}
                  disabled={saving}
                  maxLength={TESTIMONIAL_MAX_CHARS}
                  onChange={(e) => setDraftComment(e.target.value)}
                  placeholder="Explica qué impacto tuvo en tus conocimientos, el trato de los mentores o los proyectos construidos..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-base sm:text-sm bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-white/50 leading-relaxed">
                  Se publicará con tu nombre y foto de perfil una vez aprobado por moderación.
                </p>
              </div>

              {/* Mensaje de error si ocurre */}
              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setIsModalOpen(false);
                    setError(null);
                  }}
                  className="min-h-11 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !draftComment.trim()}
                  className="academy-button disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <span>{myTestimonial ? 'Actualizar opinión' : 'Publicar testimonio'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
