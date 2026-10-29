import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  VAZIO, sugestoes, opcoesSugestao, tabelaComparacao, avisoSubstituir, documentosHtml,
} from '../../assets/js/ui/comparar-conteudo.js';

const temas = JSON.parse(readFileSync('data/temas.json', 'utf8'));
const orgaos = JSON.parse(readFileSync('data/orgaos.json', 'utf8'));
const base = readdirSync('data/sandboxes').map((f) => JSON.parse(readFileSync(`data/sandboxes/${f}`, 'utf8')));
const porId = (id) => base.find((s) => s.id === id);

test('texto do estado vazio', () => {
  assert.equal(VAZIO, 'Escolha até 3 sandboxes para comparar lado a lado.');
});

test('sugestoes: no máximo 8, exclui os já escolhidos, usa buscar()', () => {
  const todas = sugestoes(base, '', temas, []);
  assert.equal(todas.length, 8);
  const sem = sugestoes(base, '', temas, todas.map((s) => s.id));
  assert.equal(sem.length, 8);
  assert.ok(sem.every((s) => !todas.some((t) => t.id === s.id)));
  const cur = sugestoes(base, 'curitiba', temas, []);
  assert.ok(cur.some((s) => s.id === 'curitiba'));
  assert.equal(sugestoes(base, 'curitiba', temas, ['curitiba']).some((s) => s.id === 'curitiba'), false);
  assert.deepEqual(sugestoes(base, 'zzzz-nada', temas, []), []);
});

test('opcoesSugestao: role=option, ids estáveis, escapa', () => {
  const html = opcoesSugestao([{ id: 'x', nome: '<b>X</b>', esfera: 'municipal', jurisdicao: { municipio: 'A', uf: 'PR' } }], { orgaos, prefixo: 'cmp-op-0', ativo: 0 });
  assert.match(html, /<li id="cmp-op-0-0" role="option" aria-selected="true" data-id="x"/);
  assert.ok(html.includes('&lt;b&gt;X&lt;/b&gt;'));
  assert.doesNotMatch(html, /<b>X<\/b>/);
});

test('tabela: uma coluna por sandbox, grupos e classes de igualdade', () => {
  const ss = [porId('curitiba'), porId('rio-de-janeiro')];
  const html = tabelaComparacao(ss, { temas, orgaos });
  assert.equal((html.match(/<th scope="col" class="cmp-col"/g) ?? []).length, 2);
  for (const g of ['Identificação', 'Escopo', 'Funcionamento', 'Execução', 'Documentação publicada', 'Confiabilidade']) {
    assert.ok(html.includes(g), g);
  }
  assert.match(html, /class="linha-difere"/);
  // Ambos são municipais: esfera é igual.
  assert.match(html, /<tr class="linha-igual" data-chave="esfera">/);
  assert.ok(html.includes('src="img/curitiba.jpg"'));
  assert.ok(html.includes('data-remover="curitiba"'));
  assert.doesNotMatch(html, /undefined|>null<|NaN/);
});

test('tabela com uma coluna não marca igual nem difere', () => {
  const html = tabelaComparacao([porId('curitiba')], { temas, orgaos });
  assert.doesNotMatch(html, /linha-igual|linha-difere/);
});

test('tabela escapa dados, bloqueia imagem e link perigosos', () => {
  const ruim = {
    id: 'x"y', nome: '<img src=x onerror=alert(1)>', status: 'ativo', esfera: 'municipal',
    imagem: { arquivo: 'javascript:alert(1)' }, temas: [],
    documentos: [{ tipo: 'lei', titulo: 'T<script>', numero: '1', data: '2024-01-02', url: 'javascript:alert(1)' }],
  };
  const html = tabelaComparacao([ruim, porId('curitiba')], { temas, orgaos });
  assert.doesNotMatch(html, /<img src=x|<script>|javascript:|data-remover="x"y"/);
  assert.ok(html.includes('data-remover="x&quot;y"'));
  assert.ok(html.includes('gv-faixa'));
});

test('documentosHtml: lista "tipo nº — título (data)" com links seguros', () => {
  const html = documentosHtml(JSON.stringify([
    { tipo: 'lei', titulo: 'Lei do Sandbox', numero: '16.293/2024', data: '2024-06-19', url: 'https://exemplo.gov.br/a"b' },
    { tipo: 'decreto', titulo: 'Sem link' },
  ]));
  assert.ok(html.includes('<a href="https://exemplo.gov.br/a&quot;b" target="_blank" rel="noopener">Lei nº 16.293/2024 — Lei do Sandbox (19/06/2024)</a>'));
  assert.ok(html.includes('Decreto — Sem link'));
  assert.equal(documentosHtml('[]'), 'não informado');
  assert.equal(documentosHtml('não é json'), 'não informado');
});

test('avisoSubstituir: título, 3 botões com nomes e cancelar', () => {
  const ss = [porId('curitiba'), porId('rio-de-janeiro'), porId('recife')];
  const html = avisoSubstituir(porId('teresina'), ss);
  assert.ok(html.includes('Escolha qual substituir'));
  assert.equal((html.match(/data-substituir="\d"/g) ?? []).length, 3);
  assert.ok(html.includes('data-cancelar'));
  for (const s of ss) assert.ok(html.includes(s.nome.replace(/&/g, '&amp;')), s.id);
});

test('toda a base, de 3 em 3, renderiza sem "undefined" e com links seguros', () => {
  for (let i = 0; i < base.length; i += 3) {
    const html = tabelaComparacao(base.slice(i, i + 3), { temas, orgaos });
    assert.doesNotMatch(html, /undefined|>null<|NaN/, String(i));
    for (const m of html.matchAll(/<a [^>]*>/g)) assert.match(m[0], /target="_blank" rel="noopener"/);
  }
});

test('tabela: canto do cabeçalho é <th scope="col"> com rótulo para leitor de tela', () => {
  const html = tabelaComparacao([porId('curitiba')], { temas, orgaos });
  assert.match(html, /<thead><tr><th scope="col" class="cmp-canto"><span class="sr-only">Campo<\/span><\/th>/);
  assert.doesNotMatch(html, /<td class="cmp-canto">/);
});
