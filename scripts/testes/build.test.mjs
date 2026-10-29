import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { carregarBase, gerarJs, versao, carimbarIndex, carimbarSitemap } from '../build-dados.mjs';

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
