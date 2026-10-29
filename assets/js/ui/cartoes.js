// HTML dos cards da lista e pequenos selos reutilizáveis. Todo dado passa por escapar().
import { escapar, rotulo } from '../formatar.js';
import { STATUS } from '../esquema.js';
import { UF_NOME } from './mapa.js';

const NAO_INFORMADO = 'não informado';

// Cor de tema vinda dos dados: só hexadecimal, senão usa o neutro do CSS.
export function corSegura(cor) {
  return typeof cor === 'string' && /^#[0-9a-f]{3,8}$/i.test(cor) ? cor : null;
}

export function seloStatus(status) {
  const classe = STATUS.includes(status) ? ` st-${status}` : ' outline';
  return `<span class="badge${classe}"><span class="bdot" aria-hidden="true"></span>${escapar(rotulo('status', status))}</span>`;
}

export function chipsTemas(ids, temas) {
  if (!Array.isArray(ids) || !ids.length) return '<span class="tema-chip sem">sem eixo definido</span>';
  return ids.map((id) => {
    const t = temas.find((x) => x.id === id);
    const cor = corSegura(t?.cor);
    const estilo = cor ? ` style="background:${cor}"` : '';
    const ico = t?.icone ? `<span aria-hidden="true">${escapar(t.icone)}</span>` : '';
    return `<span class="tema-chip"${estilo}>${ico}${escapar(t?.nome ?? id)}</span>`;
  }).join('');
}

// {sigla, local, sub} — texto puro, quem usa escapa.
export function jurisdicao(s, orgaos) {
  const j = s.jurisdicao ?? {};
  const esfera = rotulo('esfera', s.esfera);
  if (s.esfera === 'federal') {
    const o = (orgaos ?? []).find((x) => x.sigla === j.orgao);
    return { sigla: j.orgao || '?', local: o?.nome || j.orgao || NAO_INFORMADO, sub: `${esfera} · ${j.orgao || NAO_INFORMADO}` };
  }
  const regiao = j.regiao || NAO_INFORMADO;
  if (s.esfera === 'municipal') {
    const local = j.municipio && j.uf ? `${j.municipio}/${j.uf}` : j.municipio || j.uf || NAO_INFORMADO;
    return { sigla: j.uf || '?', local, sub: `${esfera} · ${regiao}` };
  }
  return { sigla: j.uf || '?', local: UF_NOME[j.uf] || j.uf || NAO_INFORMADO, sub: `${esfera} · ${regiao}` };
}

const TESTADAS = new Set(['em_teste', 'concluida', 'encerrada']);
export function solucoesTestadas(s) {
  const n = (Array.isArray(s.solucoes) ? s.solucoes : []).filter((x) => TESTADAS.has(x?.status)).length;
  return n ? `<b>${n}</b> ${n === 1 ? 'solução testada' : 'soluções testadas'}` : 'Nenhuma solução testada documentada';
}

export function cartao(s, { temas, orgaos, noComparar }) {
  const j = jurisdicao(s, orgaos);
  const nome = escapar(s.nome || NAO_INFORMADO);
  const id = escapar(s.id);
  const novo = s.recem_adicionado ? '<span class="badge novo">Recém adicionado</span>' : '';
  return `<article class="sb-card" data-id="${id}">
  <div class="sb-card-top">
    <span class="av" aria-hidden="true">${escapar(j.sigla)}</span>
    <div class="sb-card-loc"><b>${escapar(j.local)}</b><span>${escapar(j.sub)}</span></div>
  </div>
  <div class="sb-card-selos">${seloStatus(s.status)}${novo}</div>
  <h3>${nome}</h3>
  <p class="sb-card-resumo">${escapar(s.resumo || NAO_INFORMADO)}</p>
  <div class="sb-card-temas">${chipsTemas(s.temas, temas)}</div>
  <div class="sb-card-foot">
    <span class="sb-card-sol">${solucoesTestadas(s)}</span>
    <div class="sb-card-acoes">
      <button type="button" class="btn-sm" data-acao="detalhes" data-id="${id}" aria-label="Ver detalhes: ${nome}">Ver detalhes</button>
      <button type="button" class="btn-sm primario" data-acao="comparar" data-id="${id}" aria-pressed="${noComparar ? 'true' : 'false'}" aria-label="${noComparar ? 'Na comparação' : 'Comparar'}: ${nome}">${noComparar ? 'Na comparação' : 'Comparar'}</button>
    </div>
  </div>
</article>`;
}
