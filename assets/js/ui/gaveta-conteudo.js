// HTML do corpo da gaveta de detalhe (spec §4.3). Puro: sem DOM, testável no Node.
// Todo dado passa por escapar(); toda URL vinda dos dados passa por escapar(urlSegura(u)).
import { escapar, valorOuNaoInformado, textoOuNaoInformado, dataBR, rotulo, urlSegura } from '../formatar.js';
import { seloStatus, chipsTemas, jurisdicao, corSegura } from './cartoes.js';

const NAO_INFORMADO = 'não informado';
const IMAGEM_LOCAL = /^img\/[a-z0-9-]+\.(jpg|jpeg|png|webp|svg)$/;
const ROTULO_EDITAL = { aberto: 'Aberto', encerrado: 'Encerrado' };

const lista = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
const temTexto = (v) => typeof v === 'string' && v.trim() !== '';

// Link externo seguro. `texto` é texto puro (escapado aqui). URL não http(s) vira só texto.
export function linkExterno(url, texto) {
  const u = urlSegura(url);
  if (u === '#') return escapar(texto);
  return `<a href="${escapar(u)}" target="_blank" rel="noopener">${escapar(texto)}</a>`;
}

function hostDe(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'fonte';
  }
}

// Ruling R10: só imagem local com nome controlado; o resto vira "sem imagem".
export function imagemValida(imagem) {
  return Boolean(imagem && typeof imagem.arquivo === 'string' && IMAGEM_LOCAL.test(imagem.arquivo));
}

export function faixaSemImagem(s, temas) {
  const t = (temas ?? []).find((x) => x.id === s.temas?.[0]);
  const cor = corSegura(t?.cor);
  const ico = t?.icone ? `<span class="gv-faixa-ico" aria-hidden="true">${escapar(t.icone)}</span>` : '';
  return `<div class="gv-faixa"${cor ? ` style="background:${cor}"` : ''}>${ico}</div>`;
}

function foto(s, temas) {
  if (!imagemValida(s.imagem)) return faixaSemImagem(s, temas);
  const im = s.imagem;
  const origem = temTexto(im.origem) && urlSegura(im.origem) !== '#'
    ? linkExterno(im.origem, hostDe(im.origem))
    : NAO_INFORMADO;
  return `<figure class="gv-foto">
    <img src="${escapar(im.arquivo)}" alt="" decoding="async">
    <figcaption>Foto: ${valorOuNaoInformado(im.credito)} · ${valorOuNaoInformado(im.licenca)} · ${origem}</figcaption>
  </figure>`;
}

function paragrafos(texto) {
  if (!temTexto(texto)) return `<p>${NAO_INFORMADO}</p>`;
  return texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${escapar(p)}</p>`).join('');
}

function secao(titulo, corpo, extraClasse = '') {
  return `<section class="gv-sec${extraClasse}"><h3>${escapar(titulo)}</h3>${corpo}</section>`;
}

const vazio = (texto) => `<p class="gv-vazio">${escapar(texto)}</p>`;

function funcionamento(s) {
  const prazo = Number.isFinite(s.prazo_teste_meses) && s.prazo_teste_meses > 0
    ? `${s.prazo_teste_meses} ${s.prazo_teste_meses === 1 ? 'mês' : 'meses'}`
    : NAO_INFORMADO;
  const flexs = Array.isArray(s.flexibilizacoes) ? s.flexibilizacoes.filter(temTexto) : [];
  const linhas = [
    ['Gestor', valorOuNaoInformado(s.gestor)],
    ['Ingresso', escapar(rotulo('ingresso', s.ingresso || null))],
    ['Prazo de teste', escapar(prazo)],
    ['Elegibilidade', valorOuNaoInformado(s.elegibilidade)],
    ['Flexibilizações', flexs.length ? `<ul>${flexs.map((f) => `<li>${escapar(f)}</li>`).join('')}</ul>` : NAO_INFORMADO],
  ];
  return `<dl class="gv-dl">${linhas.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}

// "dd/mm/aaaa – dd/mm/aaaa" a partir de inicio/fim (texto puro).
export function periodo(inicio, fim) {
  const i = inicio ? dataBR(inicio) : null;
  const f = fim ? dataBR(fim) : null;
  if (i && f) return `${i} – ${f}`;
  if (i) return `desde ${i}`;
  if (f) return `até ${f}`;
  return NAO_INFORMADO;
}

function solucoes(s) {
  const itens = lista(s.solucoes);
  if (!itens.length) return vazio('nenhuma documentada');
  return `<ul class="gv-itens">${itens.map((x) => `<li>
    <div class="gv-item-top"><b>${valorOuNaoInformado(x.nome)}</b><span class="badge outline">${escapar(rotulo('statusSolucao', x.status ?? null))}</span></div>
    ${temTexto(x.descricao) ? `<p>${escapar(x.descricao)}</p>` : ''}
    <dl class="gv-mini">
      <div><dt>Proponente</dt><dd>${valorOuNaoInformado(x.proponente)}</dd></div>
      <div><dt>Período</dt><dd>${escapar(periodo(x.inicio, x.fim))}</dd></div>
      <div><dt>Fonte</dt><dd>${temTexto(x.fonte) ? linkExterno(x.fonte, hostDe(x.fonte)) : NAO_INFORMADO}</dd></div>
    </dl>
  </li>`).join('')}</ul>`;
}

function editais(s) {
  const itens = lista(s.editais);
  if (!itens.length) return vazio('nenhum');
  return `<ul class="gv-itens">${itens.map((x) => {
    const st = ROTULO_EDITAL[x.status] ?? textoOuNaoInformado(x.status);
    const datas = x.abertura || x.encerramento ? `<p class="gv-meta">${escapar(periodo(x.abertura, x.encerramento))}</p>` : '';
    const titulo = temTexto(x.url) ? linkExterno(x.url, textoOuNaoInformado(x.titulo)) : valorOuNaoInformado(x.titulo);
    return `<li><div class="gv-item-top"><b>${titulo}</b><span class="badge${x.status === 'aberto' ? ' st-ativo' : ' outline'}">${escapar(st)}</span></div>${datas}</li>`;
  }).join('')}</ul>`;
}

function documentos(s) {
  const itens = lista(s.documentos);
  if (!itens.length) return vazio(NAO_INFORMADO);
  return `<ul class="gv-docs">${itens.map((d) => {
    const meta = [rotulo('tipoDoc', d.tipo ?? null), d.numero ? `nº ${d.numero}` : null, d.data ? dataBR(d.data) : null].filter(Boolean).join(' · ');
    const titulo = temTexto(d.url) ? linkExterno(d.url, textoOuNaoInformado(d.titulo)) : valorOuNaoInformado(d.titulo);
    const principal = d.principal ? ' <span class="badge novo">Principal</span>' : '';
    return `<li><span class="gv-meta">${escapar(meta)}</span><span>${titulo}${principal}</span></li>`;
  }).join('')}</ul>`;
}

function linhaDoTempo(s) {
  const itens = lista(s.historico).slice().sort((a, b) => String(b.data ?? '').localeCompare(String(a.data ?? '')));
  if (!itens.length) return vazio('sem registros');
  return `<ol class="gv-tempo">${itens.map((h) => `<li>
    <span class="gv-meta">${escapar(dataBR(h.data))}</span>
    <p>${valorOuNaoInformado(h.descricao)}${temTexto(h.fonte) ? ` · ${linkExterno(h.fonte, 'fonte')}` : ''}</p>
  </li>`).join('')}</ol>`;
}

function fontes(s) {
  const itens = lista(s.fontes);
  if (!itens.length) return vazio(NAO_INFORMADO);
  return `<ul class="gv-fontes">${itens.map((f) => `<li>
    ${linkExterno(f.url, temTexto(f.titulo) ? f.titulo : hostDe(f.url))}
    <span class="gv-meta">acessado em ${escapar(dataBR(f.acessado_em))}</span>
  </li>`).join('')}</ul>`;
}

// Corpo completo, na ordem da spec §4.3. `idTitulo` liga o h2 ao aria-labelledby da gaveta.
export function conteudoGaveta(s, { temas = [], orgaos = [], idTitulo = 'gaveta-titulo' } = {}) {
  const j = jurisdicao(s, orgaos);
  return `${foto(s, temas)}
  <header class="gv-cab">
    <h2 id="${escapar(idTitulo)}" tabindex="-1">${valorOuNaoInformado(s.nome)}</h2>
    <p class="gv-jur"><b>${escapar(j.local)}</b> · ${escapar(j.sub)}</p>
    <div class="gv-selos">${seloStatus(s.status)}<span class="gv-desde">Desde ${escapar(dataBR(s.desde))}</span></div>
    <div class="sb-card-temas">${chipsTemas(s.temas, temas)}</div>
  </header>
  ${secao('Descrição', paragrafos(s.descricao), ' gv-texto')}
  ${secao('Funcionamento', funcionamento(s))}
  ${secao('Soluções testadas', solucoes(s))}
  ${secao('Editais', editais(s))}
  ${secao('Documentação publicada', documentos(s))}
  ${secao('Linha do tempo', linhaDoTempo(s))}
  ${secao('Links de confirmação', fontes(s))}
  <footer class="gv-rodape">Verificado em ${escapar(dataBR(s.verificado_em))} · ID ${escapar(s.id)}</footer>`;
}
