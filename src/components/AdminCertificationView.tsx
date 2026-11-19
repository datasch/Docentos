import { useEffect, useRef, useState } from 'react';
import { List, LayoutGrid, Award, FileCheck, Eye, ShieldAlert } from 'lucide-react';
import type { CertificateRecord } from '../types';
import { AdminSearchField, FilterMenu, ActiveFilters, Pager, useListView } from './AdminListKit';

export interface ContractSignature {
  id: string;
  userName: string;
  userEmail: string;
  signedAt: string;
  startDate: string;
  endDate: string;
  dataRetentionUntil: string;
  ipAddress: string;
  status: 'VIGENTE' | 'POR_VENCER' | 'EXPIRADO';
}

const CERT_STATE = { valid: 'Válido', revoked: 'Revocado' } as const;
const SIG_STATE: Record<ContractSignature['status'], string> = { VIGENTE: 'Vigente', POR_VENCER: 'Por vencer', EXPIRADO: 'Expirado' };
const date = (v: string, o: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }) => new Date(v).toLocaleDateString('es-ES', o);

interface Props {
  section: 'certificates' | 'contracts';
  onSection: (s: 'certificates' | 'contracts') => void;
  certificates: CertificateRecord[];
  signatures: ContractSignature[];
  onRevoke: (certId: string, reason: string) => Promise<boolean>;
  onViewSignature: (sig: ContractSignature) => void;
}

/** Certificación: certificados emitidos y auditoría de contratos, con el sistema de Usuarios. */
export function AdminCertificationView({ section, onSection, certificates, signatures, onRevoke, onViewSignature }: Props) {
  const { isMobile, view, change } = useListView('admin-cert-view');
  const size = view === 'list' ? 10 : 12;

  const [query, setQuery] = useState('');
  const [state, setState] = useState('ALL');
  const [page, setPage] = useState(1);
  const reset = (fn: () => void) => { fn(); setPage(1); };
  // Cada sección conserva su propio filtro: al cambiar de pestaña se parte limpio.
  useEffect(() => { setQuery(''); setState('ALL'); setPage(1); }, [section]);

  const q = query.trim().toLowerCase();
  const isCert = section === 'certificates';

  const certState = (c: CertificateRecord) => (c.revokedAt ? 'revoked' : 'valid');
  const certMatchQ = (c: CertificateRecord) => !q || [c.recipientName, c.userEmail, c.courseTitle, c.verificationCode].some((t) => (t || '').toLowerCase().includes(q));
  const sigMatchQ = (s: ContractSignature) => !q || [s.userName, s.userEmail, s.ipAddress].some((t) => (t || '').toLowerCase().includes(q));

  const certOpts = (['valid', 'revoked'] as const).map((v) => ({ value: v, label: CERT_STATE[v], count: certificates.filter((c) => certMatchQ(c) && certState(c) === v).length }));
  const sigOpts = (Object.keys(SIG_STATE) as Array<ContractSignature['status']>).map((v) => ({ value: v, label: SIG_STATE[v], count: signatures.filter((s) => sigMatchQ(s) && s.status === v).length }));

  const certs = certificates.filter((c) => certMatchQ(c) && (state === 'ALL' || certState(c) === state));
  const sigs = signatures.filter((s) => sigMatchQ(s) && (state === 'ALL' || s.status === state));
  const total = isCert ? certificates.length : signatures.length;
  const shown = isCert ? certs.length : sigs.length;
  const list = isCert ? certs : sigs;
  const cur = Math.min(page, Math.max(1, Math.ceil(list.length / size)));
  const from = (cur - 1) * size;

  const stateText = state === 'ALL' ? '' : isCert ? CERT_STATE[state as keyof typeof CERT_STATE] : SIG_STATE[state as ContractSignature['status']];

  // Revocar: modal con motivo opcional.
  const [target, setTarget] = useState<CertificateRecord | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (target && !d.open) d.showModal();
    if (!target && d.open) d.close();
  }, [target]);
  const confirmRevoke = async () => {
    if (!target) return;
    setBusy(true);
    await onRevoke(target.id, reason);
    setBusy(false);
    setTarget(null);
    setReason('');
  };

  const toggle = !isMobile && (
    <div className="mentor-publication-filters admin-view-toggle" role="group" aria-label="Vista">
      <button type="button" aria-pressed={view === 'list'} onClick={() => { change('list'); setPage(1); }}>
        <List aria-hidden="true" />
        <span>Lista</span>
      </button>
      <button type="button" aria-pressed={view === 'cards'} onClick={() => { change('cards'); setPage(1); }}>
        <LayoutGrid aria-hidden="true" />
        <span>Tarjetas</span>
      </button>
    </div>
  );

  return (
    <div data-mentor-ui="modern" className="admin-courses-root">
      <div className="mentor-mentees-panel admin-people-panel">
        <div className="mentor-section-heading">
          <div>
            <h2 id="admin-cert-title">Certificación</h2>
            <p>
              {isCert
                ? 'Certificados emitidos a los graduados, con código de verificación pública.'
                : 'Evidencia de los contratos y consentimientos firmados por cada usuario.'}
            </p>
          </div>
        </div>

        <div className="admin-people-top">
          <div className="mentor-publication-filters" role="group" aria-label="Sección de certificación">
            <button type="button" aria-pressed={isCert} onClick={() => onSection('certificates')}>
              <span>Certificados</span>
              <span className="mentor-publication-count">({certificates.length})</span>
            </button>
            <button type="button" aria-pressed={!isCert} onClick={() => onSection('contracts')}>
              <span>Contratos</span>
              <span className="mentor-publication-count">({signatures.length})</span>
            </button>
          </div>
        </div>

        <div className="mentor-course-toolbar">
          <AdminSearchField value={query} onChange={(value) => reset(() => setQuery(value))} placeholder={isCert ? 'Buscar por graduado, curso o código' : 'Buscar por usuario, correo o IP'} label={isCert ? 'Buscar certificado' : 'Buscar contrato'} />
          <FilterMenu groups={[{ value: state, onChange: (v) => reset(() => setState(v)), options: isCert ? certOpts : sigOpts }]} />
          {toggle}
        </div>

        <ActiveFilters
          noun={isCert ? 'certificados' : 'contratos'}
          shown={shown}
          total={total}
          onClear={() => reset(() => { setQuery(''); setState('ALL'); })}
          chips={[
            ...(state !== 'ALL' ? [{ key: 's', text: stateText, onRemove: () => reset(() => setState('ALL')) }] : []),
            ...(q ? [{ key: 'q', text: `«${query.trim()}»`, onRemove: () => reset(() => setQuery('')) }] : []),
          ]}
        />

        {list.length === 0 ? (
          <p className="mentor-courses-empty" role="status">
            {total === 0
              ? (isCert ? 'Todavía no se han emitido certificados.' : 'Todavía no hay contratos firmados.')
              : 'Nada coincide con el filtro.'}
          </p>
        ) : isCert ? (
          <div className="admin-people-list admin-cert-list" data-view={view}>
            {view === 'list' && (
              <div className="admin-people-head" aria-hidden="true">
                <span>Graduado</span><span>Curso</span><span>Código</span><span>Emisión</span><span>Estado</span><span />
              </div>
            )}
            <ul className="mentor-mentee-grid" data-view={view}>
              {certs.slice(from, from + size).map((c) => {
                const revoked = !!c.revokedAt;
                return (
                  <li key={c.id} className="mentor-mentee-card" data-view={view}>
                    <div className="mentor-mentee-card__head">
                      <span className="mentee-sheet__icon" aria-hidden="true"><Award /></span>
                      <div className="mentor-mentee-id">
                        <strong>{c.recipientName}</strong>
                        <span title={c.userEmail}>{c.userEmail}</span>
                      </div>
                    </div>
                    <p className="admin-enroll-card__course" title={c.courseTitle}>{c.courseTitle}</p>
                    <code className="admin-cert-code" title={c.verificationCode}>{c.verificationCode}</code>
                    <p className="admin-people-card__meta">{date(c.issuedAt)}</p>
                    <span className="mentor-mentee-status" data-state={revoked ? 'REVOKED' : 'active'} title={c.revocationReason || undefined}>{revoked ? 'Revocado' : 'Válido'}</span>
                    <button type="button" className="mentor-course-control" data-danger="true" disabled={revoked} onClick={() => setTarget(c)} aria-haspopup="dialog">
                      Revocar
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="admin-people-list admin-contract-list" data-view={view}>
            {view === 'list' && (
              <div className="admin-people-head" aria-hidden="true">
                <span>Usuario</span><span>Firma</span><span>Vigencia</span><span>IP</span><span>Estado</span><span />
              </div>
            )}
            <ul className="mentor-mentee-grid" data-view={view}>
              {sigs.slice(from, from + size).map((s) => (
                <li key={s.id} className="mentor-mentee-card" data-view={view}>
                  <div className="mentor-mentee-card__head">
                    <span className="mentee-sheet__icon" aria-hidden="true"><FileCheck /></span>
                    <div className="mentor-mentee-id">
                      <strong>{s.userName}</strong>
                      <span title={s.userEmail}>{s.userEmail}</span>
                    </div>
                  </div>
                  <p className="admin-people-card__meta">{date(s.signedAt)}</p>
                  <p className="admin-people-card__meta">{date(s.startDate, { month: 'short', year: 'numeric' })} → {date(s.endDate, { month: 'short', year: 'numeric' })}</p>
                  <code className="admin-cert-code">{s.ipAddress}</code>
                  <span className="mentor-mentee-status" data-state={s.status}>{SIG_STATE[s.status]}</span>
                  <button type="button" className="mentor-course-control" onClick={() => onViewSignature(s)}>
                    <Eye aria-hidden="true" /> Ver acta
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Pager total={list.length} size={size} page={cur} onPage={setPage} noun={isCert ? 'certificados' : 'contratos'} />

        <dialog
          ref={dlg}
          className="mentor-confirm"
          aria-labelledby="admin-cert-revoke-title"
          onCancel={(e) => { e.preventDefault(); if (!busy) setTarget(null); }}
          onClick={(e) => { if (e.target === e.currentTarget && !busy) setTarget(null); }}
        >
          {target && (
            <div className="mentor-confirm__body">
              <h3 id="admin-cert-revoke-title" className="admin-confirm-title">
                <ShieldAlert aria-hidden="true" />
                Revocar certificado
              </h3>
              <p>
                El certificado <strong>{target.verificationCode}</strong> de <strong>{target.recipientName}</strong> dejará de ser válido en la verificación pública. La revocación no se puede deshacer.
              </p>
              <div className="meeting-field">
                <label htmlFor="cert-revoke-reason">Motivo (opcional)</label>
                <input id="cert-revoke-reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Revocado por administración docente" />
              </div>
              <div className="mentor-confirm__actions">
                <button type="button" className="mentor-course-control" onClick={() => setTarget(null)} disabled={busy}>Cancelar</button>
                <button type="button" className="mentor-course-control" data-danger="true" onClick={confirmRevoke} disabled={busy} aria-busy={busy}>
                  Revocar certificado
                </button>
              </div>
            </div>
          )}
        </dialog>
      </div>
    </div>
  );
}
