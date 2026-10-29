import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, buscar, filtrar, ordenar, contar } from '../../assets/js/filtros.js';

const temas = [
  { id: 'turismo', nome: 'Turismo', icone: '☀', cor: '#cfe8dc' },
  { id: 'financas', nome: 'Finanças', icone: '¤', cor: '#d6e0f5' },
  { id: 'cidades', nome: 'Cidades inteligentes', icone: '⌂', cor: '#dbe8d4' },
];

const mk = (o) => ({ resumo: '', documentos: [], temas: [], ...o });
const l = [
  mk({
    id: 'sjc', nome: 'Programa Sandbox', esfera: 'municipal', status: 'ativo',
    jurisdicao: { municipio: 'São José dos Campos', uf: 'SP', regiao: 'Sudeste' },
    temas: ['cidades'], desde: '2023-04-03',
    documentos: [{ tipo: 'lei', titulo: 'Lei do programa', numero: '10.675/2023', url: 'https://x' }],
  }),
  mk({
    id: 'poa', nome: 'Pacto Alegre', esfera: 'municipal', status: 'regulamentado',
    jurisdicao: { municipio: 'Porto Alegre', uf: 'RS', regiao: 'Sul' },
    temas: ['turismo'], desde: '2021-05-01',
  }),
  mk({
    id: 'pr', nome: 'Sandbox Paraná', esfera: 'estadual', status: 'ativo',
    jurisdicao: { uf: 'PR', regiao: 'Sul' }, temas: ['turismo', 'financas'], desde: '2024-01-10',
  }),
  mk({
    id: 'bcb', nome: 'Sandbox Regulatório do Banco Central', esfera: 'federal', status: 'encerrado',
    jurisdicao: { orgao: 'BCB' }, temas: ['financas'], desde: '2020-10-01',
    documentos: [{ tipo: 'resolucao', titulo: 'Resolução conjunta', numero: '50.697/2022', url: 'https://x' }],
  }),
  mk({
    id: 'cvm', nome: 'Sandbox CVM', esfera: 'federal', status: 'em_instituicao',
    jurisdicao: { orgao: 'CVM' }, temas: ['financas'], desde: '2019-01-01',
  }),
];

test('normalizar remove acentos, caixa e espaços extras', () => {
  assert.equal(normalizar('  SÃO   José '), 'sao jose');
});

test('buscar ignora acento, caixa e espaços', () => {
  for (const t of ['sao jose', 'SÃO JOSÉ', 'Sao  Jose']) {
    assert.deepEqual(buscar(l, t).map((s) => s.id), ['sjc']);
  }
});

test('buscar por número de documento, órgão, tema e UF', () => {
  assert.deepEqual(buscar(l, '50.697').map((s) => s.id), ['bcb']);
  assert.deepEqual(buscar(l, 'bcb').map((s) => s.id), ['bcb']);
  assert.deepEqual(buscar(l, 'cidades inteligentes', temas).map((s) => s.id), ['sjc']);
  assert.deepEqual(buscar(l, 'rs').map((s) => s.id), ['poa']);
});

test('buscar exige todos os tokens; termo vazio devolve tudo', () => {
  assert.equal(buscar(l, 'sandbox sao jose').length, 1);
  assert.equal(buscar(l, 'sao jose parana').length, 0);
  assert.equal(buscar(l, '   ').length, 5);
});

test('filtrar por região exclui federais', () => {
  assert.deepEqual(filtrar(l, { regiao: 'Sul' }, temas).map((s) => s.id).sort(), ['poa', 'pr']);
  assert.deepEqual(filtrar(l, { uf: 'PR' }, temas).map((s) => s.id), ['pr']);
});

test('filtrar por esfera, órgão e campos vazios', () => {
  assert.equal(filtrar(l, { esfera: 'federal' }, temas).length, 2);
  assert.deepEqual(filtrar(l, { orgao: 'CVM' }, temas).map((s) => s.id), ['cvm']);
  assert.equal(filtrar(l, { esfera: '', status: '' }, temas).length, 5);
});

test('filtrar combina tema e status (interseção) e termo', () => {
  assert.deepEqual(filtrar(l, { tema: 'turismo', status: 'ativo' }, temas).map((s) => s.id), ['pr']);
  assert.deepEqual(filtrar(l, { termo: 'turismo', esfera: 'municipal' }, temas).map((s) => s.id), ['poa']);
});

test('ordenar por status, nome e ano sem mutar a entrada', () => {
  const copia = l.map((s) => s.id);
  const porStatus = ordenar(l, 'status');
  assert.equal(porStatus[0].status, 'ativo');
  assert.deepEqual(porStatus.map((s) => s.id), ['sjc', 'pr', 'poa', 'cvm', 'bcb']);
  assert.deepEqual(ordenar(l, 'nome').map((s) => s.id), ['poa', 'sjc', 'cvm', 'pr', 'bcb']);
  assert.deepEqual(ordenar(l, 'ano').map((s) => s.id), ['pr', 'sjc', 'poa', 'bcb', 'cvm']);
  assert.deepEqual(l.map((s) => s.id), copia);
});

test('contar inclui todas as chaves, com zeros', () => {
  const c = contar(l);
  assert.equal(c.total, 5);
  assert.equal(c.porStatusEsfera.encerrado.federal, 1);
  assert.equal(c.porStatusEsfera.encerrado.municipal, 0);
  assert.equal(c.porStatus.ativo, 2);
  assert.equal(c.porEsfera.federal, 2);
  assert.equal(c.porTema.financas, 3);
  assert.deepEqual(c.porUf, { SP: 1, RS: 1, PR: 1 });
});
