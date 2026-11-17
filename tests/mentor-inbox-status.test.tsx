import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

await i18n.use(initReactI18next).init({ lng: 'es', resources: {} });
import { MentorDashboard } from '../src/components/MentorDashboard.js';

test('mentor inbox does not claim there are no pending questions before the request finishes', () => {
  const html = renderToStaticMarkup(
    <MentorDashboard
      currentUser={{ id: 'mentor-test', name: 'Mentor', email: 'mentor@example.invalid', role: 'MENTOR' }}
      courses={[]}
      onRefreshCourses={() => {}}
    />,
  );
  const header = html.slice(html.indexOf('<section'), html.indexOf('</section>'));
  assert.doesNotMatch(header, /0 consultas pendientes|Sin consultas pendientes/);
  assert.match(header, /Cargando consultas/);
});
