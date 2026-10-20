export const SUPPORTED_LANGUAGES = ['en', 'es', 'th', 'fr', 'it', 'de', 'ja'];

export function getLandingLanguage(pathname: string) {
  const match = /^\/([a-z]{2})\/?$/i.exec(pathname);
  const language = match?.[1].toLowerCase();
  return language && SUPPORTED_LANGUAGES.includes(language) ? language : null;
}

export function detectLanguage() {
  if (typeof window === 'undefined') return 'en';
  const pathLanguage = getLandingLanguage(window.location.pathname);
  if (pathLanguage) return pathLanguage;
  const stored = window.localStorage.getItem('bw-lang');
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;
  const language = window.navigator.language?.slice(0, 2).toLowerCase();
  return SUPPORTED_LANGUAGES.includes(language) ? language : 'en';
}
