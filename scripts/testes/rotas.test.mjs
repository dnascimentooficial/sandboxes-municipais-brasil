import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerHash, escreverHash } from '../../assets/js/rotas.js';

const ids = new Set(['a', 'b', 'c', 'd', 'x']);
const padrao = { aba: 'panorama', sandbox: null, comparar: [] };

test('lerHash básico', () => {
  assert.equal(lerHash('#sandbox=nao-existe', ids).sandbox, null);
  assert.deepEqual(lerHash('#sandbox=x', ids), { aba: 'panorama', sandbox: 'x', comparar: [] });
  assert.deepEqual(lerHash('#comparar=a,a,b,zzz,c,d', ids).comparar, ['a', 'b', 'c']);
  assert.deepEqual(lerHash('#comparar=', ids), { aba: 'comparar', sandbox: null, comparar: [] });
  assert.deepEqual(lerHash('comparar=a,b', ids), { aba: 'comparar', sandbox: null, comparar: ['a', 'b'] });
});

test('lerHash vazio, desconhecido e malformado', () => {
  assert.deepEqual(lerHash('', ids), padrao);
  assert.deepEqual(lerHash('#', ids), padrao);
  assert.deepEqual(lerHash('#foo=bar', ids), padrao);
  assert.deepEqual(lerHash('#sandbox=%E0%A4%A', ids), padrao);
  assert.deepEqual(lerHash(undefined, ids), padrao);
});

test('lerHash decodifica', () => {
  const s = new Set(['a b', 'c']);
  assert.equal(lerHash('#sandbox=a%20b', s).sandbox, 'a b');
  assert.deepEqual(lerHash('#comparar=a%20b,c', s).comparar, ['a b', 'c']);
});

test('escreverHash', () => {
  assert.equal(escreverHash({ aba: 'comparar', comparar: ['a', 'b'] }), '#comparar=a,b');
  assert.equal(escreverHash({ aba: 'panorama', sandbox: 'x' }), '#sandbox=x');
  assert.equal(escreverHash({ aba: 'panorama', sandbox: null }), '');
  assert.equal(escreverHash({ aba: 'panorama' }), '');
  assert.equal(escreverHash({ aba: 'comparar', comparar: ['a b'] }), '#comparar=a%20b');
});

test('ida e volta com estados normalizados', () => {
  const estados = [
    padrao,
    { aba: 'panorama', sandbox: 'x', comparar: [] },
    { aba: 'comparar', sandbox: null, comparar: ['a', 'b', 'c'] },
    { aba: 'comparar', sandbox: null, comparar: [] },
  ];
  for (const e of estados) assert.deepEqual(lerHash(escreverHash(e), ids), e);
});
