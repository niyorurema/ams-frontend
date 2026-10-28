import test from 'node:test';
import assert from 'node:assert/strict';
import { filtrerApercusRapports } from '../src/lib/rapport-search.mjs';

const items = [
  {
    nom_complet: 'Élodie Niyonzima',
    email: 'elodie@example.test',
    role: 'superviseur',
    unite_nom: 'Finances',
  },
  {
    nom_complet: 'Jean Nkurunziza',
    email: null,
    role: 'directeur',
    unite_nom: 'Ressources humaines',
  },
];

test('retourne tous les rapports lorsque la recherche est vide', () => {
  assert.deepEqual(filtrerApercusRapports(items, '  ', 'fr'), items);
});

test('recherche sans distinction de casse sur le nom et l’email', () => {
  assert.deepEqual(filtrerApercusRapports(items, 'ELODIE', 'fr'), [items[0]]);
  assert.deepEqual(filtrerApercusRapports(items, 'EXAMPLE.TEST', 'fr'), [items[0]]);
});

test('recherche le rôle et l’unité et ignore les champs email absents', () => {
  assert.deepEqual(filtrerApercusRapports(items, 'DIRECTEUR', 'fr'), [items[1]]);
  assert.deepEqual(filtrerApercusRapports(items, 'ressources', 'fr'), [items[1]]);
});

test('retourne une liste vide lorsqu’aucun rapport ne correspond', () => {
  assert.deepEqual(filtrerApercusRapports(items, 'inexistant', 'fr'), []);
});
