import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonArray, jsonColumn } from '../lib/json.js';

test('colonne JSON : texte ou déjà décodée (MariaDB 11.x)', () => {
  assert.deepEqual(jsonArray('["Snack"]'), ['Snack']);
  assert.deepEqual(jsonArray(['Snack']), ['Snack']);
  assert.deepEqual(jsonArray(null), []);
  assert.deepEqual(jsonArray('pas du json'), []);
  assert.deepEqual(jsonArray('{"a":1}'), []);
  assert.deepEqual(jsonColumn({ a: 1 }), { a: 1 });
  assert.deepEqual(jsonColumn('{"a":1}'), { a: 1 });
});
