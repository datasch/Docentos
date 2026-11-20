import { useEffect } from 'react';
import { toast } from 'sonner';

/** Muestra como aviso emergente el mensaje de estado de un componente cuando cambia (vacío = nada). */
export function useToastMessage(message: string | null | undefined, type: 'success' | 'error' | 'info' = 'error') {
  // `id` evita que el modo estricto de React lo duplique al desarrollar.
  useEffect(() => {
    if (message) toast[type](message, { id: `${type}:${message}` });
  }, [message, type]);
}
