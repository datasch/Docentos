import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConstellationNeuralSearch } from '../src/experiences/constellation/ConstellationNeuralSearch.js';
import type { Course } from '../src/types.js';

const mockCourses = [
  {
    id: 'course-1',
    title: 'Arquitectura Cloud en AWS',
    description: 'Diseño de sistemas distribuidos y microservicios.',
    category: 'Mentoría Especializada',
    published: true,
    price: 30,
    coverImage: '/logo.avif',
    modules: [
      {
        id: 'mod-1',
        title: 'Fundamentos de VPC',
        videos: [
          {
            id: 'vid-1',
            title: 'Subredes y Gateways',
            duration: '15m',
            driveFileId: 'drive-1',
            mimeType: 'video/mp4',
            embedUrl: 'https://drive.google.com/preview',
            order: 1,
          },
        ],
      },
    ],
    resources: [],
  },
  {
    id: 'course-2',
    title: 'Ciberseguridad Ofensiva y Pentesting',
    description: 'Aprende auditoría y ethical hacking.',
    category: 'Mentoría Premium',
    published: true,
    price: 50,
    coverImage: '/logo.avif',
    modules: [],
    resources: [],
  },
  {
    id: 'course-3',
    title: 'Machine Learning con Python',
    description: 'Modelos predictivos y redes neuronales.',
    category: 'Mentoría Elite',
    published: true,
    price: 45,
    coverImage: '/logo.avif',
    modules: [],
    resources: [],
  },
] as unknown as Course[];

test('ConstellationNeuralSearch renderiza el filtro accesible con las categorías oficiales y sus cantidades', () => {
  const html = renderToStaticMarkup(
    <ConstellationNeuralSearch
      courses={mockCourses}
      onSelectCourse={() => {}}
    />
  );

  assert.match(html, /id="neural-search-category-filter"/);
  assert.match(html, /aria-label="Filtrar por categoría: Todos"/);
  for (const category of ['Mentoría Elite', 'Mentoría Especializada', 'Mentoría Premium']) {
    assert.ok(html.includes(`<span>${category}</span><span class="course-category-filter__count">1</span>`));
  }

  // Verifica que los cursos se renderizan en el catálogo
  assert.match(html, /Arquitectura Cloud en AWS/);
  assert.match(html, /Ciberseguridad Ofensiva y Pentesting/);
  assert.match(html, /Machine Learning con Python/);
});

test('ConstellationNeuralSearch muestra el contador ordenado de cursos disponibles', () => {
  const html = renderToStaticMarkup(
    <ConstellationNeuralSearch
      courses={mockCourses}
      onSelectCourse={() => {}}
    />
  );

  assert.match(html, /3 cursos disponibles/);
  assert.match(html, /CURSOS EN EL CATÁLOGO \(3\)/);
});

test('ConstellationNeuralSearch excluye cursos con categorías no estandarizadas', () => {
  const mixedCourses = [
    ...mockCourses,
    {
      id: 'course-legacy-1',
      title: 'Curso Desactualizado de Prueba',
      description: 'Legacy test course',
      category: 'YouTube Masterclass',
      published: true,
      price: 0,
      coverImage: '/logo.avif',
      modules: [],
      resources: [],
    },
    {
      id: 'course-legacy-2',
      title: 'Curso de Prueba Tecnología',
      description: 'Otro curso no estandarizado',
      category: 'Tecnología',
      published: true,
      price: 0,
      coverImage: '/logo.avif',
      modules: [],
      resources: [],
    },
  ] as unknown as Course[];

  const html = renderToStaticMarkup(
    <ConstellationNeuralSearch
      courses={mixedCourses}
      onSelectCourse={() => {}}
    />
  );

  // Solo debe contabilizar los 3 cursos estandarizados
  assert.match(html, /aria-pressed="true"[^>]*><span[^>]*>Todos<\/span><span[^>]*>3<\/span>/);
  assert.match(html, /3 cursos disponibles/);
  assert.match(html, /CURSOS EN EL CATÁLOGO \(3\)/);

  // No debe renderizar los cursos con categorías no estandarizadas
  assert.doesNotMatch(html, /Curso Desactualizado de Prueba/);
  assert.doesNotMatch(html, /Curso de Prueba Tecnología/);
  assert.doesNotMatch(html, /YouTube Masterclass/);
});
