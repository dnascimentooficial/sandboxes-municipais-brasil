import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validarBase } from '../../assets/js/validacao.js';
import { UF_REGIAO } from '../../assets/js/esquema.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'valido');
const ler = (...p) => JSON.parse(readFileSync(join(dir, ...p), 'utf8'));
const carregar = () => ({
  temas: ler('temas.json'),
  orgaos: ler('orgaos.json'),
  sandboxes: readdirSync(join(dir, 'sandboxes')).sort().map((f) => ler('sandboxes', f)),
});

// Clona a base, aplica `quebrar(municipal, federal, base)` e devolve os erros.
function com(quebrar) {
  const b = carregar();
  const [federal, municipal] = b.sandboxes; // ordem alfabética: bcb-sandbox-regulatorio, gramado-turismo
  quebrar(municipal, federal, b);
  return validarBase(b).erros;
}
function espera(quebrar, trecho) {
  const erros = com(quebrar);
  assert.ok(erros.some((e) => e.includes(trecho)), `esperava "${trecho}" em ${JSON.stringify(erros)}`);
  return erros;
}

test('fixture válida não gera erros', () => {
  assert.deepEqual(validarBase(carregar()).erros, []);
});

test('erros começam com o id do sandbox', () => {
  const erros = com((m) => { m.status = 'pausado'; });
  assert.ok(erros.every((e) => e.startsWith('gramado-turismo: ')));
});

test('id repetido', () => espera((m, f) => { f.id = m.id; }, 'id duplicado'));
test('status inválido', () => espera((m) => { m.status = 'pausado'; }, 'status inválido'));

test('municipal sem uf', () => espera((m) => { delete m.jurisdicao.uf; }, 'jurisdicao.uf'));
test('UF inválida', () => espera((m) => { m.jurisdicao.uf = 'XX'; }, 'UF inválida'));
test('região não confere', () => espera((m) => { m.jurisdicao.regiao = 'Norte'; }, 'região não confere'));
test('UF_REGIAO cobre as 27 UFs', () => assert.equal(Object.keys(UF_REGIAO).length, 27));

test('órgão federal desconhecido', () => espera((m, f) => { f.jurisdicao.orgao = 'XYZ'; }, 'órgão desconhecido'));
test('tema desconhecido', () => espera((m) => { m.temas = ['inexistente']; }, 'tema desconhecido'));
test('temas vazio é aceito', () => assert.deepEqual(com((m) => { m.temas = []; }), []));

test('resumo com 141 caracteres', () => espera((m) => { m.resumo = 'a'.repeat(141); }, 'resumo'));
test('resumo com 140 caracteres é aceito', () => assert.deepEqual(com((m) => { m.resumo = 'a'.repeat(140); }), []));

test('fontes vazias', () => espera((m) => { m.fontes = []; }, 'ao menos uma fonte'));
test('documentos vazios', () => espera((m) => { m.documentos = []; }, 'ao menos um documento'));
test('zero documentos principais', () => espera((m) => { delete m.documentos[0].principal; }, 'exatamente um documento principal'));
test('dois documentos principais', () => espera((m) => { m.documentos[1].principal = true; }, 'exatamente um documento principal'));

test('ativo sem solução em_teste/concluida', () => espera((m) => { m.solucoes[0].status = 'encerrada'; }, 'ativo exige solução documentada'));
test('ativo sem solucoes', () => espera((m) => { delete m.solucoes; }, 'ativo exige solução documentada'));
test('ativo com solução sem fonte', () => espera((m) => { delete m.solucoes[0].fonte; }, 'ativo exige solução documentada'));

test('regulamentado com principal tipo outro', () => espera((m, f) => { f.documentos[0].tipo = 'outro'; }, 'regulamentado exige ato normativo'));
test('em_instituicao com principal tipo outro é aceito', () => {
  assert.deepEqual(com((m, f) => { f.status = 'em_instituicao'; f.documentos[0].tipo = 'outro'; }), []);
});

test('encerrado sem histórico com fonte', () => espera((m) => { m.status = 'encerrado'; m.historico = [{ data: '2025-01-01', descricao: 'Fim.' }]; }, 'encerrado exige histórico com fonte'));
test('encerrado com histórico com fonte é aceito', () => {
  assert.deepEqual(com((m) => { m.status = 'encerrado'; m.historico[0].fonte = 'https://exemplo.gov.br/fim'; }), []);
});

test('imagem sem licença', () => espera((m) => {
  m.imagem = { arquivo: 'a.jpg', credito: 'Autor', origem: 'https://exemplo.gov.br/a' };
}, 'imagem.licenca'));

test('imagem.arquivo fora de img/', () => espera((m) => {
  m.imagem = { arquivo: '../segredo.jpg', credito: 'Autor', licenca: 'CC BY', origem: 'https://exemplo.gov.br/a' };
}, 'imagem.arquivo inválido'));
test('imagem.arquivo com extensão não aceita', () => espera((m) => {
  m.imagem = { arquivo: 'img/foto.gif', credito: 'Autor', licenca: 'CC BY', origem: 'https://exemplo.gov.br/a' };
}, 'imagem.arquivo inválido'));
test('imagem válida é aceita', () => assert.deepEqual(com((m) => {
  m.imagem = { arquivo: 'img/gramado-2.webp', credito: 'Autor', licenca: 'CC BY', origem: 'https://exemplo.gov.br/a' };
}), []));
test('imagem.origem não http(s)', () => espera((m) => {
  m.imagem = { arquivo: 'img/a.jpg', credito: 'Autor', licenca: 'CC BY', origem: 'javascript:alert(1)' };
}, 'imagem.origem deve ser http(s)'));
test('documentos[].url javascript:', () => espera((m) => { m.documentos[0].url = 'javascript:alert(1)'; }, 'documentos[0].url deve ser http(s)'));
test('fontes[].url relativa', () => espera((m) => { m.fontes[0].url = '/pagina'; }, 'fontes[0].url deve ser http(s)'));
test('solucoes[].fonte data:', () => espera((m) => { m.solucoes[0].fonte = 'data:text/html,oi'; }, 'solucoes[0].fonte deve ser http(s)'));
test('editais[].url ftp', () => espera((m) => { m.editais[0].url = 'ftp://exemplo.gov.br/x'; }, 'editais[0].url deve ser http(s)'));
test('historico[].fonte não http(s)', () => espera((m) => { m.historico[0].fonte = 'exemplo.gov.br/x'; }, 'historico[0].fonte deve ser http(s)'));

test('verificado_em em formato inválido', () => espera((m) => { m.verificado_em = '29/10/2026'; }, 'data inválida'));
test('data inexistente é rejeitada', () => espera((m) => { m.verificado_em = '2026-02-31'; }, 'data inválida'));
test('desde com apenas o ano é aceito', () => assert.deepEqual(com((m) => { m.desde = '2024'; }), []));
test('desde inválido', () => espera((m) => { m.desde = '24'; }, 'data inválida'));

test('campo obrigatório ausente', () => espera((m) => { delete m.nome; }, 'nome'));
test('base com sandboxes que não é lista', () => {
  assert.ok(validarBase({ temas: [], orgaos: [], sandboxes: null }).erros[0].startsWith('base: '));
});
