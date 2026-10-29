import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapar, valorOuNaoInformado, textoOuNaoInformado, dataBR, rotulo, temasTexto,
} from '../../assets/js/formatar.js';

const temas = [
  { id: 'turismo', nome: 'Turismo', icone: '☀', cor: '#cfe8dc' },
  { id: 'financas', nome: 'Finanças', icone: '¤', cor: '#d6e0f5' },
];

test('escapar neutraliza HTML e aspas', () => {
  const r = escapar('<script>alert("x")</script>');
  assert.ok(!r.includes('<') && !r.includes('>') && !r.includes('"'));
  assert.equal(escapar(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
  assert.equal(escapar(null), '');
  assert.equal(escapar(undefined), '');
  assert.equal(escapar(42), '42');
});

test('valorOuNaoInformado', () => {
  for (const v of [[], undefined, null, '']) assert.equal(valorOuNaoInformado(v), 'não informado');
  assert.equal(valorOuNaoInformado(['a', 'b']), 'a · b');
  assert.equal(valorOuNaoInformado('<b>'), '&lt;b&gt;');
  assert.equal(valorOuNaoInformado(['<i>', 'x']), '&lt;i&gt; · x');
  assert.equal(valorOuNaoInformado(3), '3');
});

test('textoOuNaoInformado não escapa', () => {
  for (const v of [[], undefined, null, '']) assert.equal(textoOuNaoInformado(v), 'não informado');
  assert.equal(textoOuNaoInformado(['<i>', 'x']), '<i> · x');
  assert.equal(textoOuNaoInformado(7), '7');
});

test('dataBR', () => {
  assert.equal(dataBR('2026-10-29'), '29/10/2026');
  assert.equal(dataBR('2024'), '2024');
  for (const v of ['2026-02-30', '29/10/2026', 'abc', '', null, undefined, '2026-13-01', 2024]) {
    assert.equal(dataBR(v), 'não informado');
  }
  assert.equal(dataBR('2024-02-29'), '29/02/2024');
});

test('rotulo', () => {
  assert.equal(rotulo('status', 'ativo'), 'Ativo');
  assert.equal(rotulo('status', 'xyz'), 'xyz');
  assert.equal(rotulo('status', null), 'não informado');
  assert.equal(rotulo('inexistente', 'a'), 'a');
});

test('temasTexto', () => {
  assert.equal(temasTexto([], temas), 'sem eixo definido');
  assert.equal(temasTexto(undefined, temas), 'sem eixo definido');
  assert.equal(temasTexto(['turismo', 'financas'], temas), 'Turismo · Finanças');
  assert.equal(temasTexto(['turismo', 'novo'], temas), 'Turismo · novo');
});

test('urlSegura aceita só http(s)', async () => {
  const { urlSegura } = await import('../../assets/js/formatar.js');
  assert.equal(urlSegura('javascript:alert(1)'), '#');
  assert.equal(urlSegura('https://x.gov.br/a'), 'https://x.gov.br/a');
  assert.equal(urlSegura('http://x.gov.br/a?b=1'), 'http://x.gov.br/a?b=1');
  for (const v of ['nada disso', '', null, undefined, 42, 'data:text/html,oi', '//x.gov.br', 'ftp://x']) {
    assert.equal(urlSegura(v), '#');
  }
});
