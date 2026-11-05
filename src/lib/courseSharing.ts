export function coursePath(courseId: string): string {
  return `/courses/${encodeURIComponent(courseId)}`;
}

export function courseIdFromPath(pathname: string): string | null {
  const match = /^\/courses\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  try {
    const id = decodeURIComponent(match[1]);
    return id.length > 0 && id.length <= 100 ? id : null;
  } catch {
    return null;
  }
}

export function courseShareUrl(origin: string, courseId: string): string {
  return new URL(coursePath(courseId), origin).toString();
}
