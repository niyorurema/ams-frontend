export interface Pointage {
  id: number;
  tenant_id: number;
  employe_id?: number;
  badge_id: number;
  capteur_id?: number;
  type_evenement:
    | 'CHECK_IN'
    | 'CHECK_OUT'
    | 'BREAK_IN'
    | 'BREAK_OUT'
    | 'UNKNOWN';
  statut_calcul: 'VALIDE' | 'RETARD' | 'ANORMAL' | 'UNKNOWN';
  date_pointage: string;
  source: 'CAPTEUR' | 'MANUEL' | 'IMPORT';
  statut: 'VALIDE' | 'INVALIDE' | 'REJETE' | 'SUPPRIME';
  employe_matricule?: string | null;
  employe_nom?: string | null;
  employe_prenom?: string | null;
  employe_unite?: string | null;
  capteur_nom?: string;
}