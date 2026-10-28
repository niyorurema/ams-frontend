export interface Employe {
  id: number;
  tenant_id: number;
  unite_id?: number | null;
  matricule: string;
  badge_id: number;
  user_id_capteur?: string;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  poste?: string;
  actif: boolean | 0 | 1 | '0' | '1';
  empreinte_enrolee: boolean | 0 | 1 | '0' | '1';
  nb_empreintes?: number;
  unite_nom?: string;
  derniere_sync?: string;
  created_at: string;
  updated_at?: string;
}