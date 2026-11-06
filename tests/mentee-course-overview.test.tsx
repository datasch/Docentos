import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CourseOverview } from '../src/components/CourseOverview.js';
import type { Course, User } from '../src/types.js';

const mockCourse: Course = {
  id: 'course-test-1',
  title: 'Quiero crear un curso práctico y estructurado',
  description: 'Contenido desde fundamentos hasta proyectos aplicados con objetivos claros.',
  category: 'Mentoría Especializada',
  published: true,
  price: 99,
  currency: 'USD',
  coverImage: '/cover.png',
  hasAccess: false,
  modules: [],
  resources: [],
  assignedMentor: {
    id: 'mentor-1',
    name: 'Ing. Sofia Ruiz',
    email: 'sofia.mentor@giantucchi.com',
    avatarUrl: null,
  },
};

const menteeUser: User = {
  id: 'mentee-1',
  name: 'Joaquin',
  email: 'ale@gmail.com',
  role: 'MENTEE',
};

const publicUser: User = {
  id: 'public-1',
  name: 'Juan Perez',
  email: 'juan@example.com',
  role: 'PUBLIC_USER',
};

test('CourseOverview: MENTEE sin acceso no ve precios y ve opción de solicitar acceso a mentor', () => {
  const html = renderToStaticMarkup(
    <CourseOverview
      course={mockCourse}
      ready={true}
      user={menteeUser}
      onBack={() => {}}
      onRegister={() => {}}
      onLogin={() => {}}
      onPurchase={() => {}}
      onContinue={() => {}}
    />,
  );

  // No debe mostrar tarifa ni precio en USD
  assert.equal(html.includes('99,00'), false, 'No debe mostrar el precio del curso al mentee');
  assert.equal(html.includes('Ver opciones de acceso'), false, 'No debe mostrar botón de compra al mentee');

  // Debe mostrar la información del mentor y el botón de solicitud
  assert.ok(html.includes('Solicitar acceso a mi mentor'), 'Debe mostrar botón Solicitar acceso a mi mentor');
  assert.ok(html.includes('Ing. Sofia Ruiz'), 'Debe mostrar el nombre del mentor asignado');
  assert.ok(html.includes('sofia.mentor@giantucchi.com'), 'Debe mostrar el correo del mentor asignado');
  assert.ok(html.includes('Acceso gestionado por Mentoría'), 'Debe indicar que el acceso es por mentoría');
});

test('CourseOverview: MENTEE con solicitud pendiente ve estado en espera', () => {
  const courseWithPending: Course = {
    ...mockCourse,
    hasPendingRequest: true,
  };

  const html = renderToStaticMarkup(
    <CourseOverview
      course={courseWithPending}
      ready={true}
      user={menteeUser}
      onBack={() => {}}
      onRegister={() => {}}
      onLogin={() => {}}
      onPurchase={() => {}}
      onContinue={() => {}}
    />,
  );

  assert.ok(html.includes('Solicitud enviada a tu mentor'), 'Debe indicar que la solicitud fue enviada');
  assert.ok(html.includes('En espera de aprobación'), 'Debe indicar que está en espera de aprobación');
});

test('CourseOverview: PUBLIC_USER sin acceso ve precio y opciones de compra', () => {
  const html = renderToStaticMarkup(
    <CourseOverview
      course={mockCourse}
      ready={true}
      user={publicUser}
      onBack={() => {}}
      onRegister={() => {}}
      onLogin={() => {}}
      onPurchase={() => {}}
      onContinue={() => {}}
    />,
  );

  assert.ok(html.includes('Ver opciones de acceso'), 'Debe mostrar Ver opciones de acceso para usuario público');
  assert.ok(html.includes('USD'), 'Debe mostrar moneda para usuario público');
  assert.equal(html.includes('Solicitar acceso a mi mentor'), false, 'No debe mostrar solicitud a mentor para usuario público');
});

test('CourseOverview: Alumno o Mentee con acceso ve Continuar aprendiendo', () => {
  const courseWithAccess: Course = {
    ...mockCourse,
    hasAccess: true,
  };

  const html = renderToStaticMarkup(
    <CourseOverview
      course={courseWithAccess}
      ready={true}
      user={menteeUser}
      onBack={() => {}}
      onRegister={() => {}}
      onLogin={() => {}}
      onPurchase={() => {}}
      onContinue={() => {}}
    />,
  );

  assert.ok(html.includes('Continuar aprendiendo'), 'Debe mostrar botón Continuar aprendiendo');
  assert.equal(html.includes('Solicitar acceso a mi mentor'), false, 'No debe solicitar acceso si ya lo tiene');
});
