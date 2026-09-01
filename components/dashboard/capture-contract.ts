import type { SyntheticEvent } from 'react';
import type { FoodAnalysis, SavedFood } from '@/lib/contracts';
import type { Locale } from '@/lib/copy';

/** Public boundary for the Capture surface. State remains server-authoritative in the dashboard shell. */
export type CaptureSurfaceProps = {
  captureMode: 'text' | 'barcode' | 'vietnam_database' | 'usda' | 'photo';
  setCaptureMode: (mode: CaptureSurfaceProps['captureMode']) => void;
  vietnamCatalog: 'ingredient' | 'dish';
  setVietnamCatalog: (catalog: 'ingredient' | 'dish') => void;
  draft: string;
  setDraft: (value: string) => void;
  analysis: FoodAnalysis | null;
  analysing: boolean;
  saving: boolean;
  savingPersonalFood: boolean;
  onAnalyse: (event: SyntheticEvent<HTMLFormElement>) => void;
  onNutrientChange: (field: keyof FoodAnalysis['snapshot']['totals'], value: string) => void;
  onReviewDetailsChange: (servingDescription: string, ingredientsText: string) => void;
  onDiscard: () => void;
  onConfirm: () => Promise<boolean>;
  onSavePersonalFood: (kind: 'food' | 'recipe') => Promise<void>;
  savedFoods: SavedFood[];
  onUseSavedFood: (savedFood: SavedFood) => void;
  onDeleteSavedFood: (savedFood: SavedFood) => Promise<void>;
  deletingSavedFoodId: string | null;
  locale: Locale;
};
