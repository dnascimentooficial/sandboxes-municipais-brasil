import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { carregarBase, checarArquivos, gerarJs, versao, carimbarIndex, carimbarSitemap, atualizacaoBase, dataIsoValida, lerUltimaExecucao } from '../build-dados.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const fixture = join(aqui, 'fixtures', 'valido');
const cli = join(aqui, '..', 'build-dados.mjs');

test('gerarJs é determinístico e meta.atualizacaoBase é o maior verificado_em', () => {
  const base = carregarBase(fixture);
  const a = gerarJs(base);
  const b = gerarJs(carregarBase(fixture));
  assert.equal(a, b);
  assert.match(a, /^\/\* Gerado por scripts\/build-dados\.mjs — não editar\. \*\/\nwindow\.SANDBOX_DADOS = /);
  const dados = JSON.parse(a.split('window.SANDBOX_DADOS = ')[1].replace(/;\n$/, ''));
  const maior = base.sandboxes.map((s) => s.verificado_em).sort().at(-1);
  assert.equal(dados.meta.atualizacaoBase, maior);
  assert.equal(dados.meta.total, base.sandboxes.length);
  assert.equal(dados.meta.titulo, 'Sandboxes regulatórios no Brasil');
});

test('carregarBase ordena sandboxes por id', () => {
  const ids = carregarBase(fixture).sandboxes.map((s) => s.id);
  assert.deepEqual(ids, [...ids].sort());
});

test('versao devolve 10 hex', () => {
  assert.match(versao('abc'), /^[0-9a-f]{10}$/);
  assert.notEqual(versao('a'), versao('b'));
});

test('carimbarIndex substitui ?v= nos assets conhecidos', () => {
  const html = '<script src="data/sandboxes.js?v=old"></script><link href="assets/app.css?v=x">';
  const out = carimbarIndex(html, { 'data/sandboxes.js': 'abc', 'assets/app.css': 'def' });
  assert.ok(out.includes('data/sandboxes.js?v=abc'));
  assert.ok(out.includes('assets/app.css?v=def'));
  assert.equal(carimbarIndex('<p>x</p>', { 'data/sandboxes.js': 'abc' }), '<p>x</p>');
});

test('CLI --check sai com 1 quando sandboxes.js está desatualizado', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'build-'));
  try {
    cpSync(fixture, join(tmp, 'data'), { recursive: true });
    writeFileSync(join(tmp, 'index.html'), '<html></html>');
    const rodar = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: tmp, encoding: 'utf8' });
    assert.equal(rodar().status, 0);
    assert.equal(rodar('--check').status, 0);
    const alvo = join(tmp, 'data', 'sandboxes.js');
    writeFileSync(alvo, readFileSync(alvo, 'utf8') + '// alterado\n');
    const r = rodar('--check');
    assert.equal(r.status, 1);
    assert.match(r.stderr, /data\/sandboxes\.js desatualizado — rode npm run build/);
    assert.match(readFileSync(alvo, 'utf8'), /alterado/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('carimbarSitemap reescreve lastmod e o CLI --check detecta sitemap desatualizado', () => {
  const xml = '<urlset><url><loc>https://x/</loc><lastmod>2020-01-01</lastmod></url></urlset>';
  assert.equal(carimbarSitemap(xml, '2026-10-29'), '<urlset><url><loc>https://x/</loc><lastmod>2026-10-29</lastmod></url></urlset>');
  assert.equal(carimbarSitemap(xml, null), xml);
  const tmp = mkdtempSync(join(tmpdir(), 'build-'));
  try {
    cpSync(fixture, join(tmp, 'data'), { recursive: true });
    writeFileSync(join(tmp, 'index.html'), '<html></html>');
    const sm = join(tmp, 'sitemap.xml');
    writeFileSync(sm, xml);
    const rodar = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: tmp, encoding: 'utf8' });
    assert.equal(rodar('--check').status, 1);
    assert.equal(rodar().status, 0);
    const base = carregarBase(join(tmp, 'data'));
    const maior = base.sandboxes.map((s) => s.verificado_em).sort().at(-1);
    assert.match(readFileSync(sm, 'utf8'), new RegExp(`<lastmod>${maior}</lastmod>`));
    assert.equal(rodar('--check').status, 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

const metaDe = (js) => JSON.parse(js.split('window.SANDBOX_DADOS = ')[1].replace(/;\n$/, '')).meta;

test('dataIsoValida aceita só AAAA-MM-DD que existe', () => {
  assert.equal(dataIsoValida('2026-10-29'), '2026-10-29');
  assert.equal(dataIsoValida('2024-02-29'), '2024-02-29');
  for (const v of ['2025-02-29', '2026-13-01', '29/10/2026', '2026-10-29T00:00', '', null, undefined, 20261029]) {
    assert.equal(dataIsoValida(v), null, String(v));
  }
});

test('R18: atualizacaoBase usa ultima_execucao quando é posterior a todos os verificado_em', () => {
  const sb = [{ verificado_em: '2026-01-10' }, { verificado_em: '2026-03-05' }];
  assert.equal(atualizacaoBase(sb, '2026-10-29'), '2026-10-29');
  assert.equal(atualizacaoBase(sb, '2025-12-31'), '2026-03-05');
  assert.equal(atualizacaoBase(sb, null), '2026-03-05');
  assert.equal(atualizacaoBase(sb, '2026-99-99'), '2026-03-05');
  assert.equal(atualizacaoBase(sb, 'ontem'), '2026-03-05');
  assert.equal(atualizacaoBase([], '2026-10-29'), '2026-10-29');
  assert.equal(atualizacaoBase([], null), null);
});

test('R18: carregarBase lê data/verificacao.json; ausente, inválido ou ilegível cai para o maior verificado_em', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'build-'));
  try {
    const dir = join(tmp, 'data');
    cpSync(fixture, dir, { recursive: true });
    const maior = carregarBase(dir).sandboxes.map((s) => s.verificado_em).sort().at(-1);
    const arq = join(dir, 'verificacao.json');

    assert.equal(lerUltimaExecucao(dir), null);
    assert.equal(metaDe(gerarJs(carregarBase(dir))).atualizacaoBase, maior);

    writeFileSync(arq, JSON.stringify({ ultima_execucao: '2099-12-31', resultado_por_id: {} }));
    const base = carregarBase(dir);
    assert.equal(base.ultimaExecucao, '2099-12-31');
    assert.equal(metaDe(gerarJs(base)).atualizacaoBase, '2099-12-31');
    assert.equal(gerarJs(base), gerarJs(carregarBase(dir)));

    for (const ruim of [JSON.stringify({ ultima_execucao: '31/12/2099' }), JSON.stringify({ ultima_execucao: '2099-02-30' }), JSON.stringify({}), '{ isto não é json']) {
      writeFileSync(arq, ruim);
      assert.equal(lerUltimaExecucao(dir), null, ruim);
      assert.equal(metaDe(gerarJs(carregarBase(dir))).atualizacaoBase, maior, ruim);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('R18: o lastmod do sitemap segue ultima_execucao', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'build-'));
  try {
    cpSync(fixture, join(tmp, 'data'), { recursive: true });
    writeFileSync(join(tmp, 'data', 'verificacao.json'), JSON.stringify({ ultima_execucao: '2099-12-31' }));
    writeFileSync(join(tmp, 'index.html'), '<html></html>');
    const sm = join(tmp, 'sitemap.xml');
    writeFileSync(sm, '<urlset><url><loc>https://x/</loc><lastmod>2020-01-01</lastmod></url></urlset>');
    const rodar = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: tmp, encoding: 'utf8' });
    assert.equal(rodar().status, 0);
    assert.match(readFileSync(sm, 'utf8'), /<lastmod>2099-12-31<\/lastmod>/);
    assert.equal(metaDe(readFileSync(join(tmp, 'data', 'sandboxes.js'), 'utf8')).atualizacaoBase, '2099-12-31');
    assert.equal(rodar('--check').status, 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('M9: checarArquivos exige id igual ao nome do arquivo e imagem existente', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'build-'));
  try {
    const dir = join(tmp, 'data');
    cpSync(fixture, dir, { recursive: true });
    assert.deepEqual(checarArquivos(dir, carregarBase(dir)), []);

    const arq = join(dir, 'sandboxes', 'gramado-turismo.json');
    const s = JSON.parse(readFileSync(arq, 'utf8'));
    s.imagem = { arquivo: 'img/gramado-turismo.jpg', credito: 'A', licenca: 'CC BY', origem: 'https://exemplo.gov.br/a' };
    writeFileSync(arq, JSON.stringify(s));
    assert.ok(checarArquivos(dir, carregarBase(dir)).some((e) => e.includes('imagem.arquivo não encontrado: img/gramado-turismo.jpg')));
    mkdirSync(join(tmp, 'img'));
    writeFileSync(join(tmp, 'img', 'gramado-turismo.jpg'), '');
    assert.deepEqual(checarArquivos(dir, carregarBase(dir)), []);

    writeFileSync(join(dir, 'sandboxes', 'outro-nome.json'), JSON.stringify({ ...s, id: 'gramado-copia' }));
    const erros = checarArquivos(dir, carregarBase(dir));
    assert.ok(erros.some((e) => e.startsWith('gramado-copia: id deve ser igual ao nome do arquivo (outro-nome.json')), JSON.stringify(erros));

    // A CLI de validação também acusa.
    const r = spawnSync(process.execPath, [join(aqui, '..', 'validar.mjs'), 'data'], { cwd: tmp, encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /id deve ser igual ao nome do arquivo/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('T1: JSON inválido na base cita o arquivo', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'build-'));
  try {
    const dir = join(tmp, 'data');
    cpSync(fixture, dir, { recursive: true });
    writeFileSync(join(dir, 'sandboxes', 'gramado-turismo.json'), '{ "id": "gramado-turismo", ');
    assert.throws(() => carregarBase(dir), /gramado-turismo\.json: JSON inválido/);
    const r = spawnSync(process.execPath, [join(aqui, '..', 'validar.mjs'), 'data'], { cwd: tmp, encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /gramado-turismo\.json: JSON inválido/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
