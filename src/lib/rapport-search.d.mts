interface RapportSearchItem {
  nom_complet: string;
  email: string | null;
  role: string;
  unite_nom: string | null;
}

export function filtrerApercusRapports<T extends RapportSearchItem>(
  items: T[],
  query: string,
  locale: string
): T[];
