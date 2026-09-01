export const PURINE_CATEGORY_MAPPING_VERSION = 'purine-ingredient-categories-1';

export const purineCategorySchemaValues = [
  'organ_meat',
  'red_meat',
  'small_oily_fish',
  'shellfish',
  'concentrated_meat_broth',
] as const;

export type PurineCategory = (typeof purineCategorySchemaValues)[number];

type CategoryDefinition = {
  category: PurineCategory;
  nameEn: string;
  nameVi: string;
  aliases: string[];
};

const categoryDefinitions: CategoryDefinition[] = [
  { category: 'organ_meat', nameEn: 'Organ meat', nameVi: 'Nội tạng', aliases: ['organ meat', 'offal', 'liver', 'kidney', 'noi tang', 'gan', 'than'] },
  { category: 'red_meat', nameEn: 'Red meat', nameVi: 'Thịt đỏ', aliases: ['red meat', 'beef', 'thit do', 'thit bo'] },
  { category: 'small_oily_fish', nameEn: 'Small oily fish', nameVi: 'Cá dầu nhỏ', aliases: ['sardine', 'sardines', 'anchovy', 'anchovies', 'ca moi', 'ca com'] },
  { category: 'shellfish', nameEn: 'Shellfish', nameVi: 'Hải sản có vỏ', aliases: ['shellfish', 'shrimp', 'prawn', 'mussel', 'clam', 'hai san co vo', 'tom', 'ngheu', 'so'] },
  { category: 'concentrated_meat_broth', nameEn: 'Concentrated meat broth', nameVi: 'Nước dùng thịt cô đặc', aliases: ['meat broth', 'bone broth', 'meat gravy', 'nuoc dung thit', 'nuoc ham xuong', 'nuoc sot thit'] },
];

const ambiguousIngredients = new Set([
  'food item', 'packaged food', 'mixed dish', 'recipe', 'protein', 'seasoning',
  'broth', 'soup', 'nuoc dung',
  'mon an', 'thuc pham', 'mon tron', 'cong thuc', 'dam', 'gia vi',
]);

export function normalizeIngredient(value: string) {
  return value
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function includesPhrase(ingredient: string, alias: string) {
  return ` ${ingredient} `.includes(` ${alias} `);
}

export type PurineMappingResult = {
  mappingVersion: typeof PURINE_CATEGORY_MAPPING_VERSION;
  state: 'matched' | 'matched_with_unresolved' | 'unresolved';
  matches: Array<{
    normalizedIngredient: string;
    category: PurineCategory;
    categoryNameEn: string;
    categoryNameVi: string;
  }>;
  unresolvedIngredients: string[];
};

export function mapPurineIngredients(ingredients: string[]): PurineMappingResult {
  const normalized = [...new Set(ingredients.map(normalizeIngredient).filter(Boolean))];
  const matches = normalized.flatMap((ingredient) => categoryDefinitions.flatMap((definition) =>
    definition.aliases.some((alias) => includesPhrase(ingredient, alias))
      ? [{
          normalizedIngredient: ingredient,
          category: definition.category,
          categoryNameEn: definition.nameEn,
          categoryNameVi: definition.nameVi,
        }]
      : [],
  ));
  const matchedIngredients = new Set(matches.map((match) => match.normalizedIngredient));
  const unresolvedIngredients = matches.length
    ? normalized.filter((ingredient) => !matchedIngredients.has(ingredient) && ambiguousIngredients.has(ingredient))
    : [...normalized];
  if (!normalized.length) unresolvedIngredients.push('ingredient list unavailable');
  return {
    mappingVersion: PURINE_CATEGORY_MAPPING_VERSION,
    state: matches.length ? (unresolvedIngredients.length ? 'matched_with_unresolved' : 'matched') : 'unresolved',
    matches,
    unresolvedIngredients,
  };
}
