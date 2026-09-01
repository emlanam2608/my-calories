import { useEffect, useState } from 'react';
import { localeMetadata, type Locale } from '@/lib/copy';

/** Keeps browser-only dashboard effects out of the composition shell. */
export function useDashboardEffects(locale: Locale) {
  useEffect(() => {
    document.documentElement.lang = localeMetadata[locale].documentLang;
  }, [locale]);
}

/** Reflects browser connectivity only; writes remain server-authoritative and are never queued. */
export function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}
