import React from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';

interface ChristmasHeroSantaProps {
  heroRef: React.RefObject<HTMLElement | null>;
}

/** Santa and the rope share the hero's scroll progress, so reversing scroll reverses the descent. */
export const ChristmasHeroSanta: React.FC<ChristmasHeroSantaProps> = ({ heroRef }) => {
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const santaTransform = useTransform(scrollYProgress, [0, 0.7], ['translateY(0%)', 'translateY(100%)']);
  const ropeTransform = useTransform(scrollYProgress, [0, 0.7], ['scaleY(0.15)', 'scaleY(0.82)']);

  return (
    <div className="christmas-hero-scene" aria-hidden="true">
      <motion.span className="christmas-hero-scene__rope" style={reducedMotion ? undefined : { transform: ropeTransform }} />
      <motion.img
        src="/seasonal/santa-rope.webp"
        alt=""
        className="christmas-hero-scene__santa"
        width={512}
        height={768}
        decoding="async"
        style={reducedMotion ? undefined : { transform: santaTransform }}
      />
      <img src="/seasonal/chimney.webp" alt="" className="christmas-hero-scene__chimney" width={512} height={512} decoding="async" />
    </div>
  );
};
