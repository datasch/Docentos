/** Un tono estable por curso (ángulo áureo sobre su posición en la lista), lejos del rojo de «en vivo». */
export function courseHue(courses: { id: string }[], id?: string | null): number {
  if (!id) return 0;
  const index = courses.findIndex((c) => c.id === id);
  if (index >= 0) return Math.round((255 + index * 137.508) % 360);
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
