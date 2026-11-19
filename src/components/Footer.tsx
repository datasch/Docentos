import React, { useState } from 'react';
import { siteConfig } from '../config/theme';
import { TermsModal } from './TermsModal';
import { useTranslation } from 'react-i18next'

interface FooterProps {
  appName?: string;
  githubUrl?: string;
}

export const Footer: React.FC<FooterProps> = ({ appName, githubUrl }) => {
  const { t } = useTranslation()
  const [showTerms, setShowTerms] = useState<boolean>(false);
  const currentYear = new Date().getFullYear();
  const displayAppName = appName || siteConfig.appName || 'DocentOS';
  const targetGithubUrl = githubUrl || siteConfig.poweredByLink || 'https://github.com/giantucchi/docentos';

  return (
    <>
      <footer className="border-t border-line px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col items-center gap-3 text-meta text-ink-muted sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              {t('currentYearDisplayAppNameTodosLos', '© {{currentYear}} {{displayAppName}}. Todos los derechos reservados.', { currentYear, displayAppName })}
            </span>
            <span className="text-ink-faint">·</span>
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              className="underline hover:text-ink transition-colors cursor-pointer"
            >
              {t('terminosCondiciones', 'Términos & Condiciones')}
            </button>
          </div>

          <a
            href={targetGithubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-2 py-1 transition-colors hover:bg-surface hover:text-ink"
          >
            {t('poweredByDocentos', 'Powered by DocentOS')}
          </a>
        </div>
      </footer>
      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
    </>
  );
};
