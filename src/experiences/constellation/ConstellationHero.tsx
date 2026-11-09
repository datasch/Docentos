import React, { lazy, Suspense } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { User } from '../../types';
import { formatDisplayName } from '../../lib/avatar';
import { DEFAULT_LOGO_URL, usePlatformBrand } from '../../lib/logoConfig';

const BrandAnimation = lazy(() => import('./ConstellationCanvas').then(module => ({ default: module.ConstellationCanvas })));

interface ConstellationHeroProps {
  currentUser?: User | null;
  onExploreCourses: () => void;
  onOpenSearch: () => void;
  totalCoursesCount: number;
  showInlineBrand?: boolean;
}

export const ConstellationHero: React.FC<ConstellationHeroProps> = ({
  currentUser, onExploreCourses, onOpenSearch, totalCoursesCount, showInlineBrand = true,
}) => {
  const { logoUrl } = usePlatformBrand();
  return (
    <section className="academy-hero">
      <div className="academy-container">
        <div className="academy-hero__layout">
          <div className="academy-hero__copy">
            <h1 className="academy-hero__title">
              {currentUser
                ? `Continúa tu aprendizaje, ${formatDisplayName(currentUser.name)}.`
                : 'Dale dirección a tu aprendizaje.'}
            </h1>
            <div className="academy-hero__intro">
              <p>
                Elige una especialización, estudia por módulos y encuentra los recursos
                que necesitas para seguir avanzando.
              </p>
              <div className="academy-hero__actions">
                <button type="button" className="academy-button" onClick={onExploreCourses}>
                  Explorar cursos <ArrowRight size={18} aria-hidden="true" />
                </button>
                <button type="button" className="academy-text-button" onClick={onOpenSearch}>
                  <Search size={18} aria-hidden="true" /> Buscar una lección
                </button>
              </div>
              <p className="academy-hero__availability">
                {totalCoursesCount === 1 ? '1 curso en el catálogo' : `${totalCoursesCount} cursos en el catálogo`}
              </p>
            </div>
          </div>
          <div className="academy-hero__brand" aria-hidden="true">
            {showInlineBrand && <Suspense fallback={<img src={logoUrl || DEFAULT_LOGO_URL} alt="" className="academy-hero__brand-fallback" />}>
              <BrandAnimation fullScreen={false} />
            </Suspense>}
          </div>
        </div>
      </div>
    </section>
  );
};
