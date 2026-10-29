import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_COMPARAR, adicionarAoComparar, substituirNoComparar, removerDoComparar, montarComparacao,
} from '../../assets/js/comparar.js';

const temas = [{ id: 'turismo', nome: 'Turismo' }, { id: 'financas', nome: 'Finanças' }];
const orgaos = [{ sigla: 'BCB', nome: 'Banco Central do Brasil', url: 'https://bcb.gov.br' }];

const base = {
  id: 'a', nome: 'A', esfera: 'municipal',
  jurisdicao: { municipio: 'Curitiba', uf: 'PR', regiao: 'Sul' },
  status: 'ativo', temas: ['turismo', 'financas'], resumo: 'Resumo A', desde: '2021',
  gestor: 'Secretaria X', ingresso: 'edital', prazo_teste_meses: 12,
  elegibilidade: 'PJ', flexibilizacoes: ['f1', 'f2'],
  documentos: [{ tipo: 'lei', titulo: 'Lei', numero: '1/2024', data: '2024-06-19', url: 'https://x', principal: true }],
  solucoes: [
    { status: 'em_teste' }, { status: 'em_teste' }, { status: 'concluida' },
  ],
  editais: [{ status: 'aberto' }, { status: 'encerrado' }, { status: 'encerrado' }],
  fontes: [{ url: 'u' }], verificado_em: '2026-10-29',
};
const b = { ...base, id: 'b', ingresso: 'convite' };
const vazio = {
  id: 'c', nome: 'C', esfera: 'estadual', jurisdicao: { uf: 'SC', regiao: 'Sul' },
  status: 'ativo', resumo: 'R', documentos: [], solucoes: [], editais: [], fontes: [], verificado_em: '2026-10-29',
};

function linha(comp, chave) {
  for (const g of comp.grupos) for (const l of g.linhas) if (l.chave === chave) return l;
  throw new Error('sem linha ' + chave);
}

test('MAX_COMPARAR é 3', () => assert.equal(MAX_COMPARAR, 3));

test('adicionar / substituir / remover', () => {
  assert.deepEqual(adicionarAoComparar(['a', 'b', 'c'], 'd'), { ids: ['a', 'b', 'c'], precisaSubstituir: true });
  assert.deepEqual(adicionarAoComparar(['a'], 'a').ids, ['a']);
  assert.equal(adicionarAoComparar(['a'], 'a').precisaSubstituir, false);
  assert.deepEqual(adicionarAoComparar(['a'], 'b'), { ids: ['a', 'b'], precisaSubstituir: false });
  assert.deepEqual(adicionarAoComparar(['a', 'b'], 'c', 2), { ids: ['a', 'b'], precisaSubstituir: true });
  assert.deepEqual(substituirNoComparar(['a', 'b', 'c'], 1, 'z'), ['a', 'z', 'c']);
  assert.deepEqual(removerDoComparar(['a', 'b', 'c'], 'b'), ['a', 'c']);
});

test('grupos e ordem das linhas', () => {
  const c = montarComparacao([base, b], { temas, orgaos });
  assert.deepEqual(c.grupos.map((g) => g.titulo),
    ['Identificação', 'Escopo', 'Funcionamento', 'Execução', 'Documentação publicada', 'Confiabilidade']);
  assert.deepEqual(c.grupos.flatMap((g) => g.linhas.map((l) => l.chave)), [
    'esfera', 'jurisdicao', 'status', 'desde', 'temas', 'resumo', 'gestor', 'ingresso', 'prazo',
    'elegibilidade', 'flexibilizacoes', 'solucoes', 'editais', 'documentos', 'verificado_em', 'fontes',
  ]);
});

test('iguais: status igual, ingresso diferente', () => {
  const c = montarComparacao([base, b], { temas, orgaos });
  assert.equal(linha(c, 'status').iguais, true);
  assert.equal(linha(c, 'ingresso').iguais, false);
  assert.deepEqual(linha(c, 'ingresso').valores, ['Edital', 'Convite']);
});

test('valores textuais', () => {
  const l = (k) => linha(montarComparacao([base], { temas, orgaos }), k).valores[0];
  assert.equal(l('esfera'), 'Municipal');
  assert.equal(l('jurisdicao'), 'Curitiba/PR');
  assert.equal(l('desde'), '2021');
  assert.equal(l('temas'), 'Turismo · Finanças');
  assert.equal(l('prazo'), '12 meses');
  assert.equal(l('flexibilizacoes'), 'f1 · f2');
  assert.equal(l('solucoes'), '2 em teste · 1 concluída');
  assert.equal(l('editais'), '1 aberto · 2 encerrados');
  assert.equal(l('verificado_em'), '29/10/2026');
  assert.equal(l('fontes'), '1 fonte');
  assert.deepEqual(JSON.parse(l('documentos')),
    [{ tipo: 'lei', titulo: 'Lei', numero: '1/2024', data: '2024-06-19', url: 'https://x' }]);
});

test('jurisdição estadual e federal', () => {
  const fed = { ...base, esfera: 'federal', jurisdicao: { orgao: 'BCB' } };
  const fed2 = { ...base, esfera: 'federal', jurisdicao: { orgao: 'XYZ' } };
  const c = montarComparacao([vazio, fed, fed2], { temas, orgaos });
  assert.deepEqual(linha(c, 'jurisdicao').valores, ['SC', 'Banco Central do Brasil (BCB)', 'XYZ']);
});

test('plurais e vazios', () => {
  const s = { ...base, prazo_teste_meses: 1, solucoes: [{ status: 'selecionada' }, { status: 'encerrada' }, { status: 'encerrada' }], editais: [{ status: 'aberto' }] };
  const c = montarComparacao([s, vazio], { temas, orgaos });
  assert.deepEqual(linha(c, 'prazo').valores, ['1 mês', 'não informado']);
  assert.equal(linha(c, 'solucoes').valores[0], '1 selecionada · 2 encerradas');
  assert.equal(linha(c, 'solucoes').valores[1], 'nenhuma documentada');
  assert.deepEqual(linha(c, 'editais').valores, ['1 aberto', 'nenhum']);
  assert.equal(linha(montarComparacao([{ ...base, solucoes: [{ status: 'concluida' }, { status: 'concluida' }, { status: 'concluida' }] }], { temas, orgaos }), 'solucoes').valores[0], '3 concluídas');
});

test('campos ausentes: não informado e sem eixo definido, sem undefined', () => {
  const c = montarComparacao([vazio], { temas, orgaos });
  assert.equal(linha(c, 'gestor').valores[0], 'não informado');
  assert.equal(linha(c, 'prazo').valores[0], 'não informado');
  assert.equal(linha(c, 'temas').valores[0], 'sem eixo definido');
  assert.equal(linha(c, 'documentos').valores[0], '[]');
  assert.equal(linha(c, 'fontes').valores[0], '0 fontes');
  for (const g of c.grupos) for (const l of g.linhas) for (const v of l.valores) assert.ok(!v.includes('undefined'), l.chave);
  const nu = montarComparacao([{ id: 'n', esfera: 'federal' }], {});
  for (const g of nu.grupos) for (const l of g.linhas) for (const v of l.valores) assert.ok(!v.includes('undefined'), l.chave);
});

test('uma coluna: nenhuma linha igual', () => {
  const c = montarComparacao([base], { temas, orgaos });
  assert.ok(c.grupos.every((g) => g.linhas.every((l) => l.iguais === false)));
});
