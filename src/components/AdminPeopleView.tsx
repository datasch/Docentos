import { MAX_USER_STRIKES, nextStrikes } from '../lib/moderation';
import { useEffect, useRef, useState } from 'react';
import { X, Plus, List, LayoutGrid, BookOpen, Check, SlidersHorizontal, TriangleAlert, ShieldAlert, Loader2 } from 'lucide-react';
import type { User, UserRole, CourseEnrollmentRecord } from '../types';
import { avatarSrc } from '../lib/avatar.js';
import { AdminSearchField, FilterMenu, ActiveFilters, Pager } from './AdminListKit';

const ROLES: Array<{ value: UserRole; label: string }> = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'MENTOR', label: 'Mentor' },
  { value: 'MENTEE', label: 'Mentee' },
  { value: 'PUBLIC_USER', label: 'Estudiante' },
  { value: 'VIP', label: 'Estudiante VIP' },
  { value: 'EXTERNAL', label: 'Invitado' },
];
const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label ?? r;
const ENR_STATUS: Record<CourseEnrollmentRecord['status'], string> = { ACTIVE: 'Activa', COMPLETED: 'Graduado', REVOKED: 'Revocada', EXPIRED: 'Expirada' };
const ENR_SOURCE: Record<CourseEnrollmentRecord['source'], string> = { ADMIN: 'Asignación directa', PAYMENT: 'Pago', MENTORSHIP: 'Mentoría', IMPORT: 'Importada' };
const ENR_FILTERS = [{ value: 'ALL', label: 'Todas' }, ...(['ACTIVE', 'COMPLETED', 'REVOKED', 'EXPIRED'] as const).map((v) => ({ value: v, label: ENR_STATUS[v] }))];
const VIEW_KEY = 'admin-people-view';
const ACCT_FILTERS = [
  { value: 'ALL', label: 'Todas' },
  { value: 'active', label: 'Activas' },
  { value: 'suspended', label: 'Suspendidas' },
  { value: 'strikes', label: 'Con strikes' },
  { value: 'nocourses', label: 'Sin cursos' },
];

interface Props {
  users: User[];
  enrollments: CourseEnrollmentRecord[];
  loading: boolean;
  roleError: string;
  section: 'directory' | 'enrollments';
  onSection: (s: 'directory' | 'enrollments') => void;
  onEnrollmentStatus: (id: string, status: CourseEnrollmentRecord['status']) => void;
  onNewEnrollment: () => void;
  onEnrollUser: (userId: string) => void;
  onUpdateRole: (userId: string, role: UserRole) => void;
  onModerate: (u: User, action: 'add_strike' | 'remove_strike' | 'toggle_active') => Promise<boolean>;
  onHistory: (u: User) => void;
  onMentorCourses: (u: User) => void;
}

/** Directorio de personas: tarjetas como en Mentoría; rol y moderación en una hoja lateral. */
export function AdminPeopleView({ users, enrollments, loading, roleError, section, onSection, onEnrollmentStatus, onNewEnrollment, onEnrollUser, onUpdateRole, onModerate, onHistory, onMentorCourses }: Props) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('ALL');
  const [page, setPage] = useState(1);
  const [enrPage, setEnrPage] = useState(1);
  const [enrQuery, setEnrQuery] = useState('');
  const [enrStatus, setEnrStatus] = useState('ALL');
  const [acct, setAcct] = useState('ALL');
  const [revokeTarget, setRevokeTarget] = useState<CourseEnrollmentRecord | null>(null);
  const revokeRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = revokeRef.current;
    if (!d) return;
    if (revokeTarget && !d.open) d.showModal();
    if (!revokeTarget && d.open) d.close();
  }, [revokeTarget]);
  const [enrSource, setEnrSource] = useState('ALL');
  const [sheetId, setSheetId] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDialogElement>(null);
  // Acciones críticas: primero se pide confirmación dentro de la misma hoja, sin cerrarla.
  const [confirm, setConfirm] = useState<null | 'strike' | 'unstrike' | 'suspend'>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 639px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const sync = () => setIsMobile(mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const [storedView, setStoredView] = useState<'list' | 'cards'>(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'cards' ? 'cards' : 'list'; } catch { return 'list'; }
  });
  // En móvil solo hay tarjetas; la preferencia de escritorio no se pisa.
  const view = isMobile ? 'cards' : storedView;
  const changeView = (v: 'list' | 'cards') => {
    setStoredView(v);
    setPage(1);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* la vista solo dura esta sesión */ }
  };

  // La hoja lee al usuario vivo de la lista, así el rol y los strikes se actualizan al cambiarlos.
  const sheetUser = users.find((u) => u.id === sheetId) ?? null;
  useEffect(() => {
    const d = sheetRef.current;
    if (!d) return;
    if (sheetUser && !d.open) d.showModal();
    if (!sheetUser && d.open) d.close();
  }, [sheetUser?.id]);

  useEffect(() => { setConfirm(null); setDone(''); }, [sheetId]);
  const runCritical = async (u: User) => {
    const kind = confirm;
    if (!kind) return;
    setBusy(true);
    const ok = await onModerate(u, kind === 'strike' ? 'add_strike' : kind === 'unstrike' ? 'remove_strike' : 'toggle_active');
    setBusy(false);
    setConfirm(null);
    const n = kind === 'unstrike' ? nextStrikes(u.strikes || 0, 'remove_strike') : nextStrikes(u.strikes || 0, 'add_strike');
    setDone(!ok ? 'No se pudo aplicar el cambio. Inténtalo de nuevo.'
      : kind === 'strike' ? `Strike agregado: ahora tiene ${n}.`
      : kind === 'unstrike' ? `Strike quitado: ahora tiene ${n}.`
      : u.isActive === false ? 'Cuenta reactivada.' : 'Cuenta suspendida.');
  };

  const activeCourses = (u: User) =>
    enrollments.filter((e) => (e.userId === u.id || e.userEmail === u.email) && e.status === 'ACTIVE').length;
  const q = query.trim().toLowerCase();
  const matchQ = (u: User) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  const matchRole = (u: User, v: string) => v === 'ALL' || u.role === v;
  const matchAcct = (u: User, v: string) =>
    v === 'ALL' || (v === 'active' ? u.isActive !== false : v === 'suspended' ? u.isActive === false : v === 'strikes' ? (u.strikes || 0) > 0 : activeCourses(u) === 0);
  // Cada contador respeta los otros filtros: el número es lo que verás al elegir esa opción.
  const roleCount = (v: string) => users.filter((u) => matchQ(u) && matchAcct(u, acct) && matchRole(u, v)).length;
  const acctCount = (v: string) => users.filter((u) => matchQ(u) && matchRole(u, role) && matchAcct(u, v)).length;
  const roleOptions = [{ value: 'ALL', label: 'Todos' }, ...ROLES.filter((r) => users.some((u) => u.role === r.value))];
  const visible = users.filter((u) => matchQ(u) && matchRole(u, role) && matchAcct(u, acct));
  const clearFilters = () => { setRole('ALL'); setAcct('ALL'); setQuery(''); setPage(1); };

  const eq = enrQuery.trim().toLowerCase();
  const matchEQ = (e: CourseEnrollmentRecord) => !eq || [e.userName, e.userEmail, e.courseTitle].some((t) => (t || '').toLowerCase().includes(eq));
  const enrCount = (v: string) => enrollments.filter((e) => matchEQ(e) && (enrSource === 'ALL' || e.source === enrSource) && (v === 'ALL' || e.status === v)).length;
  const srcCount = (v: string) => enrollments.filter((e) => matchEQ(e) && (enrStatus === 'ALL' || e.status === enrStatus) && (v === 'ALL' || e.source === v)).length;
  const srcOptions = [{ value: 'ALL', label: 'Todos' }, ...(Object.keys(ENR_SOURCE) as Array<CourseEnrollmentRecord['source']>).filter((k) => enrollments.some((e) => e.source === k)).map((k) => ({ value: k, label: ENR_SOURCE[k] }))];
  const enrVisible = enrollments.filter((e) => matchEQ(e) && (enrStatus === 'ALL' || e.status === enrStatus) && (enrSource === 'ALL' || e.source === enrSource));
  const clearEnr = () => { setEnrStatus('ALL'); setEnrSource('ALL'); setEnrQuery(''); setEnrPage(1); };

  const chipsDir = (
    <ActiveFilters
      noun="usuarios" shown={visible.length} total={users.length} onClear={clearFilters}
      chips={[
        ...(role !== 'ALL' ? [{ key: 'role', text: roleLabel(role), onRemove: () => { setRole('ALL'); setPage(1); } }] : []),
        ...(acct !== 'ALL' ? [{ key: 'acct', text: ACCT_FILTERS.find((f) => f.value === acct)?.label ?? '', onRemove: () => { setAcct('ALL'); setPage(1); } }] : []),
        ...(q ? [{ key: 'q', text: `«${query.trim()}»`, onRemove: () => { setQuery(''); setPage(1); } }] : []),
      ]}
    />
  );
  const chipsEnr = (
    <ActiveFilters
      noun="matrículas" shown={enrVisible.length} total={enrollments.length} onClear={clearEnr}
      chips={[
        ...(enrStatus !== 'ALL' ? [{ key: 'st', text: ENR_STATUS[enrStatus as CourseEnrollmentRecord['status']], onRemove: () => { setEnrStatus('ALL'); setEnrPage(1); } }] : []),
        ...(enrSource !== 'ALL' ? [{ key: 'src', text: ENR_SOURCE[enrSource as CourseEnrollmentRecord['source']], onRemove: () => { setEnrSource('ALL'); setEnrPage(1); } }] : []),
        ...(eq ? [{ key: 'q', text: `«${enrQuery.trim()}»`, onRemove: () => { setEnrQuery(''); setEnrPage(1); } }] : []),
      ]}
    />
  );
  const size = view === 'list' ? 10 : 12;
  const curPage = Math.min(page, Math.max(1, Math.ceil(visible.length / size)));
  const pageUsers = visible.slice((curPage - 1) * size, curPage * size);
  const ENR_SIZE = size;
  const curEnrPage = Math.min(enrPage, Math.max(1, Math.ceil(enrVisible.length / ENR_SIZE)));
  const pageEnrs = enrVisible.slice((curEnrPage - 1) * ENR_SIZE, curEnrPage * ENR_SIZE);
  const userById = (id: string) => users.find((u) => u.id === id);

  return (
    <div data-mentor-ui="modern" className="admin-courses-root">
      <div className="mentor-mentees-panel admin-people-panel">
        <div className="mentor-section-heading">
          <div>
            <h2 id="admin-people-title">Usuarios</h2>
            <p>
              {section === 'directory'
                ? 'Cuentas registradas en la plataforma: rol, estado y moderación.'
                : 'Acceso de cada usuario a los cursos: estado, origen y fecha de alta.'}
            </p>
          </div>
          <div className="admin-courses-actions">
            <button type="button" className="mentor-course-control mentor-course-publish" onClick={onNewEnrollment}>
              <Plus aria-hidden="true" />
              Nueva matrícula
            </button>
          </div>
        </div>

        <div className="admin-people-top">
          <div className="mentor-publication-filters" role="group" aria-label="Sección de usuarios">
            <button type="button" aria-pressed={section === 'directory'} onClick={() => onSection('directory')}>
              <span>Directorio</span>
              <span className="mentor-publication-count">({users.length})</span>
            </button>
            <button type="button" aria-pressed={section === 'enrollments'} onClick={() => onSection('enrollments')}>
              <span>Matrículas</span>
              <span className="mentor-publication-count">({enrollments.length})</span>
            </button>
          </div>
        </div>

        {section === 'directory' ? (
          <>
            <div className="mentor-course-toolbar">
              <AdminSearchField value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Buscar por nombre o correo" label="Buscar usuario" />
              <FilterMenu groups={[
                { value: role, onChange: (v) => { setRole(v); setPage(1); }, options: roleOptions.filter((o) => o.value !== 'ALL').map((o) => ({ ...o, count: roleCount(o.value) })) },
                { value: acct, onChange: (v) => { setAcct(v); setPage(1); }, options: ACCT_FILTERS.filter((o) => o.value !== 'ALL').map((o) => ({ ...o, count: acctCount(o.value) })) },
              ]} />
              {!isMobile && (
                <div className="mentor-publication-filters admin-view-toggle" role="group" aria-label="Vista de usuarios">
                  <button type="button" aria-pressed={view === 'list'} onClick={() => changeView('list')}>
                    <List aria-hidden="true" />
                    <span>Lista</span>
                  </button>
                  <button type="button" aria-pressed={view === 'cards'} onClick={() => changeView('cards')}>
                    <LayoutGrid aria-hidden="true" />
                    <span>Tarjetas</span>
                  </button>
                </div>
              )}
            </div>

            {chipsDir}

            {roleError && (
              <p role="alert" className="admin-people-error">
                <TriangleAlert aria-hidden="true" />
                {roleError}
              </p>
            )}

            {visible.length === 0 ? (
              <p className="mentor-courses-empty" role="status">
                {users.length === 0 ? (loading ? 'Cargando usuarios…' : 'Todavía no hay usuarios registrados.') : 'Nadie coincide con el filtro.'}
              </p>
            ) : (
              <div className="admin-people-list" data-view={view}>
              {view === 'list' && (
                <div className="admin-people-head" aria-hidden="true">
                  <span>Usuario</span><span>Rol</span><span>Estado</span><span>Cursos</span><span>Strikes</span><span />
                </div>
              )}
              <ul className="mentor-mentee-grid" data-view={view}>
                {pageUsers.map((u) => {
                  const suspended = u.isActive === false;
                  const strikes = u.strikes || 0;
                  const courses = activeCourses(u);
                  return (
                    <li key={u.id} className="mentor-mentee-card" data-view={view}>
                      <div className="mentor-mentee-card__head">
                        <img src={avatarSrc(u.avatarUrl)} alt="" className="mentor-mentee-avatar" />
                        <div className="mentor-mentee-id">
                          <strong>{u.name}</strong>
                          <span title={u.email}>{u.email}</span>
                        </div>
                      </div>
                      <div className="admin-people-card__facts">
                        <span className="admin-people-role" data-role={u.role}>{roleLabel(u.role)}</span>
                        <span className="mentor-mentee-status" data-state={suspended ? 'suspended' : 'active'}>{suspended ? 'Suspendido' : 'Activo'}</span>
                      </div>
                      <dl className="admin-people-stats">
                        <div><dt>Cursos</dt><dd>{courses}</dd></div>
                        <div><dt>Strikes</dt><dd>{strikes}</dd></div>
                      </dl>
                      <button type="button" className="mentor-course-control" onClick={() => setSheetId(u.id)} aria-haspopup="dialog" aria-label={`Gestionar a ${u.name}`}>
                        Gestionar
                      </button>
                    </li>
                  );
                })}
              </ul>
              </div>
            )}

            <Pager total={visible.length} size={size} page={curPage} onPage={setPage} noun="usuarios" />
          </>
        ) : (
          <>
            <div className="mentor-course-toolbar">
              <AdminSearchField value={enrQuery} onChange={(value) => { setEnrQuery(value); setEnrPage(1); }} placeholder="Buscar usuario o curso" label="Buscar matrícula" />
              <FilterMenu groups={[
                { value: enrStatus, onChange: (v) => { setEnrStatus(v); setEnrPage(1); }, options: ENR_FILTERS.filter((o) => o.value !== 'ALL').map((o) => ({ ...o, count: enrCount(o.value) })) },
                { value: enrSource, onChange: (v) => { setEnrSource(v); setEnrPage(1); }, options: srcOptions.filter((o) => o.value !== 'ALL').map((o) => ({ ...o, count: srcCount(o.value) })) },
              ]} />
              {!isMobile && (
                <div className="mentor-publication-filters admin-view-toggle" role="group" aria-label="Vista de usuarios">
                  <button type="button" aria-pressed={view === 'list'} onClick={() => changeView('list')}>
                    <List aria-hidden="true" />
                    <span>Lista</span>
                  </button>
                  <button type="button" aria-pressed={view === 'cards'} onClick={() => changeView('cards')}>
                    <LayoutGrid aria-hidden="true" />
                    <span>Tarjetas</span>
                  </button>
                </div>
              )}
            </div>

            {chipsEnr}

            {enrVisible.length === 0 ? (
              <p className="mentor-courses-empty" role="status">
                {enrollments.length === 0 ? 'Todavía no hay matrículas.' : 'Ninguna matrícula coincide con el filtro.'}
              </p>
            ) : (
              <div className="admin-people-list admin-enroll-list" data-view={view}>
              {view === 'list' && (
                <div className="admin-people-head" aria-hidden="true">
                  <span>Usuario</span><span>Curso</span><span>Estado</span><span>Fecha y origen</span><span />
                </div>
              )}
              <ul className="mentor-mentee-grid" data-view={view}>
                {pageEnrs.map((e) => {
                  const person = userById(e.userId);
                  return (
                    <li key={e.id} className="mentor-mentee-card admin-enroll-card" data-view={view}>
                      <div className="mentor-mentee-card__head">
                        <img src={avatarSrc(person?.avatarUrl)} alt="" className="mentor-mentee-avatar" />
                        <div className="mentor-mentee-id">
                          <strong>{e.userName || person?.name || e.userId}</strong>
                          <span title={e.userEmail}>{e.userEmail}</span>
                        </div>
                      </div>
                      <p className="admin-enroll-card__course">{e.courseTitle || e.courseId}</p>
                      <span className="mentor-mentee-status admin-enroll-status" data-state={e.status}>{ENR_STATUS[e.status]}</span>
                      <p className="admin-people-card__meta">
                        {new Date(e.createdAt).toLocaleDateString('es-ES')} · {ENR_SOURCE[e.source]}
                      </p>
                      <div className="admin-enroll-card__actions">
                        <button type="button" className="mentor-course-control" disabled={e.status === 'ACTIVE'} onClick={() => onEnrollmentStatus(e.id, 'ACTIVE')}>Activar</button>
                        <button type="button" className="mentor-course-control" data-danger="true" disabled={e.status === 'REVOKED'} onClick={() => setRevokeTarget(e)} aria-haspopup="dialog">Revocar</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              </div>
            )}
            <Pager total={enrVisible.length} size={ENR_SIZE} page={curEnrPage} onPage={setEnrPage} noun="matrículas" />
          </>
        )}

        <dialog
          ref={revokeRef}
          className="mentor-confirm"
          aria-labelledby="admin-revoke-title"
          onCancel={(e) => { e.preventDefault(); setRevokeTarget(null); }}
          onClick={(e) => { if (e.target === e.currentTarget) setRevokeTarget(null); }}
        >
          {revokeTarget && (
            <div className="mentor-confirm__body">
              <h3 id="admin-revoke-title" className="admin-confirm-title">
                <ShieldAlert aria-hidden="true" />
                Revocar matrícula
              </h3>
              <p>
                <strong>{revokeTarget.userName || revokeTarget.userEmail}</strong> perderá el acceso a <strong>{revokeTarget.courseTitle || 'este curso'}</strong>. Podrás volver a activarla cuando quieras.
              </p>
              <div className="mentor-confirm__actions">
                <button type="button" className="mentor-course-control" onClick={() => setRevokeTarget(null)}>Cancelar</button>
                <button
                  type="button"
                  className="mentor-course-control"
                  data-danger="true"
                  onClick={() => { const t = revokeTarget; setRevokeTarget(null); onEnrollmentStatus(t.id, 'REVOKED'); }}
                >
                  Revocar matrícula
                </button>
              </div>
            </div>
          )}
        </dialog>

        <dialog
          ref={sheetRef}
          className="mentee-sheet"
          aria-labelledby="admin-person-title"
          onClose={() => setSheetId(null)}
          onClick={(e) => { if (e.target === sheetRef.current) setSheetId(null); }}
        >
          {sheetUser && (
            <div className="mentee-sheet__body admin-person-sheet">
              <header className="mentee-sheet__head">
                <img src={avatarSrc(sheetUser.avatarUrl)} alt="" className="mentor-mentee-avatar" />
                <div className="mentor-mentee-id">
                  <strong id="admin-person-title">{sheetUser.name}</strong>
                  <span>{sheetUser.email}</span>
                </div>
                <button type="button" className="mentee-sheet__close" onClick={() => setSheetId(null)} aria-label="Cerrar">
                  <X aria-hidden="true" />
                </button>
              </header>

              <div className="admin-person-sheet__scroll">
                <div className="meeting-field">
                  <label htmlFor="admin-person-role">Rol</label>
                  <select id="admin-person-role" value={sheetUser.role} onChange={(e) => onUpdateRole(sheetUser.id, e.target.value as UserRole)}>
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                {roleError && <p role="alert" className="admin-people-error"><TriangleAlert aria-hidden="true" />{roleError}</p>}

                <section className="admin-critical" aria-labelledby="admin-critical-title">
                  <header className="admin-critical__head">
                    <ShieldAlert aria-hidden="true" />
                    <div>
                      <h3 id="admin-critical-title">Acciones críticas</h3>
                      <p>Afectan el acceso de esta persona a la plataforma y piden confirmación.</p>
                    </div>
                  </header>
                  {confirm ? (
                    <div className="admin-critical__confirm" role="group" aria-label="Confirmar acción">
                      <p>
                        {confirm === 'strike'
                          ? `¿Dar un strike a ${sheetUser.name}? Pasará de ${sheetUser.strikes || 0} a ${nextStrikes(sheetUser.strikes || 0, 'add_strike')}.${nextStrikes(sheetUser.strikes || 0, 'add_strike') >= MAX_USER_STRIKES ? ` Con ${MAX_USER_STRIKES} strikes la cuenta se suspende sola.` : ''}`
                          : confirm === 'unstrike'
                            ? `¿Quitar un strike a ${sheetUser.name}? Pasará de ${sheetUser.strikes || 0} a ${nextStrikes(sheetUser.strikes || 0, 'remove_strike')}.`
                          : sheetUser.isActive === false
                            ? `¿Reactivar la cuenta de ${sheetUser.name}? Recuperará el acceso.`
                            : `¿Suspender la cuenta de ${sheetUser.name}? Perderá el acceso hasta que la reactives.`}
                      </p>
                      <div className="admin-people-card__actions">
                        <button type="button" className="mentor-course-control" onClick={() => setConfirm(null)} disabled={busy}>Cancelar</button>
                        <button type="button" className="mentor-course-control admin-critical__go" data-tone={confirm === 'strike' ? 'warn' : confirm === 'unstrike' ? 'ok' : sheetUser.isActive === false ? 'ok' : 'danger'} onClick={() => runCritical(sheetUser)} disabled={busy} aria-busy={busy}>
                          {busy && <Loader2 aria-hidden="true" className="animate-spin" />}
                          {confirm === 'strike' ? 'Confirmar strike' : confirm === 'unstrike' ? 'Confirmar quitar strike' : sheetUser.isActive === false ? 'Confirmar reactivación' : 'Confirmar suspensión'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="admin-people-card__actions">
                      <button type="button" className="mentor-course-control" data-tone="warn" onClick={() => { setDone(''); setConfirm('strike'); }} disabled={(sheetUser.strikes || 0) >= MAX_USER_STRIKES} title={(sheetUser.strikes || 0) >= MAX_USER_STRIKES ? `Ya tiene el máximo de ${MAX_USER_STRIKES} strikes` : undefined}>Dar un strike</button>
                      <button type="button" className="mentor-course-control" onClick={() => { setDone(''); setConfirm('unstrike'); }} disabled={(sheetUser.strikes || 0) <= 0}>Quitar un strike</button>
                      <button type="button" className="mentor-course-control" onClick={() => onHistory(sheetUser)}>Ver historial</button>
                      <button type="button" className="mentor-course-control" data-tone={sheetUser.isActive === false ? 'ok' : 'danger'} onClick={() => { setDone(''); setConfirm('suspend'); }}>
                        {sheetUser.isActive === false ? 'Reactivar cuenta' : 'Suspender cuenta'}
                      </button>
                    </div>
                  )}
                  {done && <p role="status" className="admin-critical__done">{done}</p>}
                </section>
              </div>

              <footer className="mentee-sheet__foot mentee-sheet__foot--actions">
                {sheetUser.role === 'MENTOR' && (
                  <button type="button" className="mentor-course-control" onClick={() => { setSheetId(null); onMentorCourses(sheetUser); }}>
                    <BookOpen aria-hidden="true" /> Cursos a cargo
                  </button>
                )}
                <button type="button" className="mentor-course-control mentor-course-import" onClick={() => onEnrollUser(sheetUser.id)}>
                  <Plus aria-hidden="true" /> Matricular
                </button>
              </footer>
            </div>
          )}
        </dialog>
      </div>
    </div>
  );
}
