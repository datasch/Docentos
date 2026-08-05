import React from 'react';
import { siteConfig } from '../config/theme';

interface FooterProps {
  appName?: string;
  githubUrl?: string;
}

export const Footer: React.FC<FooterProps> = ({ appName, githubUrl }) => {
  const currentYear = new Date().getFullYear();
  const displayAppName = appName || siteConfig.appName || 'DocentOS';
  const targetGithubUrl = githubUrl || siteConfig.poweredByLink || 'https://github.com/giantucchi/docentos';

  return (
    <footer className="border-t border-[#262626] bg-[#0a0a0f] py-6 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div>
          © {currentYear} {displayAppName}. Todos los derechos reservados.
        </div>

        <div>
          <a
            href={targetGithubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-300 transition-colors text-xs"
          >
            Powered by DocentOS
          </a>
        </div>
      </div>
    </footer>
  );
};
