export function normalizePersonalFoodName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLocaleLowerCase('vi-VN')
    .trim()
    .replace(/\s+/g, ' ');
}
