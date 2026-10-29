#!/usr/bin/env node
// Uso: node scripts/checar-links.mjs [dir=data/sandboxes]
// Verifica os links dos JSONs e imprime anotações do GitHub Actions. Sempre sai com 0:
// link quebrado é aviso para revisão humana, nunca bloqueio de merge.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PARALELO = 8;
// Hosts que respondem 403/503 a robôs mesmo com a página no ar: pedem verificação manual.
const HOSTS_ANTIBOT = ['leismunicipais.com.br', 'leis.org', 'www2.aneel.gov.br'];
const UA = 'Mozilla/5.0 (compatible; SandboxesBrasilLinkCheck/1.0; +https://sandboxbrasil.dnascimento.com.br/)';

const ehHttp = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);

/** Reúne e deduplica as URLs de todos os campos que guardam link. */
export function coletarUrls(sandboxes) {
  const achadas = new Set();
  const add = (v) => { if (ehHttp(v)) achadas.add(v.trim()); };
  for (const s of sandboxes) {
    for (const d of s.documentos ?? []) add(d?.url);
    for (const f of s.fontes ?? []) add(f?.url);
    for (const x of s.solucoes ?? []) add(x?.fonte);
    for (const e of s.editais ?? []) add(e?.url);
    for (const h of s.historico ?? []) add(h?.fonte);
    add(s.imagem?.origem);
  }
  return [...achadas];
}

async function tentar(fetchFn, url, method, timeoutMs) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetchFn(url, {
      method,
      redirect: 'follow',
      signal: ctl.signal,
      headers: { 'user-agent': UA, accept: '*/*' },
    });
    return { status: r.status, ok: r.status >= 200 && r.status < 400 };
  } catch {
    return { status: 0, ok: false };
  } finally {
    clearTimeout(t);
  }
}

async function checarUm(url, { timeoutMs, fetchFn }) {
  let r = await tentar(fetchFn, url, 'HEAD', timeoutMs);
  if (r.status === 405 || r.status === 403) r = await tentar(fetchFn, url, 'GET', timeoutMs);
  return { url, ok: r.ok, status: r.status };
}

/** HEAD (e GET se vier 405/403), até 8 em paralelo. Preserva a ordem de entrada. */
export async function checarLinks(urls, { timeoutMs = 10000, fetchFn = fetch } = {}) {
  const resultados = new Array(urls.length);
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < urls.length) {
      const i = proximo++;
      resultados[i] = await checarUm(urls[i], { timeoutMs, fetchFn });
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALELO, urls.length) }, trabalhador));
  return resultados;
}

/** null = ok; 'notice' = host anti-bot (verificação manual); 'warning' = falha. */
export function classificar({ url, ok }) {
  if (ok) return null;
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch { /* url inválida cai em warning */ }
  const antibot = HOSTS_ANTIBOT.some((h) => host === h || host.endsWith(`.${h}`));
  return antibot ? 'notice' : 'warning';
}

async function main() {
  const dir = process.argv[2] ?? 'data/sandboxes';
  const sandboxes = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
  const urls = coletarUrls(sandboxes);
  console.log(`Verificando ${urls.length} links…`);
  const resultados = await checarLinks(urls);
  let avisos = 0, manuais = 0;
  for (const r of resultados) {
    const tipo = classificar(r);
    if (tipo === 'warning') {
      avisos++;
      console.log(`::warning title=Link com falha::${r.url} (status ${r.status || 'sem resposta'})`);
    } else if (tipo === 'notice') {
      manuais++;
      console.log(`::notice title=Verificação manual::${r.url} (status ${r.status || 'sem resposta'}; host que bloqueia robôs, verificação manual)`);
    }
  }
  console.log(`${urls.length} links: ${urls.length - avisos - manuais} ok, ${avisos} com falha, ${manuais} para verificação manual.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => console.log(`::warning::checar-links falhou: ${e.message}`)).finally(() => process.exit(0));
}
