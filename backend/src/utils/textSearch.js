export const normalizeSearchText = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('pt-BR')
  .replace(/\s+/g, ' ');

export const matchesNormalizedText = (value, search) => {
  const normalizedSearch = normalizeSearchText(search);
  if (!normalizedSearch) return true;
  return normalizeSearchText(value).includes(normalizedSearch);
};
