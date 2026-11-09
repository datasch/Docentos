import React from 'react';
import { Brain, Video, ShieldCheck, Layers } from 'lucide-react';

const pillars = [
  { icon: Video, title: 'Estudia por módulos', description: 'Videos y recursos organizados para que encuentres cada parte de tu curso.' },
  { icon: Brain, title: 'Apoyo durante el estudio', description: 'Consulta el asistente y las guías de voz disponibles en la plataforma.' },
  { icon: ShieldCheck, title: 'Tu acceso, en un solo lugar', description: 'Encuentra los cursos que tienes asignados y accede a su contenido desde tu cuenta.' },
  { icon: Layers, title: 'Recursos para avanzar', description: 'Consulta los materiales y las evaluaciones que incorpora cada curso.' },
];

export const ConstellationPillars: React.FC = () => (
  <section className="academy-method">
    <div className="academy-container">
      <h2 className="academy-section-title">Un entorno pensado para aprender</h2>
      <div className="academy-method__grid">
        {pillars.map(({ icon: Icon, title, description }) => (
          <article key={title} className="academy-method__item">
            <Icon size={22} aria-hidden="true" />
            <div><h3>{title}</h3><p>{description}</p></div>
          </article>
        ))}
      </div>
    </div>
  </section>
);
