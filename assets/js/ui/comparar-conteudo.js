// HTML da aba Comparar (spec §4.4). Puro: sem DOM, testável no Node.
// montarComparacao devolve texto puro; tudo é escapado aqui, na hora de renderizar.
import { montarComparacao } from '../comparar.js';
import { buscar, ordenar } from '../filtros.js';
import { escapar, valorOuNaoInformado, textoOuNaoInformado, dataBR, rotulo, urlSegura } from '../formatar.js';
import { seloStatus, jurisdicao } from './cartoes.js';
import { imagemValida, faixaSemImagem, linkExterno } from './gaveta-conteudo.js';

const NAO_INFORMADO = 'não informado';
export const VAZIO = 'Escolha até 3 sandboxes para comparar lado a lado.';
export const MAX_SUGESTOES = 8;

// Sugestões do autocomplete: buscar() + ordem por nome, sem os já escolhidos, no máximo 8.
export function sugestoes(sandboxes, termo, temas, excluir = [], max = MAX_SUGESTOES) {
  const fora = new Set(excluir);
  return ordenar(buscar(sandboxes, termo, temas), 'nome').filter((s) => !fora.has(s.id)).slice(0, max);
}

// <li role="option"> de cada sugestão. `prefixo` gera ids estáveis para aria-activedescendant.
export function opcoesSugestao(lista, { orgaos = [], prefixo, ativo = -1 } = {}) {
  return lista.map((s, i) => {
    const j = jurisdicao(s, orgaos);
    return `<li id="${escapar(prefixo)}-${i}" role="option" aria-selected="${i === ativo}" data-id="${escapar(s.id)}" class="cmp-op">
      <b>${valorOuNaoInformado(s.nome)}</b><span>${escapar(j.local)} · ${escapar(j.sub)}</span></li>`;
  }).join('');
}

function foto(s, temas) {
  if (!imagemValida(s.imagem)) return `<div class="cmp-foto">${faixaSemImagem(s, temas)}</div>`;
  const im = s.imagem;
  const origem = typeof im.origem === 'string' && urlSegura(im.origem) !== '#' ? ` · ${linkExterno(im.origem, 'origem')}` : '';
  return `<figure class="cmp-foto">
    <img src="${escapar(im.arquivo)}" alt="" decoding="async" loading="lazy">
    <figcaption>Foto: ${valorOuNaoInformado(im.credito)} · ${valorOuNaoInformado(im.licenca)}${origem}</figcaption>
  </figure>`;
}

function cabecalho(s, temas, orgaos) {
  const j = jurisdicao(s, orgaos);
  const nome = valorOuNaoInformado(s.nome);
  return `<th scope="col" class="cmp-col" data-id="${escapar(s.id)}">
    ${foto(s, temas)}
    <div class="cmp-col-cab">
      <div class="cmp-col-nome"><b>${nome}</b><span>${escapar(j.local)}</span></div>
      <button type="button" class="icon-btn" data-remover="${escapar(s.id)}" aria-label="Remover ${nome} da comparação"><span aria-hidden="true">×</span></button>
    </div>
    <div class="cmp-col-selo">${seloStatus(s.status)}</div>
  </th>`;
}

// Documentos: valor JSON de montarComparacao -> lista "tipo nº — título (data)" com links seguros.
export function documentosHtml(json) {
  let docs;
  try {
    docs = JSON.parse(json);
  } catch {
    return NAO_INFORMADO;
  }
  if (!Array.isArray(docs) || !docs.length) return NAO_INFORMADO;
  return `<ul class="cmp-docs">${docs.map((d) => {
    const numero = d?.numero ? ` nº ${d.numero}` : '';
    const data = d?.data ? ` (${dataBR(d.data)})` : '';
    const texto = `${rotulo('tipoDoc', d?.tipo ?? null)}${numero} — ${textoOuNaoInformado(d?.titulo)}${data}`;
    return `<li>${linkExterno(d?.url, texto)}</li>`;
  }).join('')}</ul>`;
}

function classeLinha(linha, n) {
  if (n < 2) return '';
  return linha.iguais ? 'linha-igual' : 'linha-difere';
}

function linhaHtml(linha, n) {
  const classe = classeLinha(linha, n);
  const marca = classe === 'linha-igual' ? '<span class="sr-only"> (igual em todos)</span>'
    : classe === 'linha-difere' ? '<span class="sr-only"> (difere)</span>' : '';
  const celulas = linha.valores.map((v) => `<td>${linha.chave === 'documentos' ? documentosHtml(v) : escapar(v)}</td>`).join('');
  return `<tr${classe ? ` class="${classe}"` : ''} data-chave="${escapar(linha.chave)}"><th scope="row">${escapar(linha.rotulo)}${marca}</th>${celulas}</tr>`;
}

// Tabela completa. Uma coluna por sandbox; rótulos em <th scope="row"> (fixos na rolagem horizontal).
export function tabelaComparacao(sandboxes, { temas = [], orgaos = [] } = {}) {
  const n = sandboxes.length;
  const { grupos } = montarComparacao(sandboxes, { temas, orgaos });
  const corpos = grupos.map((g) => `<tbody>
    <tr class="cmp-grupo"><th scope="colgroup" colspan="${n + 1}"><span>${escapar(g.titulo)}</span></th></tr>
    ${g.linhas.map((l) => linhaHtml(l, n)).join('')}
  </tbody>`).join('');
  const legenda = n >= 2
    ? `<p class="cmp-legenda"><span class="cmp-leg-item"><span class="cmp-leg difere"></span>Destacadas: valores diferentes</span><span class="cmp-leg-item"><span class="cmp-leg igual"></span>Atenuadas: iguais em todos</span></p>`
    : '<p class="cmp-legenda">Adicione outro sandbox para ver as diferenças.</p>';
  return `${legenda}
  <div class="cmp-rolagem" tabindex="0" role="region" aria-label="Tabela comparativa (role na horizontal se necessário)">
    <table class="cmp-tabela cmp-n${n}">
      <caption class="sr-only">Comparação lado a lado de ${n} ${n === 1 ? 'sandbox' : 'sandboxes'}</caption>
      <thead><tr><th scope="col" class="cmp-canto"><span class="sr-only">Campo</span></th>${sandboxes.map((s) => cabecalho(s, temas, orgaos)).join('')}</tr></thead>
      ${corpos}
    </table>
  </div>`;
}

// Aviso quando o "Comparar" chega com 3 já escolhidos.
export function avisoSubstituir(pendente, escolhidos) {
  const botoes = escolhidos.map((s, i) => `<button type="button" class="btn-sm" data-substituir="${i}">${valorOuNaoInformado(s.nome)}</button>`).join('');
  return `<div class="cmp-aviso" role="group" aria-labelledby="cmp-aviso-tit">
    <p class="cmp-aviso-tit" id="cmp-aviso-tit" tabindex="-1">Escolha qual substituir</p>
    <p>A comparação já tem 3 sandboxes. <b>${valorOuNaoInformado(pendente?.nome)}</b> entra no lugar de:</p>
    <div class="cmp-aviso-acoes">${botoes}<button type="button" class="btn-sm cmp-cancelar" data-cancelar>Cancelar</button></div>
  </div>`;
}
