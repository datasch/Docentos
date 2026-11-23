import React, { lazy, Suspense } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { User } from '../../types';
import { formatFirstName } from '../../lib/avatar';
import { greetingForThisVisit } from '../../lib/dailyGreeting';
import { DEFAULT_LOGO_URL, usePlatformBrand } from '../../lib/logoConfig';
import { landingTarget, useLandingConfig } from '../../lib/landingConfig';

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
  const { t } = useTranslation();
  const { logoUrl } = usePlatformBrand();
  const greeting = currentUser ? greetingForThisVisit(currentUser.id) : null;
  const custom = useLandingConfig();
  const goCta = () => {
    const target = landingTarget(custom.heroCtaLink);
    if (target.kind === 'external') window.open(target.url, '_blank', 'noopener,noreferrer');
    else if (target.kind === 'section') document.getElementById(target.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else onExploreCourses();
  };
  const firstName = currentUser ? formatFirstName(currentUser.name) : '';
  return (
    <section className="academy-hero">
      <div className="academy-container">
        <div className="academy-hero__layout">
          <div className="academy-hero__copy">
            <h1 className="academy-hero__title">
              {greeting === 'welcome'
                ? t('hero.welcome', { name: firstName, defaultValue: `Bienvenido/a, ${firstName}.` })
                : greeting === 'back'
                  ? t('hero.welcomeBack', { name: firstName, defaultValue: `Hola de nuevo, ${firstName}.` })
                  : custom.heroTitle ?? t('hero.title', 'Dale dirección a tu aprendizaje.')}
            </h1>
            <div className="academy-hero__intro">
              <p>
                {custom.heroSubtitle ?? t('hero.subtitle', 'Elige una especialización, estudia por módulos y encuentra los recursos que necesitas para seguir avanzando.')}
              </p>
              <div className="academy-hero__actions">
                <button type="button" className="academy-button" onClick={goCta}>
                  {custom.heroCtaText ?? t('hero.exploreCourses', 'Explorar cursos')} <ArrowRight size={18} aria-hidden="true" />
                </button>
                <button type="button" className="academy-text-button" onClick={onOpenSearch}>
                  <Search size={18} aria-hidden="true" /> {t('hero.searchLesson', 'Buscar una lección')}
                </button>
              </div>
              <p className="academy-hero__availability">
                {t('hero.catalogCount', { count: totalCoursesCount, defaultValue_one: '{{count}} curso en el catálogo', defaultValue_other: '{{count}} cursos en el catálogo' })}
              </p>
            </div>
          </div>
          <div className="academy-hero__brand" aria-hidden="true">
            {showInlineBrand && (
              <Suspense fallback={<img src={logoUrl || DEFAULT_LOGO_URL} alt="" className="academy-hero__brand-fallback" />}>
                <BrandAnimation fullScreen={false} />
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
