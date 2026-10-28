export interface RapportStats {
  total_employes: number;
  presents: number;
  absents: number;
  normaux: number;
  retards: number;
  anormaux: number;
  feries: number;
  repos: number;
  sans_jugement?: number;
  heures_totales: number;
  moyenne_heures: number;
  taux_presence: number;
}

export interface RapportDetail {
  matricule: string;
  nom: string;
  prenom: string;
  unite: string | null;
  heure_arrivee: string | null;
  heure_depart: string | null;
  pointages: Array<{ type: string; heure: string }>;
  heures_travaillees: number;
  arrivee_tardive: string | null;
  depart_anticipe: string | null;
  retard_minutes: number;
  depart_anticipe_minutes: number;
  statut: 'NORMAL' | 'ANORMAL' | 'RETARD' | 'EN_COURS' | 'ABSENT' | 'FERIE' | 'REPOS' | 'SANS_JUGEMENT';
  nb_pointages: number;
  horaire_nom?: string | null;
  source_calcul?: string | null;
  creneaux?: Array<{
    creneau: string;
    mode?: string;
    attendu?: string | null;
    reel?: string | null;
    statut: string;
  }>;
}

export interface RapportQuotidien {
  titre: string;
  destinataire: {
    user_id?: number;
    tenant_id?: number;
    nom: string;
    role: string;
    unite: string | null;
  };
  date: string;
  horaire: string;
  est_jour_travaille: boolean;
  raison_non_travaille: 'FERIE' | 'WEEKEND' | null;
  stats: RapportStats;
  details: RapportDetail[];
  alertes: string[];
}

export interface RapportEmployeVisible {
  id: number;
  matricule: string;
  nom: string;
  prenom: string;
  unite_id: number | null;
  unite_nom: string | null;
}

export type RapportPlanifieType = 'QUOTIDIEN' | 'HEBDOMADAIRE' | 'MENSUEL';
export type RapportFormat = 'PDF' | 'EXCEL' | 'HTML';
export type RapportLangue = 'fr' | 'en' | 'rn';
export type RapportPerimetreType =
  | 'EQUIPE'
  | 'SERVICE'
  | 'DIRECTION'
  | 'COMMISSARIAT'
  | 'TOUS';

export interface RapportPlanifie {
  id: number;
  tenant_id: number;
  user_id: number;
  destinataire_nom?: string | null;
  destinataire_email?: string | null;
  nom: string;
  type: RapportPlanifieType;
  heure_envoi: string;
  jours_semaine: string;
  format: RapportFormat;
  langue: RapportLangue;
  perimetre_type: RapportPerimetreType;
  perimetre_unite_id: number | null;
  inclure_agents_bureau: number;
  actif: number;
  dernier_envoi: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface RapportPlanifieCreate {
  nom: string;
  type: RapportPlanifieType;
  heure_envoi: string;
  jours_semaine?: string;
  format: RapportFormat;
  langue: RapportLangue;
  perimetre_type: RapportPerimetreType;
  perimetre_unite_id?: number | null;
  inclure_agents_bureau: number | boolean;
  actif: number | boolean;
  user_id?: number;
}

export type RapportPlanifieUpdate = Partial<RapportPlanifieCreate>;

export interface RapportJournalierConfiguration {
  heure_envoi: string;
  format: Extract<RapportFormat, 'PDF' | 'EXCEL'>;
  langue: RapportLangue;
  actif: number | boolean;
}

export interface RapportJournalierDestinataire {
  user_id: number;
  unite_id: number | null;
  unite_nom: string | null;
  nom_complet: string;
  email: string;
}

export interface RapportJournalierConfigurationData {
  configuration: RapportJournalierConfiguration;
  destinataires: RapportJournalierDestinataire[];
  jours_travailles: number[];
}

export interface RapportJournalierApercuItem {
  user_id: number;
  unite_id: number | null;
  unite_nom: string | null;
  nom_complet: string;
  email: string | null;
  role: string;
  date_rapport: string;
}

export interface RapportJournalierApercus {
  date_execution: string;
  date_rapport: string;
  heure_envoi: string | null;
  configuration_active: boolean;
  pret_a_envoyer: boolean;
  raison_non_envoi: string | null;
  items: RapportJournalierApercuItem[];
}

export interface RapportJournalierApercuDetail {
  destinataire: RapportJournalierApercuItem;
  contenu: RapportQuotidien;
}

export interface RapportHistoriqueItem {
  id: number;
  user_id: number;
  date_rapport: string;
  heure_envoi: string;
  format: string;
  destinataire_email: string;
  destinataire_nom: string | null;
  statut: 'ENVOYE' | 'ECHEC' | 'EN_ATTENTE';
  message_erreur: string | null;
  contenu_disponible: boolean;
}

export interface RapportHistoriqueDetail {
  envoi: Omit<RapportHistoriqueItem, 'contenu_disponible'>;
  contenu: RapportQuotidien | null;
}
