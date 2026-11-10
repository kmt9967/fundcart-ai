/** Only same-site relative paths are accepted as a post-login destination (no open redirects). */
export function safeNext(n: string | null | undefined): string | null {
  if (!n || n.length > 400) return null;
  if (!n.startsWith('/') || n.startsWith('//') || n.startsWith('/\\')) return null;
  return /^\/[A-Za-z0-9/_\-?=&%.]*$/.test(n) ? n : null;
}
