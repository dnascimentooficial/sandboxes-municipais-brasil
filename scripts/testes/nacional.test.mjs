import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { htmlNacional, gruposNacionais, alternarItem } from '../../assets/js/ui/nacional.js';
import { jurisdicao } from '../../assets/js/ui/cartoes.js';

const orgaos = JSON.parse(readFileSync('data/orgaos.json', 'utf8'));
const base = readdirSync('data/sandboxes').filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(`data/sandboxes/${f}`, 'utf8')));
const federais = base.filter((s) => s.esfera === 'federal');

test('gruposNacionais: um grupo por órgão, só federais, ordenado por quantidade e sigla', () => {
  const g = gruposNacionais(base, orgaos);
  const siglas = new Set(federais.map((s) => s.jurisdicao?.orgao || ''));
  assert.equal(g.length, siglas.size);
  assert.equal(g.reduce((t, x) => t + x.itens.length, 0), federais.length);
  for (let i = 1; i < g.length; i++) {
    const [a, b] = [g[i - 1], g[i]];
    assert.ok(a.itens.length > b.itens.length || (a.itens.length === b.itens.length && a.sigla.localeCompare(b.sigla, 'pt-BR') <= 0));
  }
  for (const x of g) for (const s of x.itens) assert.equal(s.esfera, 'federal');
});

test('htmlNacional: acordeão fechado, botões com aria-expanded/aria-controls e painéis ligados', () => {
  const html = htmlNacional(base, orgaos);
  const g = gruposNacionais(base, orgaos);
  const cabs = [...html.matchAll(/<button type="button" class="nac-cab" id="(nac-cab-\d+)" aria-expanded="false" aria-controls="(nac-painel-\d+)">/g)];
  assert.equal(cabs.length, g.length);
  for (const [, idCab, idPainel] of cabs) {
    assert.match(html, new RegExp(`<div class="nac-painel" id="${idPainel}" aria-labelledby="${idCab}" hidden>`));
  }
  assert.doesNotMatch(html, /aria-expanded="true"/);
  // um botão por sandbox federal, que abre a gaveta
  const abrir = [...html.matchAll(/data-abrir-sandbox="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(abrir, federais.map((s) => s.id).sort());
  assert.doesNotMatch(html, /undefined|null|NaN/);
});

test('htmlNacional: siglas inteiras (sem cortar ANATEL, ANVISA, INMETRO) e selo de status', () => {
  const html = htmlNacional(base, orgaos);
  for (const sigla of new Set(federais.map((s) => s.jurisdicao.orgao))) {
    assert.ok(html.includes(`<span class="av" aria-hidden="true">${sigla}</span>`), sigla);
  }
  const fake = [
    { id: 'a', nome: 'A', esfera: 'federal', status: 'ativo', jurisdicao: { orgao: 'INMETRO' } },
    { id: 'b', nome: 'B', esfera: 'federal', status: 'encerrado', jurisdicao: { orgao: 'ANVISA' } },
  ];
  const h = htmlNacional(fake, orgaos);
  assert.match(h, /<span class="av" aria-hidden="true">INMETRO<\/span>/);
  assert.match(h, /<span class="av" aria-hidden="true">ANVISA<\/span>/);
  assert.match(h, /class="badge st-ativo"/);
  assert.match(h, /class="badge st-encerrado"/);
  assert.match(h, /data-filtro="orgao" data-valor="INMETRO"/);
});

test('htmlNacional conta a base inteira e ignora estaduais/municipais', () => {
  const so = [{ id: 'x', nome: 'X', esfera: 'estadual', status: 'ativo', jurisdicao: { uf: 'PR' } }];
  assert.match(htmlNacional(so, orgaos), /Nenhum sandbox federal mapeado ainda/);
  assert.match(htmlNacional([], orgaos), /nacional-vazio/);
});

test('htmlNacional escapa dados e cai em textos de ausência', () => {
  const h = htmlNacional([
    { id: 'x"><img src=x onerror=1>', nome: '<script>alert(1)</script>', esfera: 'federal', status: 'nao-existe', jurisdicao: { orgao: '<b>Z</b>' } },
    { id: 'y', esfera: 'federal', status: 'ativo', jurisdicao: {} },
  ], orgaos);
  assert.doesNotMatch(h, /<script>|<img|<b>Z/);
  assert.match(h, /&lt;script&gt;/);
  assert.match(h, /data-abrir-sandbox="x&quot;&gt;&lt;img/);
  assert.match(h, /Órgão não informado/);
  assert.match(h, /<span class="av" aria-hidden="true">\?<\/span>/);
  assert.match(h, /class="badge outline"/);
});

test('alternarItem alterna aria-expanded e hidden', () => {
  const attrs = { 'aria-expanded': 'false' };
  const botao = { getAttribute: (k) => attrs[k], setAttribute: (k, v) => { attrs[k] = v; } };
  const painel = { hidden: true };
  assert.equal(alternarItem(botao, painel), true);
  assert.equal(attrs['aria-expanded'], 'true');
  assert.equal(painel.hidden, false);
  assert.equal(alternarItem(botao, painel), false);
  assert.equal(attrs['aria-expanded'], 'false');
  assert.equal(painel.hidden, true);
});

test('cartões: sigla federal inteira no avatar', () => {
  for (const sigla of ['ANATEL', 'ANVISA', 'INMETRO']) {
    assert.equal(jurisdicao({ esfera: 'federal', jurisdicao: { orgao: sigla } }, orgaos).sigla, sigla);
  }
  assert.equal(jurisdicao({ esfera: 'federal', jurisdicao: {} }, orgaos).sigla, '?');
});
