import type { HealthFinding } from './contracts';
import type { Locale } from './copy';

export const healthFindingPresentationVersion =
  'health-finding-presentation-1' as const;

export type LocalizedFindingAction = { en: string; vi: string };

export function localizedFindingPresentation(
  en: string,
  vi: string,
  suggestedActions: LocalizedFindingAction[],
) {
  return {
    presentationVersion: healthFindingPresentationVersion,
    text: { en, vi },
    suggestedActions,
  } as const;
}

export function presentHealthFinding(
  finding: HealthFinding,
  locale: Locale,
): { text: string; suggestedActions: string[]; usedLegacyEnglishFallback: boolean } {
  if (
    'presentationVersion' in finding
    && finding.presentationVersion === healthFindingPresentationVersion
    && typeof finding.text !== 'string'
  ) {
    return {
      text: finding.text[locale],
      suggestedActions: finding.suggestedActions.map((action) =>
        typeof action === 'string' ? action : action[locale]
      ),
      usedLegacyEnglishFallback: false,
    };
  }
  return {
    text: typeof finding.text === 'string' ? finding.text : finding.text.en,
    suggestedActions: finding.suggestedActions.map((action) =>
      typeof action === 'string' ? action : action.en
    ),
    usedLegacyEnglishFallback: locale === 'vi',
  };
}
