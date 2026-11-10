import React from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, Video, ShieldCheck, Layers } from 'lucide-react';

export const ConstellationPillars: React.FC = () => {
  const { t } = useTranslation();

  const pillars = [
    {
      icon: Video,
      title: t('pillars.item1Title', 'Estudia por módulos'),
      description: t('pillars.item1Desc', 'Videos y recursos organizados para que encuentres cada parte de tu curso.'),
    },
    {
      icon: Brain,
      title: t('pillars.item2Title', 'Apoyo durante el estudio'),
      description: t('pillars.item2Desc', 'Consulta el asistente y las guías de voz disponibles en la plataforma.'),
    },
    {
      icon: ShieldCheck,
      title: t('pillars.item3Title', 'Tu acceso, en un solo lugar'),
      description: t('pillars.item3Desc', 'Encuentra los cursos que tienes asignados y accede a su contenido desde tu cuenta.'),
    },
    {
      icon: Layers,
      title: t('pillars.item4Title', 'Recursos para avanzar'),
      description: t('pillars.item4Desc', 'Consulta los materiales y las evaluaciones que incorpora cada curso.'),
    },
  ];

  return (
    <section className="academy-method">
      <div className="academy-container">
        <h2 className="academy-section-title">{t('pillars.title', 'Un entorno pensado para aprender')}</h2>
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
};
