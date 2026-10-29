#!/usr/bin/env node
// Uso: node scripts/build-dados.mjs [--check] [dir=data]
// Valida a base, gera data/sandboxes.js e carimba ?v= no index.html.
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { validarBase } from '../assets/js/validacao.js';

const lerJson = (arq) => JSON.parse(readFileSync(arq, 'utf8'));

export const ASSETS_CARIMBADOS = ['assets/app.css', 'assets/brasil-mapa.js', 'assets/js/app.js', 'data/sandboxes.js'];

export function carregarBase(dir) {
  const arquivos = readdirSync(join(dir, 'sandboxes')).filter((f) => f.endsWith('.json')).sort();
  const sandboxes = arquivos.map((f) => lerJson(join(dir, 'sandboxes', f)));
  sandboxes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    temas: lerJson(join(dir, 'temas.json')),
    orgaos: lerJson(join(dir, 'orgaos.json')),
    sandboxes,
  };
}

export function gerarJs({ temas, orgaos, sandboxes }) {
  const meta = {
    titulo: 'Sandboxes regulatórios no Brasil',
    atualizacaoBase: sandboxes.map((s) => s.verificado_em).filter(Boolean).sort().at(-1) ?? null,
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
  const jsAtual = existsSync(saidaJs) ? readFileSync(saidaJs, 'utf8') : null;

  if (check) {
    if (jsAtual !== js || (htmlAtual !== null && htmlAtual !== htmlNovo)) {
      console.error('data/sandboxes.js desatualizado — rode npm run build');
      return 1;
    }
    console.log('data/sandboxes.js em dia.');
    return 0;
  }

  mkdirSync(dirname(saidaJs), { recursive: true });
  writeFileSync(saidaJs, js);
  if (htmlNovo !== null && htmlNovo !== htmlAtual) writeFileSync(indexHtml, htmlNovo);
  console.log(`Gerado data/sandboxes.js (${base.sandboxes.length} sandboxes).`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
