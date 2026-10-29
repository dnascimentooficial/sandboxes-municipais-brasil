#!/usr/bin/env node
// Uso: node scripts/validar.mjs [dir=data]
// Leitura local mínima; a Task 2 a substitui por carregarBase(dir) de build-dados.mjs.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validarBase } from '../assets/js/validacao.js';

const lerJson = (arq) => JSON.parse(readFileSync(arq, 'utf8'));

export function carregar(dir) {
  const arquivos = readdirSync(join(dir, 'sandboxes')).filter((f) => f.endsWith('.json')).sort();
  return {
    temas: lerJson(join(dir, 'temas.json')),
    orgaos: lerJson(join(dir, 'orgaos.json')),
    sandboxes: arquivos.map((f) => lerJson(join(dir, 'sandboxes', f))),
  };
}

const dir = process.argv[2] ?? 'data';
let erros;
try {
  ({ erros } = validarBase(carregar(dir)));
} catch (e) {
  erros = [`base: falha ao ler ${dir}: ${e.message}`];
}
if (erros.length) {
  for (const e of erros) console.error(e);
  console.error(`\n${erros.length} erro(s).`);
  process.exit(1);
}
console.log(`Base válida (${dir}).`);
