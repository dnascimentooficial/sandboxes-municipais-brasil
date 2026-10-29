#!/usr/bin/env node
// Uso: node scripts/build-dados.mjs [--check] [dir=data]
// Valida a base, gera data/sandboxes.js, carimba ?v= no index.html e o lastmod do sitemap.xml.
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { validarBase } from '../assets/js/validacao.js';

const lerJson = (arq) => JSON.parse(readFileSync(arq, 'utf8'));

export const ASSETS_CARIMBADOS = ['assets/app.css', 'assets/brasil-mapa.js', 'assets/js/app.js', 'data/sandboxes.js'];

// Data AAAA-MM-DD que existe no calendário; qualquer outra coisa é null.
export function dataIsoValida(v) {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return dt.toISOString().slice(0, 10) === v ? v : null;
}

// ultima_execucao de data/verificacao.json (rotina de verificação). Ausente, ilegível ou inválida -> null.
export function lerUltimaExecucao(dir) {
  const arq = join(dir, 'verificacao.json');
  if (!existsSync(arq)) return null;
  try {
    return dataIsoValida(lerJson(arq)?.ultima_execucao);
  } catch {
    return null;
  }
}

export function carregarBase(dir) {
  const arquivos = readdirSync(join(dir, 'sandboxes')).filter((f) => f.endsWith('.json')).sort();
  const sandboxes = arquivos.map((f) => lerJson(join(dir, 'sandboxes', f)));
  sandboxes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    temas: lerJson(join(dir, 'temas.json')),
    orgaos: lerJson(join(dir, 'orgaos.json')),
    sandboxes,
    ultimaExecucao: lerUltimaExecucao(dir),
  };
}

// R18: a maior data entre os verificado_em e a última execução da rotina de verificação.
export function atualizacaoBase(sandboxes, ultimaExecucao = null) {
  const datas = sandboxes.map((s) => dataIsoValida(s.verificado_em)).filter(Boolean);
  const ultima = dataIsoValida(ultimaExecucao);
  if (ultima) datas.push(ultima);
  return datas.sort().at(-1) ?? null;
}

export function gerarJs({ temas, orgaos, sandboxes, ultimaExecucao = null }) {
  const meta = {
    titulo: 'Sandboxes regulatórios no Brasil',
    atualizacaoBase: atualizacaoBase(sandboxes, ultimaExecucao),
    total: sandboxes.length,
  };
  return (
    '/* Gerado por scripts/build-dados.mjs — não editar. */\n' +
    'window.SANDBOX_DADOS = ' + JSON.stringify({ meta, temas, orgaos, sandboxes }) + ';\n'
  );
}

export function versao(conteudo) {
  return createHash('sha256').update(conteudo).digest('hex').slice(0, 10);
}

export function carimbarSitemap(xml, atualizacaoBase) {
  if (!atualizacaoBase) return xml;
  return xml.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${atualizacaoBase}</lastmod>`);
}

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function carimbarIndex(html, versoes) {
  let saida = html;
  for (const [caminho, v] of Object.entries(versoes)) {
    const re = new RegExp(`((?:src|href)=["'])(${escapar(caminho)})(?:\\?v=[^"']*)?(["'])`, 'g');
    saida = saida.replace(re, `$1$2?v=${v}$3`);
  }
  return saida;
}

function main(args) {
  const check = args.includes('--check');
  const dir = args.find((a) => !a.startsWith('--')) ?? 'data';
  const raiz = process.cwd();
  const pasta = resolve(raiz, dir);
  const saidaJs = resolve(raiz, 'data/sandboxes.js');
  const indexHtml = resolve(raiz, 'index.html');
  const sitemapXml = resolve(raiz, 'sitemap.xml');

  let base;
  let erros;
  try {
    base = carregarBase(pasta);
    ({ erros } = validarBase(base));
  } catch (e) {
    erros = [`base: falha ao ler ${dir}: ${e.message}`];
  }
  if (erros.length) {
    for (const e of erros) console.error(e);
    console.error(`\n${erros.length} erro(s).`);
    return 1;
  }

  const js = gerarJs(base);
  const versoes = {};
  for (const caminho of ASSETS_CARIMBADOS) {
    if (caminho === 'data/sandboxes.js') { versoes[caminho] = versao(js); continue; }
    const arq = resolve(raiz, caminho);
    if (existsSync(arq)) versoes[caminho] = versao(readFileSync(arq));
  }
  const htmlAtual = existsSync(indexHtml) ? readFileSync(indexHtml, 'utf8') : null;
  const htmlNovo = htmlAtual === null ? null : carimbarIndex(htmlAtual, versoes);
  const sitemapAtual = existsSync(sitemapXml) ? readFileSync(sitemapXml, 'utf8') : null;
  const sitemapNovo = sitemapAtual === null ? null : carimbarSitemap(sitemapAtual, atualizacaoBase(base.sandboxes, base.ultimaExecucao));
  const jsAtual = existsSync(saidaJs) ? readFileSync(saidaJs, 'utf8') : null;

  if (check) {
    if (jsAtual !== js || (htmlAtual !== null && htmlAtual !== htmlNovo) || (sitemapAtual !== null && sitemapAtual !== sitemapNovo)) {
      console.error('data/sandboxes.js desatualizado — rode npm run build');
      return 1;
    }
    console.log('data/sandboxes.js em dia.');
    return 0;
  }

  mkdirSync(dirname(saidaJs), { recursive: true });
  writeFileSync(saidaJs, js);
  if (htmlNovo !== null && htmlNovo !== htmlAtual) writeFileSync(indexHtml, htmlNovo);
  if (sitemapNovo !== null && sitemapNovo !== sitemapAtual) writeFileSync(sitemapXml, sitemapNovo);
  console.log(`Gerado data/sandboxes.js (${base.sandboxes.length} sandboxes).`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
