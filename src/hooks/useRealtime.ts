'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export interface PointageRealtimeEvent {
  type: 'nouveau_pointage';
  data: {
    id: number;
    employe_id: number | null;
    employe_nom: string | null;
    employe_matricule?: string | null;
    badge_id?: number | null;
    date_pointage: string;
    type_evenement: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_IN' | 'BREAK_OUT' | 'UNKNOWN';
    statut_calcul: 'VALIDE' | 'RETARD' | 'ANORMAL' | 'UNKNOWN';
    capteur_id: number | null;
  };
  timestamp: string;
}

/** Maintient un flux SSE authentifié et reprend après les déconnexions. */
export function useRealtimePointages() {
  const token = useAuthStore((state) => state.token);
  const router = useRouter();
  const queryClient = useQueryClient();
  const tenantId = useAuthStore((state) => state.user?.tenant_id);
  const scope = `${tenantId ?? 'unknown'}:${token ?? ''}`;
  const [eventState, setEventState] = useState<{
    scope: string;
    events: PointageRealtimeEvent[];
  }>({ scope: '', events: [] });
  const [connectionState, setConnectionState] = useState<{
    scope: string;
    connected: boolean;
  }>({ scope: '', connected: false });

  useEffect(() => {
    const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/realtime/pointages`;
    console.log('[SSE] Token:', token ? 'présent' : 'absent');
    if (!token) return;

    const controller = new AbortController();
    const cleCurseur = `ams-pointages-cursor-${tenantId ?? 'unknown'}`;
    let dernierId = window.sessionStorage.getItem(cleCurseur) ?? '0-0';
    let minuterieActualisation: number | undefined;

    const connecter = async () => {
      while (!controller.signal.aborted) {
        try {
          console.log('[SSE] Connexion à', url);
          const response = await fetch(url, {
            headers: {
              Accept: 'text/event-stream',
              Authorization: `Bearer ${token}`,
              ...(dernierId ? { 'Last-Event-ID': dernierId } : {}),
            },
            cache: 'no-store',
            signal: controller.signal,
          });

          if (!response.ok || !response.body) {
            if (response.status === 401) {
              console.error('[SSE] Erreur:', new Error('Authentification SSE refusée (401).'));
              useAuthStore.getState().clearAuth();
              if (!window.location.pathname.includes('/login')) {
                router.replace('/login');
              }
              return;
            }
            throw new Error(`Connexion temps réel refusée (${response.status}).`);
          }

          setConnectionState({ scope, connected: true });
          const lecteur = response.body.getReader();
          const decodeur = new TextDecoder();
          let tampon = '';

          while (!controller.signal.aborted) {
            const { value, done } = await lecteur.read();
            if (done) break;
            tampon = (tampon + decodeur.decode(value, { stream: true })).replace(/\r\n?/g, '\n');

            let finBloc = tampon.indexOf('\n\n');
            while (finBloc >= 0) {
              const bloc = tampon.slice(0, finBloc);
              tampon = tampon.slice(finBloc + 2);
              const donnees: string[] = [];
              let typeEvenement = 'message';
              for (const ligne of bloc.split('\n')) {
                if (ligne.startsWith(':')) continue;
                if (ligne.startsWith('id:')) {
                  dernierId = ligne.slice(3).trim();
                  window.sessionStorage.setItem(cleCurseur, dernierId);
                }
                if (ligne.startsWith('event:')) typeEvenement = ligne.slice(6).trim();
                if (ligne.startsWith('data:')) {
                  console.log('[SSE] Message reçu:', ligne);
                  donnees.push(ligne.slice(5).replace(/^ /, ''));
                }
              }
              if (donnees.length > 0) {
                const evenement = JSON.parse(donnees.join('\n')) as PointageRealtimeEvent & { message?: string };
                console.log('[SSE] Événement:', evenement);
                if (typeEvenement === 'error') {
                  throw new Error(evenement.message || 'Le serveur a interrompu le flux temps réel.');
                }
                if (evenement.type === 'nouveau_pointage') {
                  setEventState((precedent) => ({
                    scope,
                    events: [
                      evenement,
                      ...(precedent.scope === scope ? precedent.events : []),
                    ].slice(0, 100),
                  }));
                  window.clearTimeout(minuterieActualisation);
                  minuterieActualisation = window.setTimeout(() => {
                    void queryClient.invalidateQueries({ queryKey: ['pointages'] });
                  }, 400);
                }
              }
              finBloc = tampon.indexOf('\n\n');
            }
          }
          await response.body.cancel().catch(() => undefined);
        } catch (error) {
          if (controller.signal.aborted) return;
          setConnectionState({ scope, connected: false });
          console.error('[SSE] Erreur:', error);
        }

        setConnectionState({ scope, connected: false });
        await new Promise<void>((resolve) => {
          const onAbort = () => {
            window.clearTimeout(timeout);
            resolve();
          };
          const timeout = window.setTimeout(() => {
            controller.signal.removeEventListener('abort', onAbort);
            resolve();
          }, 1500);
          controller.signal.addEventListener('abort', onAbort, { once: true });
        });
      }
    };

    void connecter();
    return () => {
      controller.abort();
      window.clearTimeout(minuterieActualisation);
    };
  }, [queryClient, router, scope, tenantId, token]);

  return {
    events: eventState.scope === scope ? eventState.events : [],
    connected: Boolean(token) && connectionState.scope === scope && connectionState.connected,
  };
}
