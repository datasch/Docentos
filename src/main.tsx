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
import './styles/my-learning.css';
import './styles/mentor-courses.css';
import './styles/admin-courses.css';
import './styles/admin-tts.css';
import './styles/admin-listening.css';
import './styles/admin-plugins.css';
import './styles/page-loader.css';
import './styles/toaster.css';
import './styles/terms-paper.css';
import './styles/admin-overview.css';
import './styles/admin-select.css';
import './styles/admin-import.css';
import './styles/admin-landing.css';
import './styles/mentor-mentees.css';
import './styles/admin-people.css';
import './styles/mentor-qna.css';
import './styles/mentor-meetings.css';
import './styles/mentor-quiz.css';
import './styles/mentor-youtube.css';
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
