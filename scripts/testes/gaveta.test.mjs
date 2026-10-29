import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { conteudoGaveta, imagemValida, periodo } from '../../assets/js/ui/gaveta-conteudo.js';

const temas = JSON.parse(readFileSync('data/temas.json', 'utf8'));
const orgaos = JSON.parse(readFileSync('data/orgaos.json', 'utf8'));
const base = readdirSync('data/sandboxes').map((f) => JSON.parse(readFileSync(`data/sandboxes/${f}`, 'utf8')));

test('imagemValida segue o R10', () => {
  assert.equal(imagemValida({ arquivo: 'img/curitiba.jpg' }), true);
  assert.equal(imagemValida({ arquivo: 'img/a-b-1.webp' }), true);
  assert.equal(imagemValida({ arquivo: 'https://x.org/a.jpg' }), false);
  assert.equal(imagemValida({ arquivo: 'img/../x.jpg' }), false);
  assert.equal(imagemValida({ arquivo: 'img/A.JPG' }), false);
  assert.equal(imagemValida({ arquivo: 'img/x.gif' }), false);
  assert.equal(imagemValida(null), false);
});

test('periodo', () => {
  assert.equal(periodo('2024-01-02', '2025-03-04'), '02/01/2024 – 04/03/2025');
  assert.equal(periodo('2024-01-02'), 'desde 02/01/2024');
  assert.equal(periodo(undefined, '2025-03-04'), 'até 04/03/2025');
  assert.equal(periodo(), 'não informado');
});

test('sandbox mínimo: textos de ausência, sem "undefined"', () => {
  const html = conteudoGaveta({ id: 'x', nome: 'X', status: 'ativo', temas: [], imagem: null }, { temas, orgaos });
  for (const t of ['nenhuma documentada', 'sem eixo definido', 'sem registros', 'não informado', 'ID x', 'gv-faixa']) {
    assert.ok(html.includes(t), t);
  }
  assert.match(html, /<h3>Editais<\/h3><p class="gv-vazio">nenhum<\/p>/);
  assert.doesNotMatch(html, /undefined|null|NaN/);
});

test('escapa dados e bloqueia URLs perigosas', () => {
  const html = conteudoGaveta({
    id: 'x', nome: '<script>alert(1)</script>', status: 'ativo', temas: ['nao-existe'],
    imagem: { arquivo: 'javascript:alert(1)' },
    fontes: [{ url: 'javascript:alert(1)', titulo: 'ruim" onmouseover="x' }],
    documentos: [{ tipo: 'lei', titulo: 'ok', url: 'https://exemplo.gov.br/a"b' }],
  }, { temas, orgaos });
  assert.doesNotMatch(html, /<script>|javascript:|onmouseover="/);
  assert.match(html, /href="https:\/\/exemplo\.gov\.br\/a&quot;b" target="_blank" rel="noopener"/);
  assert.ok(html.includes('gv-faixa'));
});

test('ordem das seções da spec §4.3 e foto com legenda', () => {
  const s = base.find((x) => x.id === 'curitiba');
  const html = conteudoGaveta(s, { temas, orgaos });
  const ordem = ['gv-foto', 'gaveta-titulo', 'Descrição', 'Funcionamento', 'Soluções testadas', 'Editais',
    'Documentação publicada', 'Linha do tempo', 'Links de confirmação', 'Verificado em 29/10/2026 · ID curitiba'];
  let pos = -1;
  for (const t of ordem) {
    const i = html.indexOf(t);
    assert.ok(i > pos, `${t} fora de ordem`);
    pos = i;
  }
  assert.ok(html.includes('Foto: Vitor Hirota · CC BY-SA 2.0 · <a href="https://commons.wikimedia.org/'));
  assert.ok(html.includes('Concluída'));
});

test('toda a base renderiza sem "undefined"', () => {
  for (const s of base) {
    const html = conteudoGaveta(s, { temas, orgaos });
    assert.doesNotMatch(html, /undefined|>null<|NaN/, s.id);
    for (const m of html.matchAll(/<a [^>]*>/g)) assert.match(m[0], /target="_blank" rel="noopener"/, s.id);
  }
});
