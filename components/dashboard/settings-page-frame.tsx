import type { ReactNode } from 'react';
import { getCopy, type Locale } from '@/lib/copy';

/** Shared Settings page frame. Individual panels remain independently stateful. */
export function SettingsPageFrame({ children, locale }: { children: ReactNode; locale: Locale }) {
  const c = getCopy(locale);
  return <section className="mx-auto max-w-2xl"><div><p className="text-sm font-medium text-slate-500">{c.settings.eyebrow}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{c.settings.title}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">{c.settings.description}</p></div>{children}</section>;
}
