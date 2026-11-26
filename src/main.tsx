import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {HelmetProvider} from 'react-helmet-async';
// La capa de tokens va antes que App: asi el reset de Tailwind queda por encima
// en el bundle y las hojas de los componentes pueden pisarlo en vez de ser pisadas por el.
import './index.css';
import './styles/landing.css';
import App from './App.tsx';
import './styles/academy-fonts.css';
import './styles/academy-system.css';
import './styles/page-loader.css';
import './styles/toaster.css';
import { AppToaster } from './components/AppToaster';
import { i18nReady } from './i18n/index.ts';

// Se espera al idioma inicial para no pintar en español y cambiar un instante después.
// Si la descarga falla, la app arranca igual con el español incluido en el paquete.
const mount = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HelmetProvider>
        <App />
        <AppToaster />
      </HelmetProvider>
    </StrictMode>,
  );

i18nReady.then(mount, mount);
