/**
 * Verificación en dos pasos, desde la pantalla de seguridad de la cuenta.
 *
 * El recorrido tiene tres estados y se ven los tres aquí: apagada, a medio
 * configurar —hay QR en pantalla y falta confirmar con un código— y activa.
 *
 * Dos decisiones que se notan al usarlo:
 *
 *  - Los códigos de recuperación se enseñan **una sola vez**, justo después de
 *    activar. No hay forma de volver a verlos: el servidor los guarda hasheados.
 *    Por eso ocupan media pantalla y hay un botón para copiarlos.
 *  - Apagar la verificación o pedir códigos nuevos exige la contraseña. Una
 *    sesión robada no debe bastar para retirar la defensa que existe por si
 *    roban la contraseña.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, Copy, KeyRound, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { api, TwoFactorStatus } from '../lib/api';

const ANILLO_FOCO =
  'focus:outline-none focus:ring-2 focus:ring-brand-cyan focus:ring-offset-2 focus:ring-offset-surface';

export const TwoFactorPanel: React.FC = () => {
  const [estado, setEstado] = useState<TwoFactorStatus | null>(null);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [alta, setAlta] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [pidiendoContrasena, setPidiendoContrasena] = useState<'apagar' | 'renovar' | null>(null);
  const [codigosRecuperacion, setCodigosRecuperacion] = useState<string[] | null>(null);
  const [copiado, setCopiado] = useState(false);

  const refrescar = useCallback(async () => {
    try {
      setEstado(await api.getTwoFactorStatus());
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo consultar el estado.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  const empezarAlta = async () => {
    setError(null);
    setAviso(null);
    setTrabajando(true);
    try {
      const respuesta = await api.startTwoFactorSetup();
      setAlta({ qrDataUrl: respuesta.qrDataUrl, secret: respuesta.secret });
      setCodigo('');
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo iniciar la configuración.');
    } finally {
      setTrabajando(false);
    }
  };

  const confirmarAlta = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setError(null);
    setTrabajando(true);
    try {
      const respuesta = await api.activateTwoFactor(codigo.trim());
      setCodigosRecuperacion(respuesta.recoveryCodes);
      setAlta(null);
      setCodigo('');
      setAviso(respuesta.message);
      await refrescar();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo activar.');
    } finally {
      setTrabajando(false);
    }
  };

  const confirmarConContrasena = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setError(null);
    setTrabajando(true);
    try {
      if (pidiendoContrasena === 'apagar') {
        const respuesta = await api.disableTwoFactor(contrasena);
        setAviso(respuesta.message);
        setCodigosRecuperacion(null);
      } else {
        const respuesta = await api.regenerateRecoveryCodes(contrasena);
        setCodigosRecuperacion(respuesta.recoveryCodes);
        setAviso(respuesta.message);
      }
      setPidiendoContrasena(null);
      setContrasena('');
      await refrescar();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo completar la operación.');
    } finally {
      setTrabajando(false);
    }
  };

  const copiarCodigos = async () => {
    if (!codigosRecuperacion) return;
    try {
      await navigator.clipboard.writeText(codigosRecuperacion.join('\n'));
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles quedan en pantalla para copiarlos a mano.
      setError('El navegador no dejó copiar. Selecciona los códigos y cópialos a mano.');
    }
  };

  if (cargando) {
    return (
      <p className="flex items-center gap-2 text-meta text-ink-soft">
        <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Consultando el estado…
      </p>
    );
  }

  return (
    <section aria-labelledby="dos-pasos-titulo" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="dos-pasos-titulo" className="flex items-center gap-2 text-row font-bold text-ink">
            <ShieldCheck aria-hidden className="h-4 w-4" /> Verificación en dos pasos
          </h3>
          <p className="mt-1 text-meta text-ink-soft">
            {estado?.activo
              ? `Activa. Quedan ${estado.codigosDisponibles} códigos de recuperación sin usar.`
              : 'Añade un código temporal de tu teléfono a la contraseña. Es opcional.'}
          </p>
        </div>
        {estado?.activo && (
          <span className="shrink-0 rounded-lg border border-success/30 bg-success/10 px-2.5 py-1 text-micro font-bold text-success">
            ACTIVA
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-meta text-danger">
          <AlertCircle aria-hidden className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      {aviso && !error && (
        <p role="status" className="rounded-xl border border-success/30 bg-success/10 p-3 text-meta text-success">
          {aviso}
        </p>
      )}

      {codigosRecuperacion && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
          <p className="text-meta font-bold text-warning">
            Guarda estos códigos ahora. No se vuelven a mostrar.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-meta text-ink">
            {codigosRecuperacion.map((codigoRecuperacion) => (
              <li key={codigoRecuperacion}>{codigoRecuperacion}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={copiarCodigos}
            className={`mt-3 inline-flex items-center gap-2 rounded-lg border border-line bg-elevated px-3 py-1.5 text-meta font-bold text-ink hover:border-line-strong ${ANILLO_FOCO}`}
          >
            {copiado ? <Check aria-hidden className="h-3.5 w-3.5" /> : <Copy aria-hidden className="h-3.5 w-3.5" />}
            {copiado ? 'Copiados' : 'Copiar los diez'}
          </button>
        </div>
      )}

      {!estado?.activo && !alta && (
        <button
          type="button"
          onClick={empezarAlta}
          disabled={trabajando}
          className={`inline-flex items-center gap-2 rounded-xl border border-brand-cyan/40 bg-brand-cyan/10 px-4 py-2.5 text-meta font-bold text-brand-cyan hover:border-brand-cyan disabled:opacity-60 ${ANILLO_FOCO}`}
        >
          <KeyRound aria-hidden className="h-4 w-4" /> Activar verificación en dos pasos
        </button>
      )}

      {alta && (
        <form onSubmit={confirmarAlta} className="space-y-3 rounded-xl border border-line bg-elevated p-4">
          <p className="text-meta text-ink-soft">
            Escanea este código con Google Authenticator, Aegis o la aplicación que uses.
          </p>
          <img
            src={alta.qrDataUrl}
            alt="Código QR para configurar la verificación en dos pasos"
            width={200}
            height={200}
            className="rounded-lg bg-white p-2"
          />
          <p className="text-meta text-ink-soft">
            ¿No puedes escanear? Escribe esta clave en la aplicación:{' '}
            <code className="break-all font-mono text-ink">{alta.secret}</code>
          </p>
          <label htmlFor="dos-pasos-codigo" className="block text-micro font-bold uppercase tracking-wider text-ink-soft">
            Código de seis dígitos
          </label>
          <input
            id="dos-pasos-codigo"
            value={codigo}
            onChange={(evento) => setCodigo(evento.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            required
            className={`w-40 rounded-xl border border-line bg-canvas px-3 py-2 font-mono text-row tracking-widest text-ink ${ANILLO_FOCO}`}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={trabajando}
              className={`rounded-xl border border-brand-cyan/40 bg-brand-cyan/10 px-4 py-2 text-meta font-bold text-brand-cyan hover:border-brand-cyan disabled:opacity-60 ${ANILLO_FOCO}`}
            >
              {trabajando ? 'Comprobando…' : 'Confirmar y activar'}
            </button>
            <button
              type="button"
              onClick={() => setAlta(null)}
              className={`rounded-xl border border-line bg-elevated px-4 py-2 text-meta font-bold text-ink-soft hover:text-ink ${ANILLO_FOCO}`}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {estado?.activo && !pidiendoContrasena && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPidiendoContrasena('renovar')}
            className={`rounded-xl border border-line bg-elevated px-4 py-2 text-meta font-bold text-ink hover:border-line-strong ${ANILLO_FOCO}`}
          >
            Generar códigos de recuperación nuevos
          </button>
          <button
            type="button"
            onClick={() => setPidiendoContrasena('apagar')}
            className={`inline-flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2 text-meta font-bold text-danger hover:border-danger ${ANILLO_FOCO}`}
          >
            <ShieldOff aria-hidden className="h-4 w-4" /> Desactivar
          </button>
        </div>
      )}

      {pidiendoContrasena && (
        <form onSubmit={confirmarConContrasena} className="space-y-3 rounded-xl border border-line bg-elevated p-4">
          <label htmlFor="dos-pasos-contrasena" className="block text-micro font-bold uppercase tracking-wider text-ink-soft">
            Confirma con tu contraseña
          </label>
          <input
            id="dos-pasos-contrasena"
            type="password"
            value={contrasena}
            onChange={(evento) => setContrasena(evento.target.value)}
            autoComplete="current-password"
            required
            className={`w-full rounded-xl border border-line bg-canvas px-3 py-2 text-meta text-ink ${ANILLO_FOCO}`}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={trabajando}
              className={`rounded-xl border border-line bg-elevated px-4 py-2 text-meta font-bold text-ink hover:border-line-strong disabled:opacity-60 ${ANILLO_FOCO}`}
            >
              {pidiendoContrasena === 'apagar' ? 'Desactivar' : 'Generar códigos'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPidiendoContrasena(null);
                setContrasena('');
              }}
              className={`rounded-xl border border-line bg-elevated px-4 py-2 text-meta font-bold text-ink-soft hover:text-ink ${ANILLO_FOCO}`}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
};
