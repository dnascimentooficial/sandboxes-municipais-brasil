// Filtros, busca, ordenação e contagens. Módulo ES puro (sem imports de Node).
import { ESFERAS, STATUS } from './esquema.js';

export function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function textoIndexado(s, temas) {
  const j = s.jurisdicao || {};
  const nomesTemas = (s.temas || []).map((id) => temas.find((t) => t.id === id)?.nome ?? id);
  const docs = (s.documentos || []).flatMap((d) => [d.titulo, d.numero]);
  return normalizar(
    [s.nome, j.municipio, j.uf, j.orgao, ...nomesTemas, s.resumo, ...docs].filter(Boolean).join(' '),
  );
}

export function buscar(sandboxes, termo, temas = []) {
  const tokens = normalizar(termo).split(' ').filter(Boolean);
  if (!tokens.length) return [...sandboxes];
  return sandboxes.filter((s) => {
    const texto = textoIndexado(s, temas);
    return tokens.every((t) => texto.includes(t));
  });
}

export function filtrar(sandboxes, f = {}, temas = []) {
  let r = f.termo ? buscar(sandboxes, f.termo, temas) : [...sandboxes];
  if (f.esfera) r = r.filter((s) => s.esfera === f.esfera);
  if (f.status) r = r.filter((s) => s.status === f.status);
  if (f.regiao) r = r.filter((s) => s.jurisdicao?.regiao === f.regiao);
  if (f.uf) r = r.filter((s) => s.jurisdicao?.uf === f.uf);
  if (f.tema) r = r.filter((s) => (s.temas || []).includes(f.tema));
  if (f.orgao) r = r.filter((s) => s.jurisdicao?.orgao === f.orgao);
  return r;
}

const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');

export function ordenar(lista, chave) {
  const r = [...lista];
  if (chave === 'status') {
    r.sort((a, b) => STATUS.indexOf(a.status) - STATUS.indexOf(b.status) || porNome(a, b));
  } else if (chave === 'ano') {
    r.sort((a, b) => String(b.desde || '').localeCompare(String(a.desde || '')) || porNome(a, b));
  } else {
    r.sort(porNome);
  }
  return r;
}

export function contar(sandboxes) {
  const zeros = (chaves) => Object.fromEntries(chaves.map((k) => [k, 0]));
  const c = {
    total: sandboxes.length,
    porStatus: zeros(STATUS),
    porEsfera: zeros(ESFERAS),
    porStatusEsfera: Object.fromEntries(STATUS.map((st) => [st, zeros(ESFERAS)])),
    porTema: {},
    porUf: {},
  };
  for (const s of sandboxes) {
    if (s.status in c.porStatus) c.porStatus[s.status]++;
    if (s.esfera in c.porEsfera) c.porEsfera[s.esfera]++;
    if (c.porStatusEsfera[s.status]?.[s.esfera] !== undefined) c.porStatusEsfera[s.status][s.esfera]++;
    for (const t of s.temas || []) c.porTema[t] = (c.porTema[t] || 0) + 1;
    const uf = s.jurisdicao?.uf;
    if (uf) c.porUf[uf] = (c.porUf[uf] || 0) + 1;
  }
  return c;
}
