export function getCookieValue(cookieHeader: string, name: string): string | null {
  const target = name.trim();
  if (!target || /[;=\s]/.test(target)) return null;

  for (const segment of cookieHeader.split(';')) {
    const cookie = segment.trim();
    if (!cookie) continue;
    const separator = cookie.indexOf('=');
    if (separator < 0) continue;
    if (cookie.slice(0, separator).trim() !== target) continue;
    return cookie.slice(separator + 1).trim();
  }
  return null;
}

export function hasCookie(cookieHeader: string, name: string) {
  return getCookieValue(cookieHeader, name) !== null;
}
