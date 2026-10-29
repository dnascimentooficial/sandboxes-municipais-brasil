#!/usr/bin/env node
// Uso: node scripts/validar.mjs [dir=data]
import { validarBase } from '../assets/js/validacao.js';
import { carregarBase } from './build-dados.mjs';

const dir = process.argv[2] ?? 'data';
let erros;
try {
  ({ erros } = validarBase(carregarBase(dir)));
} catch (e) {
  erros = [`base: falha ao ler ${dir}: ${e.message}`];
}
if (erros.length) {
  for (const e of erros) console.error(e);
  console.error(`\n${erros.length} erro(s).`);
  process.exit(1);
}
console.log(`Base válida (${dir}).`);
