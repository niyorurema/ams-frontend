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

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'auth-error';

/** Maintient un flux SSE authentifié et reprend après les déconnexions. */
export function useRealtimePointages() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const router = useRouter();
  const queryClient = useQueryClient();
  const tenantId = useAuthStore((state) => state.user?.tenant_id);
  const scope = `${tenantId ?? 'unknown'}`;
  const [eventState, setEventState] = useState<{
    scope: string;
    events: PointageRealtimeEvent[];
  }>({ scope: '', events: [] });
  const [connectionState, setConnectionState] = useState<{
    scope: string;
    status: RealtimeStatus;
  }>({ scope: '', status: 'idle' });

  useEffect(() => {
    const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/realtime/pointages`;
    if (!isAuthenticated) return;

    const controller = new AbortController();
    const cleCurseur = `ams-pointages-cursor-${tenantId ?? 'unknown'}`;
    let dernierId = window.sessionStorage.getItem(cleCurseur) ?? '0-0';
    let minuterieActualisation: number | undefined;
    let tentativesEchouees = 0;

    const connecter = async () => {
      while (!controller.signal.aborted) {
        try {
          if (tentativesEchouees > 0 && tentativesEchouees < 5) {
            setConnectionState({ scope, status: 'reconnecting' });
          }
          const response = await fetch(url, {
            headers: {
              Accept: 'text/event-stream',
              ...(dernierId ? { 'Last-Event-ID': dernierId } : {}),
            },
            credentials: 'include',
            cache: 'no-store',
            signal: controller.signal,
          });

          if (!response.ok || !response.body) {
            if (response.status === 401) {
              setConnectionState({ scope, status: 'auth-error' });
              useAuthStore.getState().clearAuth();
              if (!window.location.pathname.includes('/login')) {
                router.replace('/login');
              }
              return;
            }
            throw new Error(`Connexion temps réel refusée (${response.status}).`);
          }

          tentativesEchouees = 0;
          setConnectionState({ scope, status: 'connected' });
          const lecteur = response.body.getReader();
          const decodeur = new TextDecoder();
          let tampon = '';
          let finNormaleDuFlux = false;

          while (!controller.signal.aborted) {
            const { value, done } = await lecteur.read();
            if (done) {
              finNormaleDuFlux = true;
              break;
            }
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
                  donnees.push(ligne.slice(5).replace(/^ /, ''));
                }
              }
              if (donnees.length > 0) {
                const evenement = JSON.parse(donnees.join('\n')) as PointageRealtimeEvent & { message?: string };
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
          if (!controller.signal.aborted && !finNormaleDuFlux) {
            tentativesEchouees++;
            setConnectionState({ scope, status: tentativesEchouees >= 5 ? 'error' : 'reconnecting' });
          } else if (finNormaleDuFlux) {
            tentativesEchouees = 0;
          }
        } catch {
          if (controller.signal.aborted) return;
          tentativesEchouees++;
          setConnectionState({ scope, status: tentativesEchouees >= 5 ? 'error' : 'reconnecting' });
        }

        if (controller.signal.aborted) return;
        const delay = Math.min(1500 * (2 ** Math.min(Math.max(0, tentativesEchouees - 1), 5)), 30_000);
        await new Promise<void>((resolve) => {
          const onAbort = () => {
            window.clearTimeout(timeout);
            resolve();
          };
          const timeout = window.setTimeout(() => {
            controller.signal.removeEventListener('abort', onAbort);
            resolve();
          }, delay);
          controller.signal.addEventListener('abort', onAbort, { once: true });
        });
      }
    };

    void connecter();
    return () => {
      controller.abort();
      window.clearTimeout(minuterieActualisation);
    };
  }, [queryClient, router, scope, tenantId, isAuthenticated]);

  return {
    events: eventState.scope === scope ? eventState.events : [],
    status: connectionState.scope === scope
      ? isAuthenticated ? connectionState.status : 'idle'
      : isAuthenticated ? 'connecting' : 'idle',
  };
}
