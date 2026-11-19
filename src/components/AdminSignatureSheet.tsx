import { useEffect, useRef, useState } from 'react';
import { X, Check, Copy } from 'lucide-react';
import type { ContractSignature } from './AdminCertificationView';

const STATE: Record<ContractSignature['status'], string> = { VIGENTE: 'Vigente', POR_VENCER: 'Por vencer', EXPIRADO: 'Expirado' };
const day = (v: string) => new Date(v).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
const hour = (v: string) => new Date(v).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
const month = (v: string) => new Date(v).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
const utc = (v: string) => `${new Date(v).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC`;

function Copyable({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* sin portapapeles: el texto sigue seleccionable */ }
  };
  return (
    <div className="acta-copy">
      <code>{value}</code>
      <button type="button" className="acta-copy__btn" onClick={copy} aria-label={done ? 'Copiado' : `Copiar ${label}`} title={done ? 'Copiado' : 'Copiar'}>
        {done ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </button>
    </div>
  );
}

/** Acta de firma: un documento formal sobre papel, centrado, con el texto de constancia y la evidencia. */
export function AdminSignatureSheet({ signature, onClose }: { signature: (ContractSignature & { contractHash?: string; userAgent?: string }) | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (signature && !d.open) d.showModal();
    if (!signature && d.open) d.close();
  }, [signature?.id]);
  const s = signature;

  return (
    <div data-mentor-ui="modern" className="admin-courses-root">
      <dialog ref={ref} className="acta-modal" aria-labelledby="acta-title" onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
        {s && (
          <div className="acta-modal__frame">
            <article className="acta-paper">
              <header className="acta-paper__top">
                <div>
                  <strong>DocentOS</strong>
                  <span>Plataforma e-Learning</span>
                </div>
                <div className="acta-paper__no">
                  <span>Registro N.º</span>
                  <b>{s.id.slice(0, 8).toUpperCase()}</b>
                </div>
              </header>

              <div className="acta-paper__title">
                <h2 id="acta-title">Acta digital de firma y consentimiento</h2>
                <span className="acta-stamp" data-state={s.status}>{STATE[s.status]}</span>
              </div>

              <p className="acta-paper__lead">
                Se deja constancia de que <b>{s.userName}</b>, con correo electrónico <b>{s.userEmail}</b>, aceptó electrónicamente los términos y condiciones generales y la política de privacidad de la plataforma el <b>{day(s.signedAt)}</b>, a las <b>{hour(s.signedAt)} UTC</b>, desde la dirección IP <b className="acta-mono">{s.ipAddress}</b>.
              </p>

              <dl className="acta-paper__data">
                <div><dt>Vigencia del acceso</dt><dd>{month(s.startDate)} a {month(s.endDate)}</dd></div>
                <div><dt>Custodia de datos</dt><dd>Hasta {month(s.dataRetentionUntil)}</dd></div>
                <div><dt>Fecha y hora (UTC)</dt><dd>{utc(s.signedAt)}</dd></div>
              </dl>

              <section aria-labelledby="acta-consent">
                <h3 id="acta-consent">Consentimientos aceptados</h3>
                <ul className="acta-paper__checks">
                  <li><Check aria-hidden="true" />Términos y condiciones generales</li>
                  <li><Check aria-hidden="true" />Política de privacidad</li>
                  <li><Check aria-hidden="true" />Custodia de datos personales y progreso</li>
                </ul>
              </section>

              <section aria-labelledby="acta-evid">
                <h3 id="acta-evid">Evidencia del registro</h3>
                <div className="acta-paper__field">
                  <span>Huella SHA-256 del contrato</span>
                  {s.contractHash ? <Copyable value={s.contractHash} label="huella" /> : <p className="acta-muted">No registrada</p>}
                </div>
                <div className="acta-paper__field">
                  <span>ID de registro</span>
                  <Copyable value={s.id} label="ID de registro" />
                </div>
                {s.userAgent && (
                  <div className="acta-paper__field">
                    <span>Navegador</span>
                    <p className="acta-muted">{s.userAgent}</p>
                  </div>
                )}
              </section>

              <footer className="acta-paper__foot">Registro generado automáticamente por DocentOS.</footer>
            </article>

            <button type="button" className="acta-modal__close" onClick={onClose} aria-label="Cerrar acta">
              <X aria-hidden="true" />
            </button>
          </div>
        )}
      </dialog>
    </div>
  );
}
