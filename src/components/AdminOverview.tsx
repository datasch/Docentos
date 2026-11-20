/**
 * Inicio del panel de administración: cifras con su contexto, lo que necesita
 * atención y lo último que pasó. Nada de esto repite la navegación del panel.
 */

import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { timeAgo } from '../lib/timeAgo';
import type { CertificateRecord, Course, CourseEnrollmentRecord, User } from '../types';

type Target = 'courses' | 'users' | 'enrollments' | 'certificates' | 'listening';

interface Props {
  courses: Course[];
  users: User[];
  enrollments: CourseEnrollmentRecord[];
  certificates: CertificateRecord[];
  onOpen: (target: Target) => void;
}

export const AdminOverview: React.FC<Props> = ({ courses, users, enrollments, certificates, onOpen }) => {
  const { t } = useTranslation();
  const [pendingMessages, setPendingMessages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.getListeningAdmin({ days: 0, status: '', type: '', topic: '', courseId: '', mood: '' })
      .then((res) => { if (!cancelled) setPendingMessages(res.summary.pending); })
      .catch(() => { /* sin buzón disponible, no se avisa de nada */ });
    return () => { cancelled = true; };
  }, []);

  const published = courses.filter((course) => course.published).length;
  const drafts = courses.length - published;
  const suspended = users.filter((user) => user.isActive === false).length;
  const mentors = users.filter((user) => user.role === 'MENTOR').length;
  const activeEnrollments = enrollments.filter((item) => item.status === 'ACTIVE').length;
  const completed = enrollments.filter((item) => item.status === 'COMPLETED').length;
  const revoked = certificates.filter((item) => item.revokedAt).length;

  const stats: Array<{ label: string; value: number; detail: string; target: Target }> = [
    { label: t('cursosCapital', 'Cursos'), value: courses.length, detail: t('overviewCourses', '{{published}} publicados · {{drafts}} borradores', { published, drafts }), target: 'courses' },
    { label: t('adminUsuarios', 'Usuarios'), value: users.length, detail: t('overviewUsers', '{{count}} mentores', { count: mentors }), target: 'users' },
    { label: t('matriculas', 'Matrículas'), value: enrollments.length, detail: t('overviewEnrollments', '{{active}} activas · {{done}} completadas', { active: activeEnrollments, done: completed }), target: 'enrollments' },
    { label: t('certificados', 'Certificados'), value: certificates.length, detail: revoked > 0 ? t('overviewCertsRevoked', '{{count}} revocados', { count: revoked }) : t('overviewCertsVigentes', 'Todos vigentes'), target: 'certificates' },
  ];

  // Siempre las mismas tres comprobaciones: una lista fija se lee de un vistazo y llena la tarjeta.
  const attention: Array<{ text: string; count: number; target: Target }> = [
    { text: t('overviewPendingMessages', 'Mensajes del buzón por responder'), count: pendingMessages, target: 'listening' },
    { text: t('overviewDrafts', 'Cursos sin publicar'), count: drafts, target: 'courses' },
    { text: t('overviewSuspended', 'Usuarios con acceso suspendido'), count: suspended, target: 'users' },
  ];

  const activity: Array<{ at: string; text: string; target: Target }> = [
    ...enrollments.map((item) => ({ at: item.createdAt, target: 'enrollments' as const, text: t('overviewEnrolled', '{{name}} se matriculó en {{course}}', { name: item.userName || item.userEmail || '—', course: item.courseTitle || '—' }) })),
    ...certificates.map((item) => ({ at: item.issuedAt, target: 'certificates' as const, text: t('overviewCertified', 'Certificado de {{course}} para {{name}}', { course: item.courseTitle, name: item.recipientName || item.userName || '—' }) })),
  ]
    .filter((item) => item.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 5);

  return (
    <section data-mentor-ui="modern" className="admin-courses-root admin-overview" aria-labelledby="admin-overview-title">
      <div className="mentor-mentees-panel admin-people-panel">
        <div className="mentor-section-heading">
          <div>
            <h2 id="admin-overview-title">{t('estadoGeneral', 'Estado general')}</h2>
            <p>{t('overviewIntro', 'Lo que necesita tu atención y lo último que pasó en la plataforma.')}</p>
          </div>
        </div>
      </div>

      <div className="admin-overview__stats">
        {stats.map((stat) => (
          <button key={stat.target} type="button" className="admin-overview__stat" onClick={() => onOpen(stat.target)}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.detail}</small>
          </button>
        ))}
      </div>

      <div className="admin-overview__columns">
        <section className="admin-overview__card" aria-labelledby="admin-overview-attention">
          <h3 id="admin-overview-attention">{t('overviewAttention', 'Requiere atención')}</h3>
          <ul>
            {attention.map((item) => (
              <li key={item.target}>
                {item.count > 0 ? (
                  <button type="button" onClick={() => onOpen(item.target)}>
                    <b>{item.count}</b>
                    <span>{item.text}</span>
                    <ArrowRight aria-hidden="true" />
                  </button>
                ) : (
                  <p className="admin-overview__done">
                    <CheckCircle2 aria-hidden="true" />
                    <span>{item.text}</span>
                    <small>{t('overviewNone', 'Al día')}</small>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-overview__card" aria-labelledby="admin-overview-activity">
          <h3 id="admin-overview-activity">{t('overviewActivity', 'Actividad reciente')}</h3>
          {activity.length === 0 ? (
            <p className="admin-overview__clear">{t('overviewNoActivity', 'Todavía no hay actividad.')}</p>
          ) : (
            <ul>
              {activity.map((item, index) => (
                <li key={index}>
                  <button type="button" className="admin-overview__event" onClick={() => onOpen(item.target)}>
                    <span>{item.text}</span>
                    <time dateTime={item.at}>{timeAgo(item.at)}</time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
};
