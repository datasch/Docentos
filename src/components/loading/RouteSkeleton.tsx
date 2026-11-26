import React from 'react';

export type RouteSkeletonVariant = 'learning' | 'staff' | 'editor' | 'metrics';

interface RouteSkeletonProps {
  variant?: RouteSkeletonVariant;
  label: string;
  hideHeader?: boolean;
}

const bar = 'rounded-lg bg-slate-200/75 dark:bg-white/[0.06]';
const card = 'rounded-2xl border border-line bg-surface';

/**
 * Esqueletos de carga discretos por tipo de vista.
 * Mantienen la huella visual del diseño real mientras carga el chunk o los datos,
 * respetando prefers-reduced-motion y evitando el bucle giratorio en cambios de pestaña.
 */
export const RouteSkeleton: React.FC<RouteSkeletonProps> = ({
  variant = 'staff',
  label,
  hideHeader = false,
}) => {
  if (variant === 'learning') {
    return (
      <div
        role="status"
        aria-label={label}
        className={`${hideHeader ? 'w-full' : 'academy-container py-8 sm:py-10'} space-y-8 animate-pulse motion-reduce:animate-none`}
      >
        <span className="sr-only">{label}</span>
        {!hideHeader && (
          <div className="space-y-3">
            <div className={`h-9 w-56 ${bar}`} />
            <div className={`h-4 w-72 max-w-full ${bar}`} />
          </div>
        )}
        <div className={`${card} grid grid-cols-1 gap-6 p-5 sm:p-8 lg:grid-cols-2`}>
          <div className={`aspect-video w-full rounded-xl bg-slate-200/60 dark:bg-white/[0.05] lg:order-2`} />
          <div className="flex flex-col justify-center space-y-4 lg:order-1">
            <div className={`h-3.5 w-32 ${bar}`} />
            <div className={`h-8 w-4/5 ${bar}`} />
            <div className={`h-2 w-full rounded-full bg-slate-200/70 dark:bg-white/[0.06]`} />
            <div className={`h-11 w-44 rounded-lg ${bar}`} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className={`${card} overflow-hidden`}>
              <div className="aspect-video w-full bg-slate-200/60 dark:bg-white/[0.05]" />
              <div className="space-y-3 p-5">
                <div className={`h-3 w-24 ${bar}`} />
                <div className={`h-5 w-4/5 ${bar}`} />
                <div className={`mt-4 h-10 w-full rounded-lg ${bar}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'editor') {
    return (
      <div
        role="status"
        aria-label={label}
        className="space-y-5 animate-pulse motion-reduce:animate-none"
      >
        <span className="sr-only">{label}</span>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4].map((idx) => (
            <div key={idx} className={`h-10 w-28 rounded-xl ${bar}`} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className={`${card} space-y-4 p-6 lg:col-span-7`}>
            <div className={`h-5 w-40 ${bar}`} />
            <div className={`h-11 w-full rounded-xl ${bar}`} />
            <div className={`h-28 w-full rounded-xl ${bar}`} />
            <div className="grid grid-cols-2 gap-4">
              <div className={`h-11 w-full rounded-xl ${bar}`} />
              <div className={`h-11 w-full rounded-xl ${bar}`} />
            </div>
          </div>
          <div className={`${card} space-y-4 p-6 lg:col-span-5`}>
            <div className={`h-5 w-36 ${bar}`} />
            <div className="aspect-[16/10] w-full rounded-xl bg-slate-200/60 dark:bg-white/[0.05]" />
            <div className={`h-4 w-3/4 ${bar}`} />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'metrics') {
    return (
      <div
        role="status"
        aria-label={label}
        className="space-y-5 py-2 animate-pulse motion-reduce:animate-none"
      >
        <span className="sr-only">{label}</span>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className={`${card} space-y-3 p-5`}>
              <div className={`h-3.5 w-24 ${bar}`} />
              <div className={`h-8 w-16 ${bar}`} />
              <div className={`h-3 w-32 ${bar}`} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className={`${card} space-y-3 p-5`}>
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full ${bar}`} />
                <div className="flex-1 space-y-2">
                  <div className={`h-4 w-36 ${bar}`} />
                  <div className={`h-3 w-44 max-w-full ${bar}`} />
                </div>
              </div>
              <div className={`h-6 w-28 rounded-full ${bar}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={label}
      className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 animate-pulse motion-reduce:animate-none"
    >
      <span className="sr-only">{label}</span>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2.5">
          <div className={`h-8 w-52 ${bar}`} />
          <div className={`h-4 w-72 max-w-full ${bar}`} />
        </div>
        <div className={`h-10 w-36 rounded-xl ${bar}`} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((idx) => (
          <div key={idx} className={`${card} space-y-3 p-4 sm:p-5`}>
            <div className={`h-3 w-24 ${bar}`} />
            <div className={`h-7 w-14 ${bar}`} />
          </div>
        ))}
      </div>
      <div className={`h-12 w-full rounded-2xl ${bar}`} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((idx) => (
          <div key={idx} className={`${card} space-y-3 p-5`}>
            <div className={`h-4 w-40 ${bar}`} />
            <div className={`h-3.5 w-full ${bar}`} />
            <div className={`h-3.5 w-2/3 ${bar}`} />
          </div>
        ))}
      </div>
    </div>
  );
};
