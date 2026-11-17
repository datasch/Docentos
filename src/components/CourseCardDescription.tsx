import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Expand only descriptions that actually exceed two lines at the current width. */
export function CourseCardDescription({ text }: { text: string }) {
  const { t } = useTranslation();
  const textId = useId();
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const element = paragraph.current;
    if (!element) return;
    const measure = () => {
      const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
      setHasMore(element.scrollHeight > lineHeight * 2 + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  return (
    <div className="mentor-course-description" data-expanded={expanded}>
      <p id={textId} ref={paragraph} className="mentor-course-card__description">{text}</p>
      {hasMore && (
        <button
          type="button"
          className="mentor-course-description-toggle"
          aria-expanded={expanded}
          aria-controls={textId}
          onClick={() => setExpanded(value => !value)}
        >
          {expanded ? t('mentor.descriptionLess', 'Ver menos') : t('mentor.descriptionMore', 'Ver más')}
        </button>
      )}
    </div>
  );
}
