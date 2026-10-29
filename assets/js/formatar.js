// Formatação segura. Tudo que vai para innerHTML deve passar por escapar().
import { ROTULOS } from './esquema.js';

const NAO_INFORMADO = 'não informado';
const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapar(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, (c) => ENTIDADES[c]);
}

// Versão sem escape, para quem escapa na hora de renderizar.
export function textoOuNaoInformado(v) {
  if (v === null || v === undefined || v === '') return NAO_INFORMADO;
  if (Array.isArray(v)) return v.length === 0 ? NAO_INFORMADO : v.map(String).join(' · ');
  return String(v);
}

export function valorOuNaoInformado(v) {
  return escapar(textoOuNaoInformado(v));
}

export function dataBR(iso) {
  if (typeof iso !== 'string') return NAO_INFORMADO;
  if (/^\d{4}$/.test(iso)) return iso;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return NAO_INFORMADO;
  const [, a, me, d] = m;
  const dt = new Date(Date.UTC(Number(a), Number(me) - 1, Number(d)));
  if (dt.getUTCFullYear() !== Number(a) || dt.getUTCMonth() !== Number(me) - 1 || dt.getUTCDate() !== Number(d)) {
    return NAO_INFORMADO;
  }
  return `${d}/${me}/${a}`;
}

export function rotulo(tipo, valor) {
  if (valor === null || valor === undefined) return NAO_INFORMADO;
  const tabela = Object.hasOwn(ROTULOS, tipo) ? ROTULOS[tipo] : null;
  if (tabela && Object.hasOwn(tabela, valor)) return tabela[valor];
  return String(valor);
}

export function temasTexto(ids, temas) {
  if (!Array.isArray(ids) || ids.length === 0) return 'sem eixo definido';
  const porId = new Map((temas ?? []).map((t) => [t.id, t.nome]));
  return ids.map((id) => porId.get(id) ?? id).join(' · ');
}

// Só deixa passar URLs absolutas http(s). Qualquer outra coisa vira '#'.
// O resultado ainda precisa de escapar() ao entrar num atributo.
export function urlSegura(u) {
  if (typeof u !== 'string' || !u) return '#';
  try {
    const url = new URL(u);
    return url.protocol === 'http:' || url.protocol === 'https:' ? u : '#';
  } catch {
    return '#';
  }
}
