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
import './i18n/index.ts';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>,
);

