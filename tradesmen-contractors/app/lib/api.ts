export function getApiUrl(path: string) {
  const protocol = process.env.VERCEL ? 'https' : 'http';
  const host = process.env.VERCEL_URL || 'localhost:3000';
  return `${protocol}://${host}${path}`;
}