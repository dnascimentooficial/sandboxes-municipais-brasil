// Gaveta de detalhe (spec §4.3 e §4.5). montarGaveta(el, ctx) -> {abrir(id), fechar(), render(estado)}.
//
// A gaveta é desenhada a partir de estado.sandbox (hash #sandbox=<id>): abrir/fechar/↑/↓ só mexem no
// hash via ctx.irPara, e render(estado) abre, troca ou fecha. Enquanto aberta, o resto da página fica
// `inert` e o Tab circula dentro dela; ao fechar, o foco volta ao botão "Ver detalhes" do card.
import { filtrar, ordenar } from '../filtros.js';
import { escapar } from '../formatar.js';
import { conteudoGaveta, faixaSemImagem } from './gaveta-conteudo.js';

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const ID_TITULO = 'gaveta-titulo';

export function montarGaveta(el, ctx) {
  const { temas = [], orgaos = [], sandboxes = [] } = ctx.dados;
  const porId = new Map(sandboxes.map((s) => [s.id, s]));
  const doc = el.ownerDocument;
  const fora = ['hdr', 'layout'].map((id) => doc.getElementById(id)).filter(Boolean);

  const fundo = doc.createElement('div');
  fundo.className = 'gaveta-fundo';
  fundo.hidden = true;
  el.before(fundo);

  el.removeAttribute('aria-label');
  el.setAttribute('aria-labelledby', ID_TITULO);
  el.innerHTML = `
    <div class="gaveta-topo">
      <div class="gv-nav">
        <button type="button" class="icon-btn" data-gv="anterior" aria-label="Sandbox anterior (seta para cima)"><span aria-hidden="true">↑</span></button>
        <button type="button" class="icon-btn" data-gv="proximo" aria-label="Próximo sandbox (seta para baixo)"><span aria-hidden="true">↓</span></button>
        <span class="gv-pos" data-gv-pos></span>
      </div>
      <div class="gv-acoes">
        <button type="button" class="btn-sm" data-gv="copiar">Copiar link</button>
        <button type="button" class="btn-sm primario" data-gv="comparar">Comparar</button>
        <button type="button" class="icon-btn" data-gv="fechar" aria-label="Fechar detalhe"><span aria-hidden="true">✕</span></button>
      </div>
    </div>
    <p class="gv-aviso" data-gv-aviso role="status" aria-live="polite"></p>
    <div class="gaveta-corpo" data-gv-corpo></div>`;
  const q = (sel) => el.querySelector(sel);
  const corpo = q('[data-gv-corpo]');
  const aviso = q('[data-gv-aviso]');
  const btnComparar = q('[data-gv="comparar"]');

  let atual = null; // id exibido
  let ultimo = null; // id para devolver o foco ao fechar
  let origem = null; // elemento focado quando a gaveta abriu

  // Lista filtrada + ordenada atual: a mesma que o Panorama mostra.
  function recorte() {
    const e = ctx.estado();
    return ordenar(filtrar(sandboxes, { ...e.filtros, termo: e.termo }, temas), e.ordem).map((s) => s.id);
  }

  function irPara(id) {
    if (id && porId.has(id)) ctx.irPara({ aba: 'panorama', sandbox: id });
  }

  // Vizinho (↑/↓): substitui a entrada do histórico, para o Voltar fechar a gaveta de uma vez.
  function mover(id) {
    if (id && porId.has(id)) ctx.irPara({ aba: 'panorama', sandbox: id }, { substituir: true });
  }

  function abrir(id) {
    irPara(id);
  }

  function fechar() {
    if (ctx.estado().sandbox) ctx.irPara({ aba: 'panorama', sandbox: null });
  }

  function vizinho(delta) {
    const ids = recorte();
    const i = ids.indexOf(atual);
    if (i < 0) return null;
    return ids[i + delta] ?? null;
  }

  function atualizarNav(e) {
    const ids = recorte();
    const i = ids.indexOf(atual);
    q('[data-gv="anterior"]').disabled = i <= 0;
    q('[data-gv="proximo"]').disabled = i < 0 || i >= ids.length - 1;
    q('[data-gv-pos]').textContent = i < 0 ? '' : `${i + 1} de ${ids.length}`;
    const no = e.comparar.includes(atual);
    btnComparar.textContent = no ? 'Na comparação' : 'Comparar';
  }

  function desenhar(s) {
    corpo.innerHTML = conteudoGaveta(s, { temas, orgaos, idTitulo: ID_TITULO });
    corpo.scrollTop = 0;
    aviso.textContent = '';
    const img = corpo.querySelector('.gv-foto img');
    img?.addEventListener('error', () => {
      const fig = img.closest('.gv-foto');
      if (fig) fig.outerHTML = faixaSemImagem(s, temas);
    }, { once: true });
  }

  function mostrar(aberta) {
    el.hidden = !aberta;
    fundo.hidden = !aberta;
    doc.body.classList.toggle('gaveta-aberta', aberta);
    for (const n of fora) n.inert = aberta;
  }

  function devolverFoco() {
    const alvos = [
      // Aberta pelo acordeão do Âmbito nacional: volta para o item de onde saiu.
      origem?.isConnected && origem.matches('[data-abrir-sandbox]') ? origem : null,
      ultimo && doc.querySelector(`[data-acao="detalhes"][data-id="${CSS.escape(ultimo)}"]`),
      doc.getElementById('lista-titulo'),
      doc.querySelector('[role="tab"][aria-selected="true"]'),
    ];
    for (const a of alvos) {
      if (!a || !a.getClientRects().length) continue;
      if (a.tabIndex < 0 && !a.hasAttribute('tabindex')) a.setAttribute('tabindex', '-1');
      a.focus({ preventScroll: false });
      return;
    }
  }

  function render(e) {
    const id = e.aba === 'panorama' && porId.has(e.sandbox) ? e.sandbox : null;
    if (!id) {
      if (atual) {
        atual = null;
        mostrar(false);
        corpo.innerHTML = '';
        devolverFoco();
      }
      return;
    }
    const trocou = id !== atual;
    const abrindo = !atual;
    atual = id;
    ultimo = id;
    if (abrindo) origem = doc.activeElement;
    if (trocou) desenhar(porId.get(id));
    if (abrindo) mostrar(true);
    atualizarNav(e);
    if (trocou) q(`#${ID_TITULO}`)?.focus({ preventScroll: true });
  }

  async function copiarLink() {
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      aviso.textContent = 'Link copiado.';
    } catch {
      // Fallback: mostra o link selecionado para Ctrl/Cmd+C.
      aviso.innerHTML = `Copie o link: <input type="text" class="gv-link" readonly value="${escapar(url)}" aria-label="Link deste sandbox">`;
      const campo = aviso.querySelector('input');
      campo.focus();
      campo.select();
      try { if (doc.execCommand('copy')) aviso.firstChild.textContent = 'Link copiado (selecionado abaixo): '; } catch { /* sem cópia automática */ }
    }
  }

  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-gv]');
    if (!b || !atual) return;
    const acao = b.dataset.gv;
    if (acao === 'fechar') fechar();
    else if (acao === 'anterior') mover(vizinho(-1));
    else if (acao === 'proximo') mover(vizinho(1));
    else if (acao === 'copiar') copiarLink();
    else if (acao === 'comparar') ctx.pedirComparar(atual);
  });
  fundo.addEventListener('click', fechar);

  doc.addEventListener('keydown', (ev) => {
    if (!atual || el.hidden) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      fechar();
      return;
    }
    if ((ev.key === 'ArrowUp' || ev.key === 'ArrowDown') && !ev.altKey && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) {
      // Só com o foco nos botões ↑/↓ ou no título: no resto da gaveta as setas rolam o conteúdo.
      const t = ev.target;
      if (!(t.closest?.('.gv-nav') || t.id === ID_TITULO)) return;
      const alvo = vizinho(ev.key === 'ArrowUp' ? -1 : 1);
      if (alvo) {
        ev.preventDefault();
        mover(alvo);
      }
      return;
    }
    if (ev.key === 'Tab') {
      const itens = [...el.querySelectorAll(FOCAVEIS)].filter((n) => n.getClientRects().length);
      if (!itens.length) return;
      const primeiro = itens[0];
      const ultimoItem = itens[itens.length - 1];
      const ativo = doc.activeElement;
      if (ev.shiftKey && (ativo === primeiro || !el.contains(ativo))) {
        ev.preventDefault();
        ultimoItem.focus();
      } else if (!ev.shiftKey && (ativo === ultimoItem || !el.contains(ativo))) {
        ev.preventDefault();
        primeiro.focus();
      }
    }
  });
  // Rede de segurança: foco que escapar (ex.: clique fora) volta para a gaveta.
  doc.addEventListener('focusin', (ev) => {
    if (atual && !el.hidden && !el.contains(ev.target) && !ev.target.closest?.('dialog[open]')) {
      q(`#${ID_TITULO}`)?.focus({ preventScroll: true });
    }
  });

  return { abrir, fechar, render };
}
