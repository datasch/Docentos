import { useEffect, useMemo, useRef, useState } from 'react';
import { List, LayoutGrid, Award, FileCheck, Eye, ShieldAlert, Ban, ChevronRight, X } from 'lucide-react';
import type { CertificateRecord } from '../types';
import { AdminSearchField, FilterMenu, ActiveFilters, Pager, useListView } from './AdminListKit';
import { AdminSelect } from './AdminSelect';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';
import { useTranslation, Trans } from 'react-i18next'

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
  const { t } = useTranslation()
  const { isMobile, view, change } = useListView('admin-cert-view');
  const isCert = section === 'certificates';
  const size = isCert || view === 'cards' ? 12 : 10;

  const [query, setQuery] = useState('');
  const [state, setState] = useState('ALL');
  const [studentFilter, setStudentFilter] = useState('ALL');
  const [sheetStudentKey, setSheetStudentKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const reset = (fn: () => void) => { fn(); setPage(1); };
  // Cada sección conserva su propio filtro: al cambiar de pestaña se parte limpio.
  useEffect(() => { setQuery(''); setState('ALL'); setStudentFilter('ALL'); setSheetStudentKey(null); setPage(1); }, [section]);

  const q = query.trim().toLowerCase();

  const studentKeyOf = (c: CertificateRecord) =>
    c.userId || (c.userEmail ? c.userEmail.trim().toLowerCase() : c.recipientName.trim().toLowerCase());

  const certState = (c: CertificateRecord) => (c.revokedAt ? 'revoked' : 'valid');
  const certMatchQ = (c: CertificateRecord) =>
    (!q || [c.recipientName, c.userName, c.userEmail, c.courseTitle, c.verificationCode].some((t) => (t || '').toLowerCase().includes(q))) &&
    (studentFilter === 'ALL' || studentKeyOf(c) === studentFilter);
  const sigMatchQ = (s: ContractSignature) => !q || [s.userName, s.userEmail, s.ipAddress].some((t) => (t || '').toLowerCase().includes(q));

  const studentOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string; count: number }>();
    for (const c of certificates) {
      const key = studentKeyOf(c);
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else map.set(key, { value: key, label: c.recipientName || c.userName || c.userEmail || 'Alumno', count: 1 });
    }
    return [...map.values()]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((s) => ({ value: s.value, label: `${s.label} (${s.count})` }));
  }, [certificates]);

  const certOpts = (['valid', 'revoked'] as const).map((v) => ({ value: v, label: CERT_STATE[v], count: certificates.filter((c) => certMatchQ(c) && certState(c) === v).length }));
  const sigOpts = (Object.keys(SIG_STATE) as Array<ContractSignature['status']>).map((v) => ({ value: v, label: SIG_STATE[v], count: signatures.filter((s) => sigMatchQ(s) && s.status === v).length }));

  const certs = certificates.filter((c) => certMatchQ(c) && (state === 'ALL' || certState(c) === state));
  const certStudentGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        email: string;
        items: CertificateRecord[];
        validCount: number;
        revokedCount: number;
        latestIssuedAt: string;
      }
    >();
    for (const c of certs) {
      const key = studentKeyOf(c);
      const isRevoked = Boolean(c.revokedAt);
      const existing = map.get(key);
      if (existing) {
        existing.items.push(c);
        if (isRevoked) existing.revokedCount += 1;
        else existing.validCount += 1;
        if (c.issuedAt > existing.latestIssuedAt) existing.latestIssuedAt = c.issuedAt;
      } else {
        map.set(key, {
          key,
          name: c.recipientName || c.userName || c.userEmail || 'Alumno',
          email: c.userEmail || '',
          items: [c],
          validCount: isRevoked ? 0 : 1,
          revokedCount: isRevoked ? 1 : 0,
          latestIssuedAt: c.issuedAt,
        });
      }
    }
    return [...map.values()];
  }, [certs]);

  const sigs = signatures.filter((s) => sigMatchQ(s) && (state === 'ALL' || s.status === state));
  const total = isCert ? certificates.length : signatures.length;
  const shown = isCert ? certs.length : sigs.length;
  const list = isCert ? certStudentGroups : sigs;
  const cur = Math.min(page, Math.max(1, Math.ceil(list.length / size)));
  const from = (cur - 1) * size;

  const stateText = state === 'ALL' ? '' : isCert ? CERT_STATE[state as keyof typeof CERT_STATE] : SIG_STATE[state as ContractSignature['status']];

  // Revocar: modal con motivo opcional.
  const [target, setTarget] = useState<CertificateRecord | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);
  const sheetDlg = useRef<HTMLDialogElement>(null);
  const sheetStudent = sheetStudentKey ? certStudentGroups.find((g) => g.key === sheetStudentKey) || null : null;
  useBodyScrollLock(Boolean(sheetStudent) || Boolean(target));
  useEffect(() => {
    const d = sheetDlg.current;
    if (!d) return;
    if (sheetStudent && !d.open) d.showModal();
    if (!sheetStudent && d.open) d.close();
  }, [sheetStudent]);
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (target && !d.open) d.showModal();
    if (!target && d.open) d.close();
  }, [target]);
  useEffect(() => { if (target) setReason(''); }, [target]);
  const confirmRevoke = async () => {
    if (!target || !reason.trim()) return;
    setBusy(true);
    await onRevoke(target.id, reason.trim());
    setBusy(false);
    setTarget(null);
    setReason('');
  };

  const renderCertItem = (c: CertificateRecord) => {
    const revoked = !!c.revokedAt;
    return (
      <li key={c.id} className="admin-cert-item">
        <div className="admin-cert-item__info">
          <strong className="admin-enroll-card__course" title={c.courseTitle}>{c.courseTitle}</strong>
          <code className="admin-cert-code" title={c.verificationCode}>{c.verificationCode}</code>
          <span className="admin-people-card__meta">{date(c.issuedAt)}</span>
          <span className="mentor-mentee-status" data-state={revoked ? 'REVOKED' : 'active'} title={c.revocationReason || undefined}>
            {revoked ? t('revocado', 'Revocado') : t('valido', 'Válido')}
          </span>
        </div>
        <button
          type="button"
          className="mentor-course-control"
          data-danger="true"
          disabled={revoked}
          onClick={() => setTarget(c)}
          aria-haspopup="dialog"
        >
          <Ban aria-hidden="true" />
          {t('revocar', 'Revocar')}
        </button>
      </li>
    );
  };

  const toggle = !isMobile && (
    <div className="mentor-publication-filters admin-view-toggle" role="group" aria-label={t('vista', 'Vista')}>
      <button type="button" aria-pressed={view === 'list'} onClick={() => { change('list'); setPage(1); }}>
        <List aria-hidden="true" />
        <span>{t('lista', 'Lista')}</span>
      </button>
      <button type="button" aria-pressed={view === 'cards'} onClick={() => { change('cards'); setPage(1); }}>
        <LayoutGrid aria-hidden="true" />
        <span>{t('tarjetas', 'Tarjetas')}</span>
      </button>
    </div>
  );

  return (
    <div data-mentor-ui="modern" className="admin-courses-root">
      <div className="mentor-mentees-panel admin-people-panel">
        <div className="mentor-section-heading">
          <div>
            <h2 id="admin-cert-title">{t('certificacion', 'Certificación')}</h2>
            <p>
              {isCert
                ? t('certificadosEmitidosALosGraduadosCon', 'Certificados emitidos a los graduados, con código de verificación pública.')
                : t('evidenciaDeLosContratosYConsentimientos', 'Evidencia de los contratos y consentimientos firmados por cada usuario.')}
            </p>
          </div>
        </div>

        <div className="admin-people-top">
          <div className="mentor-publication-filters" role="group" aria-label={t('seccionDeCertificacion', 'Sección de certificación')}>
            <button type="button" aria-pressed={isCert} onClick={() => onSection('certificates')}>
              <span>{t('certificados', 'Certificados')}</span>
              <span className="mentor-publication-count">({certificates.length})</span>
            </button>
            <button type="button" aria-pressed={!isCert} onClick={() => onSection('contracts')}>
              <span>{t('contratos', 'Contratos')}</span>
              <span className="mentor-publication-count">({signatures.length})</span>
            </button>
          </div>
        </div>

        <div className="mentor-course-toolbar">
          <AdminSearchField value={query} onChange={(value) => reset(() => setQuery(value))} placeholder={isCert ? t('buscarPorGraduadoCursoOCodigo', 'Buscar por graduado, curso o código') : t('buscarPorUsuarioCorreoOIp', 'Buscar por usuario, correo o IP')} label={isCert ? 'Buscar certificado' : 'Buscar contrato'} />
          {isCert && (
            <AdminSelect
              ariaLabel={t('courseNps.filterByStudent', 'Alumno')}
              value={studentFilter}
              onChange={(value) => reset(() => setStudentFilter(value))}
              options={[{ value: 'ALL', label: t('courseNps.allStudents', 'Todos los alumnos') }, ...studentOptions]}
            />
          )}
          <FilterMenu groups={[{ value: state, onChange: (v) => reset(() => setState(v)), options: isCert ? certOpts : sigOpts }]} />
          {!isCert && toggle}
        </div>

        <ActiveFilters
          noun={isCert ? 'certificados' : 'contratos'}
          shown={shown}
          total={total}
          onClear={() => reset(() => { setQuery(''); setState('ALL'); setStudentFilter('ALL'); })}
          chips={[
            ...(isCert && studentFilter !== 'ALL' ? [{ key: 'u', text: studentOptions.find((s) => s.value === studentFilter)?.label || 'Alumno', onRemove: () => reset(() => setStudentFilter('ALL')) }] : []),
            ...(state !== 'ALL' ? [{ key: 's', text: stateText, onRemove: () => reset(() => setState('ALL')) }] : []),
            ...(q ? [{ key: 'q', text: `«${query.trim()}»`, onRemove: () => reset(() => setQuery('')) }] : []),
          ]}
        />

        {list.length === 0 ? (
          <p className="mentor-courses-empty" role="status">
            {total === 0
              ? (isCert ? t('todaviaNoSeHanEmitidoCertificados', 'Todavía no se han emitido certificados.') : t('todaviaNoHayContratosFirmados', 'Todavía no hay contratos firmados.'))
              : t('nadaCoincideConElFiltro', 'Nada coincide con el filtro.')}
          </p>
        ) : isCert ? (
          <ul className="admin-cert-groups" data-view="cards">
            {certStudentGroups.slice(from, from + size).map((group) => {
              const isSelected = sheetStudentKey === group.key;
              return (
                <li key={group.key} className="admin-cert-student" data-view="cards">
                  <button
                    type="button"
                    className="admin-cert-student__head"
                    aria-expanded={isSelected}
                    aria-haspopup="dialog"
                    onClick={() => setSheetStudentKey(group.key)}
                  >
                    <div className="mentor-mentee-card__head">
                      <span className="mentee-sheet__icon" aria-hidden="true"><Award /></span>
                      <div className="mentor-mentee-id">
                        <strong>{group.name}</strong>
                        {group.email && <span title={group.email}>{group.email}</span>}
                      </div>
                    </div>
                    <div className="admin-cert-student__meta">
                      <span className="admin-cert-student__count">
                        {t('certStudentCount', {
                          defaultValue_one: '{{count}} certificado',
                          defaultValue_other: '{{count}} certificados',
                          count: group.items.length,
                        })}
                      </span>
                      {group.validCount > 0 && (
                        <span className="mentor-mentee-status" data-state="active">
                          {t('certValidCount', {
                            defaultValue_one: '{{count}} válido',
                            defaultValue_other: '{{count}} válidos',
                            count: group.validCount,
                          })}
                        </span>
                      )}
                      {group.revokedCount > 0 && (
                        <span className="mentor-mentee-status" data-state="REVOKED">
                          {t('certRevokedCount', {
                            defaultValue_one: '{{count}} revocado',
                            defaultValue_other: '{{count}} revocados',
                            count: group.revokedCount,
                          })}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="admin-people-list admin-contract-list" data-view={view}>
            {view === 'list' && (
              <div className="admin-people-head" aria-hidden="true">
                <span>{t('usuario', 'Usuario')}</span><span>{t('firma', 'Firma')}</span><span>{t('vigencia', 'Vigencia')}</span><span>{t('ip', 'IP')}</span><span>{t('estado', 'Estado')}</span><span />
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
                    <Eye aria-hidden="true" /> {t('verActa', 'Ver acta')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Pager total={list.length} size={size} page={cur} onPage={setPage} noun={isCert ? 'alumnos' : 'contratos'} />

        <dialog
          ref={sheetDlg}
          className="mentee-sheet admin-cert-sheet"
          aria-labelledby="admin-cert-sheet-title"
          onCancel={(e) => { e.preventDefault(); setSheetStudentKey(null); }}
          onClick={(e) => { if (e.target === e.currentTarget) setSheetStudentKey(null); }}
        >
          {sheetStudent && (
            <div className="mentee-sheet__body admin-cert-sheet__body">
              <header className="mentee-sheet__head">
                <span className="mentee-sheet__icon" aria-hidden="true"><Award /></span>
                <div className="mentor-mentee-id">
                  <strong id="admin-cert-sheet-title">{sheetStudent.name}</strong>
                  {sheetStudent.email && <span title={sheetStudent.email}>{sheetStudent.email}</span>}
                </div>
                <button type="button" onClick={() => setSheetStudentKey(null)} className="mentee-sheet__close" aria-label={t('cerrar', 'Cerrar')}>
                  <X aria-hidden="true" />
                </button>
              </header>
              <div className="admin-cert-sheet__summary">
                <span className="admin-cert-student__count">
                  {t('certStudentCount', {
                    defaultValue_one: '{{count}} certificado',
                    defaultValue_other: '{{count}} certificados',
                    count: sheetStudent.items.length,
                  })}
                </span>
                {sheetStudent.validCount > 0 && (
                  <span className="mentor-mentee-status" data-state="active">
                    {t('certValidCount', {
                      defaultValue_one: '{{count}} válido',
                      defaultValue_other: '{{count}} válidos',
                      count: sheetStudent.validCount,
                    })}
                  </span>
                )}
                {sheetStudent.revokedCount > 0 && (
                  <span className="mentor-mentee-status" data-state="REVOKED">
                    {t('certRevokedCount', {
                      defaultValue_one: '{{count}} revocado',
                      defaultValue_other: '{{count}} revocados',
                      count: sheetStudent.revokedCount,
                    })}
                  </span>
                )}
              </div>
              <div className="admin-cert-sheet__scroll">
                <ul className="admin-cert-sheet__list">
                  {sheetStudent.items.map(renderCertItem)}
                </ul>
              </div>
            </div>
          )}
        </dialog>

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
                {t('revocarCertificado', 'Revocar certificado')}
              </h3>
              <p>
                {t('elCertificado', 'El certificado')} <strong>{target.verificationCode}</strong> {t('de', 'de')} <strong>{target.recipientName}</strong> <Trans i18nKey="dejaraDeSerValidoEnLaVerificacionPublica">dejará de ser válido en la verificación pública. La revocación es <strong className="mentor-confirm__permanent">permanente</strong>.</Trans>
              </p>
              <div className="meeting-field">
                <label htmlFor="cert-revoke-reason">{t('motivoDeLaRevocacion', 'Motivo de la revocación')}</label>
                <input id="cert-revoke-reason" type="text" required aria-required="true" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('explicaPorQueSeRevocaEsteCertificado', 'Explica por qué se revoca este certificado')} autoComplete="off" />
              </div>
              <div className="mentor-confirm__actions">
                <button type="button" className="mentor-course-control" onClick={() => setTarget(null)} disabled={busy}>{t('cancelar', 'Cancelar')}</button>
                <button type="button" className="mentor-course-control" data-danger="true" onClick={confirmRevoke} disabled={busy || !reason.trim()} aria-busy={busy}>
                  <Ban aria-hidden="true" />
                  {t('revocarCertificado', 'Revocar certificado')}
                </button>
              </div>
            </div>
          )}
        </dialog>
      </div>
    </div>
  );
}
