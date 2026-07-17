import en from './en.json';
import zh from './zh.json';

export const locales = ['en', 'zh'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

const dicts: Record<Locale, Record<string, string>> = { en, zh };

/** Read a translation, falling back to English then the key itself. */
export function t(key: string, locale: Locale = defaultLocale, vars: Record<string, string | number> = {}): string {
  const raw = dicts[locale]?.[key] ?? dicts[defaultLocale][key] ?? key;
  return Object.keys(vars).reduce(
    (acc, name) => acc.replace(new RegExp(`\\{${name}\\}`, 'g'), String(vars[name])),
    raw,
  );
}

/** Detect the locale of a URL pathname. */
export function pathLocale(pathname: string): Locale {
  if (pathname === '/zh' || pathname.startsWith('/zh/')) return 'zh';
  return 'en';
}

/** Strip the locale prefix from a pathname so it can be re-prefixed elsewhere. */
export function stripLocale(pathname: string): string {
  if (pathname === '/zh') return '/';
  if (pathname.startsWith('/zh/')) return pathname.slice(3) || '/';
  return pathname || '/';
}

/** Build the equivalent URL for `pathname` under a different locale. */
export function localizedPath(pathname: string, target: Locale): string {
  const bare = stripLocale(pathname);
  if (target === defaultLocale) return bare;
  return bare === '/' ? '/zh/' : `/zh${bare}`;
}
