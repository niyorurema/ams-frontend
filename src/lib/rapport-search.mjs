/**
 * @typedef {Object} RapportSearchItem
 * @property {string} nom_complet
 * @property {string | null} email
 * @property {string} role
 * @property {string | null} unite_nom
 */

/**
 * @template {RapportSearchItem} T
 * @param {T[]} items
 * @param {string} query
 * @param {string} locale
 * @returns {T[]}
 */
export function filtrerApercusRapports(items, query, locale) {
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  if (!normalizedQuery) return items;

  return items.filter((item) =>
    [item.nom_complet, item.email, item.role, item.unite_nom]
      .filter((value) => Boolean(value))
      .some((value) => value.toLocaleLowerCase(locale).includes(normalizedQuery))
  );
}
