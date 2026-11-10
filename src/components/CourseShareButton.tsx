import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Share2, X, MessageCircle } from 'lucide-react';
import { courseShareUrl } from '../lib/courseSharing';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';

export function CourseShareButton({ course, variant = 'default', iconOnly = false }: { course: { id: string; title: string; published: boolean }; variant?: 'default' | 'featured' | 'overlay'; iconOnly?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const url = typeof window === 'undefined' ? '' : courseShareUrl(window.location.origin, course.id);
  useBodyScrollLock(open);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  if (!course.published) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setMessage(t('common.linkCopied', 'Enlace copiado')); }
    catch { input.current?.select(); setMessage(t('common.copyLinkNotice', 'Selecciona y copia el enlace para compartirlo.')); }
  };
  const nativeShare = async () => {
    try { await navigator.share({ title: course.title, text: t('common.recommendCourse', { title: course.title, defaultValue: `Te recomiendo este curso: ${course.title}` }), url }); }
    catch (error) { if ((error as Error).name !== 'AbortError') setMessage(t('common.shareErrorNotice', 'No se pudo compartir. Puedes copiar el enlace.')); }
  };
  return (
    <div className="inline-flex shrink-0" onClick={e => e.stopPropagation()}>
      <button type="button" onClick={() => { setMessage(''); setOpen(true); }} aria-haspopup="dialog" aria-expanded={open} aria-label={`${t('common.shareCourse', 'Compartir curso')}: ${course.title}`} title={t('common.shareCourse', 'Compartir curso')} className={`inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full border transition-colors cursor-pointer text-xs ${iconOnly ? 'h-11 w-11 p-0' : 'px-3 py-2'} ${variant === 'featured' ? 'border-amber-600/25 bg-amber-500/5 text-amber-900 hover:border-amber-500 hover:bg-amber-500/15 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200 dark:hover:bg-amber-400/20' : variant === 'overlay' ? 'course-share-overlay' : 'border-line bg-surface text-ink hover:border-brand-cyan'}`}>
        <Share2 className="h-4 w-4" aria-hidden /><span className={iconOnly ? 'sr-only' : undefined}>{t('common.shareCourse', 'Compartir curso')}</span>
      </button>
      <dialog ref={dialog} onClose={() => setOpen(false)} onCancel={() => setOpen(false)} onClick={e => { if (e.target === dialog.current) setOpen(false); }} aria-labelledby={headingId} className="app-dialog m-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-line bg-surface p-6 text-ink shadow-2xl backdrop:bg-black/60">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0 break-words"><h2 id={headingId} className="text-lg font-semibold">{t('common.shareCourse', 'Compartir curso')}</h2><p className="mt-1 text-sm text-ink-soft">{course.title}</p></div><button type="button" onClick={() => setOpen(false)} aria-label={t('common.close', 'Cerrar')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg cursor-pointer"><X className="h-5 w-5" /></button></div>
        <label className="block mt-5 text-xs text-ink-muted" htmlFor={`${headingId}-url`}>{t('common.courseLink', 'Enlace del curso')}</label>
        <input ref={input} id={`${headingId}-url`} readOnly value={url} onFocus={e => e.currentTarget.select()} className="mt-2 w-full rounded-lg border border-line bg-raised p-3 text-base sm:text-sm text-ink" />
        <div className="mt-4 flex flex-wrap gap-2 [&>button]:min-h-11 [&>a]:min-h-11">
          <button type="button" onClick={copy} className="btn-brand-primary px-4 py-2 text-sm flex items-center gap-2 cursor-pointer">{message === t('common.linkCopied', 'Enlace copiado') ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{t('common.copyLink', 'Copiar enlace')}</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(`${t('common.recommendCourse', { title: course.title, defaultValue: `Te recomiendo este curso: ${course.title}` })}\n${url}`)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm"><MessageCircle className="h-4 w-4" />WhatsApp</a>
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && <button type="button" onClick={nativeShare} className="rounded-lg border border-line px-4 py-2 text-sm cursor-pointer">{t('common.moreOptions', 'Más opciones')}</button>}
        </div>
        <p role="status" className="mt-3 text-sm text-brand-cyan">{message}</p>
      </dialog>
    </div>
  );
}
