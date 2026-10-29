#!/usr/bin/env node
// Uso: node scripts/validar.mjs [dir=data]
import { validarBase } from '../assets/js/validacao.js';
import { carregarBase, checarArquivos } from './build-dados.mjs';

const dir = process.argv[2] ?? 'data';
let erros;
try {
  const base = carregarBase(dir);
  ({ erros } = validarBase(base));
  erros = [...erros, ...checarArquivos(dir, base)];
} catch (e) {
  erros = [`base: falha ao ler ${dir}: ${e.message}`];
}
if (erros.length) {
  for (const e of erros) console.error(e);
  console.error(`\n${erros.length} erro(s).`);
  process.exit(1);
}
console.log(`Base válida (${dir}).`);
