export interface Capteur {
  id: number;
  tenant_id: number;
  nom: string;
  adresse_ip: string;
  port: number;
  type_reseau: 'LAN' | 'NETBIRD';
  statut: 'ACTIF' | 'INACTIF' | 'HORS_LIGNE';
  numero_serie?: string;
  firmware?: string;
  platform?: string;
  dernier_scan?: string;
  derniere_sync_users?: string;
  derniere_sync_attendance?: string;
  created_at: string;
  updated_at?: string;
}