import React, { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import '../styles/toaster.css';

// Por debajo de 1152px la app muestra la barra de pestañas inferior: los avisos suben para no taparla.
const NARROW = '(max-width: 1151px)';

export const AppToaster: React.FC = () => {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(NARROW).matches);
  useEffect(() => {
    const query = window.matchMedia(NARROW);
    const update = () => setNarrow(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return (
    <Toaster
      position="bottom-right"
      offset={{ bottom: narrow ? 88 : 24, right: 24 }}
      mobileOffset={{ bottom: 88, left: 12, right: 12 }}
      duration={4000}
      visibleToasts={3}
    />
  );
};
