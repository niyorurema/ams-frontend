export interface Capteur {
  id: number;
  tenant_id: number;
  nom: string;
  adresse_ip: string;
  port: number;
  type_reseau: 'LAN' | 'NETBIRD';
  statut: 'ACTIF' | 'INACTIF';
  etat_connexion?: 'ONLINE' | 'OFFLINE' | 'UNKNOWN' | 'INACTIVE';
  derniere_communication?: string | null;
  source_derniere_communication?: 'ADMS' | 'SERVER_POLL' | null;
  frequence_adms_secondes?: number | null;
  frequence_polling_secondes?: number | null;
  numero_serie?: string;
  com_key?: string;
  timeout_secondes?: number;
  firmware?: string;
  platform?: string;
  dernier_scan?: string;
  derniere_sync_users?: string;
  derniere_sync_attendance?: string;
  created_at: string;
  updated_at?: string;
}